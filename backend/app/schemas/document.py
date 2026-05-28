from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import (
    AcknowledgementStatus,
    ApprovalStatus,
    DocumentFileKind,
    DocumentStatus,
    DocumentType,
)
from app.core.config import settings
from app.schemas.department import DepartmentRead
from app.schemas.user import UserRead


class StructuredOrderData(BaseModel):
    order_subject: str
    legal_basis_text: str
    purpose_text: str
    order_items: list[str] = Field(default_factory=list)
    control_assignee_text: str
    approval_people: list[int] = Field(default_factory=list)
    acknowledgement_people: list[int] = Field(default_factory=list)
    acknowledgement_departments: list[int] = Field(default_factory=list)
    executor_name: str | None = None
    executor_phone: str | None = None

    @field_validator("order_items")
    @classmethod
    def validate_items(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if not cleaned:
            raise ValueError("At least one order item is required")
        return cleaned


class StructuredInstructionData(BaseModel):
    instruction_subject: str
    purpose_text: str
    instruction_items: list[str] = Field(default_factory=list)
    participants: list[int] = Field(default_factory=list)
    participant_departments: list[int] = Field(default_factory=list)
    control_assignee_text: str
    acknowledgement_people: list[int] = Field(default_factory=list)
    executor_name: str | None = None
    executor_phone: str | None = None

    @field_validator("instruction_items")
    @classmethod
    def validate_items(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if not cleaned:
            raise ValueError("At least one instruction item is required")
        return cleaned


class StructuredExtractData(BaseModel):
    source_order_id: int
    extracted_items: list[str] = Field(default_factory=list)
    certifier_position: str
    certifier_name: str
    extract_date: date

    @field_validator("extracted_items")
    @classmethod
    def validate_extract_items(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if not cleaned:
            raise ValueError("At least one extracted item is required")
        return cleaned


class StructuredIncomingData(BaseModel):
    sender: str
    received_at: date
    subject: str
    body_text: str


class StructuredResolutionData(BaseModel):
    linked_incoming_letter_id: int
    resolution_text: str
    assigned_users: list[int] = Field(default_factory=list)
    assigned_departments: list[int] = Field(default_factory=list)
    assignee_statuses: dict[str, str] = Field(default_factory=dict)


class ApprovalStepRead(BaseModel):
    id: int
    step_order: int
    approver_id: int
    status: ApprovalStatus
    comment: str | None
    acted_at: datetime | None
    approver: UserRead | None = None

    model_config = {"from_attributes": True}


class AcknowledgementRead(BaseModel):
    id: int
    user_id: int
    status: AcknowledgementStatus
    acknowledged_at: datetime | None
    user: UserRead | None = None

    model_config = {"from_attributes": True}


class DocumentFileRead(BaseModel):
    id: int
    version: int
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    kind: DocumentFileKind
    is_download_allowed: bool
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentRead(BaseModel):
    id: int
    type: DocumentType
    title: str
    status: DocumentStatus
    author_id: int
    department_id: int | None
    current_version: int
    registered_number: str | None
    registered_date: date | None
    document_date: date | None
    city: str
    organization_name: str
    signer_position: str
    signer_name: str
    executor_name: str | None
    executor_phone: str | None
    structured_data: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    author: UserRead | None = None
    department: DepartmentRead | None = None
    files: list[DocumentFileRead] = Field(default_factory=list)
    approval_steps: list[ApprovalStepRead] = Field(default_factory=list)
    acknowledgements: list[AcknowledgementRead] = Field(default_factory=list)
    allowed_actions: list[str] = Field(default_factory=list)
    requires_action: bool = False

    model_config = {"from_attributes": True}


class DocumentListResponse(DocumentRead):
    pass


class DocumentGenerateResponse(BaseModel):
    message: str
    document: DocumentRead


class BaseStructuredDocumentPayload(BaseModel):
    title: str
    department_id: int | None = None
    registered_number: str | None = None
    registered_date: date | None = None
    document_date: date | None = None
    city: str = settings.default_document_city
    organization_name: str = settings.default_document_organization_name
    signer_position: str
    signer_name: str
    executor_name: str | None = None
    executor_phone: str | None = None


class OrderCreate(BaseStructuredDocumentPayload):
    structured_data: StructuredOrderData


class OrderUpdate(BaseModel):
    title: str | None = None
    department_id: int | None = None
    registered_number: str | None = None
    registered_date: date | None = None
    document_date: date | None = None
    city: str | None = None
    organization_name: str | None = None
    signer_position: str | None = None
    signer_name: str | None = None
    executor_name: str | None = None
    executor_phone: str | None = None
    structured_data: StructuredOrderData | None = None


class InstructionCreate(BaseStructuredDocumentPayload):
    structured_data: StructuredInstructionData


class InstructionUpdate(BaseModel):
    title: str | None = None
    department_id: int | None = None
    registered_number: str | None = None
    registered_date: date | None = None
    document_date: date | None = None
    city: str | None = None
    organization_name: str | None = None
    signer_position: str | None = None
    signer_name: str | None = None
    executor_name: str | None = None
    executor_phone: str | None = None
    structured_data: StructuredInstructionData | None = None


class SendForApprovalRequest(BaseModel):
    approver_ids: list[int]

    @field_validator("approver_ids")
    @classmethod
    def validate_approver_ids(cls, value: list[int]) -> list[int]:
        cleaned = [item for item in value if item]
        if not cleaned:
            raise ValueError("At least one approver is required")
        return cleaned


class ApproveDocumentRequest(BaseModel):
    comment: str | None = None


class ReturnForRevisionRequest(BaseModel):
    comment: str

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Comment is required")
        return value.strip()


class SendForAcknowledgementRequest(BaseModel):
    user_ids: list[int] = Field(default_factory=list)
    department_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_targets(self) -> "SendForAcknowledgementRequest":
        if not self.user_ids and not self.department_ids:
            raise ValueError("At least one acknowledgement target is required")
        return self


class SendInstructionRequest(BaseModel):
    acknowledgement_user_ids: list[int] = Field(default_factory=list)
    acknowledgement_department_ids: list[int] = Field(default_factory=list)


class GenerateExtractRequest(BaseModel):
    extracted_items: list[str]
    certifier_position: str
    certifier_name: str
    extract_date: date


class IncomingCreate(BaseModel):
    title: str
    department_id: int | None = None
    document_date: date | None = None
    organization_name: str
    signer_position: str
    signer_name: str
    structured_data: StructuredIncomingData


class ResolutionCreate(BaseModel):
    title: str
    department_id: int | None = None
    document_date: date | None = None
    organization_name: str
    signer_position: str
    signer_name: str
    structured_data: StructuredResolutionData


class AuditLogRead(BaseModel):
    id: int
    actor_id: int | None
    action: str
    entity_type: str
    entity_id: int | None
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    actor: UserRead | None = None

    model_config = {"from_attributes": True}


DocumentSection = Literal["all", "new", "current", "mine", "archive"]
