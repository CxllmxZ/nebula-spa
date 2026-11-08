import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  verifyLineSignature,
  replyLineText,
  replyLineMessages,
  pushLineText,
  leaveLineGroup,
} from "@/lib/line";
import {
  consumeLinkCode,
  getLineSettings,
  linkStaffGroup,
  markStaffGroupDisconnected,
  setOwnerLineUserId,
} from "@/lib/db/queries/line";
import {
  canCustomerCancel,
  cancelBookingByCustomer,
  getBookingForLineUser,
  saveCancelReason,
  getLatestUpcomingBookingForLineUser,
  setLineNotifyEnabled,
} from "@/lib/db/queries/customer-line";
import {
  CANCEL_CONFIRM_TTL_MIN,
  bookingConfirmationMessage,
  cancelConfirmMessage,
  cancelledAskReasonMessage,
  isConfirmExpired,
  parsePostbackData,
  textMessage,
} from "@/lib/line-customer-messages";
import { notifyBookingEvent } from "@/lib/notify";
import {
  sendCancellationToSheet,
  sheetsConfigFrom,
  type SheetsConfig,
} from "@/lib/sheets";
import { RESCHEDULE_REASON, cancelReasonLabel } from "@/lib/cancel-reasons";

/**
 * POST /api/webhooks/line
 *
 * รับ event จาก LINE Platform (Session 10 — scope รอบนี้):
 *   - message (user)  : "#owner 123456" → ผูก LINE เจ้าของร้าน
 *   - message (group) : "#link 123456"  → ผูกกลุ่มพนักงาน / ข้อความอื่นในกลุ่ม → เงียบ
 *   - join   (group)  : บอทถูกเชิญเข้ากลุ่ม → บอกวิธีพิมพ์ #link
 *   - leave  (group)  : บอทถูกเอาออก → ถ้าเป็นกลุ่มที่ผูกไว้ → disconnected + แจ้งเจ้าของ
 *   - follow (user)   : ข้อความต้อนรับ + คิวล่าสุดที่ผูก LINE ไว้ (ถ้ามี) + ปุ่มยกเลิก (Day 40 / 42)
 *   - postback (user) : ลูกค้ากดปุ่มยกเลิก → ถามซ้ำ → ยกเลิก + แจ้งร้าน (Day 40)
 *                       → ถามสาเหตุ (Quick Reply) → บันทึก D1 + ส่ง Google Sheets (Day 43)
 *   - unfollow (user) : บล็อก/ลบเพื่อน OA → line_notify_enabled = false (ไม่ push หาอีก) (Day 42)
 *                       follow กลับมา → true
 *
 * Flow:
 *   1. อ่าน raw body (ต้องก่อน parse — ใช้ตรวจลายเซ็น)
 *   2. ตรวจ x-line-signature → ไม่ผ่าน = 401
 *   3. ประมวลผล event ใน ctx.waitUntil (Workers ตัด I/O หลัง return — Day 32)
 *   4. ตอบ 200 ทันที (LINE ต้องการคำตอบเร็ว ไม่งั้นนับเป็น error/redeliver)
 *
 * การตอบใช้ reply token เสมอเมื่อทำได้ = ไม่นับโควตา
 */

// ─────────────────────────────────────────────────────────────
// Minimal LINE event types (เฉพาะที่ใช้)
// ─────────────────────────────────────────────────────────────

type LineSource =
  | { type: "user"; userId: string }
  | { type: "group"; groupId: string; userId?: string }
  | { type: "room"; roomId: string; userId?: string };

interface LineEventBase {
  type: string;
  source: LineSource;
  replyToken?: string;
  mode?: "active" | "standby";
}

interface LineMessageEvent extends LineEventBase {
  type: "message";
  replyToken: string;
  message: { type: string; text?: string };
}

interface LinePostbackEvent extends LineEventBase {
  type: "postback";
  replyToken: string;
  postback: { data: string };
}

type LineEvent = LineEventBase | LineMessageEvent | LinePostbackEvent;

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

interface Ctx {
  token: string;
  enabled: boolean;
  fallbackOwnerId: string | undefined;
  /** Day 43 — Google Sheets ของร้าน (ไม่ตั้ง = ไม่ส่ง) */
  sheets: SheetsConfig;
}

