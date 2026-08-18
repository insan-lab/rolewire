"""Bootstrap a platform superadmin account.

No self-signup endpoint exists for platform_admins on purpose (§platform) — this is the only way
to create one, meant to be run once per operator via `docker compose exec api python -m
app.scripts.create_platform_admin someone@rolewire.io`.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.db import get_sessionmaker
from app.core.security import hash_password
from app.models import PlatformAdmin


async def _create(email: str, password: str) -> None:
    async with get_sessionmaker()() as session:
        existing = await session.scalar(
            select(PlatformAdmin).where(PlatformAdmin.email == email)
        )
        if existing is not None:
            print(f"a platform admin with email {email!r} already exists", file=sys.stderr)
            raise SystemExit(1)

        session.add(PlatformAdmin(email=email, password_hash=hash_password(password)))
        try:
            await session.commit()
        except IntegrityError:
            print(f"a platform admin with email {email!r} already exists", file=sys.stderr)
            raise SystemExit(1) from None
    print(f"created platform admin {email!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    args = parser.parse_args()

    password = getpass.getpass("Password: ")
    if len(password) < 8:
        print("password must be at least 8 characters", file=sys.stderr)
        raise SystemExit(1)
    if password != getpass.getpass("Confirm password: "):
        print("passwords did not match", file=sys.stderr)
        raise SystemExit(1)

    asyncio.run(_create(args.email, password))


if __name__ == "__main__":
    main()
