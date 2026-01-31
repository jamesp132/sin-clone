from agents.coordinator import CoordinatorAgent
from agents.researcher import ResearcherAgent
from agents.writer import WriterAgent
from agents.editor import EditorAgent
from agents.coder import CoderAgent
from agents.code_reviewer import CodeReviewerAgent
from agents.analyst import AnalystAgent
from agents.sysadmin import SysadminAgent
from agents.creative import CreativeAgent
from agents.planner import PlannerAgent
from agents.assistant import AssistantAgent

ALL_AGENTS = {
    "Coordinator": CoordinatorAgent,
    "Researcher": ResearcherAgent,
    "Writer": WriterAgent,
    "Editor": EditorAgent,
    "Coder": CoderAgent,
    "CodeReviewer": CodeReviewerAgent,
    "Analyst": AnalystAgent,
    "Sysadmin": SysadminAgent,
    "Creative": CreativeAgent,
    "Planner": PlannerAgent,
    "Assistant": AssistantAgent,
}

__all__ = [
    "ALL_AGENTS",
    "CoordinatorAgent",
    "ResearcherAgent",
    "WriterAgent",
    "EditorAgent",
    "CoderAgent",
    "CodeReviewerAgent",
    "AnalystAgent",
    "SysadminAgent",
    "CreativeAgent",
    "PlannerAgent",
    "AssistantAgent",
]
