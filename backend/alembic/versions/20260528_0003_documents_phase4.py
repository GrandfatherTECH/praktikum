"""documents phase4

Revision ID: 20260528_0003
Revises: 20260525_0002
Create Date: 2026-05-28 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260528_0003"
down_revision: str | None = "20260525_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


document_type_enum = postgresql.ENUM(
    "ORDER",
    "INSTRUCTION",
    "INCOMING_LETTER",
    "RESOLUTION",
    "ORDER_EXTRACT",
    name="document_type",
    create_type=False,
)

document_status_enum = postgresql.ENUM(
    "DRAFT",
    "ON_APPROVAL",
    "REVISION_REQUIRED",
    "APPROVED",
    "ON_ACKNOWLEDGEMENT",
    "ACKNOWLEDGEMENT_COMPLETED",
    "REGISTERED",
    "ARCHIVED",
    "SENT",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "COMPLETED",
    "UPLOADED",
    "WAITING_RESOLUTION",
    "RESOLUTION_CREATED",
    "CLOSED",
    "CREATED",
    "RECEIVED",
    name="document_status",
    create_type=False,
)

approval_status_enum = postgresql.ENUM(
    "PENDING",
    "WAITING",
    "APPROVED",
    "RETURNED",
    "SKIPPED",
    name="approval_status",
    create_type=False,
)

acknowledgement_status_enum = postgresql.ENUM(
    "PENDING",
    "ACKNOWLEDGED",
    name="acknowledgement_status",
    create_type=False,
)

document_file_kind_enum = postgresql.ENUM(
    "GENERATED_DOCX",
    "GENERATED_PDF",
    "EXTRACT_DOCX",
    "EXTRACT_PDF",
    name="document_file_kind",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    document_type_enum.create(bind, checkfirst=True)
    document_status_enum.create(bind, checkfirst=True)
    approval_status_enum.create(bind, checkfirst=True)
    acknowledgement_status_enum.create(bind, checkfirst=True)
    document_file_kind_enum.create(bind, checkfirst=True)

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", document_type_enum, nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("status", document_status_enum, nullable=False, server_default="DRAFT"),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("registered_number", sa.String(length=100), nullable=True),
        sa.Column("registered_date", sa.Date(), nullable=True),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("city", sa.String(length=255), nullable=False, server_default="г. Екатеринбург"),
        sa.Column("organization_name", sa.String(length=500), nullable=False),
        sa.Column("signer_position", sa.String(length=500), nullable=False),
        sa.Column("signer_name", sa.String(length=255), nullable=False),
        sa.Column("executor_name", sa.String(length=255), nullable=True),
        sa.Column("executor_phone", sa.String(length=100), nullable=True),
        sa.Column("structured_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_author_id"), "documents", ["author_id"], unique=False)
    op.create_index(op.f("ix_documents_created_at"), "documents", ["created_at"], unique=False)
    op.create_index(op.f("ix_documents_department_id"), "documents", ["department_id"], unique=False)
    op.create_index(op.f("ix_documents_status"), "documents", ["status"], unique=False)
    op.create_index(op.f("ix_documents_type"), "documents", ["type"], unique=False)

    op.create_table(
        "document_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=1000), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("kind", document_file_kind_enum, nullable=False),
        sa.Column("is_download_allowed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_document_files_created_at"), "document_files", ["created_at"], unique=False)
    op.create_index(op.f("ix_document_files_document_id"), "document_files", ["document_id"], unique=False)
    op.create_index(op.f("ix_document_files_kind"), "document_files", ["kind"], unique=False)

    op.create_table(
        "approval_steps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("approver_id", sa.Integer(), nullable=False),
        sa.Column("status", approval_status_enum, nullable=False, server_default="PENDING"),
        sa.Column("comment", sa.String(length=1000), nullable=True),
        sa.Column("acted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["approver_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id", "step_order", name="uq_approval_steps_document_order"),
    )
    op.create_index(op.f("ix_approval_steps_approver_id"), "approval_steps", ["approver_id"], unique=False)
    op.create_index(op.f("ix_approval_steps_document_id"), "approval_steps", ["document_id"], unique=False)
    op.create_index(op.f("ix_approval_steps_status"), "approval_steps", ["status"], unique=False)

    op.create_table(
        "acknowledgements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", acknowledgement_status_enum, nullable=False, server_default="PENDING"),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_acknowledgements_document_id"), "acknowledgements", ["document_id"], unique=False)
    op.create_index(op.f("ix_acknowledgements_status"), "acknowledgements", ["status"], unique=False)
    op.create_index(op.f("ix_acknowledgements_user_id"), "acknowledgements", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_acknowledgements_user_id"), table_name="acknowledgements")
    op.drop_index(op.f("ix_acknowledgements_status"), table_name="acknowledgements")
    op.drop_index(op.f("ix_acknowledgements_document_id"), table_name="acknowledgements")
    op.drop_table("acknowledgements")

    op.drop_index(op.f("ix_approval_steps_status"), table_name="approval_steps")
    op.drop_index(op.f("ix_approval_steps_document_id"), table_name="approval_steps")
    op.drop_index(op.f("ix_approval_steps_approver_id"), table_name="approval_steps")
    op.drop_table("approval_steps")

    op.drop_index(op.f("ix_document_files_kind"), table_name="document_files")
    op.drop_index(op.f("ix_document_files_document_id"), table_name="document_files")
    op.drop_index(op.f("ix_document_files_created_at"), table_name="document_files")
    op.drop_table("document_files")

    op.drop_index(op.f("ix_documents_type"), table_name="documents")
    op.drop_index(op.f("ix_documents_status"), table_name="documents")
    op.drop_index(op.f("ix_documents_department_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_created_at"), table_name="documents")
    op.drop_index(op.f("ix_documents_author_id"), table_name="documents")
    op.drop_table("documents")

    bind = op.get_bind()
    document_file_kind_enum.drop(bind, checkfirst=True)
    acknowledgement_status_enum.drop(bind, checkfirst=True)
    approval_status_enum.drop(bind, checkfirst=True)
    document_status_enum.drop(bind, checkfirst=True)
    document_type_enum.drop(bind, checkfirst=True)
