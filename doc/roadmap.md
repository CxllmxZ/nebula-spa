# Nebula Spa — Project Roadmap

**Last updated:** 13 สิงหาคม 2026
**Owner:** BiMaV
**Timeline lock:** 3-4 สัปดาห์ (per `booking-system-decisions.md`)
**Pace:** ~1-2 ชม./วัน (side project + งานประจำ)

Single source of truth สำหรับ session ที่ทำแล้ว + เหลือ + timeline + decisions + schema evolution

---

## Naming Convention

- **Session** = 1 chat conversation กับ AI assistant
- **Session 6A / 6B** = sub-sessions ใน scope เดียวกัน (Booking CRUD)
- **Module** = feature area (e.g. Module 2 = Database, Module 4 = Availability)
- **Day N** = ตัวเลข post บน Threads (build-in-public)

---

## Progress Overview

```
Foundation      ████████████████████ 100%  ✅ Session 2
Database        ████████████████████ 100%  ✅ Session 3-4
Auth            ████████████████████ 100%  ✅ Session 3-4
Availability    ████████████████████ 100%  ✅ Session 5
Booking API     ████████████████████ 100%  ✅ Session 6 (6A + 6B)
Admin UI        ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ Session 7
Public UI       ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ Session 8
Deploy MVP      ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ Session 9
LINE (Full)     ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ Session 10
Portfolio       ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ Session 11
```

**Overall: ~100% backend (booking layer), 0% frontend**

**Backend gap:** Services/Hours CRUD endpoints ยังไม่ทำ — จะ implement พร้อม UI ใน Session 7 (7E + 7F)

---

## Completed Sessions ✅

### Session 2 — Structure + Schema (21 ก.ค.)

**Scope:** Folder structure + Drizzle schema

**Deliverables:**
- 31 files (routes, layouts, actions, api, middleware, lib)
- 4 tables (services, business_hours, bookings, blocked_slots)
- 5 dependencies + Drizzle setup
- 6 commits clean history

**Handover:** [`handover-session-2.md`](./handover-session-2.md)

---

### Session 3-4 — Cloudflare Infrastructure + Auth (23-30 ก.ค.)

**Scope:** Cloudflare D1 + Better Auth + Middleware guard

**Deliverables:**
- 11 tables live (4 business + 4 auth + 3 system)
- 8 services + 20 mock bookings seeded
- 3 users (admin promoted via SQL)
- `getDb()` factory using `getCloudflareContext({ async: true })`
- Better Auth catch-all `/api/auth/[...all]` handler
- Middleware protects `/admin/*` (renamed from `proxy.ts` due to Next 16 + OpenNext incompat)
- Build + deploy pipeline verified end-to-end

**Handover:** [`handover-session-3-4.md`](./handover-session-3-4.md)

---

### Session 5 — Availability Algorithm (2 ส.ค.)

**Scope:** Time slot computation + Bangkok timezone helpers

**Deliverables:**
- `src/lib/datetime.ts` — 6 timezone helpers (Bangkok/UTC conversion)
- `src/lib/db/queries/availability.ts` — `getAvailableSlots()` + reusable `hasBookingConflict()`
- `GET /api/availability` — Zod validation + ISO 8601 response with Asia/Bangkok offset
- 9 test cases verified end-to-end

**Design decisions locked:**
- Return format: ISO 8601 with Bangkok offset (`2026-08-15T14:00:00+07:00`)
- Auto-confirm booking flow (no pending state)
- `BLOCKING_STATUSES = ['confirmed']` only
- 30-min slot granularity
- Advance booking limit: 30 days

**Handover:** [`handover-session-5.md`](./handover-session-5.md)

---

### Session 6 — Booking CRUD (Day 10-14, 3-13 ส.ค.)

**Scope:** Booking CRUD ทั้ง public + admin flow

**Sub-sessions:**
- **6A — Public Booking Create** (Day 10-13): `POST /api/bookings` + auth guard + Turnstile + LINE fire-forget
- **6B — Admin Management** (Day 13-14): `GET /api/admin/bookings` (list + filter) + `GET/PATCH /api/admin/bookings/[id]`

**Deliverables:**