const OWNER_CMD = /^#owner\s+(\d{6})$/i;
const LINK_CMD = /^#link\s+(\d{6})$/i;

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });

  // Step 1: raw body
  const rawBody = await request.text();

  // Step 2: signature
  const valid = await verifyLineSignature(
    env.LINE_CHANNEL_SECRET,
    rawBody,
    request.headers.get("x-line-signature"),
  );
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ปุ่ม "Verify" ใน Console ส่ง events: [] มา → ตอบ 200 เฉยๆ
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const handlerCtx: Ctx = {
    token: env.LINE_CHANNEL_ACCESS_TOKEN,
    enabled: env.LINE_ENABLED === "true",
    fallbackOwnerId: env.LINE_OWNER_USER_ID,
    sheets: sheetsConfigFrom(env),
  };

  // Step 3: background — event ละตัว พังตัวเดียวไม่ลากตัวอื่น
  ctx.waitUntil(
    Promise.allSettled(
      body.events.map((event) =>
        handleEvent(event, handlerCtx).catch((err) => {
          console.error("[LINE webhook] event failed", {
            type: event.type,
            source: event.source?.type,
            error: err instanceof Error ? err.message : String(err),
          });
        }),
      ),
    ),
  );

  // Step 4
  return NextResponse.json({ ok: true });
}

// ─────────────────────────────────────────────────────────────
// Event routing
// ─────────────────────────────────────────────────────────────

async function handleEvent(event: LineEvent, ctx: Ctx): Promise<void> {
  // standby = มีระบบอื่นถือแชทอยู่ (เช่น ตอบมือใน OA Manager) → ไม่ยุ่ง
  if (event.mode === "standby") return;

  switch (event.type) {
    case "message":
      return handleMessage(event as LineMessageEvent, ctx);
    case "join":
      return handleJoin(event, ctx);
    case "leave":
      return handleLeave(event, ctx);
    case "follow":
      return handleFollow(event, ctx);
    case "postback":
      return handlePostback(event as LinePostbackEvent, ctx);
    case "unfollow":
      return handleUnfollow(event);
    default:
      return;
  }
}

async function handleMessage(event: LineMessageEvent, ctx: Ctx) {
  if (event.message.type !== "text" || !event.message.text) return;
  const text = event.message.text.trim();
  const reply = (msg: string) =>
    replyLineText(ctx.token, event.replyToken, msg, ctx.enabled);

  // ── กลุ่ม ──────────────────────────────────────────────
  if (event.source.type === "group") {
    const match = text.match(LINK_CMD);
    if (!match) return; // ข้อความอื่นในกลุ่ม → เงียบ

    const groupId = event.source.groupId;
    const ok = await consumeLinkCode(match[1], "staff_group");
    if (!ok) {
      return reply(
        "รหัสไม่ถูกต้องหรือหมดอายุแล้ว\nสร้างรหัสใหม่ได้ที่หน้าตั้งค่าร้าน",
      );
    }

    const previousGroupId = await linkStaffGroup(groupId);
    await reply("เชื่อมกลุ่มเรียบร้อย ✅\nระบบจะแจ้งคิวในกลุ่มนี้");

    // ผูกกลุ่มใหม่แทนกลุ่มเดิม → บอทออกจากกลุ่มเดิม (กลุ่มเดียวต่อร้าน)
    if (previousGroupId) {
      await leaveLineGroup(ctx.token, previousGroupId, ctx.enabled);
    }
    return;
  }

  // ── room (แชทหลายคนที่ไม่ใช่กลุ่ม) → ไม่รองรับ เงียบ ───
  if (event.source.type !== "user") return;

  // ── แชท 1:1 ────────────────────────────────────────────
  const ownerMatch = text.match(OWNER_CMD);
  if (ownerMatch) {
    const ok = await consumeLinkCode(ownerMatch[1], "owner");
    if (!ok) {
      return reply(
        "รหัสไม่ถูกต้องหรือหมดอายุแล้ว\nสร้างรหัสใหม่ได้ที่หน้าตั้งค่าร้าน",
      );
    }
    await setOwnerLineUserId(event.source.userId);
    return reply("เชื่อม LINE เจ้าของร้านเรียบร้อย ✅\nจะแจ้งคิวใหม่ทางแชทนี้");
  }

  if (LINK_CMD.test(text)) {
    return reply("คำสั่ง #link ต้องพิมพ์ในกลุ่มพนักงาน ไม่ใช่แชทนี้");
  }

  // ข้อความทั่วไปจากลูกค้า → reply (ฟรี) บอกช่องทาง
  return reply(
    "ขอบคุณที่ทักมาค่ะ 🌙\nแชทนี้ใช้แจ้งเตือนการจองอัตโนมัติ\nหากต้องการเลื่อนหรือสอบถาม กรุณาโทรหาร้านโดยตรง",
  );
}

