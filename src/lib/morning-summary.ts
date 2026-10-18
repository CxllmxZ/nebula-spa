/**
 * สรุปคิวเช้า — ส่งเข้ากลุ่มพนักงานวันละครั้ง (line-integration-plan.md → Morning Summary)
 *
 * ถูกเรียกจาก cron ทุก 15 นาที (ผ่าน /api/cron/tick) — ทุกรอบเช็ค:
 *   1. เปิดสรุปไว้ + มีปลายทาง (กลุ่ม linked / กลุ่มหลุด → เจ้าของ)
 *   2. วันนี้ยังไม่ได้ส่ง
 *   3. เลยเวลาที่ตั้งแล้ว (ค่าเริ่มต้น 08:00 เวลาไทย)
 *   4. วันนี้ร้านเปิด — วันปิดไม่ส่ง และไม่บันทึกว่าส่งแล้ว
 *      → วันทำการถัดไปจะรวม "ระหว่างร้านปิด" ให้
 *
 * วันไม่มีคิว → ส่ง "วันนี้ยังไม่มีคิวจอง" (decision Day 35: ให้รู้ว่าระบบยังทำงาน)
 *
 * กันส่งซ้ำ: "จอง" วันนี้ใน DB ก่อนส่ง (update แบบมีเงื่อนไข) — ส่งไม่สำเร็จค่อยคืนค่า
 */

import { and, asc, eq, gte, isNull, lt, ne, notInArray, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bookings,
  businessHours,
  lineSettings,
  services,
} from "@/lib/db/schema";
import { getLineSettings } from "@/lib/db/queries/line";
import { bangkokDateTimeToUtc, getBangkokDayOfWeek } from "@/lib/datetime";
import { formatBangkokDate, formatBangkokTime, pushLineText } from "@/lib/line";
import { bangkokToday, isShopClosedOn, type NotifyEnv } from "@/lib/notify";

const MAX_LINE_TEXT = 4900; // LINE จำกัด 5,000 ตัวอักษรต่อข้อความ — เผื่อไว้
const MAX_CLOSED_LOOKBACK_DAYS = 14;

export type SummaryResult =
  | { status: "sent"; to: "group" | "owner"; bookings: number }
  | { status: "skipped"; reason: string };

// ─────────────────────────────────────────────────────────────
// Entry
// ─────────────────────────────────────────────────────────────

export async function runMorningSummary(
  env: NotifyEnv,
  opts: { force?: boolean } = {},
): Promise<SummaryResult> {
  const settings = await getLineSettings();
  const today = bangkokToday();

  if (!settings.summaryEnabled) return skip("summary disabled");

  // ปลายทาง: กลุ่ม → หลุด → เจ้าของ / ไม่ได้ใช้กลุ่ม → ไม่ส่ง
  const ownerId = settings.ownerLineUserId ?? env.fallbackOwnerId;
  let to: { id: string; kind: "group" | "owner" } | null = null;
  if (settings.staffGroupStatus === "linked" && settings.staffGroupId) {
    to = { id: settings.staffGroupId, kind: "group" };
  } else if (settings.staffGroupStatus === "disconnected" && ownerId) {
    to = { id: ownerId, kind: "owner" };
  }
  if (!to) return skip("no destination (group not linked)");

  if (!opts.force) {
    if (settings.lastSummaryDate === today) return skip("already sent today");
    if (nowBangkokHHMM() < settings.summaryTime)
      return skip("before summary time");
  }

  if (await isShopClosedOn(today)) return skip("shop closed today");

  // ── เตรียมเนื้อหา (อ่านค่าเดิมก่อน "จอง") ───────────────────
  const previousDate = settings.lastSummaryDate;
  const previousSentAt = settings.lastSummarySentAt;

  const [todayBookings, hours, closedChanges] = await Promise.all([
    getActiveBookingsOn(today),
    getHoursOn(today),
    getChangesWhileClosed(previousDate, today),
  ]);

  // ── จองวันนี้ (กันสองรอบส่งซ้ำ) ───────────────────────────────
  const claimed = await claimToday(today, opts.force === true);
  if (!claimed) return skip("already sent today (claimed by another run)");

  const text = buildSummary(
    today,
    hours,
    todayBookings,
    closedChanges,
    to.kind,
  );
  const chunks = splitMessage(text);

  try {
    for (const chunk of chunks) {
      await pushLineText(env.token, to.id, chunk, env.enabled);
    }
  } catch (err) {
    // คืนค่า — รอบถัดไปลองใหม่
    await restoreClaim(previousDate, previousSentAt);
    throw err;
  }

  return { status: "sent", to: to.kind, bookings: todayBookings.length };
}