*New files:*
- `src/lib/auth-guard.ts` — `requireRole()` + `requireRoleAction()`
- `src/lib/nanoid.ts` — booking code generator (6 chars, no confusing chars)
- `src/app/api/bookings/route.ts` — POST public
- `src/app/api/admin/bookings/route.ts` — GET list
- `src/app/api/admin/bookings/[id]/route.ts` — GET single + PATCH status

*Implement จริง (session 2 placeholder):*
- `src/lib/turnstile.ts` — Cloudflare token verify
- `src/lib/line.ts` — `pushLineText()` + `sendBookingNotification()` + Thai date format
- `src/lib/validations.ts` — 3 schemas (create + admin filter + status update)
- `src/lib/db/queries/bookings.ts` — 5 functions (create/getByCode/list/getById/updateStatus)

*Env additions:* `LINE_ENABLED` flag, Turnstile test keys

**Design decisions locked:**
- Booking code = nanoid 6 chars + custom alphabet (32 chars, no 0/O/1/I/l)
- LINE push = fire-and-forget + log (ไม่ block booking)
- Turnstile local dev = Cloudflare test keys (always-pass)
- Route Handler แทน Server Action (test ผ่าน Postman ตรงกว่า)
- `BookingError` class + HTTP status mapping (404/409/422/500)
- Snapshot pricing (freeze price/duration ที่ booking record)
- `LINE_ENABLED` feature flag (deploy MVP ก่อน setup OA)
- Auto-confirm booking flow (no pending state)
- Auth guard signature = `requireRole(request, allowed)` (explicit dep)
- Pagination = offset (`?page=1&pageSize=20`, max 100)
- Response shape = flat + meta object
- Status change = free (no state machine — MVP flexibility)
- PATCH scope = status only (workaround: cancel + create new)
- Sort default = `asc(startsAt)` (วันใกล้สุดขึ้นก่อน)
- Search = LIKE 3 columns (name/phone/code, Unicode-safe)
- Multi-status = comma-separated (`?status=confirmed,pending`)

**Bugs fixed:**
- D1 type error ใน `hasBookingConflict` (`sql\`\`` template ไม่ auto-serialize Date → convert Unix seconds manual)
- Missing `await getDb()` ใน `hasBookingConflict` (session 5 code miss)
- Route conflict `/admin/bookings` (page.tsx vs route.ts) → ย้าย API ไป `/api/admin/`
- Turnstile env keys missing + potential quotes issue

**Verified:** 22 test cases end-to-end (9 public POST + 13 admin endpoints)

**Handover:** [`handover-session-6.md`](./handover-session-6.md)

---

## Remaining Sessions 🎯

### Session 7 — Admin Panel UI

**Scope:** Frontend for admin routes + supporting endpoints (services/hours CRUD)
**Effort:** 10-14 ชม. (เพิ่มจากเดิม 8-12h เพราะ 7E + 7F ต้องทำ endpoints ด้วย)
**Depends on:** 6 ✅
**Can parallel:** Session 8 (different route trees)
**Schema change:** ❌ None

**Sub-tasks:**

| # | Task | Effort |
|---|---|---|
| 7A | shadcn/ui setup + light theme tokens | 1h |
| 7B | Login page + Better Auth client integration | 1-2h |
| 7C | Dashboard — stat cards + calendar view + recent bookings | 2-3h |
| 7D | Bookings table + filter + change status modal | 2-3h |
| 7E | Services CRUD — backend endpoints + UI | 2-3h |
| 7F | Business Hours + Blocked Slots — backend endpoints + UI | 2-3h |

**Endpoints ที่ต้องเพิ่ม (7E + 7F):**
- `GET/POST/PATCH/DELETE /api/admin/services` — role `["admin"]`
- `GET/PUT /api/admin/hours` — role `["admin"]`
- `GET/POST/DELETE /api/admin/blocked-slots` — role `["admin", "staff"]`

**Query functions ที่ต้องเพิ่ม:**
- `src/lib/db/queries/services.ts` — CRUD (session 2 stub)
- `src/lib/db/queries/bookings.ts` — `getBookingStats()` สำหรับ dashboard
- new: `src/lib/db/queries/hours.ts` + `blocked-slots.ts`

**Deliverables:** 5 pages functional, admin can manage everything

---

### Session 8 — Public Booking UI

**Scope:** Customer-facing booking flow
**Effort:** 8-10 ชม.
**Depends on:** 6 ✅
**Can parallel:** Session 7 (different route trees)
**Schema change:** ❌ None

