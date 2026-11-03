/**
 * ลูกค้า ↔ LINE (Day 40)
 *
 * - ผูก LINE กับคิว (จากหน้ายืนยันการจอง)
 * - หาคิวของลูกค้าจาก LINE userId (ตอนแอดเพื่อน / กดปุ่ม)
 * - ลูกค้ายกเลิกคิวเอง (atomic — เช็คเจ้าของคิว + สถานะ + เวลา ในคำสั่งเดียว)
 *
 * กติกา:
 *   - 1 คิว ผูกได้ LINE เดียว (มีคนได้รหัสจองไปก็ผูกซ้ำไม่ได้)
 *   - ผูกได้ / ยกเลิกได้ เฉพาะคิวที่ยังใช้งาน (pending/confirmed) และยังไม่ถึงเวลานัด
 *   - ผูก LINE ไม่เปลี่ยนสถานะคิว (ไม่มีระบบเตือนก่อนนัด → ไม่ต้อง "รอยืนยัน")
 */

import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, customers, services } from "@/lib/db/schema";

const ACTIVE_STATUSES = ["pending", "confirmed"] as const;

export interface CustomerBooking {
  code: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  price: number;
  notes: string | null;
  status: string;
}

const bookingFields = {
  code: bookings.code,
  customerName: bookings.customerName,
  customerPhone: bookings.customerPhone,
  serviceName: services.name,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  durationMin: bookings.durationMin,
  price: bookings.price,
  notes: bookings.notes,
  status: bookings.status,
};

function withServiceName<T extends { serviceName: string | null }>(
  row: T,
): T & { serviceName: string } {
  return { ...row, serviceName: row.serviceName ?? "(บริการที่ถูกลบ)" };
}

function isActive(b: { status: string; startsAt: Date }): boolean {
  return (
    (ACTIVE_STATUSES as readonly string[]).includes(b.status) &&
    b.startsAt.getTime() > Date.now()
  );
}

// ─────────────────────────────────────────────────────────────
// ผูก LINE กับคิว
// ─────────────────────────────────────────────────────────────

export type LinkResult =
  | { ok: true; newlyLinked: boolean; booking: CustomerBooking }
  | {
      ok: false;
      reason: "NOT_FOUND" | "CLOSED" | "LINKED_TO_OTHER" | "PHONE_TAKEN";
    };

export async function linkBookingToLine(
  code: string,
  lineUserId: string,
): Promise<LinkResult> {
  const db = await getDb();

  // 1. คิว
  const [row] = await db
    .select({ ...bookingFields, customerId: bookings.customerId })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.code, code))
    .limit(1);
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (!isActive(row)) return { ok: false, reason: "CLOSED" };

  // 2. ลูกค้า (หาจาก LINE ก่อน → ไม่เจอค่อยหาจากเบอร์)
  const customerId = await findOrCreateCustomer(
    lineUserId,
    row.customerPhone,
    row.customerName,
  );
  if (customerId === null) return { ok: false, reason: "PHONE_TAKEN" };

  const { customerId: currentCustomerId, ...rest } = row;
  const booking = withServiceName(rest);

  // 3. ผูกคิว — เฉพาะคิวที่ยังไม่ถูกผูก (กันสองคนผูกพร้อมกัน)
  if (currentCustomerId === customerId) {
    return { ok: true, newlyLinked: false, booking };
  }
  if (currentCustomerId !== null) {
    return { ok: false, reason: "LINKED_TO_OTHER" };
  }

  const updated = await db
    .update(bookings)
    .set({ customerId })
    .where(and(eq(bookings.code, code), isNull(bookings.customerId)))
    .returning({ customerId: bookings.customerId });

  if (updated.length === 0) {
    // มีคนผูกตัดหน้าไปเสี้ยววินาที → เช็คว่าเป็นคนเดียวกันไหม
    const [again] = await db
      .select({ customerId: bookings.customerId })
      .from(bookings)
      .where(eq(bookings.code, code))
      .limit(1);
    return again?.customerId === customerId
      ? { ok: true, newlyLinked: false, booking }
      : { ok: false, reason: "LINKED_TO_OTHER" };
  }

  return { ok: true, newlyLinked: true, booking };
}

/**
 * @returns customer id / null = เบอร์นี้ผูกกับ LINE บัญชีอื่นไปแล้ว
 */