function skip(reason: string): SummaryResult {
  return { status: "skipped", reason };
}

// ─────────────────────────────────────────────────────────────
// Claim (atomic) / restore
// ─────────────────────────────────────────────────────────────

async function claimToday(today: string, force: boolean): Promise<boolean> {
  const db = await getDb();
  const where = force
    ? eq(lineSettings.id, 1)
    : and(
        eq(lineSettings.id, 1),
        or(
          isNull(lineSettings.lastSummaryDate),
          ne(lineSettings.lastSummaryDate, today),
        ),
      );

  const rows = await db
    .update(lineSettings)
    .set({ lastSummaryDate: today, lastSummarySentAt: new Date() })
    .where(where)
    .returning({ id: lineSettings.id });

  return rows.length > 0;
}

async function restoreClaim(
  previousDate: string | null,
  previousSentAt: Date | null,
): Promise<void> {
  const db = await getDb();
  await db
    .update(lineSettings)
    .set({ lastSummaryDate: previousDate, lastSummarySentAt: previousSentAt })
    .where(eq(lineSettings.id, 1));
}

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────

interface SummaryBooking {
  startsAt: Date;
  durationMin: number;
  customerName: string;
  serviceName: string | null;
  status: string;
  notes: string | null;
}

/** ช่วงเวลาของวันนั้น (เวลาไทย) เป็น UTC [start, end) */
function dayRange(date: string): { start: Date; end: Date } {
  return {
    start: bangkokDateTimeToUtc(date, "00:00"),
    end: bangkokDateTimeToUtc(addDays(date, 1), "00:00"),
  };
}

async function getActiveBookingsOn(date: string): Promise<SummaryBooking[]> {
  const db = await getDb();
  const { start, end } = dayRange(date);

  return db
    .select({
      startsAt: bookings.startsAt,
      durationMin: bookings.durationMin,
      customerName: bookings.customerName,
      serviceName: services.name,
      status: bookings.status,
      notes: bookings.notes,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(
      and(
        gte(bookings.startsAt, start),
        lt(bookings.startsAt, end),
        notInArray(bookings.status, ["cancelled", "no-show"]),
      ),
    )
    .orderBy(asc(bookings.startsAt));
}

async function getHoursOn(
  date: string,
): Promise<{ open: string; close: string } | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(businessHours)
    .where(eq(businessHours.dayOfWeek, getBangkokDayOfWeek(date)))
    .limit(1);
  if (!row || !row.openTime || !row.closeTime) return null;
  return { open: row.openTime, close: row.closeTime };
}

interface ClosedChanges {
  closedDates: string[];
  newCount: number;
  cancelledCount: number;
}

/**
 * ความเคลื่อนไหวที่เกิด "ในวันร้านปิด" ตั้งแต่สรุปครั้งก่อน ถึงเมื่อวาน
 * (วันเปิด → แจ้งกลุ่มทันทีไปแล้ว ไม่ต้องนับซ้ำ)
 *
 * ยกเลิก = status cancelled + updated_at อยู่ในวันปิด (ใกล้เคียง — ถ้าแก้คิวที่ยกเลิกไปแล้วอีกรอบ เวลาจะขยับ)
 */
async function getChangesWhileClosed(
  lastSummaryDate: string | null,
  today: string,
): Promise<ClosedChanges> {
  const empty = { closedDates: [], newCount: 0, cancelledCount: 0 };
  if (!lastSummaryDate || lastSummaryDate >= today) return empty;

  // ไล่วันระหว่าง (สรุปครั้งก่อน, วันนี้)
  const closedDates: string[] = [];
  let d = addDays(lastSummaryDate, 1);
  for (let i = 0; d < today && i < MAX_CLOSED_LOOKBACK_DAYS; i++) {
    if (await isShopClosedOn(d)) closedDates.push(d);
    d = addDays(d, 1);
  }
  if (closedDates.length === 0) return empty;

  const db = await getDb();
  let newCount = 0;
  let cancelledCount = 0;

  for (const date of closedDates) {
    const { start, end } = dayRange(date);

    const created = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(gte(bookings.createdAt, start), lt(bookings.createdAt, end)));
    newCount += created.length;

    const cancelled = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "cancelled"),
          gte(bookings.updatedAt, start),
          lt(bookings.updatedAt, end),
        ),
      );
    cancelledCount += cancelled.length;
  }

  return { closedDates, newCount, cancelledCount };
}

