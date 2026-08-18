"""platform_admins table + cross-tenant read policy for the platform panel

Revision ID: 0002_platform_admin
Revises: 0001_initial
Create Date: 2026-08-18

``platform_admins`` is a new, non-tenant-scoped table (metadata.create_all is idempotent, so this
only creates what 0001 didn't already). The RLS ``tenant_rw`` policy on every tenant-scoped table
only matches an exact tenant, so the platform panel needs its own SELECT-only, all-tenant policy —
gated by ``app.platform_context`` the same way ``app.public_context``/``app.auth_context`` gate
their own narrow policies (§3, 0001_initial). Multiple permissive policies OR together, so this
adds read access without loosening ``tenant_rw``'s write restriction.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from app.core.db import Base
from app.models import TENANT_SCOPED_TABLES

revision: str = "0002_platform_admin"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    if not _is_postgres():
        return

    for table in TENANT_SCOPED_TABLES:
        op.execute(
            f"""
            CREATE POLICY platform_read ON {table} FOR SELECT
              USING (current_setting('app.platform_context', true) = 'on')
            """
        )


def downgrade() -> None:
    if _is_postgres():
        for table in TENANT_SCOPED_TABLES:
            op.execute(f"DROP POLICY IF EXISTS platform_read ON {table}")
    op.execute("DROP TABLE IF EXISTS platform_admins")


__all__ = ["downgrade", "upgrade"]
