import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";

/**
 * DELETE /api/invitations/[id] — revoke an unconsumed invitation.
 *
 * Admin-only. Tenant-scoped: the invitation must belong to the caller's
 * tenant. Already-consumed invitations cannot be revoked (the user has
 * already signed in; revoke their tenant_users row instead, future).
 */

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "admin role required" }, { status: 403 });
  }

  const { id } = await params;

  const deleted = await db
    .delete(schema.invitations)
    .where(
      and(
        eq(schema.invitations.id, id),
        eq(schema.invitations.tenantId, session.user.tenantId),
        isNull(schema.invitations.consumedAt),
      ),
    )
    .returning({ id: schema.invitations.id });

  if (deleted.length === 0) {
    return NextResponse.json(
      {
        error:
          "no matching unconsumed invitation found (already consumed, or not yours)",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, id: deleted[0].id });
}