async function handleJoin(event: LineEventBase, ctx: Ctx) {
  if (event.source.type !== "group" || !event.replyToken) return;

  const settings = await getLineSettings();
  const alreadyLinked =
    settings.staffGroupStatus === "linked" &&
    settings.staffGroupId === event.source.groupId;
  if (alreadyLinked) return;

  await replyLineText(
    ctx.token,
    event.replyToken,
    "สวัสดีค่ะ 🌙 Nebula Spa\nเจ้าของร้านพิมพ์ #link ตามด้วยรหัส 6 หลักจากหน้าตั้งค่าร้าน เพื่อเริ่มแจ้งคิวในกลุ่มนี้",
    ctx.enabled,
  );
}

async function handleLeave(event: LineEventBase, ctx: Ctx) {
  if (event.source.type !== "group") return;

  const wasLinked = await markStaffGroupDisconnected(event.source.groupId);
  if (!wasLinked) return;

  // leave ไม่มี reply token → ต้อง push หาเจ้าของ (นับโควตา 1)
  const settings = await getLineSettings();
  const ownerId = settings.ownerLineUserId ?? ctx.fallbackOwnerId;
  if (!ownerId) return;

  await pushLineText(
    ctx.token,
    ownerId,
    "⚠️ บอทออกจากกลุ่มพนักงานแล้ว\nระบบจะแจ้งคิวหาคุณโดยตรงจนกว่าจะเชื่อมกลุ่มใหม่",
    ctx.enabled,
  );
}

async function handleFollow(event: LineEventBase, ctx: Ctx) {
  if (event.source.type !== "user" || !event.replyToken) return;

  // กลับมาแอดเพื่อน (เคยบล็อก) → ส่งข้อความหาได้อีก — ไม่ใช่ลูกค้าที่เคยผูก = ไม่มีผล
  await setLineNotifyEnabled(event.source.userId, true);

  // ลูกค้าที่ผูก LINE ไว้ก่อนแอดเพื่อน → push ตอนผูกไม่ผ่าน → ส่งตอนนี้แทน (reply = ฟรี)
  // ส่งแค่คิวที่จองล่าสุด (Day 42) — ลบเพื่อนแล้วแอดใหม่ จะไม่ได้คิวเก่าทั้งหมดซ้ำ
  const latest = await getLatestUpcomingBookingForLineUser(event.source.userId);

  const welcome = latest
    ? "ยินดีต้อนรับสู่ Nebula Spa 🌙\nนี่คือคิวล่าสุดที่คุณจองไว้ ยกเลิกได้จากปุ่มด้านล่าง"
    : "ยินดีต้อนรับสู่ Nebula Spa 🌙\nเราจะส่งรายละเอียดคิวที่คุณจองผ่านแชทนี้";

  await replyLineMessages(
    ctx.token,
    event.replyToken,
    latest
      ? [textMessage(welcome), bookingConfirmationMessage(latest)]
      : [textMessage(welcome)],
    ctx.enabled,
  );
}

/**
 * บล็อก / ลบเพื่อน OA — ไม่มี reply token (ตอบไม่ได้อยู่แล้ว)
 * จดไว้ว่าไม่ต้อง push หาอีก · ถ้าเป็นเจ้าของร้าน: ไม่อยู่ในตาราง customers → ไม่มีผล
 */
async function handleUnfollow(event: LineEventBase) {
  if (event.source.type !== "user") return;
  const known = await setLineNotifyEnabled(event.source.userId, false);
  if (known) console.log("[LINE webhook] customer unfollowed → notify off");
}

// ─────────────────────────────────────────────────────────────
// Postback — ลูกค้ากดปุ่มในข้อความ (Day 40)
// ─────────────────────────────────────────────────────────────

const CALL_SHOP = "กรุณาโทรหาร้านโดยตรง";

