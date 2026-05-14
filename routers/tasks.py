import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Task, User
from rate_limiter import general_limiter, get_client_ip
from schemas import (
    TaskCreate, TaskOut, TaskUpdate,
    PaginatedTasks, BulkTaskUpdate,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_task_or_404(task_id: str, user: User, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=PaginatedTasks)
def list_tasks(
    request: Request,
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search task titles"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    q = db.query(Task).filter(Task.user_id == current_user.id)
    if status:
        q = q.filter(Task.status == status)
    if priority:
        q = q.filter(Task.priority == priority)
    if search:
        q = q.filter(Task.title.ilike(f"%{search}%"))

    total = q.count()
    items = q.order_by(Task.due_date.asc().nullslast()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedTasks(
        items=[TaskOut.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    request: Request,
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    task = Task(user_id=current_user.id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    request: Request,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    return TaskOut.model_validate(_get_task_or_404(task_id, current_user, db))


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    request: Request,
    task_id: str,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    task = _get_task_or_404(task_id, current_user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    request: Request,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    general_limiter.check(get_client_ip(request))
    task = _get_task_or_404(task_id, current_user, db)
    db.delete(task)
    db.commit()


@router.post("/bulk-update", response_model=dict)
def bulk_update_tasks(
    request: Request,
    payload: BulkTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk update status, priority, or assigned_to for multiple tasks."""
    general_limiter.check(get_client_ip(request))
    tasks = db.query(Task).filter(
        Task.id.in_(payload.task_ids),
        Task.user_id == current_user.id,
    ).all()

    updates = {k: v for k, v in {
        "status": payload.status,
        "priority": payload.priority,
        "assigned_to": payload.assigned_to,
    }.items() if v is not None}

    updated_count = 0
    for task in tasks:
        for field, value in updates.items():
            setattr(task, field, value)
        updated_count += 1

    db.commit()
    return {"updated": updated_count, "requested": len(payload.task_ids)}


@router.delete("/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_tasks(
    request: Request,
    payload: BulkTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk delete multiple tasks."""
    general_limiter.check(get_client_ip(request))
    deleted = db.query(Task).filter(
        Task.id.in_(payload.task_ids),
        Task.user_id == current_user.id,
    ).delete(synchronize_session="fetch")
    db.commit()
    return {"deleted": deleted}
