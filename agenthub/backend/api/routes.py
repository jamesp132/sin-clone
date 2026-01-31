"""API routes for AgentHub."""

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query

from db.models import ChatRequest, ChatResponse
from db.database import get_db
from orchestrator.memory import MemoryManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# These will be set by main.py after AgentManager is created
_manager = None
_memory = MemoryManager()


def set_manager(manager: Any) -> None:
    """Inject the AgentManager instance."""
    global _manager
    _manager = manager


def _get_manager():
    if _manager is None:
        raise HTTPException(status_code=503, detail="Agent manager not initialized")
    return _manager


# ── Chat ──────────────────────────────────────────────────────────────────────


@router.post("/chat", response_model=None)
async def chat(request: ChatRequest) -> Dict[str, Any]:
    """Process a chat message through the agent system."""
    manager = _get_manager()
    result = await manager.process_message(
        message=request.message,
        agent_name=request.agent,
        conversation_id=request.conversation_id,
    )
    return result


# ── Agents ────────────────────────────────────────────────────────────────────


@router.get("/agents")
async def get_agents() -> List[Dict[str, Any]]:
    """Get status of all agents."""
    manager = _get_manager()
    agents = manager.get_all_agents()
    return [a.dict() for a in agents]


@router.get("/agent/{name}")
async def get_agent(name: str) -> Dict[str, Any]:
    """Get details and history for a specific agent."""
    manager = _get_manager()
    details = manager.get_agent_details(name)
    if details is None:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")

    # Get recent messages from this agent
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, conversation_id, content, created_at FROM messages "
            "WHERE agent_name = ? ORDER BY created_at DESC LIMIT 50",
            (name,),
        )
        details["recent_messages"] = [
            {
                "id": row[0],
                "conversation_id": row[1],
                "content": row[2][:200],
                "created_at": row[3],
            }
            for row in rows
        ]
    finally:
        await db.close()

    return details


@router.post("/agent/{name}/chat")
async def agent_direct_chat(name: str, request: ChatRequest) -> Dict[str, Any]:
    """Chat directly with a specific agent, bypassing the Coordinator."""
    manager = _get_manager()
    if name not in manager.agents:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")

    result = await manager.process_message(
        message=request.message,
        agent_name=name,
        conversation_id=request.conversation_id,
    )
    return result


# ── Tasks ─────────────────────────────────────────────────────────────────────


@router.get("/tasks")
async def get_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    """Get paginated list of tasks."""
    db = await get_db()
    try:
        query = "SELECT id, conversation_id, parent_task_id, description, assigned_agent, status, result, created_at, completed_at FROM tasks"
        params: list = []

        if status:
            query += " WHERE status = ?"
            params.append(status)

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = await db.execute_fetchall(query, params)
        tasks = [
            {
                "id": row[0],
                "conversation_id": row[1],
                "parent_task_id": row[2],
                "description": row[3],
                "assigned_agent": row[4],
                "status": row[5],
                "result": row[6][:200] if row[6] else None,
                "created_at": row[7],
                "completed_at": row[8],
            }
            for row in rows
        ]

        # Get total count
        count_query = "SELECT COUNT(*) FROM tasks"
        count_params: list = []
        if status:
            count_query += " WHERE status = ?"
            count_params.append(status)
        count_row = await db.execute_fetchall(count_query, count_params)
        total = count_row[0][0] if count_row else 0

        return {"tasks": tasks, "total": total, "limit": limit, "offset": offset}
    finally:
        await db.close()


