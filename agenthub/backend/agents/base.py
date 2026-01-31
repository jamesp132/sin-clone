"""Base agent class for all AgentHub agents."""

import logging
from typing import Optional, Callable, Awaitable, List, Dict, Any

import anthropic

from config import ANTHROPIC_API_KEY, DEFAULT_MODEL, MAX_TOKENS

logger = logging.getLogger(__name__)


class BaseAgent:
    """Base class for all specialized agents."""

    name: str = "Base"
    role: str = "Generic Agent"
    persona: str = "A helpful AI assistant."
    tools: List[str] = []
    color: str = "#6B7280"
    can_delegate_to: List[str] = []
    temperature: float = 0.7

    def __init__(self) -> None:
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.conversation_history: List[Dict[str, str]] = []
        self.status: str = "idle"
        self.current_task: Optional[str] = None
        self._manager: Any = None

    def set_manager(self, manager: Any) -> None:
        """Set reference to the orchestrator manager for delegation."""
        self._manager = manager

    def _build_system_prompt(self) -> str:
        """Build the full system prompt including persona and delegation instructions."""
        parts = [self.persona]
        if self.can_delegate_to:
            delegate_list = ", ".join(self.can_delegate_to)
            parts.append(
                f"\n\nYou can delegate tasks to these agents: {delegate_list}. "
                "To delegate, use this exact format on its own line:\n"
                "[DELEGATE to AgentName]: Task description\n\n"
                "Only delegate when a task is clearly better suited to another agent's expertise. "
                "Always explain your plan before delegating."
            )
        if self.tools:
            tool_list = ", ".join(self.tools)
            parts.append(f"\n\nYou have access to these tools: {tool_list}")
        return "\n".join(parts)

    async def chat(
        self,
        message: str,
        on_token: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> str:
        """Send a message and stream the response.

        Args:
            message: The user message to process.
            on_token: Optional async callback invoked for each streamed token.

        Returns:
            The full response text.
        """
        self.status = "thinking"
        self.current_task = message[:100]

        self.conversation_history.append({"role": "user", "content": message})

        full_response = ""
        try:
            with self.client.messages.stream(
                model=DEFAULT_MODEL,
                max_tokens=MAX_TOKENS,
                temperature=self.temperature,
                system=self._build_system_prompt(),
                messages=self.conversation_history,
            ) as stream:
                for text in stream.text_stream:
                    full_response += text
                    if on_token:
                        await on_token(text)

            self.conversation_history.append(
                {"role": "assistant", "content": full_response}
            )
        except anthropic.APIConnectionError as e:
            logger.error("API connection error for %s: %s", self.name, e)
            full_response = f"I'm having trouble connecting to the AI service. Please check your API key and network connection. Error: {e}"
        except anthropic.RateLimitError as e:
            logger.error("Rate limit hit for %s: %s", self.name, e)
            full_response = "I've hit the API rate limit. Please wait a moment and try again."
        except anthropic.APIStatusError as e:
            logger.error("API error for %s: %s", self.name, e)
            full_response = f"An API error occurred: {e.message}"
        except Exception as e:
            logger.exception("Unexpected error in %s.chat", self.name)
            full_response = f"An unexpected error occurred: {e}"
        finally:
            self.status = "idle"
            self.current_task = None

        return full_response

    async def delegate(self, to_agent: str, task: str) -> str:
        """Delegate a task to another agent via the manager.

        Args:
            to_agent: Name of the agent to delegate to.
            task: Description of the task to delegate.

        Returns:
            The result from the delegated agent.
        """
        if self._manager is None:
            return f"Cannot delegate: no manager configured for {self.name}"
        if to_agent not in self.can_delegate_to:
            return f"Cannot delegate to {to_agent}: not in allowed delegation list"
        return await self._manager.delegate_task(
            from_agent=self.name,
            to_agent=to_agent,
            task=task,
        )

    def clear_history(self) -> None:
        """Clear this agent's conversation history."""
        self.conversation_history.clear()

    def get_status(self) -> Dict[str, Any]:
        """Get current agent status information."""
        return {
            "name": self.name,
            "role": self.role,
            "color": self.color,
            "status": self.status,
            "current_task": self.current_task,
            "tools": self.tools,
            "can_delegate_to": self.can_delegate_to,
            "history_length": len(self.conversation_history),
        }
