/**
 * Notification dispatcher — จุดรวมเดียวสำหรับแจ้งเหตุการณ์คิวผ่าน LINE
 *
 * ใครได้อะไร (ตาม line-integration-plan.md → Notification Map):
 *   created    : เจ้าของ ✅ (มีเบอร์โทร)   + กลุ่ม ✅ (ไม่มีเบอร์โทร)
 *   cancelled  : by owner (ทำในหน้า admin) → กลุ่มเท่านั้น
 *                by customer (LINE, session ถัดไป) → เจ้าของ + กลุ่ม
 *
 * กฎกลุ่ม:
 *   - วันที่ร้านปิดทั้งวัน (ดูจาก "วันนี้" ไม่ใช่วันนัด) → ไม่ส่งเข้ากลุ่ม (สรุปเช้าจะเก็บให้)
 *   - กลุ่ม disconnected / ส่งไม่สำเร็จ 2 ครั้ง → ส่งหาเจ้าของแทน
 *     (ยกเว้นเจ้าของได้ข้อความนี้ไปแล้ว หรือเจ้าของเป็นคนทำเอง)
 *
 * ทุกการส่ง = push = นับโควตา (กลุ่มนับตามจำนวนสมาชิก)
 * Caller ต้องห่อ ctx.waitUntil() เสมอ — ห้าม await บล็อก response
 */

import { getLineSettings } from "@/lib/db/queries/line";
import { getDayClosure } from "@/lib/db/queries/availability";
import { pushLineText, formatBangkokDate, formatBangkokTime } from "@/lib/line";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface NotifyBooking {
  code: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  startsAt: Date; // UTC
  durationMin: number;
  price: number;
  notes: string | null;
  status: string;
}

export type BookingEvent =
  | { type: "created"; booking: NotifyBooking }
  | { type: "cancelled"; booking: NotifyBooking; by: "customer" | "owner" };

export interface NotifyEnv {
  token: string;
  enabled: boolean;
  fallbackOwnerId?: string; // env LINE_OWNER_USER_ID — ใช้ถ้ายังไม่ผูก #owner
}

