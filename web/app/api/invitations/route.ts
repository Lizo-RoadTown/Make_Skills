import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, schema } from "@/db";

/**
 * Tenant-scoped invitation management. Admin-only.
 *
 * GET  /api/invitations       — list pending + recent invites for caller's tenant
 * POST /api/invitations { email } — issue new invite for the given email
 *
 * Revocation lives at /api/invitations/[id] (DELETE).
 */

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "admin role required" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: schema.invitations.id,
      email: schema.invitations.email,
      token: schema.invitations.token,
      createdAt: schema.invitations.createdAt,
      consumedAt: schema.invitations.consumedAt,
      consumedByEmail: schema.invitations.consumedByEmail,
    })
    .from(schema.invitations)
    .where(eq(schema.invitations.tenantId, session.user.tenantId))
    .orderBy(desc(schema.invitations.createdAt))
    .limit(100);

  return NextResponse.json({
    invitations: rows.map((r) => ({
      id: r.id,
      email: r.email,
      token: r.token,
      createdAt: r.createdAt?.toISOString(),
      consumedAt: r.consumedAt?.toISOString() || null,
      consumedByEmail: r.consumedByEmail,
      status: r.consumedAt ? "consumed" : "pending",
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "admin role required" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "valid email required" },
      { status: 400 },
    );
  }

  // Check for an existing unconsumed invite (partial unique index in
  // SQL also enforces this, but a friendly 409 beats a raw constraint
  // violation).
  const existing = await db
    .select({ id: schema.invitations.id })
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.email, email),
        isNull(schema.invitations.consumedAt),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return NextResponse.json(
      { error: "an unconsumed invitation for this email already exists" },
      { status: 409 },
    );
  }

  const inserted = await db
    .insert(schema.invitations)
    .values({
      email,
      tenantId: session.user.tenantId,
      // token defaults to gen_random_bytes(24) hex per the SQL migration
    })
    .returning({
      id: schema.invitations.id,
      email: schema.invitations.email,
      token: schema.invitations.token,
      createdAt: schema.invitations.createdAt,
    });

  return NextResponse.json({
    invitation: {
      id: inserted[0].id,
      email: inserted[0].email,
      token: inserted[0].token,
      createdAt: inserted[0].createdAt?.toISOString(),
      status: "pending",
    },
  });
}
