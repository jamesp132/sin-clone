"""AgentHub configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
DATABASE_PATH: str = os.getenv("DATABASE_PATH", "/data/agenthub.db")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "claude-sonnet-4-20250514")
ADVANCED_MODEL: str = os.getenv("ADVANCED_MODEL", "claude-opus-4-20250514")
MAX_TOKENS: int = int(os.getenv("MAX_TOKENS", "4096"))
WORKSPACE_PATH: str = os.getenv("WORKSPACE_PATH", "/workspace")