**Sub-tasks:**

| # | Task | Effort |
|---|---|---|
| 8A | Landing page + service catalog + dark cosmic theme | 2h |
| 8B | Booking flow multi-step (service → date → time → info) | 3-4h |
| 8C | Client-side Turnstile widget + form validation | 1h |
| 8D | Confirmation page `/book/[code]` + Google Calendar link | 1-2h |
| 8E | Responsive + mobile testing | 1h |

**Deliverables:** End-to-end customer booking flow live

---

### Session 9 — Preview + Deploy MVP 🚀

**Scope:** First production deploy (**ไม่แตะ LINE OA setup** — เลื่อนไป Session 10)
**Effort:** 3-5 ชม.
**Depends on:** 7 + 8
**Schema change:** ❌ None (apply migrations 0000 + 0001 to remote)

**Sub-tasks:**

| # | Task | Effort |
|---|---|---|
| 9A | ~~Add `LINE_ENABLED` env flag~~ **✅ Done ใน Session 6A** | — |
| 9B | OpenNext build + `wrangler dev` end-to-end test | 1h |
| 9C | `wrangler d1 execute --remote` apply migrations 0000 + 0001 | 30 min |
| 9D | `wrangler secret put` production secrets (Turnstile + Better Auth + `LINE_ENABLED=false`) | 30 min |
| 9E | Deploy `nebula-spa.YOURNAME.workers.dev` | 30 min |
| 9F | Fix production-only issues (env, timezone, edge cases) | 30 min - 1h |
| 9G | Test end-to-end บน production (booking + admin, no LINE) | 30 min |
| 9H | Update Fastwork description + demo URL | 30 min |

**⚠️ Session 9A — LINE_ENABLED Flag Setup**

**Status:** ✅ **Implement แล้วใน Session 6A** — code + env vars พร้อม deploy

**Behavior ปัจจุบัน:**
```typescript
// src/lib/line.ts pushLineText()
if (process.env.LINE_ENABLED !== "true") {
  console.log("[LINE disabled] would push:", { userId, text });
  return;
}
```

**Env ที่มีอยู่:**
- `.env.local`: `LINE_ENABLED=false`
- `.env.example`: `LINE_ENABLED=false  # Set true only after LINE OA setup in Session 10`
- `.dev.vars`: `LINE_ENABLED=false`
- Production: ต้อง `wrangler secret put LINE_ENABLED` → `false` ตอน deploy (9D)

**Verified:** Session 6A test — booking POST log "would push" + return 201 ปกติ

**Session 9 action:** แค่ deploy + `wrangler secret put` — no code change  
**Session 10 action:** `wrangler secret put LINE_ENABLED true` — activate ทันที no redeploy

**Deliverables:**
- ✅ Live URL (`nebula-spa.YOURNAME.workers.dev`)
- ✅ MVP demo-able: booking flow + admin panel work
- ⚠️ **No LINE notification** yet (Session 10 activates)
- ✅ Fastwork listing updated
- ✅ First public URL to share

---

### Session 10 — LINE OA Setup + Customer Flow ⭐

**Scope:** LINE ทั้งระบบ — OA setup + activate 6A owner push + customer flow ครบ
**Effort:** 10-14 ชม.
**Depends on:** 9 (production URL ต้องพร้อม สำหรับ webhook URL config)
**Schema change:** ✅ **YES — Migration 0002** (details below)

**Sub-tasks:**

#### Part A — LINE OA Setup + Activate 6A (1-1.5h)

| # | Task | Effort |
|---|---|---|
| 10A1 | LINE Developers Console → Provider "Nebula Spa" | 10 min |
| 10A2 | Create Messaging API Channel + Bot mode enabled | 15 min |
| 10A3 | Copy `LINE_CHANNEL_ACCESS_TOKEN` + `LINE_CHANNEL_SECRET` | 5 min |
| 10A4 | Follow OA (LINE ส่วนตัว) → capture `LINE_OWNER_USER_ID` | 10 min |
| 10A5 | Fill `.env.local` + `wrangler secret put` production | 15 min |
| 10A6 | `wrangler secret put LINE_ENABLED true` (production) | 5 min |
| 10A7 | Test locally + production: book → owner LINE เด้ง ✅ | 15 min |

**Result:** 6A owner push code = activated + working (dev + production)

#### Part B — Migration 0002 (1-2h)

