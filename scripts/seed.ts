/**
 * Seed script for Nebula Spa demo database.
 *
 * Generates deterministic SQL for:
 *   - 8 services (Thai massage, oil, spa, etc.)
 *   - 7 business hours entries (Mon-Sun)
 *   - 20 mock bookings with realistic Thai names + spread across ±14 days
 *
 * Usage:
 *   pnpm exec tsx scripts/seed.ts
 *   pnpm exec wrangler d1 execute nebula-spa-db --local  --file=scripts/seed.sql
 *   pnpm exec wrangler d1 execute nebula-spa-db --remote --file=scripts/seed.sql
 */

import { writeFileSync } from "node:fs";
import { customAlphabet } from "nanoid";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const nanoid6 = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

const esc = (s: string) => s.replace(/'/g, "''");

function timestamp(daysFromNow: number, hour: number, minute: number): number {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomPhone(): string {
  const prefix = pick(["08", "09", "06"]);
  const rest = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
  return `${prefix}${rest}`;
}

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────

const services = [
  { name: "นวดไทย 60 นาที", duration: 60, price: 300 },
  { name: "นวดไทย 90 นาที", duration: 90, price: 450 },
  { name: "นวดน้ำมัน 60 นาที", duration: 60, price: 450 },
  { name: "นวดน้ำมัน 90 นาที", duration: 90, price: 650 },
  { name: "นวดฝ่าเท้า 45 นาที", duration: 45, price: 280 },
  { name: "นวดคอ-บ่า-ไหล่ 30 นาที", duration: 30, price: 200 },
  { name: "สปาหน้า 60 นาที", duration: 60, price: 550 },
  { name: "ประคบสมุนไพร 45 นาที", duration: 45, price: 350 },
] as const;

const hours = [
  { day: 0, open: "09:00", close: "22:00" }, // Sun
  { day: 1, open: "10:00", close: "21:00" }, // Mon
  { day: 2, open: "10:00", close: "21:00" }, // Tue
  { day: 3, open: "10:00", close: "21:00" }, // Wed
  { day: 4, open: "10:00", close: "21:00" }, // Thu
  { day: 5, open: "10:00", close: "21:00" }, // Fri
  { day: 6, open: "09:00", close: "22:00" }, // Sat
] as const;

const thaiNames = [
  "สมชาย ใจดี",
  "มานี ประเสริฐ",
  "ปิยะ สุขใจ",
  "อรวรรณ มณีทอง",
  "ธนกร รักดี",
  "นภาพร สายทอง",
  "วิชัย พงษ์ศิริ",
  "สุนิสา ทองแท้",
  "อนุชา แก้วใส",
  "รัตนา พิทักษ์",
  "ประวิทย์ วงศ์ใหญ่",
  "จุฑามาศ เจริญสุข",
  "ณัฐพล ธนากร",
  "พรทิพย์ อินทรา",
  "ศิริพงษ์ ยอดวงศ์",
  "กัญญา บุญมา",
  "ไพโรจน์ สินทรัพย์",
  "ปนัดดา แสงเงิน",
  "ธีรพงษ์ นาคทอง",
  "อัญชลี พูนทรัพย์",
] as const;

// ─────────────────────────────────────────────────────────────
// Generate SQL
// ─────────────────────────────────────────────────────────────

const sql: string[] = [];

sql.push("-- ============================================");
sql.push("-- Nebula Spa seed (generated)");
sql.push(`-- Generated at: ${new Date().toISOString()}`);
sql.push("-- ============================================");
sql.push("");
sql.push("-- Clean slate");
sql.push("DELETE FROM bookings;");
sql.push("DELETE FROM services;");
sql.push("DELETE FROM business_hours;");
sql.push("DELETE FROM blocked_slots;");
sql.push("DELETE FROM sqlite_sequence;");
sql.push("");

sql.push("-- Services (8 items)");
services.forEach((s, i) => {
  sql.push(
    `INSERT INTO services (name, duration_min, price, display_order) ` +
      `VALUES ('${esc(s.name)}', ${s.duration}, ${s.price}, ${i + 1});`,
  );
});
sql.push("");

sql.push("-- Business hours (Mon-Sun, no closed days)");
hours.forEach((h) => {
  sql.push(
    `INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed) ` +
      `VALUES (${h.day}, '${h.open}', '${h.close}', 0);`,
  );
});
sql.push("");

sql.push(
  "-- Bookings (20 mock: 3 pending, 8 confirmed, 5 completed, 2 cancelled, 2 no-show)",
);

// Spread bookings across ±14 days
const usedSlots = new Set<string>();
const bookingSlots: Array<{ day: number; hour: number; minute: number }> = [];
for (let i = 0; i < 20; i++) {
  let day: number, hour: number, minute: number, key: string;
  let attempts = 0;
  do {
    day = Math.floor(Math.random() * 29) - 14;
    hour = 10 + Math.floor(Math.random() * 11);
    minute = pick([0, 30]);
    key = `${day}-${hour}-${minute}`;
    attempts++;
  } while (usedSlots.has(key) && attempts < 50);
  usedSlots.add(key);
  bookingSlots.push({ day, hour, minute });
}

bookingSlots.sort((a, b) => a.day - b.day);

// Past days → completed/no-show/cancelled; Future → pending/confirmed/cancelled
const pastStatuses = [
  "completed",
  "completed",
  "completed",
  "completed",
  "completed",
  "no-show",
  "no-show",
  "cancelled",
];
const futureStatuses = [
  "pending",
  "pending",
  "pending",
  "confirmed",
  "confirmed",
  "confirmed",
  "confirmed",
  "confirmed",
  "confirmed",
  "confirmed",
  "confirmed",
  "cancelled",
];

let pastIdx = 0;
let futureIdx = 0;
const finalBookings = bookingSlots.map((slot) => {
  const status =
    slot.day < 0
      ? pastStatuses[pastIdx++ % pastStatuses.length]!
      : futureStatuses[futureIdx++ % futureStatuses.length]!;
  return { ...slot, status };
});

finalBookings.forEach((booking) => {
  const service = pick(services);
  const svcIdx = services.indexOf(service);
  const serviceId = svcIdx + 1;
  const name = pick(thaiNames);
  const phone = randomPhone();
  const code = nanoid6();
  const startsAt = timestamp(booking.day, booking.hour, booking.minute);
  const endsAt = startsAt + service.duration * 60;

  sql.push(
    `INSERT INTO bookings ` +
      `(code, customer_name, customer_phone, service_id, starts_at, ends_at, duration_min, price, status) ` +
      `VALUES ('${code}', '${esc(name)}', '${phone}', ${serviceId}, ${startsAt}, ${endsAt}, ${service.duration}, ${service.price}, '${booking.status}');`,
  );
});

sql.push("");
sql.push("-- Done");

// Write output
const output = sql.join("\n") + "\n";
writeFileSync("scripts/seed.sql", output);
console.log(`✓ Generated scripts/seed.sql (${output.length} bytes)`);
console.log(`  - 8 services`);
console.log(`  - 7 business hours`);
console.log(`  - 20 bookings`);
