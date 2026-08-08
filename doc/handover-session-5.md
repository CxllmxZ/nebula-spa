# Handover — Session 5 (Availability Algorithm)

**Date:** 2 สิงหาคม 2026
**Duration:** 1 chat session (~4-5 ชม. spread หลายรอบ)
**Scope:** Backend availability slot computation — pure algorithm + API endpoint
**Status:** ✅ Complete + verified end-to-end

---

## Summary

Availability layer พร้อมใช้ครบ 100%:
- Bangkok timezone handling (helpers 6 ตัว)
- Slot computation algorithm (30-min grid + overlap check + boundary rules)
- Reusable `hasBookingConflict()` (Session 6 booking CRUD จะเรียกใช้)
- Public GET endpoint + Zod validation + ISO 8601 response
- Verified 9 test cases ผ่านทั้งหมด

**Backend progress:** Module 4 (availability) เสร็จ — เหลือ Module 5-6 (booking CRUD, admin queries) สำหรับ Session 6+

---

## Deliverables

### Files created/modified

**Datetime layer:**
- `src/lib/datetime.ts` — implement จริง (แทน placeholder จาก Session 2)
  - `bangkokDateTimeToUtc(date, time)` — string → UTC Date
  - `toBangkokIsoString(date)` — Date → "2026-08-15T14:00:00+07:00"
  - `getBangkokDayOfWeek(date)` — YYYY-MM-DD → 0-6
  - `getBangkokNow()` — mock-able current time
  - `isBangkokToday(date)` — YYYY-MM-DD comparison
  - `parseTimeString(time)` — internal helper
  - `addMinutesToTime(time, minutes)` — "HH:MM" arithmetic
  - `isTimeBeforeOrEqual(a, b)` — string comparison
  - Constant: `BANGKOK_TZ = "Asia/Bangkok"`

**Query layer:**
- `src/lib/db/queries/availability.ts` — full implementation
  - `getAvailableSlots(serviceId, date)` — main algorithm
  - `hasBookingConflict(startsAt, endsAt)` — reusable race-condition guard
  - Internal helpers: `isBeyondAdvanceLimit`, `isPastDate`, `formatDateOffset`, `generateSlotGrid`, `hasOverlap`

**API layer:**
- `src/app/api/availability/route.ts` — public GET endpoint (recreate from smoke test)
  - Query params: `?serviceId={n}&date={YYYY-MM-DD}`
  - Zod validation (400 on invalid input)
  - Empty slots return 200 + `slots: []` (not error)
  - Serialize Date → ISO 8601 at route boundary

### No new dependencies

ใช้ของที่ install ตั้งแต่ Session 2:
- `date-fns` + `date-fns-tz` — timezone handling
- `zod` — validation
- `drizzle-orm` — query

---

## Design Decisions Locked

### 1. API return format = ISO 8601 with Bangkok offset

```json
{
  "date": "2026-08-15",
  "serviceId": 1,
  "timezone": "Asia/Bangkok",
  "slots": [
    { "start": "2026-08-15T14:00:00+07:00", "end": "2026-08-15T15:00:00+07:00" }
  ]
}
```

**Rationale:**
- Industry standard (Cal.com, Booking.com, Bookingkit ใช้)
- Timezone-explicit (ไม่ต้องเดา offset)
- JS `new Date(str)` parse ได้ทันที
- Human-readable ตอน debug

**Rejected:**
- Unix timestamp (ambiguous seconds vs ms, ต้องแปลง 2 ที่ = timezone bug risk)
- "HH:MM" strings ล้วน (client ต้อง compute timestamp เอง)

### 2. Internal return = Date object (not ISO string)

- `getAvailableSlots()` return `{ start: Date, end: Date }[]`
- Route layer แปลง ISO ตอน serialize
- **Rationale:** Session 6 `createBooking()` เรียก `hasBookingConflict()` ตรง — ใช้ Date สะดวกกว่า

### 3. Booking flow = Auto-confirm

Customer POST → status = `confirmed` ทันที (ไม่ผ่าน `pending`)

**Anti-spam plan (Session 6):**
- Cloudflare Turnstile ที่ POST endpoint
- LINE reminder T-1 hour ลด no-show

**Rationale:** ตรง spec เดิม + ตรง industry norm สำหรับสปา/นวด (walk-in-friendly)

### 4. BLOCKING_STATUSES = `['confirmed']` only

**ไม่รวม `pending`** เพราะ flow ปัจจุบันไม่มี pending  
**ไม่รวม `completed`/`no-show`** เพราะ status พวกนี้ถูก set หลังคิวผ่าน → เวลาจริงไม่ overlap future slot

**Future proofing note (ถ้าอนาคตเพิ่ม pending-approval):**
- ต้องคิด business rule: block ทันที + auto-expire? หรือแยก reservation table?

