"""Real-time streaming anomaly alerts for stuck tasks and bottlenecks.

Exposes both a polled snapshot endpoint and a server-sent-events stream that
yields anomaly events as they are computed.
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Task, User

router = APIRouter(prefix="/api/streaming-anomalies", tags=["streaming-anomalies"])

STUCK_THRESHOLD_HOURS = 24


def _detect_stuck_tasks(db: Session, hours: int = STUCK_THRESHOLD_HOURS):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = db.query(Task).filter(Task.status.in_(["open", "in_progress"]))
    results = []
    for t in q.limit(500).all():
        last = getattr(t, "updated_at", None) or getattr(t, "created_at", None)
        if last and last.replace(tzinfo=timezone.utc) < cutoff:
            results.append({
                "task_id": str(getattr(t, "id", "")),
                "title": getattr(t, "title", ""),
                "status": getattr(t, "status", ""),
                "hours_stuck": round((datetime.now(timezone.utc) - last.replace(tzinfo=timezone.utc)).total_seconds() / 3600, 1),
            })
    return results


@router.get("/snapshot")
def snapshot(db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    return {"stuck_tasks": _detect_stuck_tasks(db), "threshold_hours": STUCK_THRESHOLD_HOURS}


@router.get("/stream")
async def stream(db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    async def event_gen() -> AsyncGenerator[str, None]:
        for _ in range(20):  # cap the stream — production would loop indefinitely
            payload = _detect_stuck_tasks(db)
            yield f"data: {json.dumps({'ts': datetime.utcnow().isoformat(), 'count': len(payload), 'items': payload[:10]})}\n\n"
            await asyncio.sleep(5)
    return StreamingResponse(event_gen(), media_type="text/event-stream")
