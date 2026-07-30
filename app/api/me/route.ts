import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { effectiveCapabilities } from "@/lib/permissions";

// The signed-in user's own profile + the capabilities they effectively have, so
// the UI can hide actions they can't perform. Read from the DB (not the JWT) so
// a freshly granted permission applies without re-logging in.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = session.user as { id: string };

  const farmer = await prisma.farmer.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, jobTitle: true, permissions: true, avatar: true },
  });
  if (!farmer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...farmer,
    capabilities: effectiveCapabilities(farmer),
  });
}