### 5. Advance booking limit = 30 days

- Handle ที่ availability layer (return `[]` ถ้า > today+30)
- Session 6 ต้อง check ซ้ำที่ POST /api/bookings (defense in depth)

### 6. Slot granularity = 30 min

รองรับ service duration 30/45/60/90/120 min ด้วย grid เดียว

### 7. Boundary rule — adjacency ≠ overlap

Formula: `slot.start < booking.end AND slot.end > booking.start`

- Slot 13:00-14:00 + booking 14:00-15:00 = **NOT overlap** (ต่อกันพอดี ให้จองได้)
- Slot 13:30-14:30 + booking 14:00-15:00 = **overlap** (ทับกัน)

### 8. Timezone method = `"Asia/Bangkok"` (IANA name)

**Not hardcode `+07:00`** — แม้ไทยไม่มี DST ก็ยึด standard เพื่อ handover ให้ลูกค้าจริงในอนาคต

### 9. Public endpoint /api/availability — NO auth guard

Customer เรียกจากหน้าจอง = public flow → ไม่ต้อง session

**Contrast Session 6:** ทุก `/api/admin/*` + Server Action ต้อง `requireRole()`

---

## Test Coverage (9 cases verified end-to-end)

| # | Case | Result |
|---|------|--------|
| 1 | Saturday, service 60min | ✅ 25 slots (09:00-22:00) |
| 2 | Sunday, service 60min | ✅ 25 slots (weekend hours) |
| 3 | Monday, service 60min | ✅ 21 slots (weekday 10:00-21:00) |
| 4 | Saturday, service 90min | ✅ 24 slots (last 20:30-22:00) |
| 5 | Past date | ✅ empty (200 OK, not 400) |
| 6 | Beyond today+30 | ✅ empty |
| 7 | Invalid input (3 variants) | ✅ 400 Zod |
| 8 | Non-existent service | ✅ empty |
| 9 | Booking overlap block | ✅ 17 slots (21 - 4 blocked around 14:00-15:30 booking) |

**Skipped (intentional):**
- Cancelled/pending status not blocking → verified by design (constant literal in code = query filter, impossible to leak)

---

## Feedback Locked for Session 6

**Security principle (from external feedback):**

