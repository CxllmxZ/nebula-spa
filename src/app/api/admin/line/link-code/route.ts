import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";
import { createLinkCode } from "@/lib/db/queries/line";
import { toBangkokIsoString } from "@/lib/datetime";

/**
 * POST /api/admin/line/link-code (admin only)
 *
 * Body: { purpose: "owner" | "staff_group" }
 * → { code, expiresAt }  รหัส 6 หลัก อายุ 30 นาที ใช้ได้ครั้งเดียว
 *   สร้างใหม่ = รหัสเก่า purpose เดียวกันใช้ไม่ได้ทันที
 */

const schema = z.object({ purpose: z.enum(["owner", "staff_group"]) });

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  }

  try {
    const { code, expiresAt } = await createLinkCode(parsed.data.purpose);
    return NextResponse.json({
      code,
      expiresAt: toBangkokIsoString(expiresAt),
    });
  } catch (err) {
    console.error("[POST /api/admin/line/link-code]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
