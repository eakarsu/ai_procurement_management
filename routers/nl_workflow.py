"""Natural-language workflow creation (prose -> automation).

Accepts a description and produces a workflow DSL skeleton. v0 returns a
heuristic-parsed skeleton; production would call the LLM in routers/ai.py.
"""
import os
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User

router = APIRouter(prefix="/api/nl-workflow", tags=["nl-workflow"])


class NLWorkflowRequest(BaseModel):
    description: str
    name: Optional[str] = None


def _extract_steps(description: str) -> list[dict]:
    # crude heuristic: split on sequence cues; production would use the LLM
    parts = re.split(r"(?:\bthen\b|\bnext\b|->|,|\.|\n)", description, flags=re.I)
    steps = []
    for i, p in enumerate(parts):
        p = p.strip()
        if not p or len(p) < 4:
            continue
        steps.append({
            "id": f"step_{i+1}",
            "name": p[:60],
            "type": "task" if "task" in p.lower() else "action",
        })
    return steps[:20]


@router.post("/generate")
def generate(req: NLWorkflowRequest,
             db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    if not req.description or len(req.description) < 5:
        raise HTTPException(status_code=400, detail="description too short")

    steps = _extract_steps(req.description)
    # TODO: invoke LLM (anthropic client in routers/ai.py) for richer DSL
    return {
        "name": req.name or "Generated Workflow",
        "steps": steps,
        "source": "heuristic_v0",
        "llm_available": bool(os.getenv("ANTHROPIC_API_KEY")),
    }
