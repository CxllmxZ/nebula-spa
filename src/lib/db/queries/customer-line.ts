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
 *   - line_notify_enabled: unfollow (บล็อก/ลบเพื่อน OA) = false · follow = true (Day 42)
 *     การผูก LINE ไม่แตะค่านี้ — ผูกได้ทั้งที่ยังบล็อก OA อยู่ (LINE Login ≠ เป็นเพื่อน)
 */

import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
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
  | {
      ok: true;
      newlyLinked: boolean;
      booking: CustomerBooking;
      /** false = ลูกค้าบล็อก OA อยู่ → อย่า push (ไม่ผ่านอยู่แล้ว + เปลืองคำขอ) */
      notifyEnabled: boolean;
    }
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
  const customer = await findOrCreateCustomer(
    lineUserId,
    row.customerPhone,
    row.customerName,
  );
  if (customer === null) return { ok: false, reason: "PHONE_TAKEN" };
  const { id: customerId, notifyEnabled } = customer;

  const { customerId: currentCustomerId, ...rest } = row;
  const booking = withServiceName(rest);

  // 3. ผูกคิว — เฉพาะคิวที่ยังไม่ถูกผูก (กันสองคนผูกพร้อมกัน)
  if (currentCustomerId === customerId) {
    return { ok: true, newlyLinked: false, booking, notifyEnabled };
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
      ? { ok: true, newlyLinked: false, booking, notifyEnabled }
      : { ok: false, reason: "LINKED_TO_OTHER" };
  }

  return { ok: true, newlyLinked: true, booking, notifyEnabled };
}

/**
 * @returns ลูกค้า / null = เบอร์นี้ผูกกับ LINE บัญชีอื่นไปแล้ว
 */
async function findOrCreateCustomer(
  lineUserId: string,
  phone: string,
  name: string,
): Promise<{ id: number; notifyEnabled: boolean } | null> {
  const db = await getDb();

  const [byLine] = await db
    .select({ id: customers.id, notifyEnabled: customers.lineNotifyEnabled })
    .from(customers)
    .where(eq(customers.lineUserId, lineUserId))
    .limit(1);
  if (byLine) return byLine;

  const [byPhone] = await db
    .select({
      id: customers.id,
      lineUserId: customers.lineUserId,
      notifyEnabled: customers.lineNotifyEnabled,
    })
    .from(customers)
    .where(eq(customers.phone, phone))
    .limit(1);

  if (byPhone) {
    if (byPhone.lineUserId && byPhone.lineUserId !== lineUserId) return null;
    await db
      .update(customers)
      .set({ lineUserId })
      .where(eq(customers.id, byPhone.id));
    return { id: byPhone.id, notifyEnabled: byPhone.notifyEnabled };
  }

  try {
    const [created] = await db
      .insert(customers)
      .values({ phone, name, lineUserId })
      .returning({
        id: customers.id,
        notifyEnabled: customers.lineNotifyEnabled,
      });
    return created;
  } catch (err) {
    // ชน unique (เบอร์/LINE) จากคำขอที่เข้ามาพร้อมกัน → ลองหาใหม่ครั้งเดียว
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      const [retry] = await db
        .select({
          id: customers.id,
          lineUserId: customers.lineUserId,
          notifyEnabled: customers.lineNotifyEnabled,
        })
        .from(customers)
        .where(eq(customers.phone, phone))
        .limit(1);
      if (retry && retry.lineUserId === lineUserId) {
        return { id: retry.id, notifyEnabled: retry.notifyEnabled };
      }
      return null;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// follow / unfollow (Day 42)
// ─────────────────────────────────────────────────────────────

/**
 * ลูกค้าบล็อก/ลบเพื่อน OA (false) หรือกลับมาแอด (true)
 * ไม่ใช่ลูกค้าที่เคยผูก (เช่น เจ้าของร้าน / คนทั่วไป) → ไม่มีแถว → ไม่ทำอะไร
 * @returns true ถ้าเป็นลูกค้าที่รู้จัก
 */
export async function setLineNotifyEnabled(
  lineUserId: string,
  enabled: boolean,
): Promise<boolean> {
  const db = await getDb();
  const updated = await db
    .update(customers)
    .set({ lineNotifyEnabled: enabled })
    .where(eq(customers.lineUserId, lineUserId))
    .returning({ id: customers.id });
  return updated.length > 0;
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

/**
 * คิวที่ "จองล่าสุด" และยังไม่ถึงเวลา ของ LINE นี้ — ใช้ตอนแอดเพื่อน (Day 42)
 * ส่งแค่คิวเดียว: ลบเพื่อนแล้วแอดใหม่ จะไม่ได้คิวเก่าๆ ซ้ำทั้งหมด
 */
export async function getLatestUpcomingBookingForLineUser(
  lineUserId: string,
): Promise<CustomerBooking | null> {
  const db = await getDb();
  const [row] = await db
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
    .orderBy(desc(bookings.createdAt))
    .limit(1);
  return row ? withServiceName(row) : null;
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
