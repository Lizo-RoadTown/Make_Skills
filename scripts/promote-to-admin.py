"""
Promote an existing user to admin role on their tenant.

For pre-bootstrap users (those who signed in BEFORE the bootstrap-first-
user logic landed): their tenant_users row was created with role='member'
since the bootstrap path didn't exist yet. This script bumps them to admin
so the dashboard's Admin sidebar group appears + /admin/invitations works.

Reads DATABASE_URL from env (so creds never live in repo or shell history).

Usage:
  $env:DATABASE_URL = '<your-render-external-url>'
  python scripts/promote-to-admin.py lizocontactinfo@gmail.com

Prereqs:
  pip install "psycopg[binary]"
"""
from __future__ import annotations

import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python promote-to-admin.py <email>", file=sys.stderr)
        return 2

    email = sys.argv[1].strip().lower()

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
            """
            UPDATE tenant_users
            SET role = 'admin'
            WHERE user_id IN (SELECT id FROM users WHERE email = %s)
            RETURNING user_id, tenant_id, role
            """,
            (email,),
        )
        rows = cur.fetchall()
        conn.commit()

    if rows:
        for r in rows:
            print(f"promoted: user_id={r[0]} tenant_id={r[1]} role={r[2]}")
        print(
            "\nSign out + sign back in to refresh your JWT — the new role is "
            "baked into the token at sign-in time, so a fresh session is needed."
        )
    else:
        print(f"no row matched (no user with email={email}, or no tenant_users row)")
        with psycopg.connect(url) as conn:
            cur = conn.execute(
                "SELECT id, email FROM users WHERE email = %s",
                (email,),
            )
            users = cur.fetchall()
            if users:
                print(f"  user exists: id={users[0][0]} email={users[0][1]}")
                print("  but no tenant_users row — sign in once to create it")
            else:
                print("  no user with that email; sign in via OAuth first")
    return 0


if __name__ == "__main__":
    sys.exit(main())