Detail อยู่ section "🔧 Session 10 — Schema Change Detail" ด้านล่าง

#### Part C — Customer Flow (7-10h)

| # | Task | Effort |
|---|---|---|
| 10C | Popup UI (Add OA suggestion) + localStorage "dismiss today" | 1-2h |
| 10D | LINE webhook receiver `/api/webhooks/line` + signature verify | 2h |
| 10E | Configure webhook URL ที่ LINE Console → production endpoint | 15 min |
| 10F | Message event handler — link phone → `line_user_id` via booking code | 1-2h |
| 10G | Flex message: "จองสำเร็จ" → customer (2nd notification, complements owner) | 1h |
| 10H | Cron Trigger — reminder T-1 hour + Flex confirm button | 2-3h |
| 10I | Postback event handler — customer confirm → notify staff *(nice-to-have)* | 1h |

**Deliverables:**
- ✅ LINE Provider "Nebula Spa" active
- ✅ Owner push ทำงาน (from 6A code, activated in 10A)
- ✅ Customer receives "จองสำเร็จ" Flex message
- ✅ Cron reminder T-1 hour ทำงาน production
- ✅ Confirm button + staff notification (if 10I done)
- ✅ Popup Add OA + localStorage dismiss
- ✅ End-to-end LINE flow complete

---

#### 🔧 Session 10 — Schema Change Detail

**Migration file:** `drizzle/migrations/0002_add_customers.sql`

##### Schema diff — `src/lib/db/schema.ts`

**1. Add new `customers` table:**

```typescript
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),              // ← natural key
  name: text("name"),
  lineUserId: text("line_user_id"),                     // ← null = ยังไม่ add OA
  lineLinkedAt: integer("line_linked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("customers_line_user_idx").on(t.lineUserId),
]);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
```

**2. Modify `bookings` table — add FK + confirm timestamp:**

```typescript
export const bookings = sqliteTable("bookings", {
  // ทั้งหมดเดิม keep as-is
  // id, code, customerName, customerPhone, serviceId,
  // startsAt, endsAt, durationMin, price, status, notes, createdAt

  // NEW fields (nullable for backward compat)
  customerId: integer("customer_id")
    .references(() => customers.id),                    // ← nullable
  confirmedByCustomerAt: integer("confirmed_by_customer_at", { mode: "timestamp" }),
}, (t) => [
  // existing indexes: bookings_time_idx, bookings_status_idx, bookings_code_idx

  // NEW index
  index("bookings_customer_idx").on(t.customerId),
]);
```

**3. Extend status enum — add `confirmed_by_customer`:**

```typescript
status: text("status", {
  enum: [
    "confirmed",              // existing
    "confirmed_by_customer",  // ← NEW (customer กด confirm ผ่าน LINE)
    "completed",              // existing
    "cancelled",              // existing
    "no-show",                // existing
  ],
})
```

##### Data migration script

**File:** `scripts/migrate-0002-populate-customers.ts`

**Purpose:** Populate `customers` table จาก existing bookings + back-fill `bookings.customer_id`

```
Pseudo-code:

1. SELECT DISTINCT phone, latest name FROM bookings ORDER BY created_at DESC
2. FOR EACH (phone, name):
     IF NOT EXISTS in customers:
       INSERT INTO customers (phone, name, line_user_id, line_linked_at, created_at)
       VALUES (phone, name, NULL, NULL, unixepoch())
     UPDATE bookings SET customer_id = customer.id WHERE customer_phone = phone
3. Verify: SELECT COUNT(*) FROM bookings WHERE customer_id IS NULL   → 0
4. Verify: SELECT COUNT(*) FROM customers                            → COUNT(DISTINCT phone)

Runtime: pnpm tsx scripts/migrate-0002-populate-customers.ts
Idempotent: safe to re-run (checks existing before insert)
```

##### Workflow

