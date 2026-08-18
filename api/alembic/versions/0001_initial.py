"""initial schema with row-level security

Revision ID: 0001_initial
Revises:
Create Date: 2025-01-01

Tables are created from the SQLAlchemy metadata (single source of truth in ``app.models``); the
tenant-isolation policies below cannot be expressed in metadata and are applied as explicit DDL.

Isolation model (§3):
* every tenant-scoped table gets ``ENABLE`` + ``FORCE ROW LEVEL SECURITY`` so even the table owner
  is subject to the policies;
* ``tenant_rw`` restricts all access to rows matching ``app.current_tenant_id``;
* ``public_published_read`` lets the unauthenticated public API read published jobs and their
  questions before a tenant is known, and nothing else;
* ``auth_lookup`` lets login/OAuth callbacks find a user by email or provider identity. It is
  SELECT-only.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.db import Base
from app.models import TENANT_SCOPED_TABLES

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TENANT_ID_TABLES = TENANT_SCOPED_TABLES


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    if not _is_postgres():
        return

    for table in TENANT_ID_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_rw ON {table}
              USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
              WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
              )
            """
        )

    # Public API: published jobs and their questions, readable without a tenant context.
    op.execute(
        """
        CREATE POLICY public_published_read ON jobs FOR SELECT
          USING (current_setting('app.public_context', true) = 'on' AND status = 'published')
        """
    )
    op.execute(
        """
        CREATE POLICY public_published_read ON job_questions FOR SELECT
          USING (
            current_setting('app.public_context', true) = 'on'
            AND EXISTS (
              SELECT 1 FROM jobs j
              WHERE j.id = job_questions.job_id AND j.status = 'published'
            )
          )
        """
    )

    # Pre-authentication identity lookups (login, OAuth callback). SELECT-only.
    op.execute(
        """
        CREATE POLICY auth_lookup ON users FOR SELECT
          USING (current_setting('app.auth_context', true) = 'on')
        """
    )

    # oauth_accounts has no tenant_id of its own; it inherits isolation through users.
    op.execute("ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE oauth_accounts FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_rw ON oauth_accounts
          USING (
            EXISTS (
              SELECT 1 FROM users u
              WHERE u.id = oauth_accounts.user_id
                AND u.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM users u
              WHERE u.id = oauth_accounts.user_id
                AND u.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
          )
        """
    )
    op.execute(
        """
        CREATE POLICY auth_lookup ON oauth_accounts FOR SELECT
          USING (current_setting('app.auth_context', true) = 'on')
        """
    )

    # Case-insensitive uniqueness for login emails.
    op.execute("CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email))")


def downgrade() -> None:
    if _is_postgres():
        op.execute("DROP INDEX IF EXISTS uq_users_email_lower")
        for table in (*TENANT_ID_TABLES, "oauth_accounts"):
            op.execute(f"DROP POLICY IF EXISTS tenant_rw ON {table}")
            op.execute(f"DROP POLICY IF EXISTS public_published_read ON {table}")
            op.execute(f"DROP POLICY IF EXISTS auth_lookup ON {table}")
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    Base.metadata.drop_all(bind=op.get_bind())


__all__ = ["downgrade", "upgrade", "sa"]
