"""Memory manager for long-term fact storage and conversation context."""

import logging
from typing import List, Dict, Optional, Any

from db.database import get_db

logger = logging.getLogger(__name__)


class MemoryManager:
    """Manages long-term memory storage and retrieval."""

    def __init__(self) -> None:
        self.max_context_tokens = 3000  # Rough token estimate for context window

    async def add_fact(
        self,
        fact: str,
        source_conversation_id: Optional[int] = None,
        importance: int = 5,
    ) -> int:
        """Store a fact in long-term memory.

        Args:
            fact: The fact to remember.
            source_conversation_id: The conversation this fact came from.
            importance: Priority level 1-10 (10 = most important).

        Returns:
            The ID of the stored fact.
        """
        db = await get_db()
        try:
            cursor = await db.execute(
                "INSERT INTO memory (fact, source_conversation_id, importance) "
                "VALUES (?, ?, ?)",
                (fact, source_conversation_id, min(max(importance, 1), 10)),
            )
            await db.commit()
            fact_id = cursor.lastrowid
            logger.info("Stored memory fact #%d (importance=%d)", fact_id, importance)
            return fact_id
        finally:
            await db.close()

    async def search_facts(
        self,
        query: str,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Search stored facts by keyword matching.

        Args:
            query: Search query string.
            limit: Maximum number of results.

        Returns:
            List of matching fact dicts.
        """
        db = await get_db()
        try:
            # Simple keyword search — split query into words, match any
            words = query.lower().split()
            if not words:
                return []

            conditions = " OR ".join(["LOWER(fact) LIKE ?" for _ in words])
            params = [f"%{w}%" for w in words]
            params.append(limit)

            rows = await db.execute_fetchall(
                f"SELECT id, fact, source_conversation_id, importance, created_at "
                f"FROM memory WHERE {conditions} "
                f"ORDER BY importance DESC, created_at DESC LIMIT ?",
                params,
            )

            return [
                {
                    "id": row[0],
                    "fact": row[1],
                    "source_conversation_id": row[2],
                    "importance": row[3],
                    "created_at": row[4],
                }
                for row in rows
            ]
        finally:
            await db.close()

    async def get_conversation_context(
        self,
        conversation_id: int,
        max_messages: int = 20,
    ) -> List[Dict[str, str]]:
        """Get recent messages from a conversation for context.

        Args:
            conversation_id: The conversation to retrieve.
            max_messages: Maximum number of messages to return.

        Returns:
            List of message dicts with role, agent_name, and content.
        """
        db = await get_db()
        try:
            rows = await db.execute_fetchall(
                "SELECT role, agent_name, content FROM messages "
                "WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
                (conversation_id, max_messages),
            )

            # Reverse to get chronological order
            messages = [
                {
                    "role": row[0],
                    "agent_name": row[1],
                    "content": row[2],
                }
                for row in reversed(rows)
            ]
            return messages
        finally:
            await db.close()

    async def summarize_if_needed(
        self,
        conversation_history: List[Dict[str, str]],
    ) -> List[Dict[str, str]]:
        """Compress conversation history if it exceeds the token limit.

        Uses a simple heuristic: ~4 chars per token. If estimated tokens exceed
        the max, keep the first message (system context) and the most recent messages.

        Args:
            conversation_history: Full conversation history.

        Returns:
            Potentially trimmed conversation history.
        """
        if not conversation_history:
            return conversation_history

        # Estimate total tokens (~4 chars per token)
        total_chars = sum(len(m.get("content", "")) for m in conversation_history)
        estimated_tokens = total_chars // 4

        if estimated_tokens <= self.max_context_tokens:
            return conversation_history

        # Keep first message and trim from the middle
        result = []
        if conversation_history:
            result.append(conversation_history[0])

        # Add a summary marker
        trimmed_count = 0
        remaining_budget = self.max_context_tokens * 4  # Convert back to chars
        remaining_budget -= len(conversation_history[0].get("content", ""))

        # Walk backward from the end, adding messages until budget exhausted
        recent_messages = []
        for msg in reversed(conversation_history[1:]):
            msg_len = len(msg.get("content", ""))
            if remaining_budget - msg_len > 0:
                recent_messages.insert(0, msg)
                remaining_budget -= msg_len
            else:
                trimmed_count += 1

        if trimmed_count > 0:
            result.append({
                "role": "system",
                "content": f"[{trimmed_count} earlier messages omitted for context length]",
            })

        result.extend(recent_messages)
        logger.info(
            "Compressed history: %d messages -> %d messages (%d trimmed)",
            len(conversation_history),
            len(result),
            trimmed_count,
        )
        return result

    async def get_all_facts(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all stored facts with pagination.

        Args:
            limit: Max facts to return.
            offset: Offset for pagination.

        Returns:
            List of fact dicts.
        """
        db = await get_db()
        try:
            rows = await db.execute_fetchall(
                "SELECT id, fact, source_conversation_id, importance, created_at "
                "FROM memory ORDER BY importance DESC, created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            return [
                {
                    "id": row[0],
                    "fact": row[1],
                    "source_conversation_id": row[2],
                    "importance": row[3],
                    "created_at": row[4],
                }
                for row in rows
            ]
        finally:
            await db.close()
