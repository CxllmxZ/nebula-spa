import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  verifyLineSignature,
  replyLineText,
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

/**
 * POST /api/webhooks/line
 *
 * รับ event จาก LINE Platform (Session 10 — scope รอบนี้):
 *   - message (user)  : "#owner 123456" → ผูก LINE เจ้าของร้าน
 *   - message (group) : "#link 123456"  → ผูกกลุ่มพนักงาน / ข้อความอื่นในกลุ่ม → เงียบ
 *   - join   (group)  : บอทถูกเชิญเข้ากลุ่ม → บอกวิธีพิมพ์ #link
 *   - leave  (group)  : บอทถูกเอาออก → ถ้าเป็นกลุ่มที่ผูกไว้ → disconnected + แจ้งเจ้าของ
 *   - follow (user)   : ข้อความต้อนรับ
 *   (postback / unfollow ของลูกค้า → session ถัดไป)
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

type LineEvent = LineEventBase | LineMessageEvent;

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

interface Ctx {
  token: string;
  enabled: boolean;
  fallbackOwnerId: string | undefined;
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
    default:
      return; // unfollow / postback ฯลฯ → session ถัดไป
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

  await replyLineText(
    ctx.token,
    event.replyToken,
    "ยินดีต้อนรับสู่ Nebula Spa 🌙\nเราจะแจ้งเตือนคิวที่คุณจองผ่านแชทนี้",
    ctx.enabled,
  );
}
