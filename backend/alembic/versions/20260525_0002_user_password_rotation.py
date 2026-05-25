"""user password rotation

Revision ID: 20260525_0002
Revises: 20260525_0001
Create Date: 2026-05-25 19:10:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260525_0002"
down_revision: str | None = "20260525_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(op.f("ix_users_must_change_password"), "users", ["must_change_password"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_must_change_password"), table_name="users")
    op.drop_column("users", "must_change_password")