```
Step 1: Update src/lib/db/schema.ts
  - Add customers table
  - Add bookings.customer_id (nullable) + bookings.confirmed_by_customer_at
  - Extend status enum

Step 2: Generate migration
  $ pnpm drizzle-kit generate
  → drizzle/migrations/0002_XXX.sql

Step 3: Review SQL manually (drizzle-kit may need edge case tweaks)
  - Verify FK definition
  - Verify index syntax

Step 4: Apply schema migration
  $ wrangler d1 execute nebula-spa-db --local  --file=drizzle/migrations/0002_XXX.sql
  $ wrangler d1 execute nebula-spa-db --remote --file=drizzle/migrations/0002_XXX.sql

Step 5: Run data migration script (populate customers, back-fill FK)
  $ pnpm tsx scripts/migrate-0002-populate-customers.ts

Step 6: Verify data integrity
  $ wrangler d1 execute nebula-spa-db --local --command="SELECT COUNT(*) FROM customers"
  $ wrangler d1 execute nebula-spa-db --local --command="SELECT COUNT(*) FROM bookings WHERE customer_id IS NULL"

Step 7: Verify queries still work
  $ pnpm tsc --noEmit
  $ pnpm test (if tests exist)

Step 8: Commit + push
```

##### Backward Compatibility Plan

**Design principle:** ทุก field ใหม่ nullable → **booking เก่าไม่พัง** ถ้ายังไม่ populate

- `customerId` nullable → SELECT bookings ยังคืน record ได้แม้ไม่มี customer link
- `confirmedByCustomerAt` nullable → ปกติเป็น null สำหรับ booking ที่ไม่ได้ผ่าน LINE
- Status enum เพิ่ม value → existing bookings ยังใช้ `confirmed` ปกติ

**Failure recovery:** ถ้า data migration script fail กลางทาง = **safe to re-run** (query check existing ก่อน insert)

##### Impact on existing queries

**Files ต้อง update ตอน Session 10:**

| File | Change |
|---|---|
| `src/lib/db/queries/bookings.ts` | Optional: join customers เพื่อ get lineUserId ใน list response |
| `src/lib/db/queries/availability.ts` | ❌ ไม่กระทบ (query bookings time/status เท่านั้น) |
| `src/lib/db/queries/services.ts` | ❌ ไม่กระทบ |
| `src/lib/validations.ts` | Add `linkLineSchema` — booking code validation |

**Files ที่จะสร้างใหม่:**

- `src/lib/db/queries/customers.ts` — upsert by phone, link LINE
- `src/lib/line-flex.ts` — Flex message templates
- `src/app/api/webhooks/line/route.ts` — receive events + verify signature

---

### Session 11 — Portfolio + Fastwork Integration

**Scope:** Non-code — marketing + presentation
**Effort:** 3-4 ชม.
**Depends on:** 10 (or 9 if LINE เลื่อน)
**Schema change:** ❌ None

**Tasks:**
- Screenshots: 6-8 shots (landing, booking flow, dashboard, LINE Flex message)
- Update `project-bimav.vercel.app` — Nebula Spa section + hero eyebrow
- Update Fastwork listing — description + demo URL + screenshots
- Case study writeup (short version)

**Deliverables:** Portfolio + Fastwork updated, buyer สามารถกดเข้าดู demo

---

## Schema Evolution History

**Source of truth:** `src/lib/db/schema.ts` + `drizzle/migrations/`

```
Migration 0000 (Session 3-4) — Business tables
├── services              — บริการที่ให้จอง
├── business_hours        — เวลาเปิด-ปิด 7 วัน
├── bookings              — รายการจอง (core)
└── blocked_slots         — ช่วงเวลาปิดพิเศษ

Migration 0001 (Session 3-4) — Better Auth tables
├── users
├── sessions
├── accounts
└── verifications

Migration 0002 (Session 10 Part B) — LINE Customer support
├── customers (NEW)
│   ├── phone (unique)     — natural key
│   ├── name
│   ├── line_user_id       — null = ยังไม่ add OA
│   └── line_linked_at
├── bookings (MODIFIED)
│   ├── + customer_id      — FK to customers, nullable
│   ├── + confirmed_by_customer_at
│   └── status enum + 'confirmed_by_customer'
└── + Data migration: populate customers from existing bookings
```

**Total tables after 0002:** 12 (5 business + 4 auth + 3 system)

**Migration ordering rule:** ห้ามข้ามลำดับ 0000 → 0001 → 0002 → …
- Local: `wrangler d1 execute --local` ตามลำดับ
- Remote: `wrangler d1 execute --remote` ตามลำดับ (deploy ก่อนแล้วค่อย migrate)

---

## Timeline Estimate