// ─────────────────────────────────────────────────────────────
// Message
// ─────────────────────────────────────────────────────────────

function buildSummary(
  today: string,
  hours: { open: string; close: string } | null,
  list: SummaryBooking[],
  closed: ClosedChanges,
  to: "group" | "owner",
): string {
  const header = formatBangkokDate(bangkokDateTimeToUtc(today, "12:00"));
  const lines: string[] = [];

  if (to === "owner") lines.push("(แทนกลุ่มพนักงาน)");
  lines.push(`☀️ คิววันนี้ — ${header}`);

  if (list.length === 0) {
    lines.push(
      hours ? `ร้านเปิด ${hours.open}-${hours.close}` : "",
      "",
      "วันนี้ยังไม่มีคิวจอง",
    );
  } else {
    lines.push(
      `${hours ? `ร้านเปิด ${hours.open}-${hours.close} · ` : ""}ทั้งหมด ${list.length} คิว`,
      "",
    );
    for (const b of list) {
      const end = new Date(b.startsAt.getTime() + b.durationMin * 60 * 1000);
      const pending = b.status === "pending" ? " (รอยืนยัน)" : "";
      const note = b.notes ? ` 📝 ${b.notes}` : "";
      lines.push(
        `${formatBangkokTime(b.startsAt)}-${formatBangkokTime(end)}  ${b.serviceName ?? "(บริการที่ถูกลบ)"} · ${b.customerName}${pending}${note}`,
      );
    }
  }

  if (closed.newCount > 0 || closed.cancelledCount > 0) {
    const days = closed.closedDates
      .map((d) => formatBangkokDate(bangkokDateTimeToUtc(d, "12:00")))
      .join(", ");
    const parts = [
      closed.newCount > 0 ? `คิวใหม่ ${closed.newCount} คิว` : null,
      closed.cancelledCount > 0 ? `ยกเลิก ${closed.cancelledCount} คิว` : null,
    ].filter(Boolean);
    lines.push("", `📌 ระหว่างร้านปิด (${days})`, `· ${parts.join(" · ")}`);
  }

  return lines.filter((l, i) => !(l === "" && lines[i - 1] === "")).join("\n");
}

/** ตัดข้อความยาวเป็นหลายก้อนตามบรรทัด (ร้านขนาดเป้าหมายไม่น่าถึง) */
function splitMessage(text: string): string[] {
  if (text.length <= MAX_LINE_TEXT) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current.length + line.length + 1 > MAX_LINE_TEXT) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ─────────────────────────────────────────────────────────────
// Date helpers ("YYYY-MM-DD" ไม่มี timezone — คิดเป็นวันปฏิทิน)
// ─────────────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function nowBangkokHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
