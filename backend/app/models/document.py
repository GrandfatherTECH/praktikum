from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import DocumentStatus, DocumentType


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[DocumentType] = mapped_column(Enum(DocumentType, name="document_type"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status"),
        nullable=False,
        index=True,
        default=DocumentStatus.DRAFT,
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    registered_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    registered_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    city: Mapped[str] = mapped_column(String(255), nullable=False, default="г. Екатеринбург")
    organization_name: Mapped[str] = mapped_column(String(500), nullable=False)
    signer_position: Mapped[str] = mapped_column(String(500), nullable=False)
    signer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    executor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    executor_phone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    structured_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    author = relationship("User", foreign_keys=[author_id])
    department = relationship("Department", foreign_keys=[department_id])
    files = relationship("DocumentFile", back_populates="document", cascade="all, delete-orphan")
    approval_steps = relationship(
        "ApprovalStep",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ApprovalStep.step_order.asc()",
    )
    acknowledgements = relationship("Acknowledgement", back_populates="document", cascade="all, delete-orphan")
