"""Apply pass 5 — additive routes.

Adds:
  - Task dependencies (CRUD over `task_dependencies` table created on demand).
  - Approval queue (CRUD over `approvals` table created on demand).

All schema changes go through ``CREATE TABLE IF NOT EXISTS`` via raw SQL — no
SQLAlchemy model definitions are added, so models.py is unchanged.

PRODUCT-DECISION: dependencies are (task_id, depends_on_task_id) pairs; cycle
detection is not enforced at write time (left to caller). Approvals are
single-step (one approver per record); multi-step approvals can be added by
appending more rows.

No required env vars.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User

router = APIRouter(prefix="/api/extras", tags=["extras"])


def _ensure_schema(db: Session) -> None:
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS task_dependencies (
            id SERIAL PRIMARY KEY,
            task_id VARCHAR NOT NULL,
            depends_on_task_id VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(task_id, depends_on_task_id)
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS approvals (
            id SERIAL PRIMARY KEY,
            workflow_run_id VARCHAR,
            requester_id VARCHAR NOT NULL,
            approver_id VARCHAR,
            subject TEXT NOT NULL,
            payload JSONB DEFAULT '{}'::jsonb,
            status VARCHAR(20) DEFAULT 'pending',
            decision_note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            decided_at TIMESTAMP
        )
    """))
    db.commit()


@router.get("/task-dependencies")
def list_task_dependencies(
    task_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_schema(db)
    if task_id:
        result = db.execute(text(
            "SELECT * FROM task_dependencies WHERE task_id = :tid OR depends_on_task_id = :tid ORDER BY id DESC"
        ), {"tid": task_id}).mappings().all()
    else:
        result = db.execute(text("SELECT * FROM task_dependencies ORDER BY id DESC LIMIT 200")).mappings().all()
    return {"dependencies": [dict(r) for r in result]}


@router.post("/task-dependencies", status_code=201)
async def add_task_dependency(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON body required")
    task_id = body.get("task_id")
    depends_on_task_id = body.get("depends_on_task_id")
    if not task_id or not depends_on_task_id:
        raise HTTPException(status_code=400, detail="task_id and depends_on_task_id are required")
    if task_id == depends_on_task_id:
        raise HTTPException(status_code=400, detail="A task cannot depend on itself")
    _ensure_schema(db)
    db.execute(text(
        "INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (:t, :d) ON CONFLICT DO NOTHING"
    ), {"t": task_id, "d": depends_on_task_id})
    db.commit()
    return {"task_id": task_id, "depends_on_task_id": depends_on_task_id}


@router.delete("/task-dependencies/{dep_id}")
def remove_task_dependency(
    dep_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_schema(db)
    res = db.execute(text("DELETE FROM task_dependencies WHERE id = :id RETURNING id"), {"id": dep_id}).fetchone()
    db.commit()
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": dep_id}


@router.get("/approvals")
def list_approvals(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_schema(db)
    if status:
        result = db.execute(text(
            "SELECT * FROM approvals WHERE status = :s ORDER BY created_at DESC LIMIT 200"
        ), {"s": status}).mappings().all()
    else:
        result = db.execute(text("SELECT * FROM approvals ORDER BY created_at DESC LIMIT 200")).mappings().all()
    return {"approvals": [dict(r) for r in result]}


@router.post("/approvals", status_code=201)
async def create_approval(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON body required")
    subject = body.get("subject")
    if not subject:
        raise HTTPException(status_code=400, detail="subject is required")
    _ensure_schema(db)
    res = db.execute(text(
        """INSERT INTO approvals (workflow_run_id, requester_id, approver_id, subject, payload)
           VALUES (:wf, :req, :app, :subj, CAST(:pl AS jsonb)) RETURNING id, status, created_at"""
    ), {
        "wf": body.get("workflow_run_id"),
        "req": current_user.id,
        "app": body.get("approver_id"),
        "subj": subject,
        "pl": json.dumps(body.get("payload") or {}),
    }).mappings().first()
    db.commit()
    return dict(res) if res else {"created": True}


@router.post("/approvals/{approval_id}/decide")
async def decide_approval(
    approval_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="JSON body required")
    decision = body.get("decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be 'approved' or 'rejected'")
    _ensure_schema(db)
    res = db.execute(text(
        """UPDATE approvals SET status = :s, decision_note = :note, decided_at = NOW()
           WHERE id = :id RETURNING id, status, decided_at"""
    ), {"id": approval_id, "s": decision, "note": body.get("decision_note")}).mappings().first()
    db.commit()
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
    return dict(res)
