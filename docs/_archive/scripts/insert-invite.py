"""
Insert one invitation row into the Pillar 0 `invitations` table.

Reads DATABASE_URL from env (so the connection string never lives in
the repo or your shell history). Takes the email as the first arg;
tenant_id defaults to the default-tenant UUID.

Usage:
  $env:DATABASE_URL = '<your-render-external-url>'
  python scripts/insert-invite.py lizocontactinfo@gmail.com

  # or for a different tenant:
  python scripts/insert-invite.py user@example.com 11111111-1111-1111-1111-111111111111

Prereqs:
  pip install "psycopg[binary]"
"""
from __future__ import annotations

import os
import sys

DEFAULT_TENANT = "00000000-0000-0000-0000-000000000000"


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python insert-invite.py <email> [tenant_id]", file=sys.stderr)
        return 2

    email = sys.argv[1].strip().lower()
    tenant_id = sys.argv[2].strip() if len(sys.argv) > 2 else DEFAULT_TENANT

    url = os.environ.get("DATABASE_URL")
    if not url:
        print(
            "ERROR: DATABASE_URL not set. In PowerShell:\n"
            "  $env:DATABASE_URL = 'postgresql://...your-render-external-url...'",
            file=sys.stderr,
        )
        return 1

    try:
        import psycopg
    except ImportError:
        print(
            "ERROR: psycopg not installed. Install with:\n"
            '  pip install "psycopg[binary]"',
            file=sys.stderr,
        )
        return 1

    with psycopg.connect(url) as conn:
        cur = conn.execute(
            "INSERT INTO invitations (email, tenant_id) VALUES (%s, %s) "
            "ON CONFLICT DO NOTHING RETURNING id",
            (email, tenant_id),
        )
        rows = cur.fetchall()
        conn.commit()

    if rows:
        print(f"inserted invite: email={email} tenant_id={tenant_id} id={rows[0][0]}")
    else:
        print(
            f"no row inserted (an unconsumed invite for {email} already exists "
            f"or email format conflicts). Existing rows:"
        )
        with psycopg.connect(url) as conn:
            cur = conn.execute(
                "SELECT id, email, consumed_at FROM invitations WHERE email = %s",
                (email,),
            )
            for r in cur.fetchall():
                print(f"  id={r[0]} email={r[1]} consumed_at={r[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
