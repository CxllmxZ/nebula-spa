import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";
import { updateLineSettings } from "@/lib/db/queries/line";
import { getLineSettingsDTO } from "@/lib/line-settings-dto";

/**
 * GET   /api/admin/line/settings — สถานะการเชื่อม LINE + ค่าตั้ง (admin only)
 * PATCH /api/admin/line/settings — แก้ ownerNotifyEnabled / summaryEnabled / summaryTime
 */

const patchSchema = z
  .object({
    ownerNotifyEnabled: z.boolean().optional(),
    summaryEnabled: z.boolean().optional(),
    summaryTime: z
      .enum(["06:00", "07:00", "08:00", "09:00"], {
        message: "เลือกได้ 06:00, 07:00, 08:00 หรือ 09:00",
      })
      .optional(),
  })
  .strict();

async function guard(request: Request): Promise<Response | null> {
  try {
    await requireRole(request, ["admin"]);
    return null;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  try {
    return NextResponse.json(await getLineSettingsDTO());
  } catch (err) {
    console.error("[GET /api/admin/line/settings]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 },
    );
  }

  try {
    await updateLineSettings(parsed.data);
    return NextResponse.json(await getLineSettingsDTO());
  } catch (err) {
    console.error("[PATCH /api/admin/line/settings]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