@router.get("/task/{task_id}")
async def get_task(task_id: int) -> Dict[str, Any]:
    """Get full task details including delegations."""
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, conversation_id, parent_task_id, description, assigned_agent, "
            "status, result, created_at, completed_at FROM tasks WHERE id = ?",
            (task_id,),
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Task not found")

        row = rows[0]
        task = {
            "id": row[0],
            "conversation_id": row[1],
            "parent_task_id": row[2],
            "description": row[3],
            "assigned_agent": row[4],
            "status": row[5],
            "result": row[6],
            "created_at": row[7],
            "completed_at": row[8],
        }

        # Get delegations for this task
        delegation_rows = await db.execute_fetchall(
            "SELECT id, from_agent, to_agent, reason, created_at "
            "FROM delegations WHERE task_id = ? ORDER BY created_at",
            (task_id,),
        )
        task["delegations"] = [
            {
                "id": d[0],
                "from_agent": d[1],
                "to_agent": d[2],
                "reason": d[3],
                "created_at": d[4],
            }
            for d in delegation_rows
        ]

        # Get subtasks
        subtask_rows = await db.execute_fetchall(
            "SELECT id, description, assigned_agent, status, created_at, completed_at "
            "FROM tasks WHERE parent_task_id = ? ORDER BY created_at",
            (task_id,),
        )
        task["subtasks"] = [
            {
                "id": s[0],
                "description": s[1],
                "assigned_agent": s[2],
                "status": s[3],
                "created_at": s[4],
                "completed_at": s[5],
            }
            for s in subtask_rows
        ]

        return task
    finally:
        await db.close()


# ── Conversations ─────────────────────────────────────────────────────────────


@router.get("/conversations")
async def get_conversations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    """Get recent conversations."""
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, title, created_at, updated_at FROM conversations "
            "ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        conversations = [
            {
                "id": row[0],
                "title": row[1],
                "created_at": row[2],
                "updated_at": row[3],
            }
            for row in rows
        ]

        count_row = await db.execute_fetchall("SELECT COUNT(*) FROM conversations")
        total = count_row[0][0] if count_row else 0

        return {"conversations": conversations, "total": total}
    finally:
        await db.close()


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: int) -> Dict[str, Any]:
    """Get full conversation with all messages."""
    db = await get_db()
    try:
        conv_rows = await db.execute_fetchall(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
            (conversation_id,),
        )
        if not conv_rows:
            raise HTTPException(status_code=404, detail="Conversation not found")

        row = conv_rows[0]
        conversation = {
            "id": row[0],
            "title": row[1],
            "created_at": row[2],
            "updated_at": row[3],
        }

        msg_rows = await db.execute_fetchall(
            "SELECT id, role, agent_name, content, tokens_used, created_at "
            "FROM messages WHERE conversation_id = ? ORDER BY created_at",
            (conversation_id,),
        )
        conversation["messages"] = [
            {
                "id": m[0],
                "role": m[1],
                "agent_name": m[2],
                "content": m[3],
                "tokens_used": m[4],
                "created_at": m[5],
            }
            for m in msg_rows
        ]

        return conversation
    finally:
        await db.close()


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int) -> Dict[str, str]:
    """Delete a conversation and all related data."""
    db = await get_db()
    try:
        # Check existence
        rows = await db.execute_fetchall(
            "SELECT id FROM conversations WHERE id = ?", (conversation_id,)
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Conversation not found")

        await db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        await db.commit()
        return {"status": "deleted"}
    finally:
        await db.close()


# ── Memory ────────────────────────────────────────────────────────────────────


@router.post("/memory")
async def add_memory(
    fact: str,
    importance: int = 5,
    conversation_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Add a fact to long-term memory."""
    fact_id = await _memory.add_fact(
        fact=fact,
        source_conversation_id=conversation_id,
        importance=importance,
    )
    return {"id": fact_id, "status": "stored"}


@router.get("/memory/search")
async def search_memory(q: str = Query(..., min_length=1)) -> Dict[str, Any]:
    """Search long-term memory."""
    facts = await _memory.search_facts(q)
    return {"query": q, "results": facts, "count": len(facts)}


# ── Settings ──────────────────────────────────────────────────────────────────


@router.get("/settings")
async def get_settings() -> Dict[str, str]:
    """Get all settings."""
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT key, value FROM settings")
        return {row[0]: row[1] for row in rows}
    finally:
        await db.close()


@router.put("/settings")
async def update_settings(settings: Dict[str, str]) -> Dict[str, str]:
    """Update settings (upsert)."""
    db = await get_db()
    try:
        for key, value in settings.items():
            await db.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )
        await db.commit()
        return {"status": "updated", "count": str(len(settings))}
    finally:
        await db.close()


# ── Health ────────────────────────────────────────────────────────────────────


@router.get("/health")
async def health() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