| Session | Effort | Cumulative | Est. Days (1-2h/day) | Status |
|---|---|---|---|---|
| 2 | ~8h | 8h | Day 1-5 | ✅ Done |
| 3-4 | ~10-12h | 18-20h | Day 6-9 | ✅ Done |
| 5 | ~4-5h | 22-25h | Day 10 | ✅ Done |
| **6 (6A+6B)** | **~6-7h** | **28-32h** | **Day 10-14** | **✅ Done** |
| 7 | 10-14h | 38-46h | +5-9 days | ⏳ |
| 8 (parallel) | 8-10h | +partial | +overlap with 7 | ⏳ |
| **9** | **3-5h** | **41-51h** | **~Day 20-25** | ⏳ |
| 10 | 10-14h | 51-65h | +5-9 days | ⏳ |
| 11 | 3-4h | 54-69h | +2-3 days | ⏳ |

**Milestones:**
- 🎯 **MVP Live (Session 9):** ~3 สัปดาห์ — demo ทำงาน ยกเว้น LINE
- 🎯 **LINE Complete (Session 10):** ~4 สัปดาห์ — LINE ครบ end-to-end
- 🎯 **Portfolio Ready (Session 11):** ~4.5 สัปดาห์

**Note:** Session 7+8 สามารถ parallel ได้ (route tree ต่างกัน — admin vs public) → ลดเวลารวมประมาณ 2-3 วัน

**Timeline reality check:**
- Original spec: 2 สัปดาห์
- Decisions.md realistic: 3-4 สัปดาห์
- **Current projection:** ~4-5 สัปดาห์ (เกิน decisions.md 25-30% เพราะ scope creep ที่ Session 10 + real pace)

---

## Key Decisions Locked

### 1. Deploy MVP ก่อน LINE OA Setup

**Session 9 (deploy) → Session 10 (LINE)** — ไม่ยัด LINE ใน MVP

**เหตุผล:**
- Webhook URL ต้องมี production URL ก่อน → deploy ต้องมาก่อน
- Cron Trigger ทำงานได้เฉพาะ deployed Worker → deploy ก่อน
- 1 session ทำ LINE ทั้งระบบทีเดียว = focus + no context switching
- MVP demo-able ก่อน (สำหรับ Fastwork update)

### 2. Session 6A LINE Code = "Written but inactive" until Session 10

**สถานะปัจจุบัน:** ✅ **Implement + verify แล้ว** — code + `LINE_ENABLED` flag ทำงาน ระหว่าง Session 6A test:
- Booking POST → 201 ปกติ
- Terminal log `[LINE disabled] would push: {...}` — verify code path ทำงาน

**Activate เมื่อ:** Session 10 Part A — setup OA + fill token + `LINE_ENABLED=true`

**เหตุผล:**
- 6A ยังเขียน code ได้ (business logic + integration point ถูกที่)
- Session 9 deploy ปลอดภัย (flag=false → skip API call)
- Session 10 activate = 1 command (`wrangler secret put`) ไม่ต้อง redeploy code

### 3. Customers Table = Migration 0002 (Session 10 Part B)

**ทำใน Session 10 เท่านั้น**

**เหตุผล:**
- Session 6-9 ยึด schema 4 tables + 4 auth เดิม
- ไม่ต้อง refactor query แต่ละ session
- Migration แยกชัดเจน + data back-fill ทีเดียวจบ

### 4. Confirm Button (Session 10I) = Nice-to-have

**ทำถ้ามีเวลา** ใน 10C-10H budget เกิน = ตัด

### 5. Public Booking = No Login Required

**Customer จองด้วยแค่ชื่อ+เบอร์** — LINE = optional add ทีหลัง

**เหตุผล:**
- ธุรกิจนวด/สปา = walk-in-friendly
- Add friction = drop-off เยอะ
- LINE Login แยก (session 10)

### 6. Backward-compat schema evolution

**Migration 0002 = all new fields nullable**

**เหตุผล:**
- Session 6A bookings รอนำเข้า customer table ทีหลัง ไม่พังตอน migrate
- Data migration ทำแยกจาก schema migration = failure recovery ปลอดภัย
- Booking เก่าที่จองก่อน LINE feature = ยัง query ได้ปกติ

### 7. `LINE_ENABLED` Feature Flag Pattern

**Pattern:** Runtime toggle ผ่าน env var — ไม่ต้อง comment code / redeploy

