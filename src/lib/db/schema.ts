import {
  sqliteTable,
  integer,
  text,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============================================
// services
// ============================================
// บริการที่ให้จอง เช่น "นวดไทย 60 นาที", "นวดน้ำมัน 90 นาที"
export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  durationMin: integer("duration_min").notNull(), // 30, 45, 60, 90, 120
  price: integer("price").notNull(), // เก็บเป็น baht (integer) ไม่ใช่ decimal
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ============================================
// business_hours
// ============================================
// เวลาเปิด-ปิด ประจำสัปดาห์ (day_of_week: 0=Sun, 6=Sat)
export const businessHours = sqliteTable(
  "business_hours",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dayOfWeek: integer("day_of_week").notNull(), // 0-6
    openTime: text("open_time"), // "10:00" (HH:MM) — nullable ถ้าปิด
    closeTime: text("close_time"), // "21:00"
    isClosed: integer("is_closed", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    // ป้องกันซ้ำ 1 day of week มีได้ 1 row เท่านั้น
    unique("business_hours_day_unique").on(t.dayOfWeek),
  ],
);

// ============================================
// bookings
// ============================================
// รายการจอง — core table
export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(), // 6-char nanoid: "A3F9K2"
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id),

    // Timestamp-based (UTC) — decisions lock: store UTC, display Asia/Bangkok
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),

    // Snapshot ตอนจอง — ถ้า service update ราคา booking เก่ายังคงราคาเดิม
    durationMin: integer("duration_min").notNull(),
    price: integer("price").notNull(),

    status: text("status", {
      enum: ["pending", "confirmed", "completed", "cancelled", "no-show"],
    })
      .notNull()
      .default("confirmed"),

    notes: text("notes"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // Index สำหรับ availability query (overlap check)
    index("bookings_time_idx").on(t.startsAt, t.endsAt),
    // Index สำหรับ admin filter by status
    index("bookings_status_idx").on(t.status),
    // Index สำหรับ lookup ผ่าน code (confirmation page)
    index("bookings_code_idx").on(t.code),
  ],
);

// ============================================
// blocked_slots
// ============================================
// ปิด slot พิเศษ เช่น วันหยุด, อบรม, ปิดปรับปรุง
export const blockedSlots = sqliteTable(
  "blocked_slots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("blocked_slots_time_idx").on(t.startsAt, t.endsAt)],
);

// ============================================
// Type exports — infer types สำหรับ query
// ============================================
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type BusinessHour = typeof businessHours.$inferSelect;
export type NewBusinessHour = typeof businessHours.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type BlockedSlot = typeof blockedSlots.$inferSelect;
export type NewBlockedSlot = typeof blockedSlots.$inferInsert;

export * from "./auth.schema";
