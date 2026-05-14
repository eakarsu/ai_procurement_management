"""
Workflow Template Library — pre-built workflow templates users can instantiate.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User, Workflow, WorkflowTemplate
from rate_limiter import general_limiter, get_client_ip
from schemas import WorkflowTemplateOut, WorkflowOut

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[WorkflowTemplateOut])
def list_templates(
    request: Request,
    category: str = Query(None, description="Filter by category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all available workflow templates (public)."""
    general_limiter.check(get_client_ip(request))
    q = db.query(WorkflowTemplate)
    if category:
        q = q.filter(WorkflowTemplate.category == category)
    templates = q.order_by(WorkflowTemplate.name).all()
    return [WorkflowTemplateOut.model_validate(t) for t in templates]


@router.get("/{template_id}", response_model=WorkflowTemplateOut)
def get_template(
    request: Request,
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    general_limiter.check(get_client_ip(request))
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return WorkflowTemplateOut.model_validate(template)


@router.post("/{template_id}/instantiate", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
def instantiate_template(
    request: Request,
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new Workflow from a template."""
    general_limiter.check(get_client_ip(request))
    template = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    wf = Workflow(
        user_id=current_user.id,
        name=f"{template.name} (from template)",
        description=template.description,
        trigger_type=template.trigger_type,
        trigger_config=template.trigger_config or {},
        steps=template.steps or [],
    )
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return WorkflowOut.model_validate(wf)