async function handlePostback(event: LinePostbackEvent, ctx: Ctx) {
  if (event.source.type !== "user") return;
  const userId = event.source.userId;
  const reply = (text: string) =>
    replyLineText(ctx.token, event.replyToken, text, ctx.enabled);

  const parsed = parsePostbackData(event.postback.data);
  if (!parsed) return;
  const { action, code, issuedAt } = parsed;

  if (action === "cancel_keep") {
    return reply("รับทราบค่ะ คิวของคุณยังอยู่ตามเดิม 🌙");
  }

  if (action === "reason") {
    return handleReason(event, ctx, code, parsed.reason!);
  }

  // ── ตรวจสิทธิ์: คิวต้องผูกกับ LINE นี้ ──────────────────
  const booking = await getBookingForLineUser(code, userId);
  if (!booking) {
    return reply(`ไม่พบคิวนี้ในบัญชี LINE ของคุณ\n${CALL_SHOP}`);
  }

  if (action === "cancel") {
    if (!canCustomerCancel(booking)) return reply(cannotCancelText(booking));
    return replyLineMessages(
      ctx.token,
      event.replyToken,
      [cancelConfirmMessage(booking)],
      ctx.enabled,
    );
  }

  // action === "cancel_confirm"
  // ปุ่มจากข้อความถามซ้ำอันเก่า (เกิน 10 นาที) → ไม่ยกเลิก ถามใหม่แทน (กันกดพลาดย้อนหลัง)
  if (isConfirmExpired(issuedAt)) {
    if (!canCustomerCancel(booking)) return reply(cannotCancelText(booking));
    return replyLineMessages(
      ctx.token,
      event.replyToken,
      [
        textMessage(
          `ปุ่มนี้หมดอายุแล้ว (ใช้ได้ ${CANCEL_CONFIRM_TTL_MIN} นาทีหลังถาม)\nถ้ายังต้องการยกเลิก กดยืนยันอีกครั้งด้านล่าง`,
        ),
        cancelConfirmMessage(booking),
      ],
      ctx.enabled,
    );
  }

  // ยกเลิกจริง (atomic — กดซ้ำได้ผลครั้งเดียว)
  const cancelled = await cancelBookingByCustomer(code, userId);
  if (!cancelled) {
    const latest = await getBookingForLineUser(code, userId);
    return reply(latest ? cannotCancelText(latest) : CALL_SHOP);
  }

  // ยกเลิกแล้ว + ถามสาเหตุ (Quick Reply — ไม่บังคับ) · reply = ไม่นับโควตา
  await replyLineMessages(
    ctx.token,
    event.replyToken,
    [cancelledAskReasonMessage(cancelled.code)],
    ctx.enabled,
  );

  // แจ้งเจ้าของ + กลุ่ม (กติกาวันหยุด / fallback อยู่ใน notify.ts)
  await notifyBookingEvent(
    { type: "cancelled", booking: cancelled, by: "customer" },
    {
      token: ctx.token,
      enabled: ctx.enabled,
      fallbackOwnerId: ctx.fallbackOwnerId,
    },
  );
}

/**
 * ลูกค้าเลือกสาเหตุการยกเลิก (Day 43)
 * บันทึกครั้งเดียว (atomic) → ตอบขอบคุณ → ส่ง Google Sheets (ถ้าร้านตั้งไว้)
 * "ขอเลื่อน / จองผิด" → แจ้งกลุ่มพนักงานให้โทรนัดใหม่ (วันร้านปิด → เจ้าของ)
 *   ไม่ส่งลิงก์ให้ลูกค้าจองใหม่เอง (สเปก: เลื่อนนัด = โทรคุยกับร้าน)
 */
async function handleReason(
  event: LinePostbackEvent,
  ctx: Ctx,
  code: string,
  reason: string,
) {
  if (event.source.type !== "user") return;
  const reply = (text: string) =>
    replyLineText(ctx.token, event.replyToken, text, ctx.enabled);

  const saved = await saveCancelReason(code, event.source.userId, reason);
  if (!saved) {
    // ตอบไปแล้ว / ไม่ใช่คิวที่ลูกค้ายกเลิกเอง / ไม่ใช่ของ LINE นี้ → ไม่บันทึกซ้ำ
    return reply("รับทราบค่ะ ขอบคุณที่แจ้งให้ทราบ 🙏");
  }

  const wantsReschedule = reason === RESCHEDULE_REASON;
  await reply(
    wantsReschedule
      ? "รับทราบค่ะ 🙏\nทางร้านจะติดต่อกลับเพื่อนัดเวลาใหม่ให้นะคะ"
      : `ขอบคุณที่บอกเหตุผลค่ะ 🙏 (${cancelReasonLabel(reason)})\nหวังว่าจะได้ดูแลคุณอีกครั้งนะคะ 🌙`,
  );

  if (wantsReschedule) {
    await notifyBookingEvent(
      { type: "reschedule_request", booking: saved },
      {
        token: ctx.token,
        enabled: ctx.enabled,
        fallbackOwnerId: ctx.fallbackOwnerId,
      },
    );
  }

  await sendCancellationToSheet(ctx.sheets, saved);
}

function cannotCancelText(b: { status: string; startsAt: Date }): string {
  if (b.status === "cancelled") return "คิวนี้ถูกยกเลิกไปแล้วค่ะ";
  if (b.status === "completed") return "คิวนี้ใช้บริการเรียบร้อยแล้วค่ะ";
  if (b.startsAt.getTime() <= Date.now()) {
    return `เลยเวลานัดแล้ว ยกเลิกผ่าน LINE ไม่ได้\n${CALL_SHOP}`;
  }
  return `ยกเลิกคิวนี้ผ่าน LINE ไม่ได้\n${CALL_SHOP}`;
}