> "Middleware route guards protect the page render, not the data.
> If your API routes or server actions for /admin/* also accept calls
> directly (not just through the guarded page), re-check the role
> server-side in each handler too, not just in the middleware matcher."

**Action items Session 6:**
1. Create `src/lib/auth-guard.ts`:
   - `requireRole(allowed: AllowedRole[])` — for API routes (throws Response)
   - `requireRoleAction(allowed: AllowedRole[])` — for Server Actions (throws Error)
2. Every `/api/admin/*` handler must call `requireRole()` first
3. Every Server Action for admin flows must call `requireRoleAction()` first
4. Middleware ยังทำงานเป็น edge fast-fail — แต่**ไม่ใช่ source of truth**

**Role map (draft — refine ตอน Session 6):**
- `POST /api/admin/bookings/[id]/status` → `["admin", "staff"]`
- `POST /api/admin/services` (CRUD) → `["admin"]` (staff ไม่ควรแก้ราคา)
- `POST /api/admin/hours` → `["admin"]`
- `POST /api/admin/blocked-slots` → `["admin", "staff"]`

---

## Gotchas Discovered

### 1. `date-fns-tz` — `fromZonedTime` vs `toZonedTime` ทิศทางตรงข้าม

| Function | Input | Output | Use case |
|---|---|---|---|
| `fromZonedTime(str, tz)` | "string ในโซน tz" | UTC Date | User input → DB |
| `toZonedTime(utcDate, tz)` | UTC Date | "Date ที่ getDay/getHours ให้ค่าโซน tz" | DB → local calculation |

**เจอบ่อย:** ใช้ผิดกัน → เพี้ยน 7 ชม.

**Rule of thumb:**
- Input จาก user/DB → `fromZonedTime` (แปลงเข้า UTC)
- Output ให้ user/format → `formatInTimeZone` (แปลงออกจาก UTC)
- อยาก `getDay/getHours` แบบ local → `toZonedTime` แล้ว call

### 2. `getBangkokDayOfWeek` — ต้อง bridge string → UTC → Bangkok view

Naive way ที่พลาด:
```typescript
// ❌ อาจผิดวันถ้า timezone drift
new Date("2026-08-15").getDay()
```

Correct pattern (ที่ implement ไว้):
```typescript
const utcDate = bangkokDateTimeToUtc(date, "00:00");
const bangkokView = toZonedTime(utcDate, BANGKOK_TZ);
return getDay(bangkokView);
```

### 3. Drizzle `gt()` + `mode: 'timestamp'` type mismatch

Drizzle version ปัจจุบันมี type conflict ระหว่าง `gt()` shorthand กับ timestamp column → ใช้ `sql\`\`` template ปลอดภัยกว่า:

```typescript
// Instead of: gt(bookings.endsAt, startsAt)
sql`${bookings.endsAt} > ${startsAt}`
```

**Future:** ถ้า Drizzle version ใหม่แก้แล้ว → refactor ได้

### 4. `getDb()` async — pattern เดียวกับ Session 3-4

```typescript
const db = await getDb();  // ← await
```

เพราะ `getCloudflareContext({ async: true })` ที่ setup Session 3

### 5. `Intl.DateTimeFormat("en-CA", ...)` = ISO 8601 format

Locale `en-CA` (Canada) default format = `YYYY-MM-DD` — ใช้แทน `date-fns` format ง่ายกว่าเพราะไม่ต้อง import lib

Used in: `formatDateOffset()` helper

### 6. Testing D1-backed code ต้องผ่าน `wrangler dev`

`tsx scripts/xxx.ts` ไม่มี D1 binding → รันไม่ได้  
**Solution:** ทดสอบผ่าน HTTP endpoint + Postman (ที่ทำใน Session 5)

**Future:** ถ้าอยากมี proper unit test — ต้อง mock `getDb()` layer

### 7. Zod v4 error API = `.issues[0]` ไม่ใช่ `.errors[0]`

Zod v4 (install ตอน Session 2) เปลี่ยน API — code ใช้ `.issues` ถูกแล้ว

### 8. Overlap check ทำ in-memory ไม่ใช่ DB

**เหตุผล:**
- 1 วัน max ~20-30 bookings → filter ใน memory เร็วมาก
- SQL overlap สำหรับ multiple candidates = query ซ้อน + slower สำหรับ D1

**ยกเว้น** `hasBookingConflict()` — single-slot check → query DB คุ้มกว่า (Session 6 booking POST เรียกทีละครั้ง)

---

## Config Snapshot

```typescript
// availability.ts constants
const ADVANCE_BOOKING_DAYS = 30;
const SLOT_GRANULARITY_MIN = 30;
const BLOCKING_STATUSES = ["confirmed"] as const;
```

---

## Session 6 Kickoff — Ready State

### Infrastructure verified (from Session 3-4-5)
- ✅ Cloudflare Workers + D1 + Drizzle pattern established
- ✅ Better Auth (3 roles) + middleware guard
- ✅ Bangkok timezone helpers ready to reuse
- ✅ `hasBookingConflict()` ready to import
- ✅ Type check passing across project

### Session 6 scope
**Booking CRUD — public + admin flows**

Sub-modules:
1. **Public booking create** (Server Action or POST /api/bookings)
   - Zod validation
   - Turnstile verify
   - `hasBookingConflict()` guard (race condition)
   - nanoid 6-char code generation
   - LINE push notification (fire-and-forget) to owner
2. **Admin booking management** (GET/PATCH)
   - `requireRole()` guard on every handler
   - List with filter (date range, status, service)
   - Change status endpoint
3. **`requireRole()` helper** — new file `src/lib/auth-guard.ts`

### Session 7 candidate scope (defer)
- LINE reminder cron trigger (T-1 hour before booking)
- Cron Trigger vs Queue vs Durable Object — need research + decision

### Decisions needed before Session 6 starts
- Booking code format: nanoid 6 chars? excluded chars (0/O/1/I)?
- LINE push failure handling: retry? log? silent?
- Turnstile bypass for local dev (site key test mode)

### Estimated
- Session 6 (booking CRUD core): ~3-4 hours across 2 sub-sessions
- Session 7 (reminder cron): ~2 hours

---

## Reference Files

- `booking-system-spec.md` — original scope
- `booking-system-toolstack.md` — tool detail
- `booking-system-workflow.md` — algorithms + user journey
- `booking-system-decisions.md` — locked decisions
- `handover-session-2.md` — structure + schema
- `handover-session-3-4.md` — infrastructure + auth
- `handover-session-5.md` — this file

---

## Git Commit (recommended)

```powershell
git add src/lib/datetime.ts src/lib/db/queries/availability.ts src/app/api/availability/route.ts docs/handover-session-5.md
git commit -m "feat(availability): implement slot computation algorithm

- Bangkok timezone helpers via date-fns-tz (6 functions)
- getAvailableSlots + hasBookingConflict queries
- Public GET /api/availability endpoint with Zod validation
- ISO 8601 response with Asia/Bangkok offset
- Verified 9 test cases end-to-end
- Session 5 handover doc"
git push
```

---

**End of handover — Session 5 complete ✅**

Ready for Session 6: Booking CRUD 🎯
