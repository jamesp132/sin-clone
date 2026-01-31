"""Pydantic models for AgentHub API."""

from typing import Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    agent: Optional[str] = None
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
    task_id: int
    status: str
    conversation_id: int


class AgentStatus(BaseModel):
    name: str
    status: str
    current_task: Optional[str] = None


class WebSocketMessage(BaseModel):
    type: str
    data: dict
