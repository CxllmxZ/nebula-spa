/**
 * LINE Messaging API — server-side push notification.
 *
 * ⚠️ LINE Notify shut down 31 Mar 2025 — MUST use Messaging API.
 *
 * Flow:
 *   1. Owner follows OA channel (get their LINE user ID)
 *   2. Server pushes messages via API to that user ID
 *   3. Owner sees notification in their LINE app
 *
 * Free tier: 500 push messages/month (enough for demo).
 *
 * Docs: https://developers.line.biz/en/reference/messaging-api/#send-push-message
 */

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

interface LineTextMessage {
  type: "text";
  text: string;
}

interface LinePushBody {
  to: string;
  messages: LineTextMessage[];
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

/**
 * Push a raw text message to a LINE user.
 * Low-level — usually use sendBookingNotification instead.
 *
 * @throws Error if API call fails (caller decides retry/log/ignore)
 */
export async function pushLineText(
  channelAccessToken: string,
  userId: string,
  text: string,
): Promise<void> {
  if (!channelAccessToken || !userId) {
    throw new Error("[LINE] Missing channelAccessToken or userId");
  }

  const body: LinePushBody = {
    to: userId,
    messages: [{ type: "text", text }],
  };

  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
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
}

/**
 * Send new booking notification to shop owner.
 * Formats booking data into Thai text message.
 *
 * Design: fire-and-forget from caller — errors logged, never rollback booking.
 *
 * Example output:
 *   🌙 จองใหม่ Nebula Spa
 *
 *   รหัสจอง: A3F9K2
 *   ลูกค้า: คุณสมชาย
 *   เบอร์: 0812345678
 *
 *   บริการ: นวดไทย 60 นาที
 *   วัน: เสาร์ 15 ส.ค. 2569
 *   เวลา: 14:00 - 15:00
 *   ราคา: 300 บาท
 */
export async function sendBookingNotification(
  channelAccessToken: string,
  ownerUserId: string,
  data: BookingNotificationData,
): Promise<void> {
  const text = formatBookingMessage(data);
  await pushLineText(channelAccessToken, ownerUserId, text);
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
 * Format Bangkok time as "เสาร์ 15 ส.ค. 2569"
 * Note: Uses Intl.DateTimeFormat with Asia/Bangkok timezone.
 */
function formatBangkokDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const day = get("day");
  const month = Number.parseInt(get("month"), 10);
  const yearAD = Number.parseInt(get("year"), 10);
  const yearBE = yearAD + 543;

  // Weekday index via UTC offset trick
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

  const dateStr = formatBangkokDate(startsAt);
  const startTime = formatBangkokTime(startsAt);
  const endTime = formatBangkokTime(endsAt);

  return [
    "🌙 จองใหม่ Nebula Spa",
    "",
    `รหัสจอง: ${data.code}`,
    `ลูกค้า: ${data.customerName}`,
    `เบอร์: ${data.customerPhone}`,
    "",
    `บริการ: ${data.serviceName}`,
    `วัน: ${dateStr}`,
    `เวลา: ${startTime} - ${endTime}`,
    `ราคา: ${data.price} บาท`,
  ].join("\n");
}
