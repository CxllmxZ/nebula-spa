import {
  sqliteTable,
  integer,
  text,
  index,
  unique,
  check,
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
// customers (Migration 0002 — LINE v2)
// ============================================
// ลูกค้าที่เชื่อม LINE — 1 เบอร์ = 1 คน
// ลูกค้าที่ไม่เชื่อม LINE ไม่ต้องมีแถวที่นี่ (bookings ยังเก็บชื่อ/เบอร์ snapshot เหมือนเดิม)
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(), // unique = มี index ในตัว
  name: text("name").notNull(),
  lineUserId: text("line_user_id").unique(), // unique = มี index ในตัว
  // unfollow OA → false (push ไม่ได้อยู่แล้ว ไม่ต้องลอง)
  lineNotifyEnabled: integer("line_notify_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
});

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

    // Migration 0002 — ผูกเมื่อลูกค้าเชื่อม LINE (null = ไม่ได้เชื่อม)
    customerId: integer("customer_id").references(() => customers.id),

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

    // Migration 0002 — ใช้กับสรุปเช้า "ระหว่างร้านปิด"
    // nullable + ไม่มี DB default เพราะ SQLite ห้าม ADD COLUMN ที่ default ไม่ใช่ค่าคงที่
    // แอปเติมค่าเองทั้งตอน insert และ update / แถวเก่า backfill ใน migration
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Index สำหรับ availability query (overlap check)
    index("bookings_time_idx").on(t.startsAt, t.endsAt),
    // Index สำหรับ admin filter by status
    index("bookings_status_idx").on(t.status),
    // Index สำหรับ lookup ผ่าน code (confirmation page)
    index("bookings_code_idx").on(t.code),
    // Migration 0002
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_updated_idx").on(t.updatedAt),
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
// line_settings (Migration 0002 — LINE v2)
// ============================================
// single-tenant → มีแถวเดียวเสมอ (id = 1)
// แถวถูกสร้างโดยแอป (getLineSettings ทำ insert-if-missing) ไม่ใช่ใน migration
// → seed/reset DB แล้วไม่พัง
export const lineSettings = sqliteTable(
  "line_settings",
  {
    id: integer("id").primaryKey(),

    // เจ้าของร้าน — ผูกด้วย #owner {code}
    ownerLineUserId: text("owner_line_user_id"),
    ownerNotifyEnabled: integer("owner_notify_enabled", { mode: "boolean" })
      .notNull()
      .default(true),

    // กลุ่มพนักงาน — ผูกด้วย #link {code}
    staffGroupId: text("staff_group_id"),
    staffGroupStatus: text("staff_group_status", {
      enum: ["not_linked", "linked", "disconnected"],
    })
      .notNull()
      .default("not_linked"),
    staffGroupLinkedAt: integer("staff_group_linked_at", { mode: "timestamp" }),
    staffGroupDisconnectedAt: integer("staff_group_disconnected_at", {
      mode: "timestamp",
    }),

    // สรุปคิวเช้า
    summaryEnabled: integer("summary_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    summaryTime: text("summary_time").notNull().default("08:00"), // HH:MM เวลาไทย
    lastSummaryDate: text("last_summary_date"), // "YYYY-MM-DD" เวลาไทย
    lastSummarySentAt: integer("last_summary_sent_at", { mode: "timestamp" }),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [check("line_settings_singleton", sql`${t.id} = 1`)],
);

// ============================================
// line_link_codes (Migration 0002 — LINE v2)
// ============================================
// รหัส 6 หลักสำหรับผูก LINE เจ้าของ (#owner) / กลุ่มพนักงาน (#link)
// อายุ 30 นาที, ใช้ได้ครั้งเดียว, สร้างใหม่ = รหัสเก่า purpose เดียวกันหมดอายุ
export const lineLinkCodes = sqliteTable(
  "line_link_codes",
  {
    code: text("code").primaryKey(),
    purpose: text("purpose", { enum: ["owner", "staff_group"] }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("line_link_codes_purpose_idx").on(t.purpose, t.usedAt)],
);

// ============================================
// Type exports — infer types สำหรับ query
// ============================================
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

export type BusinessHour = typeof businessHours.$inferSelect;
export type NewBusinessHour = typeof businessHours.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type BlockedSlot = typeof blockedSlots.$inferSelect;
export type NewBlockedSlot = typeof blockedSlots.$inferInsert;

export type LineSettings = typeof lineSettings.$inferSelect;
export type LineLinkCode = typeof lineLinkCodes.$inferSelect;

export * from "./auth.schema";
