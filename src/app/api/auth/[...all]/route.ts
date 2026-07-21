import { NextResponse } from "next/server";

// Placeholder — will be replaced with Better Auth catch-all handler
// See: https://www.better-auth.com/docs/integrations/next

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Auth not configured yet" },
    { status: 501 },
  );
}

export async function POST() {
  return NextResponse.json(
    { ok: false, message: "Auth not configured yet" },
    { status: 501 },
  );
}
