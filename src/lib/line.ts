/**
 * LINE Messaging API — server-side helpers.
 *
 * ⚠️ LINE Notify shut down 31 Mar 2025 — MUST use Messaging API.
 *
 * ทุกฟังก์ชันที่ยิง API รับ `enabled` เป็น parameter (อ่านจาก Cloudflare env ที่ caller)
 * ไม่อ่าน process.env เอง — single source of truth
 *
 * ⚠️ บน Cloudflare Workers: งานเบื้องหลังต้องห่อ ctx.waitUntil() เสมอ
 * ไม่งั้น Worker ตัด I/O ทิ้งหลัง return response (Day 32)
 *
 * Docs: https://developers.line.biz/en/reference/messaging-api/
 */

const LINE_API_BASE = "https://api.line.me/v2/bot";
const LINE_PUSH_URL = `${LINE_API_BASE}/message/push`;
const LINE_REPLY_URL = `${LINE_API_BASE}/message/reply`;

interface LineTextMessage {
  type: "text";
  text: string;
}

interface LinePushError {
  message: string;
  details?: Array<{ property?: string; message: string }>;
}

export interface BookingNotificationData {
  code: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  startsAt: Date; // UTC
  durationMin: number;
  price: number;
}

// ─────────────────────────────────────────────────────────────
// Webhook signature
// ─────────────────────────────────────────────────────────────

/**
 * ตรวจ x-line-signature = base64(HMAC-SHA256(channelSecret, rawBody))
 *
 * - ต้องใช้ raw body (string ก่อน JSON.parse) — parse แล้ว stringify ใหม่ = byte ไม่ตรง
 * - ใช้ crypto.subtle.verify → เทียบแบบ constant-time (กัน timing attack)
 */
export async function verifyLineSignature(
  channelSecret: string,
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!channelSecret || !signature) return false;

  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  } catch {
    return false; // ไม่ใช่ base64
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(rawBody),
  );
}

// ─────────────────────────────────────────────────────────────
// Send messages
// ─────────────────────────────────────────────────────────────

function maskId(id: string): string {
  return id.slice(0, 6) + "...";
}

async function throwLineError(response: Response): Promise<never> {
  let errorMessage = `LINE API ${response.status}`;
  try {
    const errorBody = (await response.json()) as LinePushError;
    errorMessage += `: ${errorBody.message}`;
    if (errorBody.details?.length) {
      errorMessage += ` (${errorBody.details.map((d) => d.message).join(", ")})`;
    }
  } catch {
    // Response body not JSON — ignore
  }
  throw new Error(errorMessage);
}

async function postLine(
  url: string,
  channelAccessToken: string,
  body: unknown,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwLineError(response);
}

/**
 * Push text ถึง user หรือ group (to = userId / groupId)
 * นับโควตา — กลุ่มนับตามจำนวนสมาชิก
 *
 * @throws Error if API call fails (caller decides retry/log/ignore)
 */
export async function pushLineText(
  channelAccessToken: string,
  to: string,
  text: string,
  enabled: boolean = true,
): Promise<void> {
  if (!enabled) {
    console.log("[LINE disabled] would push:", { to: maskId(to), text });
    return;
  }
  if (!channelAccessToken || !to) {
    throw new Error("[LINE] Missing channelAccessToken or recipient");
  }

  const messages: LineTextMessage[] = [{ type: "text", text }];
  await postLine(LINE_PUSH_URL, channelAccessToken, { to, messages });
}

/**
 * Reply ด้วย replyToken จาก webhook event
 * ไม่นับโควตา — ใช้ตอบในกลุ่ม/แชทเสมอเมื่อทำได้
 * replyToken ใช้ได้ครั้งเดียว และหมดอายุเร็ว (ตอบทันทีใน webhook)
 */
export async function replyLineText(
  channelAccessToken: string,
  replyToken: string,
  text: string,
  enabled: boolean = true,
): Promise<void> {
  if (!enabled) {
    console.log("[LINE disabled] would reply:", { text });
    return;
  }
  if (!channelAccessToken || !replyToken) {
    throw new Error("[LINE] Missing channelAccessToken or replyToken");
  }

  const messages: LineTextMessage[] = [{ type: "text", text }];
  await postLine(LINE_REPLY_URL, channelAccessToken, { replyToken, messages });
}

/**
 * ให้บอทออกจากกลุ่ม — ใช้ตอนผูกกลุ่มใหม่แทนกลุ่มเดิม
 * 404 = บอทไม่อยู่ในกลุ่มแล้ว → ถือว่าสำเร็จ
 */
export async function leaveLineGroup(
  channelAccessToken: string,
  groupId: string,
  enabled: boolean = true,
): Promise<void> {
  if (!enabled) {
    console.log("[LINE disabled] would leave group:", maskId(groupId));
    return;
  }

  const response = await fetch(
    `${LINE_API_BASE}/group/${encodeURIComponent(groupId)}/leave`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    },
  );
  if (!response.ok && response.status !== 404) await throwLineError(response);
}

// ─────────────────────────────────────────────────────────────
// Booking notification (owner)
// ─────────────────────────────────────────────────────────────

/**
 * Send new booking notification to shop owner.
 * Design: fire-and-forget from caller (ctx.waitUntil) — errors logged, never rollback booking.
 */
export async function sendBookingNotification(
  channelAccessToken: string,
  ownerUserId: string,
  data: BookingNotificationData,
  enabled: boolean = true,
): Promise<void> {
  const text = formatBookingMessage(data);
  await pushLineText(channelAccessToken, ownerUserId, text, enabled);
}

// ---------- Internal formatting ----------

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const THAI_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/**
 * Format Bangkok time as "ส. 15 ส.ค. 2569"
 */
function formatBangkokDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const day = get("day");
  const month = Number.parseInt(get("month"), 10);
  const yearBE = Number.parseInt(get("year"), 10) + 543;

  // Weekday index via UTC offset trick (Bangkok = UTC+7, no DST)
  const bangkokMs = date.getTime() + 7 * 60 * 60 * 1000;
  const dayOfWeek = new Date(bangkokMs).getUTCDay();

  return `${THAI_DAYS[dayOfWeek]} ${day} ${THAI_MONTHS[month - 1]} ${yearBE}`;
}

/**
 * Format Bangkok time as "14:00"
 */
function formatBangkokTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

function formatBookingMessage(data: BookingNotificationData): string {
  const startsAt = data.startsAt;
  const endsAt = new Date(startsAt.getTime() + data.durationMin * 60 * 1000);

  return [
    "🌙 จองใหม่ Nebula Spa",
    "",
    `รหัสจอง: ${data.code}`,
    `ลูกค้า: ${data.customerName}`,
    `เบอร์: ${data.customerPhone}`,
    "",
    `บริการ: ${data.serviceName}`,
    `วัน: ${formatBangkokDate(startsAt)}`,
    `เวลา: ${formatBangkokTime(startsAt)} - ${formatBangkokTime(endsAt)}`,
    `ราคา: ${data.price} บาท`,
  ].join("\n");
}
