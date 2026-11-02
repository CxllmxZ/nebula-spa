import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { verifyLineIdToken } from "@/lib/line-login";
import { linkBookingToLine } from "@/lib/db/queries/customer-line";
import { pushLineMessages } from "@/lib/line";
import { bookingConfirmationMessage } from "@/lib/line-customer-messages";

/**
 * POST /api/line/link — ลูกค้าผูก LINE กับคิว (จากหน้ายืนยันการจอง)
 *
 * Body: { code, idToken }
 *
 * Flow:
 *   1. ตรวจ body
 *   2. ตรวจ ID token กับ LINE (ไม่เชื่อ userId จากหน้าเว็บ)
 *   3. ผูก — 1 คิวผูกได้ LINE เดียว
 *   4. ผูกครั้งแรก → push รายละเอียด + ปุ่มยกเลิก (นับโควตา 1)
 *      ยังไม่เป็นเพื่อน OA → push ไม่ผ่าน → ไม่เป็นไร: แอดเพื่อนเมื่อไหร่ webhook "follow" ส่งให้ (reply ฟรี)
 *
 * Response: { linked: true, messageSent } | { error, code }
 *   400 INVALID_BODY · 401 INVALID_TOKEN · 404 NOT_FOUND
 *   409 LINKED_TO_OTHER / PHONE_TAKEN · 422 CLOSED
 */

const bodySchema = z.object({
  code: z.string().trim().min(4).max(12),
  idToken: z.string().min(10),
});

const ERROR_STATUS = {
  NOT_FOUND: 404,
  CLOSED: 422,
  LINKED_TO_OTHER: 409,
  PHONE_TAKEN: 409,
} as const;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const { env } = await getCloudflareContext({ async: true });

  const identity = await verifyLineIdToken(
    parsed.data.idToken,
    env.LINE_LOGIN_CHANNEL_ID,
  );
  if (!identity) {
    return NextResponse.json(
      { error: "LINE login expired", code: "INVALID_TOKEN" },
      { status: 401 },
    );
  }

  const result = await linkBookingToLine(parsed.data.code, identity.userId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, code: result.reason },
      { status: ERROR_STATUS[result.reason] },
    );
  }

  // ผูกซ้ำ (รีเฟรชหน้า) → ไม่ส่งซ้ำ
  let messageSent = false;
  if (result.newlyLinked) {
    try {
      await pushLineMessages(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        identity.userId,
        [bookingConfirmationMessage(result.booking)],
        env.LINE_ENABLED === "true",
      );
      messageSent = true;
    } catch (err) {
      // ส่วนใหญ่ = ยังไม่เป็นเพื่อน OA → follow event จะส่งให้ทีหลัง
      console.warn("[LINE link] push failed (probably not a friend yet)", {
        code: result.booking.code,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ linked: true, messageSent });
}
