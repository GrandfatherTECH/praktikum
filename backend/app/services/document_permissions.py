from __future__ import annotations

from fastapi import HTTPException, status

from app.models.acknowledgement import Acknowledgement
from app.models.approval_step import ApprovalStep
from app.models.document import Document
from app.models.enums import ApprovalStatus, DocumentFileKind, DocumentStatus, DocumentType, UserRole
from app.models.user import User


def can_view_document(user: User, document: Document) -> bool:
    if user.role in {UserRole.ADMIN, UserRole.CHIEF}:
        return True
    if user.role == UserRole.DEPARTMENT_HEAD and user.department_id and user.department_id == document.department_id:
        return True
    if document.author_id == user.id:
        return True
    if any(step.approver_id == user.id for step in document.approval_steps):
        return True
    if any(item.user_id == user.id for item in document.acknowledgements):
        return True

    structured_data = document.structured_data or {}
    if document.type == DocumentType.RESOLUTION and user.id in structured_data.get("assigned_users", []):
        return True
    if user.department_id and document.type == DocumentType.RESOLUTION:
        if user.department_id in structured_data.get("assigned_departments", []):
            return True
    return False


def ensure_document_visible(user: User, document: Document) -> None:
    if not can_view_document(user, document):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Document is not available")


def can_edit_document(user: User, document: Document) -> bool:
    if document.author_id != user.id and user.role not in {UserRole.ADMIN, UserRole.CHIEF}:
        return False
    return document.status in {DocumentStatus.DRAFT, DocumentStatus.REVISION_REQUIRED}


def current_waiting_step(document: Document) -> ApprovalStep | None:
    for step in document.approval_steps:
        if step.status == ApprovalStatus.WAITING:
            return step
    return None


def can_download_file(user: User, document: Document, kind: DocumentFileKind, is_download_allowed: bool) -> bool:
    if not is_download_allowed:
        return False
    return can_view_document(user, document) and kind in {DocumentFileKind.EXTRACT_DOCX, DocumentFileKind.EXTRACT_PDF}


def build_allowed_actions(user: User, document: Document) -> list[str]:
    actions: list[str] = ["open", "preview"]
    if can_edit_document(user, document):
        actions.extend(["edit", "generate"])
    waiting = current_waiting_step(document)
    if waiting and waiting.approver_id == user.id:
        actions.extend(["approve", "return_for_revision"])
    if document.type == DocumentType.ORDER and can_edit_document(user, document):
        actions.append("send_for_approval")
    if document.status == DocumentStatus.REVISION_REQUIRED and can_edit_document(user, document):
        actions.append("resubmit")
    if document.type == DocumentType.ORDER and document.status == DocumentStatus.APPROVED and user.role in {UserRole.ADMIN, UserRole.CHIEF}:
        actions.extend(["send_for_acknowledgement", "generate_extract"])
    if document.type == DocumentType.INSTRUCTION and document.status == DocumentStatus.DRAFT and can_edit_document(user, document):
        actions.append("send")
    if document.type == DocumentType.ORDER and any(item.user_id == user.id and item.status.value == "PENDING" for item in document.acknowledgements):
        actions.append("acknowledge")
    return actions


def requires_action(user: User, document: Document) -> bool:
    waiting = current_waiting_step(document)
    if waiting and waiting.approver_id == user.id:
        return True
    if document.type == DocumentType.ORDER:
        return any(item.user_id == user.id and item.status.value == "PENDING" for item in document.acknowledgements)
    return False
