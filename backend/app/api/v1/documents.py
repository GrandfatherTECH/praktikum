from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db_session
from app.models.acknowledgement import Acknowledgement
from app.models.approval_step import ApprovalStep
from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.document import Document
from app.models.document_file import DocumentFile
from app.models.enums import (
    AcknowledgementStatus,
    ApprovalStatus,
    DocumentFileKind,
    DocumentStatus,
    DocumentType,
    UserRole,
)
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.document import (
    ApproveDocumentRequest,
    AuditLogRead,
    DocumentGenerateResponse,
    DocumentRead,
    DocumentSection,
    GenerateExtractRequest,
    IncomingCreate,
    InstructionCreate,
    InstructionUpdate,
    OrderCreate,
    OrderUpdate,
    ResolutionCreate,
    ReturnForRevisionRequest,
    SendForAcknowledgementRequest,
    SendForApprovalRequest,
    SendInstructionRequest,
)
from app.services.audit import create_audit_log
from app.services.document_generation import document_generation_service
from app.services.document_permissions import (
    build_allowed_actions,
    can_download_file,
    can_edit_document,
    current_waiting_step,
    ensure_document_visible,
    requires_action,
)

router = APIRouter(prefix="/documents", tags=["documents"])
incoming_router = APIRouter(prefix="/incoming", tags=["incoming"])
resolution_router = APIRouter(prefix="/resolutions", tags=["resolutions"])
audit_router = APIRouter(prefix="/audit", tags=["audit"])


def _document_query():
    return (
        select(Document)
        .options(
            selectinload(Document.author),
            selectinload(Document.department),
            selectinload(Document.files),
            selectinload(Document.approval_steps).selectinload(ApprovalStep.approver),
            selectinload(Document.acknowledgements).selectinload(Acknowledgement.user),
        )
        .order_by(Document.created_at.desc(), Document.id.desc())
    )