/** สร้าง NotifyEnv จาก Cloudflare env — อ่าน env ที่เดียว */
export function notifyEnvFrom(env: CloudflareEnv): NotifyEnv {
  return {
    token: env.LINE_CHANNEL_ACCESS_TOKEN,
    enabled: env.LINE_ENABLED === "true",
    fallbackOwnerId: env.LINE_OWNER_USER_ID || undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────

export async function notifyBookingEvent(
  event: BookingEvent,
  env: NotifyEnv,
): Promise<void> {
  const settings = await getLineSettings();
  const ownerId = settings.ownerLineUserId ?? env.fallbackOwnerId;
  const ownerOn = !!ownerId && settings.ownerNotifyEnabled;

  // ── เจ้าของ ───────────────────────────────────────────────
  const ownerWants = !(event.type === "cancelled" && event.by === "owner");
  let ownerReceived = false;

  if (ownerOn && ownerWants) {
    ownerReceived = await safePush(env, ownerId!, ownerMessage(event));
  }

  // ── กลุ่ม ──────────────────────────────────────────────────
  if (await isShopClosedToday()) return; // สรุปเช้าจะเก็บให้

  const groupText = groupMessage(event);

  if (settings.staffGroupStatus === "linked" && settings.staffGroupId) {
    // ลองซ้ำ 1 ครั้ง (ตามแผน) — ไม่เปลี่ยนสถานะกลุ่ม (รอ event leave เป็นตัวตัดสิน)
    const ok =
      (await safePush(env, settings.staffGroupId, groupText)) ||
      (await safePush(env, settings.staffGroupId, groupText));
    if (ok) return;
  } else if (settings.staffGroupStatus === "not_linked") {
    return; // ร้านไม่ได้ใช้กลุ่ม → ไม่ต้อง fallback
  }

  // กลุ่มหลุด หรือส่งกลุ่มไม่สำเร็จ → ส่งหาเจ้าของแทน
  // ข้าม: เจ้าของได้ข้อความไปแล้ว / เจ้าของเป็นคนทำเอง / ปิดแจ้งเตือนไว้
  if (ownerOn && ownerWants && !ownerReceived) {
    await safePush(env, ownerId!, `(แทนกลุ่มพนักงาน)\n${groupText}`);
  }
}

/** push แบบไม่ throw — log แล้วคืน true/false */
async function safePush(
  env: NotifyEnv,
  to: string,
  text: string,
): Promise<boolean> {
  try {
    await pushLineText(env.token, to, text, env.enabled);
    return true;
  } catch (err) {
    console.error("[notify] push failed", {
      to: to.slice(0, 6) + "...",
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Shop closed (Asia/Bangkok)
// ─────────────────────────────────────────────────────────────

/** วันนี้ตามเวลาไทย "YYYY-MM-DD" */
export function bangkokToday(): string {
  // en-CA → "YYYY-MM-DD"
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function isShopClosedToday(): Promise<boolean> {
  return isShopClosedOn(bangkokToday());
}

/**
 * วันนั้นร้านปิดทั้งวันไหม — กฎอยู่ที่ getDayClosure (availability.ts) ที่เดียว
 * เพื่อให้หน้าจอง / แจ้งกลุ่ม / สรุปเช้า ใช้นิยามเดียวกันเสมอ
 *
 * @param date "YYYY-MM-DD" เวลาไทย
 */
export async function isShopClosedOn(date: string): Promise<boolean> {
  return (await getDayClosure(date)) !== null;
}

// ─────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  completed: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
  "no-show": "ไม่มา",
};

function timeRange(b: NotifyBooking): string {
  const endsAt = new Date(b.startsAt.getTime() + b.durationMin * 60 * 1000);
  return `${formatBangkokTime(b.startsAt)}-${formatBangkokTime(endsAt)}`;
}

/** เจ้าของ — ข้อมูลครบ รวมเบอร์โทร (แชทส่วนตัว) */
function ownerMessage(event: BookingEvent): string {
  const b = event.booking;

  if (event.type === "created") {
    return [
      "🌙 จองใหม่ Nebula Spa",
      "",
      `รหัสจอง: ${b.code}`,
      `ลูกค้า: ${b.customerName}`,
      `เบอร์: ${b.customerPhone}`,
      "",
      `บริการ: ${b.serviceName}`,
      `วัน: ${formatBangkokDate(b.startsAt)}`,
      `เวลา: ${timeRange(b)}`,
      `ราคา: ${b.price} บาท`,
      ...(b.notes ? [`📝 ${b.notes}`] : []),
    ].join("\n");
  }

  // cancelled by customer
  return [
    "❌ ลูกค้ายกเลิกคิว",
    `${formatBangkokDate(b.startsAt)} · ${timeRange(b)}`,
    `${b.serviceName} · ${b.customerName}`,
    `เบอร์: ${b.customerPhone}`,
    `รหัสจอง: ${b.code}`,
  ].join("\n");
}

/** กลุ่ม — ไม่มีเบอร์โทร (decision: ข้อมูลลูกค้าไม่เข้ากลุ่ม) */
function groupMessage(event: BookingEvent): string {
  const b = event.booking;

  if (event.type === "created") {
    return [
      "🆕 คิวใหม่",
      `${formatBangkokDate(b.startsAt)} · ${timeRange(b)}`,
      b.serviceName,
      `ลูกค้า: ${b.customerName}`,
      ...(b.notes ? [`📝 ${b.notes}`] : []),
      `สถานะ: ${STATUS_LABEL[b.status] ?? b.status}`,
    ].join("\n");
  }

  return [
    "❌ ยกเลิกคิว",
    `${formatBangkokDate(b.startsAt)} · ${timeRange(b)}`,
    `${b.serviceName} · ${b.customerName}`,
    `ยกเลิกโดย: ${event.by === "owner" ? "ร้าน" : "ลูกค้า (ผ่าน LINE)"}`,
  ].join("\n");
}
