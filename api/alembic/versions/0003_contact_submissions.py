"""contact_submissions table

Revision ID: 0003_contact_submissions
Revises: 0002_platform_admin
Create Date: 2026-08-18

Stores contact form submissions from the public contact page for super admins to view and manage.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from app.core.db import Base

revision: str = "0003_contact_submissions"
down_revision: str | None = "0002_platform_admin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS contact_submissions")


__all__ = ["downgrade", "upgrade"]
