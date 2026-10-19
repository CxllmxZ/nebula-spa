import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";
import { unlinkOwner, unlinkStaffGroup } from "@/lib/db/queries/line";
import { leaveLineGroup } from "@/lib/line";

/**
 * POST /api/admin/line/unlink (admin only)
 *
 * Body: { target: "owner" | "staff_group" }
 *   owner       → ล้าง LINE เจ้าของ (กลับไปใช้ LINE_OWNER_USER_ID ใน env ถ้ามี)
 *   staff_group → ล้างกลุ่ม + ให้บอทออกจากกลุ่ม
 */

const schema = z.object({ target: z.enum(["owner", "staff_group"]) });

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
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }

  try {
    if (parsed.data.target === "owner") {
      await unlinkOwner();
    } else {
      const groupId = await unlinkStaffGroup();
      if (groupId) {
        const { env, ctx } = await getCloudflareContext({ async: true });
        // ล้าง DB ก่อน แล้วค่อยออกจากกลุ่ม — event leave ที่ตามมาจะไม่ตรงกลุ่มที่ผูก → ไม่แจ้งเจ้าของซ้ำ
        ctx.waitUntil(
          leaveLineGroup(
            env.LINE_CHANNEL_ACCESS_TOKEN,
            groupId,
            env.LINE_ENABLED === "true",
          ).catch((err) =>
            console.error("[unlink] leave group failed", {
              error: err instanceof Error ? err.message : String(err),
            }),
          ),
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/line/unlink]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
