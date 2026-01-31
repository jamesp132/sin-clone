"""WebSocket endpoint for real-time agent communication."""

import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# Will be set by main.py
_manager = None


def set_manager(manager: Any) -> None:
    """Inject the AgentManager instance."""
    global _manager
    _manager = manager


async def websocket_endpoint(websocket: WebSocket) -> None:
    """Handle WebSocket connections for real-time updates.

    Events sent to clients:
        - agent_thinking: An agent has started processing
        - agent_response: Streaming token from an agent
        - agent_complete: An agent has finished processing
        - delegation: Task delegated from one agent to another
        - task_update: Task status changed
        - status_update: All agent statuses
        - error: Error occurred

    Events received from clients:
        - chat: Process a new message
        - get_status: Request agent statuses
        - ping: Keep-alive
    """
    await websocket.accept()

    if _manager is None:
        await websocket.send_text(json.dumps({
            "type": "error",
            "data": {"message": "Agent manager not initialized"},
        }))
        await websocket.close()
        return

    _manager.websocket_connections.append(websocket)
    logger.info(
        "WebSocket connected. Total connections: %d",
        len(_manager.websocket_connections),
    )

    # Send initial status
    try:
        agents = _manager.get_all_agents()
        await websocket.send_text(json.dumps({
            "type": "status_update",
            "data": {"agents": [a.dict() for a in agents]},
        }))
    except Exception as e:
        logger.error("Error sending initial status: %s", e)

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "data": {"message": "Invalid JSON"},
                }))
                continue

            msg_type = message.get("type", "")
            data = message.get("data", {})

            if msg_type == "chat":
                # Process chat message asynchronously
                user_message = data.get("message", "")
                agent_name = data.get("agent")
                conversation_id = data.get("conversation_id")

                if not user_message:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "data": {"message": "Empty message"},
                    }))
                    continue

                try:
                    result = await _manager.process_message(
                        message=user_message,
                        agent_name=agent_name,
                        conversation_id=conversation_id,
                    )
                    await websocket.send_text(json.dumps({
                        "type": "chat_complete",
                        "data": result,
                    }))
                except Exception as e:
                    logger.exception("Error processing WebSocket chat")
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "data": {"message": str(e)},
                    }))

            elif msg_type == "get_status":
                agents = _manager.get_all_agents()
                await websocket.send_text(json.dumps({
                    "type": "status_update",
                    "data": {"agents": [a.dict() for a in agents]},
                }))

            elif msg_type == "ping":
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "data": {},
                }))

            else:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "data": {"message": f"Unknown message type: {msg_type}"},
                }))

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.exception("WebSocket error")
    finally:
        if websocket in _manager.websocket_connections:
            _manager.websocket_connections.remove(websocket)
        logger.info(
            "WebSocket cleaned up. Remaining connections: %d",
            len(_manager.websocket_connections),
        )
