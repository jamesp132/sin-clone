"""Agent Manager - orchestrates agent interactions, delegation, and task management."""

import re
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from fastapi import WebSocket

from agents import ALL_AGENTS
from agents.base import BaseAgent
from db.database import get_db

logger = logging.getLogger(__name__)

DELEGATE_PATTERN = re.compile(r"\[DELEGATE to (\w+)\]:\s*(.+)", re.IGNORECASE)


class AgentManager:
    """Manages all agent instances, task routing, and WebSocket broadcasting."""

    def __init__(self) -> None:
        self.agents: Dict[str, BaseAgent] = {}
        self.active_tasks: Dict[int, Dict[str, Any]] = {}
        self.websocket_connections: List[WebSocket] = []
        self._initialize_agents()

    def _initialize_agents(self) -> None:
        """Create instances of all agents and wire up manager references."""
        for name, agent_cls in ALL_AGENTS.items():
            agent = agent_cls()
            agent.set_manager(self)
            self.agents[name] = agent
        logger.info("Initialized %d agents: %s", len(self.agents), list(self.agents.keys()))

    async def process_message(
        self,
        message: str,
        agent_name: Optional[str] = None,
        conversation_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Process a user message by routing to the appropriate agent.

        Args:
            message: The user's message.
            agent_name: Optional specific agent to route to (defaults to Coordinator).
            conversation_id: Optional existing conversation to continue.

        Returns:
            Dict with task_id, status, conversation_id, and response.
        """
        db = await get_db()
        try:
            # Create or continue conversation
            if conversation_id is None:
                title = message[:80] + ("..." if len(message) > 80 else "")
                cursor = await db.execute(
                    "INSERT INTO conversations (title) VALUES (?)", (title,)
                )
                conversation_id = cursor.lastrowid
                await db.commit()

            # Save user message
            await db.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
                (conversation_id, "user", message),
            )
            await db.commit()

            # Select agent
            target_agent = agent_name or "Coordinator"
            if target_agent not in self.agents:
                target_agent = "Coordinator"

            agent = self.agents[target_agent]

            # Create task
            cursor = await db.execute(
                "INSERT INTO tasks (conversation_id, description, assigned_agent, status) "
                "VALUES (?, ?, ?, ?)",
                (conversation_id, message[:200], target_agent, "in_progress"),
            )
            task_id = cursor.lastrowid
            await db.commit()

            self.active_tasks[task_id] = {
                "agent": target_agent,
                "status": "in_progress",
                "started_at": datetime.utcnow().isoformat(),
            }

            # Broadcast thinking status
            await self._broadcast({
                "type": "agent_thinking",
                "data": {"agent": target_agent, "task_id": task_id},
            })

            # Stream response
            full_response = ""

            async def on_token(token: str) -> None:
                nonlocal full_response
                full_response += token
                await self._broadcast({
                    "type": "agent_response",
                    "data": {
                        "agent": target_agent,
                        "token": token,
                        "task_id": task_id,
                        "conversation_id": conversation_id,
                    },
                })

            # Reset full_response since chat() builds it internally
            full_response = ""
            response = await agent.chat(message, on_token=on_token)
            full_response = response

            # Broadcast completion
            await self._broadcast({
                "type": "agent_complete",
                "data": {
                    "agent": target_agent,
                    "task_id": task_id,
                    "conversation_id": conversation_id,
                },
            })

            # Check for delegation patterns in the response
            delegation_results = await self._process_delegations(
                response, target_agent, task_id, conversation_id, db
            )

            # Compile final response
            if delegation_results:
                compiled = response + "\n\n---\n\n"
                for dr in delegation_results:
                    compiled += f"**{dr['agent']}** responded:\n\n{dr['response']}\n\n---\n\n"
                full_response = compiled.rstrip("\n-")

            # Save assistant message
            await db.execute(
                "INSERT INTO messages (conversation_id, role, agent_name, content) "
                "VALUES (?, ?, ?, ?)",
                (conversation_id, "assistant", target_agent, full_response),
            )

            # Update task status
            await db.execute(
                "UPDATE tasks SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP "
                "WHERE id = ?",
                ("complete", full_response[:1000], task_id),
            )
            await db.commit()

            # Update conversation timestamp
            await db.execute(
                "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (conversation_id,),
            )
            await db.commit()

            self.active_tasks.pop(task_id, None)

            await self._broadcast({
                "type": "task_update",
                "data": {
                    "task_id": task_id,
                    "status": "complete",
                    "agent": target_agent,
                },
            })

            return {
                "task_id": task_id,
                "status": "complete",
                "conversation_id": conversation_id,
                "response": full_response,
                "agent": target_agent,
            }

        except Exception as e:
            logger.exception("Error processing message")
            await self._broadcast({
                "type": "error",
                "data": {"message": str(e)},
            })
            return {
                "task_id": 0,
                "status": "error",
                "conversation_id": conversation_id or 0,
                "response": f"Error processing message: {e}",
                "agent": agent_name or "Coordinator",
            }
        finally:
            await db.close()

    async def _process_delegations(
        self,
        response: str,
        from_agent: str,
        parent_task_id: int,
        conversation_id: int,
        db: Any,
    ) -> List[Dict[str, Any]]:
        """Parse delegation patterns from response and execute them.

        Returns:
            List of delegation result dicts with agent name and response.
        """
        results = []
        matches = DELEGATE_PATTERN.findall(response)

        for to_agent_name, task_description in matches:
            if to_agent_name not in self.agents:
                logger.warning("Delegation to unknown agent: %s", to_agent_name)
                continue

            result = await self.delegate_task(
                from_agent=from_agent,
                to_agent=to_agent_name,
                task=task_description,
                parent_task_id=parent_task_id,
                conversation_id=conversation_id,
            )
            results.append({"agent": to_agent_name, "response": result})

        return results

    async def delegate_task(
        self,
        from_agent: str,
        to_agent: str,
        task: str,
        parent_task_id: Optional[int] = None,
        conversation_id: Optional[int] = None,
    ) -> str:
        """Handle agent-to-agent delegation.

        Args:
            from_agent: Name of the delegating agent.
            to_agent: Name of the target agent.
            task: Task description.
            parent_task_id: Optional parent task for hierarchy.
            conversation_id: The conversation this belongs to.

        Returns:
            The response from the delegated agent.
        """
        if to_agent not in self.agents:
            return f"Agent '{to_agent}' not found."

        agent = self.agents[to_agent]

        db = await get_db()
        try:
            # Create subtask
            cursor = await db.execute(
                "INSERT INTO tasks (conversation_id, parent_task_id, description, "
                "assigned_agent, status) VALUES (?, ?, ?, ?, ?)",
                (conversation_id, parent_task_id, task[:200], to_agent, "in_progress"),
            )
            subtask_id = cursor.lastrowid

            # Record delegation
            await db.execute(
                "INSERT INTO delegations (task_id, from_agent, to_agent, reason) "
                "VALUES (?, ?, ?, ?)",
                (subtask_id, from_agent, to_agent, task[:500]),
            )
            await db.commit()

            # Broadcast delegation event
            await self._broadcast({
                "type": "delegation",
                "data": {
                    "from_agent": from_agent,
                    "to_agent": to_agent,
                    "task": task[:200],
                    "task_id": subtask_id,
                },
            })

            # Broadcast thinking
            await self._broadcast({
                "type": "agent_thinking",
                "data": {"agent": to_agent, "task_id": subtask_id},
            })

            # Execute delegation
            async def on_token(token: str) -> None:
                await self._broadcast({
                    "type": "agent_response",
                    "data": {
                        "agent": to_agent,
                        "token": token,
                        "task_id": subtask_id,
                        "conversation_id": conversation_id,
                    },
                })

            response = await agent.chat(task, on_token=on_token)

            # Save to messages
            await db.execute(
                "INSERT INTO messages (conversation_id, role, agent_name, content) "
                "VALUES (?, ?, ?, ?)",
                (conversation_id, "assistant", to_agent, response),
            )

            # Update subtask
            await db.execute(
                "UPDATE tasks SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP "
                "WHERE id = ?",
                ("complete", response[:1000], subtask_id),
            )
            await db.commit()

            # Broadcast completion
            await self._broadcast({
                "type": "agent_complete",
                "data": {
                    "agent": to_agent,
                    "task_id": subtask_id,
                    "conversation_id": conversation_id,
                },
            })

            return response

        except Exception as e:
            logger.exception("Error in delegation from %s to %s", from_agent, to_agent)
            return f"Delegation error: {e}"
        finally:
            await db.close()

    async def _broadcast(self, message: dict) -> None:
        """Send a message to all connected WebSocket clients."""
        disconnected = []
        payload = json.dumps(message)

        for ws in self.websocket_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                disconnected.append(ws)

        for ws in disconnected:
            self.websocket_connections.remove(ws)

    async def broadcast_status(self) -> None:
        """Send current status of all agents to all WebSocket connections."""
        statuses = self.get_all_agents()
        await self._broadcast({
            "type": "status_update",
            "data": {"agents": [s.dict() for s in statuses]},
        })

    def get_all_agents(self) -> List[Any]:
        """Get status of all agents."""
        from db.models import AgentStatus
        result = []
        for agent in self.agents.values():
            result.append(AgentStatus(
                name=agent.name,
                status=agent.status,
                current_task=agent.current_task,
            ))
        return result

    def get_agent_details(self, name: str) -> Optional[Dict[str, Any]]:
        """Get detailed info about a specific agent."""
        agent = self.agents.get(name)
        if agent is None:
            return None
        return agent.get_status()