async function findOrCreateCustomer(
  lineUserId: string,
  phone: string,
  name: string,
): Promise<number | null> {
  const db = await getDb();

  const [byLine] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.lineUserId, lineUserId))
    .limit(1);
  if (byLine) {
    // ผูกใหม่ = แอดเพื่อนอยู่ (ถ้าเคย unfollow มาก่อน) → เปิดแจ้งเตือนคืน
    await db
      .update(customers)
      .set({ lineNotifyEnabled: true })
      .where(eq(customers.id, byLine.id));
    return byLine.id;
  }

  const [byPhone] = await db
    .select({ id: customers.id, lineUserId: customers.lineUserId })
    .from(customers)
    .where(eq(customers.phone, phone))
    .limit(1);

  if (byPhone) {
    if (byPhone.lineUserId && byPhone.lineUserId !== lineUserId) return null;
    await db
      .update(customers)
      .set({ lineUserId, lineNotifyEnabled: true })
      .where(eq(customers.id, byPhone.id));
    return byPhone.id;
  }

  try {
    const [created] = await db
      .insert(customers)
      .values({ phone, name, lineUserId })
      .returning({ id: customers.id });
    return created.id;
  } catch (err) {
    // ชน unique (เบอร์/LINE) จากคำขอที่เข้ามาพร้อมกัน → ลองหาใหม่ครั้งเดียว
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      const [retry] = await db
        .select({ id: customers.id, lineUserId: customers.lineUserId })
        .from(customers)
        .where(eq(customers.phone, phone))
        .limit(1);
      if (retry && retry.lineUserId === lineUserId) return retry.id;
      return null;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// หาคิวของลูกค้า
// ─────────────────────────────────────────────────────────────

/** คิวที่ยังไม่ถึงเวลาของ LINE นี้ (ตอนแอดเพื่อน → ส่งรายละเอียดให้) — reply ได้สูงสุด 5 ข้อความ */
export async function getUpcomingBookingsForLineUser(
  lineUserId: string,
  limit = 4,
): Promise<CustomerBooking[]> {
  const db = await getDb();
  const rows = await db
    .select(bookingFields)
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(
      and(
        eq(customers.lineUserId, lineUserId),
        inArray(bookings.status, [...ACTIVE_STATUSES]),
        gt(bookings.startsAt, new Date()),
      ),
    )
    .orderBy(asc(bookings.startsAt))
    .limit(limit);
  return rows.map(withServiceName);
}

/** คิวนี้ของ LINE นี้ (ทุกสถานะ — ให้ caller บอกเหตุผลได้ว่าทำไมยกเลิกไม่ได้) */
export async function getBookingForLineUser(
  code: string,
  lineUserId: string,
): Promise<CustomerBooking | null> {
  const db = await getDb();
  const [row] = await db
    .select(bookingFields)
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(and(eq(bookings.code, code), eq(customers.lineUserId, lineUserId)))
    .limit(1);
  return row ? withServiceName(row) : null;
}

export function canCustomerCancel(b: { status: string; startsAt: Date }) {
  return isActive(b);
}

// ─────────────────────────────────────────────────────────────
// ลูกค้ายกเลิกเอง
// ─────────────────────────────────────────────────────────────

/**
 * ยกเลิกแบบ atomic: เจ้าของคิว + สถานะยังใช้งาน + ยังไม่ถึงเวลา — เช็คในคำสั่ง UPDATE เดียว
 * (กดปุ่มซ้ำ 2 ครั้งพร้อมกัน → ยกเลิกได้ครั้งเดียว แจ้งร้านครั้งเดียว)
 *
 * @returns คิวที่ยกเลิก / null = ยกเลิกไม่ได้ (caller ใช้ getBookingForLineUser หาเหตุผล)
 */
export async function cancelBookingByCustomer(
  code: string,
  lineUserId: string,
): Promise<CustomerBooking | null> {
  const db = await getDb();

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.lineUserId, lineUserId))
    .limit(1);
  if (!customer) return null;

  const cancelled = await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledBy: "customer",
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(bookings.code, code),
        eq(bookings.customerId, customer.id),
        inArray(bookings.status, [...ACTIVE_STATUSES]),
        gt(bookings.startsAt, new Date()),
      ),
    )
    .returning({ code: bookings.code });

  if (cancelled.length === 0) return null;
  return getBookingForLineUser(code, lineUserId);
}
