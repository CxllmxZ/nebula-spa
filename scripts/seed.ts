/**
 * Seed script
 *
 * Populates the database with mock data for demo:
 *   - 8 services (นวดไทย, นวดน้ำมัน, สปาหน้า, etc.)
 *   - Business hours: Mon-Fri 10:00-21:00, Sat-Sun 09:00-22:00
 *   - 15-20 mock bookings with mixed statuses
 *   - 1 admin user (from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD)
 *
 * Usage: pnpm tsx scripts/seed.ts
 * (After D1 database is set up in next chat)
 */

// ============================================
// TODO: seed services (8 items from decisions.md)
// ============================================
// const services = [
//   { name: "นวดไทย 60 นาที", durationMin: 60, price: 300, displayOrder: 1 },
//   { name: "นวดไทย 90 นาที", durationMin: 90, price: 450, displayOrder: 2 },
//   { name: "นวดน้ำมัน 60 นาที", durationMin: 60, price: 450, displayOrder: 3 },
//   { name: "นวดน้ำมัน 90 นาที", durationMin: 90, price: 650, displayOrder: 4 },
//   { name: "นวดฝ่าเท้า 45 นาที", durationMin: 45, price: 280, displayOrder: 5 },
//   { name: "นวดคอ-บ่า-ไหล่ 30 นาที", durationMin: 30, price: 200, displayOrder: 6 },
//   { name: "สปาหน้า 60 นาที", durationMin: 60, price: 550, displayOrder: 7 },
//   { name: "ประคบสมุนไพร 45 นาที", durationMin: 45, price: 350, displayOrder: 8 },
// ];

// ============================================
// TODO: seed business hours (7 rows)
// ============================================
// Mon-Fri (1-5): 10:00-21:00
// Sat-Sun (0, 6): 09:00-22:00

// ============================================
// TODO: seed mock bookings
// ============================================
// - Distribute across current month
// - Mix statuses: pending(3), confirmed(8), completed(5), cancelled(2), no-show(2)
// - Thai names + realistic phone numbers

// ============================================
// TODO: seed admin user (via Better Auth signUp)
// ============================================

async function seed() {
  throw new Error("Not implemented — configure Cloudflare D1 first");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