**Value ที่คุ้ม:**
- Session 9 deploy = safe (flag=false)
- Session 10 activate = 1 command
- Session ในอนาคต ปิดชั่วคราวได้ (LINE OA maintenance, quota exceeded)
- Log "would push" ยัง verify logic ทำงาน

### 8. Deviate จาก decisions.md — Next.js 16 + Prettier ชั่วคราว

**Next 16** (แทน 15) — Cloudflare official support พร้อม + breaking change `async params` handle ในโค้ดใหม่

**Prettier** (แทน Biome) — ใช้ที่มาพร้อม scaffold Next.js, migrate Biome ทีหลัง

### 9. Session 6 API Design — Route Handler over Server Action

**เลือก Route Handler** สำหรับ POST /api/bookings + admin endpoints ทั้งหมด

**เหตุผล:**
- Test ผ่าน Postman ตรง (Server Action test ซับซ้อน)
- Turnstile client-side widget → fetch + JSON body ธรรมชาติ
- Consistency กับ admin endpoints
- Session 4 เจอ static prerender + middleware quirks — Route Handler edge case น้อยกว่า

**Trade-off:** เขียน fetch client-side เอง (ไม่ได้ auto-generate จาก Server Action type)

### 10. Session 6B PATCH scope = status only

**Rejected:** full edit (name, phone, time, notes)

**เหตุผล:**
- 80% use case = status change
- แก้เวลา = availability re-check + notify ลูกค้า = complex flow
- Workaround สำหรับ 20% edge case: cancel + create new

**Future:** Session 12+ อาจเพิ่ม `PATCH .../reschedule` endpoint แยก (มี availability re-check + notify)

---

## Blocking Questions (Defer to Session 10)

**อย่าตัดตอนนี้** — เจอ context จริงตอน implement 7-9 ก่อน ค่อยตัดสิน

1. **Popup UI style** — Modal (blocking) / Card inline / Toast?
2. **Deep link platform detect** — Desktop = QR code, Mobile = LINE URL scheme?
3. **Fallback ถ้า user ไม่มี LINE** — hide popup หรือแสดง disclaimer?
4. **Reminder message copy** — formal / friendly / with emoji tone?
5. **Cron schedule** — every 15-min check bookings within 1h? Or exact 60min mark?
6. **Booking code expiration** — 1h / 24h / ไม่หมดอายุ (สำหรับ link LINE)?
7. **Webhook URL** — subdomain default (`nebula-spa.YOURNAME.workers.dev/api/webhooks/line`) หรือ custom domain?

---

## Reference Files

**Planning docs:**
- `booking-system-spec.md` — original scope
- `booking-system-toolstack.md` — tech stack detail
- `booking-system-workflow.md` — algorithms + user journey
- `booking-system-decisions.md` — locked decisions

**Handover docs (per session):**
- `handover-session-2.md` — Structure phase ✅
- `handover-session-3-4.md` — Cloudflare + Auth ✅
- `handover-session-5.md` — Availability algorithm ✅
- `handover-session-6.md` — Booking CRUD (6A + 6B) ✅

**This file:**
- `roadmap.md` — session tracker + timeline + schema evolution

---

## How to use this file

**เริ่ม chat ใหม่:**
1. Upload/reference `roadmap.md` เข้า project memory
2. บอก AI ว่า "จะทำ Session X" ตาม roadmap
3. AI อ่าน scope + depends on + deliverables + schema change จาก section ที่ตรง
4. เริ่ม coding ตาม deliverables

**หลังจบ session:**
1. Update section "Completed" ให้เพิ่ม session ที่เพิ่งเสร็จ
2. เขียน `handover-session-X.md` (optional — recommended)
3. ถ้ามี schema change → update "Schema Evolution History" section
4. ถ้าจำเป็นต้องปรับ scope session ถัดไป → แก้ที่นี่

**ถ้าเจอ decision ใหม่:**
- Add เข้า "Key Decisions Locked" section
- Note ว่า deviate จาก decisions.md หรือไม่ (ถ้าใช่ระบุเหตุผล)

**ถ้ามี schema change ใหม่ (migration 0003+):**
- Add section 10-style detail (schema diff + data migration + workflow + backward compat)
- Update "Schema Evolution History" diagram
- Track migration number ให้ต่อเนื่อง 0000 → 0001 → 0002 → 0003 → …