async def _get_document_or_404(db: AsyncSession, document_id: int) -> Document:
    result = await db.execute(_document_query().where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


def _document_to_read(document: Document, current_user: User) -> DocumentRead:
    payload = DocumentRead.model_validate(document)
    payload.allowed_actions = build_allowed_actions(current_user, document)
    payload.requires_action = requires_action(current_user, document)
    return payload


async def _ensure_department_exists(db: AsyncSession, department_id: int | None) -> None:
    if department_id is None:
        return
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")


async def _ensure_users_exist(db: AsyncSession, user_ids: list[int]) -> list[User]:
    if not user_ids:
        return []
    result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = result.scalars().all()
    if len(users) != len(set(user_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more users not found")
    by_id = {item.id: item for item in users}
    return [by_id[user_id] for user_id in user_ids]


async def _collect_department_user_ids(db: AsyncSession, department_ids: list[int]) -> list[int]:
    if not department_ids:
        return []
    result = await db.execute(select(User.id).where(User.department_id.in_(department_ids), User.is_active.is_(True)))
    return [row[0] for row in result.all()]


async def _replace_acknowledgements(db: AsyncSession, document: Document, user_ids: list[int]) -> None:
    await db.execute(delete(Acknowledgement).where(Acknowledgement.document_id == document.id))
    unique_ids = list(dict.fromkeys(user_ids))
    for user_id in unique_ids:
        db.add(Acknowledgement(document_id=document.id, user_id=user_id, status=AcknowledgementStatus.PENDING))
    await db.flush()


async def _replace_approval_steps(db: AsyncSession, document: Document, approver_ids: list[int]) -> None:
    await db.execute(delete(ApprovalStep).where(ApprovalStep.document_id == document.id))
    unique_ids = list(dict.fromkeys(approver_ids))
    for index, approver_id in enumerate(unique_ids, start=1):
        step_status = ApprovalStatus.WAITING if index == 1 else ApprovalStatus.PENDING
        db.add(
            ApprovalStep(
                document_id=document.id,
                step_order=index,
                approver_id=approver_id,
                status=step_status,
            )
        )
    await db.flush()


def _request_meta(request: Request) -> tuple[str | None, str | None]:
    return (request.client.host if request.client else None, request.headers.get("user-agent"))


def _document_base_fields(payload) -> dict:
    return {
        "title": payload.title,
        "department_id": payload.department_id,
        "registered_number": payload.registered_number,
        "registered_date": payload.registered_date,
        "document_date": payload.document_date,
        "city": payload.city,
        "organization_name": payload.organization_name,
        "signer_position": payload.signer_position,
        "signer_name": payload.signer_name,
        "executor_name": payload.executor_name,
        "executor_phone": payload.executor_phone,
    }


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    section: DocumentSection = Query(default="all"),
    document_type: DocumentType | None = Query(default=None, alias="type"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[DocumentRead]:
    query = _document_query()
    if document_type is not None:
        query = query.where(Document.type == document_type)

    if current_user.role not in {UserRole.ADMIN, UserRole.CHIEF}:
        filters = [Document.author_id == current_user.id]
        if current_user.role == UserRole.DEPARTMENT_HEAD and current_user.department_id:
            filters.append(Document.department_id == current_user.department_id)
        query = query.where(
            or_(
                *filters,
                Document.id.in_(select(ApprovalStep.document_id).where(ApprovalStep.approver_id == current_user.id)),
                Document.id.in_(select(Acknowledgement.document_id).where(Acknowledgement.user_id == current_user.id)),
            )
        )

    if section == "new":
        query = query.where(Document.status == DocumentStatus.DRAFT)
    elif section == "current":
        query = query.where(Document.status.not_in([DocumentStatus.DRAFT, DocumentStatus.ARCHIVED]))
    elif section == "mine":
        query = query.where(Document.author_id == current_user.id)
    elif section == "archive":
        query = query.where(Document.status == DocumentStatus.ARCHIVED)

    result = await db.execute(query)
    documents = result.scalars().unique().all()
    visible = [document for document in documents if True]
    return [_document_to_read(document, current_user) for document in visible]


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    ensure_document_visible(current_user, document)
    return _document_to_read(document, current_user)


@router.post("/orders", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    await _ensure_department_exists(db, payload.department_id)
    await _ensure_users_exist(db, payload.structured_data.approval_people + payload.structured_data.acknowledgement_people)
    document = Document(
        type=DocumentType.ORDER,
        status=DocumentStatus.DRAFT,
        author_id=current_user.id,
        structured_data=payload.structured_data.model_dump(mode="json"),
        **_document_base_fields(payload),
    )
    db.add(document)
    await db.flush()
    await _replace_acknowledgements(db, document, payload.structured_data.acknowledgement_people)

    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="order.created",
        entity_type="document",
        entity_id=document.id,
        after={"type": document.type.value, "title": document.title},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.patch("/orders/{document_id}", response_model=DocumentRead)
async def update_order(
    document_id: int,
    payload: OrderUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.ORDER:
        raise HTTPException(status_code=400, detail="Document is not an order")
    if not can_edit_document(current_user, document):
        raise HTTPException(status_code=403, detail="Document cannot be edited")

    data = payload.model_dump(exclude_unset=True)
    if "department_id" in data:
        await _ensure_department_exists(db, data["department_id"])
    if payload.structured_data is not None:
        await _ensure_users_exist(
            db,
            payload.structured_data.approval_people + payload.structured_data.acknowledgement_people,
        )
        document.structured_data = payload.structured_data.model_dump(mode="json")
        await _replace_acknowledgements(db, document, payload.structured_data.acknowledgement_people)
        data.pop("structured_data", None)

    before = {"status": document.status.value, "title": document.title}
    for key, value in data.items():
        setattr(document, key, value)

    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="order.updated",
        entity_type="document",
        entity_id=document.id,
        before=before,
        after={"status": document.status.value, "title": document.title},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/orders/{document_id}/generate", response_model=DocumentGenerateResponse)
async def generate_order(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentGenerateResponse:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.ORDER:
        raise HTTPException(status_code=400, detail="Document is not an order")
    if not can_edit_document(current_user, document):
        raise HTTPException(status_code=403, detail="Document cannot be generated")
    await document_generation_service.generate_order_docx(db, document, current_user)
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="order.generated",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return DocumentGenerateResponse(message="Order files generated", document=_document_to_read(document, current_user))


@router.post("/orders/{document_id}/send-for-approval", response_model=DocumentRead)
async def send_order_for_approval(
    document_id: int,
    payload: SendForApprovalRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.ORDER:
        raise HTTPException(status_code=400, detail="Document is not an order")
    if not can_edit_document(current_user, document):
        raise HTTPException(status_code=403, detail="Document cannot be sent for approval")
    await _ensure_users_exist(db, payload.approver_ids)
    await _replace_approval_steps(db, document, payload.approver_ids)
    await document_generation_service.generate_order_docx(db, document, current_user)
    document.status = DocumentStatus.ON_APPROVAL
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="order.sent_for_approval",
        entity_type="document",
        entity_id=document.id,
        after={"approver_ids": payload.approver_ids},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/instructions", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_instruction(
    payload: InstructionCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    await _ensure_department_exists(db, payload.department_id)
    await _ensure_users_exist(db, payload.structured_data.participants + payload.structured_data.acknowledgement_people)
    document = Document(
        type=DocumentType.INSTRUCTION,
        status=DocumentStatus.DRAFT,
        author_id=current_user.id,
        structured_data=payload.structured_data.model_dump(mode="json"),
        **_document_base_fields(payload),
    )
    db.add(document)
    await db.flush()
    await _replace_acknowledgements(db, document, payload.structured_data.acknowledgement_people)
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="instruction.created",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.patch("/instructions/{document_id}", response_model=DocumentRead)
async def update_instruction(
    document_id: int,
    payload: InstructionUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.INSTRUCTION:
        raise HTTPException(status_code=400, detail="Document is not an instruction")
    if not can_edit_document(current_user, document):
        raise HTTPException(status_code=403, detail="Document cannot be edited")
    data = payload.model_dump(exclude_unset=True)
    if "department_id" in data:
        await _ensure_department_exists(db, data["department_id"])
    if payload.structured_data is not None:
        await _ensure_users_exist(db, payload.structured_data.participants + payload.structured_data.acknowledgement_people)
        document.structured_data = payload.structured_data.model_dump(mode="json")
        await _replace_acknowledgements(db, document, payload.structured_data.acknowledgement_people)
        data.pop("structured_data", None)
    for key, value in data.items():
        setattr(document, key, value)
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="instruction.updated",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/instructions/{document_id}/generate", response_model=DocumentGenerateResponse)
async def generate_instruction(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentGenerateResponse:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.INSTRUCTION:
        raise HTTPException(status_code=400, detail="Document is not an instruction")
    if not can_edit_document(current_user, document):
        raise HTTPException(status_code=403, detail="Document cannot be generated")
    await document_generation_service.generate_instruction_docx(db, document, current_user)
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="instruction.generated",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return DocumentGenerateResponse(message="Instruction files generated", document=_document_to_read(document, current_user))


@router.post("/instructions/{document_id}/send", response_model=DocumentRead)
async def send_instruction(
    document_id: int,
    payload: SendInstructionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.INSTRUCTION:
        raise HTTPException(status_code=400, detail="Document is not an instruction")
    if not can_edit_document(current_user, document):
        raise HTTPException(status_code=403, detail="Document cannot be sent")
    await _ensure_users_exist(db, payload.acknowledgement_user_ids)
    department_user_ids = await _collect_department_user_ids(db, payload.acknowledgement_department_ids)
    await _replace_acknowledgements(db, document, payload.acknowledgement_user_ids + department_user_ids)
    await document_generation_service.generate_instruction_docx(db, document, current_user)
    document.status = DocumentStatus.SENT
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="instruction.sent",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/{document_id}/approve", response_model=DocumentRead)
async def approve_document(
    document_id: int,
    payload: ApproveDocumentRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    waiting = current_waiting_step(document)
    if not waiting or waiting.approver_id != current_user.id:
        raise HTTPException(status_code=403, detail="No approval action is available")
    waiting.status = ApprovalStatus.APPROVED
    waiting.comment = payload.comment
    waiting.acted_at = datetime.now(UTC)
    next_step = None
    for step in document.approval_steps:
        if step.step_order == waiting.step_order + 1:
            next_step = step
            break
    if next_step:
        next_step.status = ApprovalStatus.WAITING
        document.status = DocumentStatus.ON_APPROVAL
    else:
        document.status = DocumentStatus.APPROVED
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="document.approved",
        entity_type="document",
        entity_id=document.id,
        after={"step_order": waiting.step_order},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/{document_id}/return-for-revision", response_model=DocumentRead)
async def return_document_for_revision(
    document_id: int,
    payload: ReturnForRevisionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    waiting = current_waiting_step(document)
    if not waiting or waiting.approver_id != current_user.id:
        raise HTTPException(status_code=403, detail="No revision return action is available")
    waiting.status = ApprovalStatus.RETURNED
    waiting.comment = payload.comment
    waiting.acted_at = datetime.now(UTC)
    for step in document.approval_steps:
        if step.step_order > waiting.step_order and step.status == ApprovalStatus.PENDING:
            step.status = ApprovalStatus.SKIPPED
    document.status = DocumentStatus.REVISION_REQUIRED
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="document.returned_for_revision",
        entity_type="document",
        entity_id=document.id,
        after={"comment": payload.comment},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/{document_id}/resubmit", response_model=DocumentRead)
async def resubmit_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if not can_edit_document(current_user, document) or document.status != DocumentStatus.REVISION_REQUIRED:
        raise HTTPException(status_code=403, detail="Document cannot be resubmitted")
    for step in document.approval_steps:
        step.status = ApprovalStatus.PENDING
        step.comment = None
        step.acted_at = None
    if document.approval_steps:
        document.approval_steps[0].status = ApprovalStatus.WAITING
        document.status = DocumentStatus.ON_APPROVAL
    await document_generation_service.regenerate_document_files(db, document, current_user)
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="document.resubmitted",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/{document_id}/send-for-acknowledgement", response_model=DocumentRead)
async def send_for_acknowledgement(
    document_id: int,
    payload: SendForAcknowledgementRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if current_user.role not in {UserRole.ADMIN, UserRole.CHIEF} and document.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Document cannot be sent for acknowledgement")
    await _ensure_users_exist(db, payload.user_ids)
    department_user_ids = await _collect_department_user_ids(db, payload.department_ids)
    await _replace_acknowledgements(db, document, payload.user_ids + department_user_ids)
    document.status = DocumentStatus.ON_ACKNOWLEDGEMENT
    await document_generation_service.regenerate_document_files(db, document, current_user)
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="document.sent_for_acknowledgement",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/{document_id}/acknowledge", response_model=DocumentRead)
async def acknowledge_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    acknowledgement = next((item for item in document.acknowledgements if item.user_id == current_user.id), None)
    if not acknowledgement or acknowledgement.status != AcknowledgementStatus.PENDING:
        raise HTTPException(status_code=403, detail="Acknowledgement is not available")
    acknowledgement.status = AcknowledgementStatus.ACKNOWLEDGED
    acknowledgement.acknowledged_at = datetime.now(UTC)
    if all(item.status == AcknowledgementStatus.ACKNOWLEDGED for item in document.acknowledgements):
        document.status = (
            DocumentStatus.ACKNOWLEDGEMENT_COMPLETED
            if document.type == DocumentType.ORDER
            else DocumentStatus.ACKNOWLEDGED
        )
    await document_generation_service.regenerate_document_files(db, document, current_user)
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="document.acknowledged",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@router.post("/{document_id}/generate-extract", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def generate_extract(
    document_id: int,
    payload: GenerateExtractRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    source = await _get_document_or_404(db, document_id)
    if source.type != DocumentType.ORDER:
        raise HTTPException(status_code=400, detail="Extract can only be generated from an order")
    ensure_document_visible(current_user, source)
    extract = Document(
        type=DocumentType.ORDER_EXTRACT,
        status=DocumentStatus.APPROVED,
        title=f"Выписка: {source.title}",
        author_id=current_user.id,
        department_id=source.department_id,
        current_version=1,
        document_date=payload.extract_date,
        city=source.city,
        organization_name=source.organization_name,
        signer_position=source.signer_position,
        signer_name=source.signer_name,
        structured_data={
            "source_order_id": source.id,
            "extracted_items": payload.extracted_items,
            "certifier_position": payload.certifier_position,
            "certifier_name": payload.certifier_name,
            "extract_date": payload.extract_date.isoformat(),
        },
    )
    db.add(extract)
    await db.flush()
    await document_generation_service.generate_order_extract_docx(db, extract, current_user)
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="extract.created",
        entity_type="document",
        entity_id=extract.id,
        after={"source_order_id": source.id},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    extract = await _get_document_or_404(db, extract.id)
    return _document_to_read(extract, current_user)


@router.get("/{document_id}/preview")
async def preview_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    document = await _get_document_or_404(db, document_id)
    ensure_document_visible(current_user, document)
    pdf_file = next((item for item in document.files if item.kind in {DocumentFileKind.GENERATED_PDF, DocumentFileKind.EXTRACT_PDF}), None)
    if not pdf_file:
        raise HTTPException(status_code=404, detail="Preview file not found")
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="document.previewed",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    return FileResponse(
        pdf_file.storage_path,
        media_type="application/pdf",
        filename=Path(pdf_file.original_filename).name,
        content_disposition_type="inline",
    )


@router.get("/{document_id}/files/{file_id}/download")
async def download_document_file(
    document_id: int,
    file_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    document = await _get_document_or_404(db, document_id)
    ensure_document_visible(current_user, document)
    file_entry = next((item for item in document.files if item.id == file_id), None)
    if not file_entry:
        raise HTTPException(status_code=404, detail="File not found")
    if not can_download_file(current_user, document, file_entry.kind, file_entry.is_download_allowed):
        raise HTTPException(status_code=403, detail="Download is not allowed")
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="document.downloaded",
        entity_type="document",
        entity_id=document.id,
        after={"file_id": file_entry.id},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    return FileResponse(file_entry.storage_path, media_type=file_entry.mime_type, filename=file_entry.original_filename)


@incoming_router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_incoming(
    payload: IncomingCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    if current_user.role not in {UserRole.ADMIN, UserRole.CHIEF, UserRole.INCOMING_DOC_OPERATOR}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    document = Document(
        type=DocumentType.INCOMING_LETTER,
        status=DocumentStatus.WAITING_RESOLUTION,
        author_id=current_user.id,
        department_id=payload.department_id,
        title=payload.title,
        document_date=payload.document_date,
        city="г. Екатеринбург",
        organization_name=payload.organization_name,
        signer_position=payload.signer_position,
        signer_name=payload.signer_name,
        structured_data=payload.structured_data.model_dump(mode="json"),
    )
    db.add(document)
    await db.flush()
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="incoming.created",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@incoming_router.get("", response_model=list[DocumentRead])
async def list_incoming(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[DocumentRead]:
    result = await db.execute(_document_query().where(Document.type == DocumentType.INCOMING_LETTER))
    documents = [doc for doc in result.scalars().unique().all() if True]
    visible = [doc for doc in documents if current_user.role in {UserRole.ADMIN, UserRole.CHIEF, UserRole.INCOMING_DOC_OPERATOR} or doc.author_id == current_user.id]
    return [_document_to_read(document, current_user) for document in visible]


@incoming_router.get("/{document_id}", response_model=DocumentRead)
async def get_incoming(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.INCOMING_LETTER:
        raise HTTPException(status_code=404, detail="Incoming letter not found")
    ensure_document_visible(current_user, document)
    return _document_to_read(document, current_user)


@incoming_router.post("/{document_id}/resolution", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_resolution(
    document_id: int,
    payload: ResolutionCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    if current_user.role not in {UserRole.ADMIN, UserRole.CHIEF}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    incoming = await _get_document_or_404(db, document_id)
    if incoming.type != DocumentType.INCOMING_LETTER:
        raise HTTPException(status_code=404, detail="Incoming letter not found")
    await _ensure_users_exist(db, payload.structured_data.assigned_users)
    resolution = Document(
        type=DocumentType.RESOLUTION,
        status=DocumentStatus.CREATED,
        author_id=current_user.id,
        department_id=payload.department_id,
        title=payload.title,
        document_date=payload.document_date,
        city="г. Екатеринбург",
        organization_name=payload.organization_name,
        signer_position=payload.signer_position,
        signer_name=payload.signer_name,
        structured_data=payload.structured_data.model_dump(mode="json"),
    )
    db.add(resolution)
    incoming.status = DocumentStatus.RESOLUTION_CREATED
    ip_address, user_agent = _request_meta(request)
    await db.flush()
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="resolution.created",
        entity_type="document",
        entity_id=resolution.id,
        after={"incoming_id": incoming.id},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    resolution = await _get_document_or_404(db, resolution.id)
    return _document_to_read(resolution, current_user)


@resolution_router.get("", response_model=list[DocumentRead])
async def list_resolutions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[DocumentRead]:
    result = await db.execute(_document_query().where(Document.type == DocumentType.RESOLUTION))
    documents = result.scalars().unique().all()
    visible = [document for document in documents if current_user.role in {UserRole.ADMIN, UserRole.CHIEF} or ensure_resolution_visible(current_user, document)]
    return [_document_to_read(document, current_user) for document in visible]


def ensure_resolution_visible(current_user: User, document: Document) -> bool:
    if document.author_id == current_user.id:
        return True
    assigned_users = document.structured_data.get("assigned_users", [])
    assigned_departments = document.structured_data.get("assigned_departments", [])
    return current_user.id in assigned_users or (current_user.department_id in assigned_departments if current_user.department_id else False)


@resolution_router.get("/{document_id}", response_model=DocumentRead)
async def get_resolution(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.RESOLUTION:
        raise HTTPException(status_code=404, detail="Resolution not found")
    if current_user.role not in {UserRole.ADMIN, UserRole.CHIEF} and not ensure_resolution_visible(current_user, document):
        raise HTTPException(status_code=403, detail="Resolution is not available")
    return _document_to_read(document, current_user)


@resolution_router.post("/{document_id}/take-in-work", response_model=DocumentRead)
async def take_resolution_in_work(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.RESOLUTION or not ensure_resolution_visible(current_user, document):
        raise HTTPException(status_code=403, detail="Resolution is not available")
    document.status = DocumentStatus.IN_PROGRESS
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="resolution.taken_in_work",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@resolution_router.post("/{document_id}/complete", response_model=DocumentRead)
async def complete_resolution(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentRead:
    document = await _get_document_or_404(db, document_id)
    if document.type != DocumentType.RESOLUTION or not ensure_resolution_visible(current_user, document):
        raise HTTPException(status_code=403, detail="Resolution is not available")
    document.status = DocumentStatus.COMPLETED
    ip_address, user_agent = _request_meta(request)
    await create_audit_log(
        db,
        actor_id=current_user.id,
        action="resolution.completed",
        entity_type="document",
        entity_id=document.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await db.commit()
    document = await _get_document_or_404(db, document.id)
    return _document_to_read(document, current_user)


@audit_router.get("", response_model=list[AuditLogRead])
async def list_audit(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[AuditLogRead]:
    if current_user.role not in {UserRole.ADMIN, UserRole.CHIEF}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    result = await db.execute(select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(500))
    return [AuditLogRead.model_validate(item) for item in result.scalars().all()]
