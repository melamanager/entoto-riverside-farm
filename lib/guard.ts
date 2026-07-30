import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, type Capability } from "@/lib/permissions";

// Server-side capability guard for API routes.
//
// Permissions are read from the DB rather than the JWT on purpose: a manager
// granting "attendance" to someone must take effect immediately, not after that
// person logs out and back in.
//
// Usage:
//   const gate = await requireCapability("attendance");
//   if (!gate.ok) return gate.response;
//   const { userId, role } = gate;

type GateOk = { ok: true; userId: string; role: string };
type GateFail = { ok: false; response: NextResponse };

export async function requireCapability(cap: Capability): Promise<GateOk | GateFail> {
  const session = await auth();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { id: userId, role } = session.user as { id: string; role: string };

  // managers and supervisors are covered by role alone — skip the lookup
  if (can({ role, permissions: [] }, cap)) return { ok: true, userId, role };

  const farmer = await prisma.farmer.findUnique({
    where: { id: userId },
    select: { role: true, permissions: true },
  });
  if (!farmer || !can(farmer, cap)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `You don't have permission to do that (${cap}). Ask a manager to grant it.` },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId, role };
}
