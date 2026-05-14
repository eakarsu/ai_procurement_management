"""Mobile companion app endpoints — minimal API surface for tasks, approvals,
and push-notification registration.

This is a thin wrapper over existing models to keep payloads mobile-friendly.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Task, User

router = APIRouter(prefix="/api/mobile", tags=["mobile-companion"])


class DeviceRegistration(BaseModel):
    device_token: str
    platform: str  # "ios" | "android"


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


@router.post("/register-device")
def register_device(reg: DeviceRegistration,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    if reg.platform not in {"ios", "android"}:
        raise HTTPException(status_code=400, detail="platform must be ios or android")
    # TODO: persist to DevicePushToken model and integrate with APNs/FCM
    return {
        "registered": True,
        "user_id": str(getattr(current_user, "id", "")),
        "platform": reg.platform,
        "note": "Stub: wire APNs/FCM and DevicePushToken model.",
    }


@router.get("/my-tasks")
def my_tasks(limit: int = 25,
             db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    q = db.query(Task)
    assignee_attr = "assigned_to_id" if hasattr(Task, "assigned_to_id") else "assignee_id"
    if hasattr(Task, assignee_attr):
        q = q.filter(getattr(Task, assignee_attr) == getattr(current_user, "id", None))
    tasks = q.limit(min(limit, 100)).all()
    return {
        "tasks": [
            {
                "id": str(getattr(t, "id", "")),
                "title": getattr(t, "title", ""),
                "status": getattr(t, "status", ""),
                "priority": getattr(t, "priority", None),
            }
            for t in tasks
        ]
    }


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, body: TaskUpdate,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="task not found")
    if body.status and hasattr(t, "status"):
        t.status = body.status
    if body.notes and hasattr(t, "notes"):
        t.notes = body.notes
    db.commit()
    return {"updated": True, "task_id": task_id}
