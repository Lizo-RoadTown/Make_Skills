"""
Promote a user to admin role on their tenant — handles two cases:

  1. User already has a tenant_users row → UPDATE role='admin'.
  2. User exists but has NO tenant_users row (signed in before the
     bootstrap path existed, AND the bootstrap path no longer fires
     because other tenant_users rows now exist) → create a fresh
     tenant + tenant_users row with role='admin'. This is what
     bootstrap would have done if it had fired for them.

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
        # Case 1: tenant_users row exists — UPDATE.
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

        if rows:
            conn.commit()
            for r in rows:
                print(f"promoted (existing row): user_id={r[0]} tenant_id={r[1]} role={r[2]}")
            _print_signin_reminder()
            return 0

        # No tenant_users row. Find the user.
        cur = conn.execute(
            "SELECT id, email FROM users WHERE email = %s",
            (email,),
        )
        users = cur.fetchall()
        if not users:
            print(f"no user with email={email} — sign in via OAuth first to create the users row")
            return 1

        user_id = users[0][0]
        print(f"user exists: id={user_id} email={users[0][1]}")
        print("no tenant_users row — creating a fresh tenant + tenant_users with role=admin")

        # Case 2: bootstrap directly. Create tenant, then tenant_users row.
        cur = conn.execute(
            "INSERT INTO tenants (name) VALUES (%s) RETURNING id",
            (f"{email}'s workspace",),
        )
        tenant_row = cur.fetchone()
        if tenant_row is None:
            print("ERROR: failed to create tenant", file=sys.stderr)
            return 1
        tenant_id = tenant_row[0]

        cur = conn.execute(
            """
            INSERT INTO tenant_users (user_id, tenant_id, role)
            VALUES (%s, %s, 'admin')
            RETURNING user_id, tenant_id, role
            """,
            (user_id, tenant_id),
        )
        rows = cur.fetchall()
        conn.commit()

        for r in rows:
            print(f"bootstrapped: user_id={r[0]} tenant_id={r[1]} role={r[2]}")
        _print_signin_reminder()

    return 0


def _print_signin_reminder() -> None:
    print(
        "\nSign out + sign back in to refresh your JWT — the new role is "
        "baked into the token at sign-in time, so a fresh session is needed."
    )


if __name__ == "__main__":
    sys.exit(main())
