# Handover — Session 6 (Booking CRUD)

**Date:** 12-13 สิงหาคม 2026 (Day 11-14)
**Chats:** 1 chat session ต่อกัน spread 4 วัน
**Total effort:** ~6-7 ชั่วโมง กระจาย
**Scope:** Booking CRUD ทั้ง public + admin

**Status:** ✅ Complete + verified end-to-end (22 test cases ผ่านทั้งหมด)

---

## Summary

จบ Module 5 (Booking API) ครบทั้ง public + admin flow:

- **Session 6A (public create):** `POST /api/bookings` — Zod + Turnstile + race guard + LINE fire-forget + snapshot pricing
- **Session 6B (admin management):** `GET /api/admin/bookings` (list + filter) + `GET/PATCH /api/admin/bookings/[id]` (detail + status change) + `requireRole` guard

**Verified end-to-end:**
- 9 test cases สำหรับ public POST (happy + all error paths)
- 13 test cases สำหรับ admin endpoints (auth + filter + pagination + Thai search + PATCH)

**Backend progress:** ~100% เสร็จ (Module 2-5 done, ยกเว้น services/hours CRUD ที่ defer ไป Session 7)

---

## Deliverables

### Files created

**Auth layer (Session 6A blocker):**
- `src/lib/auth-guard.ts` — `requireRole()` (Route Handler) + `requireRoleAction()` (Server Action)

**Utility layer:**
- `src/lib/nanoid.ts` — booking code generator (nanoid 6 chars, custom alphabet)

### Files modified (implement จริง จาก session 2 placeholder)

- `src/lib/turnstile.ts` — server-side token verification (Cloudflare API)
- `src/lib/line.ts` — `pushLineText()` + `sendBookingNotification()` + Thai date formatting
- `src/lib/validations.ts` — เขียนใหม่ทั้งไฟล์: `bookingCreateSchema` + `adminBookingFilterSchema` + `bookingStatusUpdateSchema`
- `src/lib/db/queries/bookings.ts` — implement `createBooking`, `getBookingByCode`, `getBookingsWithFilter`, `getBookingById`, `updateBookingStatus`

### Route handlers (new)

- `src/app/api/bookings/route.ts` — POST public booking create
- `src/app/api/admin/bookings/route.ts` — GET list + filter
- `src/app/api/admin/bookings/[id]/route.ts` — GET single + PATCH status

### Config additions

- `.env.local`, `.dev.vars`, `.env.example` เพิ่ม:
  - `LINE_ENABLED=false` (feature flag สำหรับ deploy MVP ก่อน setup OA)
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (Cloudflare test key — always pass)
  - `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`

### No new dependencies

ใช้ของที่ install ตั้งแต่ session 2:
- `nanoid` — code generator
- `zod` — validation
- `drizzle-orm` — DB queries
- `date-fns` + `date-fns-tz` — Bangkok timezone (reuse จาก session 5)

---

## Design Decisions Locked

### Session 6A — Public Booking Create

#### 1. Booking code format = nanoid 6 chars + custom alphabet

```typescript
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no 0/O/1/I/l
const CODE_LENGTH = 6;
```

**Rationale:**
- 32^6 = 1.07 พันล้าน combinations → collision แทบ 0 ที่ realistic scale
- ตัด confusing chars (0/O/1/I/l) — ลูกค้าโทรบอกทางโทรศัพท์อ่านง่าย
- 8 chars ยาวเกินไป (จำ/โทรบอกยาก) — 6 = sweet spot

**Retry pattern:** insert loop 3 รอบ ถ้าเจอ UNIQUE constraint violation → generate ใหม่

#### 2. LINE push = fire-and-forget + log

```typescript
sendBookingNotification(...).catch((err) => {
  console.error("[LINE push failed]", { code, error: err.message });
});
```

**Rationale:**
- LINE = notify เจ้าของร้าน, ไม่ใช่ critical path
- ถ้า push fail แล้ว rollback booking = ลูกค้าเสียของ (ผิด)
- Cloudflare Workers CPU limit (10ms Free tier) ไม่เหลือให้ retry loop
- Retry/queue = Session 10 (LINE cron reminder)

#### 3. Turnstile local dev = Cloudflare test keys

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA          # always pass
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

**Rejected alternatives:**
- `if (dev) skipTurnstile()` — เสี่ยงลืมลบ → prod bypass
- Whitelist localhost origin — edge cases เยอะ

**Test key fail variant:** `2x00000000000000000000AB` (always fail — ทดสอบ error path)

#### 4. API Route Handler แทน Server Action

**Rationale:**
- Test ผ่าน Postman ได้ตรง (Server Action test ยาก — ต้อง render + submit)
- Turnstile widget render client-side → fetch + JSON body ธรรมชาติ
- Consistency กับ admin endpoints (6B ใช้ Route Handler ด้วย)
- Session 4 เจอ static prerender + middleware quirks — Route Handler edge case น้อยกว่า

#### 5. `BookingError` class แทน HTTP throw ที่ query layer

```typescript
export class BookingError extends Error {
  constructor(
    public code: "SERVICE_NOT_FOUND" | "SLOT_CONFLICT" | "PAST_DATE" | "BEYOND_ADVANCE_LIMIT" | "CODE_GENERATION_FAILED",
    message: string,
  ) { ... }
}
```

**Rationale:**
- Business logic ไม่ควรรู้เรื่อง HTTP (testable + reusable)
- Route handler map error code → HTTP status:
  - `SERVICE_NOT_FOUND` → 404
  - `SLOT_CONFLICT` → 409
  - `PAST_DATE` / `BEYOND_ADVANCE_LIMIT` → 422
  - `CODE_GENERATION_FAILED` → 500

#### 6. Snapshot pattern — freeze price/duration ที่ booking record

```typescript
await db.insert(bookings).values({
  ...input,
  durationMin: service.durationMin,  // จาก service ณ เวลา insert
  price: service.price,               // snapshot
})
```

**Rationale:** ถ้า service เปลี่ยนราคาในอนาคต booking เก่ายังคงราคาที่ตกลง (audit + business fairness)

#### 7. `LINE_ENABLED` feature flag

```typescript
if (process.env.LINE_ENABLED !== "true") {
  console.log("[LINE disabled] would push:", { userId, text });
  return;
}
```

**Rationale:**
- Deploy MVP ได้ก่อน setup LINE OA (Session 9 → deploy, Session 10 → setup)
- Log "would push" ยัง verify code path ทำงาน (ไม่ใช่ silent skip)
- Session 10 activate = `wrangler secret put LINE_ENABLED true` (no code change)

#### 8. Auto-confirm booking flow

Customer POST → status = `confirmed` ทันที (ไม่ผ่าน `pending`)

**Rationale:** ตรง industry norm สำหรับสปา/นวด (walk-in-friendly)  
**Anti-spam:** Turnstile ที่ endpoint + Session 10 reminder T-1h ลด no-show

---

### Session 6B — Admin Booking Management

#### 1. Auth guard signature = `requireRole(request, allowed)`

**Rationale:**
- Route handler มี `request` ในมืออยู่แล้ว → ส่งเข้าไปเลย = explicit dep
- Server Action ไม่มี `request` → `requireRoleAction()` แยก function ใช้ `next/headers`
- แยก 2 function ตาม context ชัดกว่ารวม 1 function ที่ handle 2 แบบ

**Throw pattern:**
- `requireRole` throw `Response` (401/403) → route handler catch → return ตรง
- `requireRoleAction` throw `AuthError` → Server Action boundary จับ

#### 2. Pagination = offset (`?page=1&pageSize=20`)

**Rejected: cursor-based**
- ซับซ้อน, jump page ไม่ได้
- Admin dashboard ดู 20-50 records → offset เหมาะ

**Max pageSize = 100** (กัน DoS)

#### 3. Response shape = flat + meta object

```json
{
  "bookings": [...],
  "meta": { "total": 21, "page": 1, "pageSize": 20, "totalPages": 2 }
}
```

**Rejected: RFC 5988 Link headers** — over-engineer สำหรับ demo

#### 4. Status change = free (no state machine)

**Rejected: strict transitions** (confirmed → completed/cancelled/no-show only)

**Rationale:** MVP ยืดหยุ่นดีกว่า — admin กดผิดต้องย้อนได้ (ยังไม่มี audit log)

**Future:** add audit log → enforce transitions ในภายหลังได้

#### 5. PATCH scope = status only

**Rejected: full edit (name, phone, time)**

**Rationale:**
- 80% use case = status change (มา/ไม่มา/ยกเลิก)
- แก้เวลา = availability re-check + notify ลูกค้า = complex
- Workaround สำหรับ 20% edge case: cancel + create ใหม่

**Future:** Session 12+ อาจเพิ่ม `PATCH .../reschedule` endpoint แยก (มี availability re-check)

#### 6. Sort default = `asc(startsAt)` — วันใกล้สุดขึ้นก่อน

**Rejected: `desc(startsAt)` (ไกลสุดก่อน)**

**Rationale:** admin เข้ามาดู → อยากรู้ "วันนี้/พรุ่งนี้ใครมาก่อน" — ตรงกับ mental model

**Note:** ปัจจุบัน fixed = asc — ไม่ configurable (Session 7 recent widget ถ้าต้อง `desc(createdAt)` แยกเขียน function ใหม่)

#### 7. Search = LIKE 3 columns (name / phone / code)

```typescript
or(
  like(bookings.customerName, `%${search}%`),
  like(bookings.customerPhone, `%${search}%`),
  like(bookings.code, `%${search}%`),
)
```

**Verified:** SQLite handle Unicode LIKE ok — Thai name "สมชาย" match ได้ทันที

#### 8. Multi-status = comma-separated + Zod pipe

```typescript
// ?status=confirmed,pending
status: z.string().optional()
  .transform((v) => v ? v.split(",").map(s => s.trim()) : undefined)
  .pipe(z.array(z.enum(BOOKING_STATUSES)).optional()),
```

**Rejected: repeated params** (`?status=confirmed&status=pending`)
- Comma-separated URL สั้นกว่า
- Zod transform + pipe = clean

#### 9. Role permissions

- `["admin", "staff"]` ทั้ง 3 admin booking endpoints (list + detail + PATCH)
- Session 7+ services/hours CRUD = `["admin"]` only (staff ไม่ควรแก้ราคา)

---

## Problems Encountered + Fixes (Chronological)

### Session 6A

#### 1. Turnstile verify fail — ไม่มี test keys ใน env

**Symptom:** POST /api/bookings → `400 { "error": "Turnstile verification failed" }`

**Root cause:** `.dev.vars` ไม่มี `TURNSTILE_SECRET_KEY` → server ยิงไป Cloudflare → invalid response

**Fix:** เพิ่ม test keys (Cloudflare wildcard, always-pass) ทั้ง `.dev.vars` + `.env.local` + `.env.example`

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

**Reference:** https://developers.cloudflare.com/turnstile/troubleshooting/testing/

**Lesson:** Test keys ไม่ใช่ magic string — Cloudflare document ทางการ (pattern `1x0000...` = always pass, `2x0000...` = always fail)

---

#### 2. D1 type error — `sql\`\`` template ไม่ auto-serialize Date

**Symptom:**
```
D1_TYPE_ERROR: Type 'object' not supported for value 'Sat Aug 15 2026 14:00:00 GMT+0700'
[POST /api/bookings] 500 Internal Server Error
```

**Root cause:** ที่ `hasBookingConflict()` (session 5 code):
```typescript
lt(bookings.startsAt, endsAt),          // ← Drizzle serialize Date → int ok
sql`${bookings.endsAt} > ${startsAt}`,  // ← sql`` ไม่ serialize! ส่ง Date raw
```

Drizzle helper `lt()` / `gte()` auto-convert Date → Unix timestamp  
`sql\`\`` template ส่ง value ตรงไป D1 → D1 รู้จักแค่ TEXT/INTEGER/REAL/BLOB → reject Date object

**Fix:** convert Date → Unix seconds manually ก่อนใส่ template

```typescript
const startsAtSec = Math.floor(startsAt.getTime() / 1000);

.where(and(
  lt(bookings.startsAt, endsAt),
  sql`${bookings.endsAt} > ${startsAtSec}`,  // ← ส่ง number แทน Date
  inArray(bookings.status, [...BLOCKING_STATUSES]),
))
```

**Why session 5 test ไม่เจอ:** Session 5 test ยิงผ่าน `GET /api/availability` (ไม่เรียก `hasBookingConflict`) — session 6A เป็นครั้งแรกที่ execute → bug โผล่ตอนนี้

**Lesson:** `sql\`\`` = escape hatch แต่ต้อง serialize เอง — Drizzle helpers ปลอดภัยกว่าถ้ามี option

---

#### 3. Missing `await getDb()` ใน `hasBookingConflict()`

**Symptom:** function เรียก `db.select()` ตรง — `db` undefined

**Root cause:** Session 5 code เดิม `getAvailableSlots()` มี `const db = await getDb()` ต้นสุด — แต่ `hasBookingConflict()` ไม่มี (เพราะ session 5 test ไม่ได้ execute path นี้)

**Fix:** เพิ่ม `const db = await getDb();` ต้น function

**Lesson:** Session 3-4 pattern ทุก query function ต้องมี `await getDb()` — session 5 handover gotcha #4 ระบุไว้แล้ว, session 6A บั๊กเพราะข้ามการ verify

---

#### 4. Env var quotes ทำ Turnstile fail

**Symptom:** เห็น error message ต่างจากรอบแรก:
```
[Turnstile] Verify request failed 400
```

**Suspected root cause:** ถ้า `.dev.vars` มี quotes ครอบ:
```
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
```
Wrangler อ่านค่ารวม quotes → ส่งไป Cloudflare = `"1x0000..."` (มี double quotes ในสตริง) → invalid format → 400

**Fix (defensive):** ตรวจว่า `.dev.vars` value ไม่มี quotes:
```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA   # ✅ correct
TURNSTILE_SECRET_KEY="1x0000..."                            # ❌ wrong (bash/dotenv style)
```

**Lesson:** `.dev.vars` = wrangler-specific format, ไม่ใช่ bash — ไม่ต้องมี quotes รอบ value

---

### Session 6B

#### 5. Route conflict — `/admin/bookings` มีทั้ง page + route

**Symptom:**
```
Build error occurred
Error: Conflicting route and page at /admin/bookings:
  route at /admin/bookings/route and page at /admin/bookings/page
```

**Root cause:** ผม (AI) แนะนำ path ผิด — save route file ที่ `src/app/admin/bookings/route.ts` ทับ `page.tsx` เดิม  
Next.js App Router = 1 URL path = 1 file (page.tsx **หรือ** route.ts เท่านั้น ไม่พร้อมกัน)

**Fix:** ย้ายไฟล์ไป `src/app/api/admin/bookings/route.ts` (มี `/api/` prefix)

```
❌ src/app/admin/bookings/route.ts          (conflict กับ page.tsx)
✅ src/app/api/admin/bookings/route.ts      (separate namespace)
```

**Lesson:** Next.js App Router conventions — API endpoints ต้องอยู่ใต้ `/api/` prefix เสมอ (ไม่บังคับ แต่ recommended pattern)

---

#### 6. Stale `.next/types/validator.ts` cache

**Symptom:** หลังลบ route file ผิดที่:
```
error TS2307: Cannot find module '../../src/app/admin/bookings/[id]/route.js'
error TS2307: Cannot find module '../../src/app/admin/bookings/route.js'
```

**Root cause:** `.next/types/validator.ts` = auto-generated ตอน build ก่อน — reference ไฟล์ที่ลบไปแล้ว

**Fix:**
```powershell
Remove-Item -Recurse -Force .next
pnpm tsc --noEmit
```

**Lesson:** Session 4 handover gotcha #9 เจอ pattern เดียวกันแล้ว — เจอซ้ำเป็นเรื่องปกติเมื่อลบ/rename route

---

#### 7. Drizzle `or()` return type = `SQL | undefined`

**Symptom:** TypeScript complain ตอน compose conditions:
```typescript
conditions.push(or(...))  // ← type error: undefined not assignable to SQL[]
```

**Root cause:** Drizzle `or()` return `SQL | undefined` (ถ้า args เป็น undefined ทั้งหมด return undefined)

**Fix:** non-null assertion เพราะเรามั่นใจว่า 3 conditions เต็มเสมอ:
```typescript
conditions.push(
  or(
    like(bookings.customerName, pattern),
    like(bookings.customerPhone, pattern),
    like(bookings.code, pattern),
  )!,  // ← ! ตัด undefined
);
```

**Trade-off:** ถ้า Drizzle version ใหม่แก้ type → refactor ได้

---

## Test Coverage

### Session 6A — Public POST /api/bookings (9 cases)

| # | Case | Expected | Result |
|---|------|----------|--------|
| 1 | Happy path | 201 + code + LINE log | ✅ code `9MUVBJ`, LINE disabled log |
| 2 | Time format invalid | 400 Zod | ✅ "รูปแบบเวลาไม่ถูกต้อง" |
| 3 | Missing required fields | 400 Zod (multi issues) | ✅ customerPhone + turnstileToken |
| 4 | Phone format wrong | 400 Zod | ✅ "เบอร์โทรไม่ถูกต้อง" |
| 5 | Service not found | 404 | ✅ `SERVICE_NOT_FOUND` |
| 6 | Slot conflict (yigy ซ้ำ Test 1) | 409 | ✅ `SLOT_CONFLICT` |
| 7 | Past date | 422 | ✅ `PAST_DATE` |
| 8 | Beyond advance limit | 422 | ✅ `BEYOND_ADVANCE_LIMIT` |
| 9 | Turnstile token missing | 400 | ✅ Zod validation ตัดก่อน Turnstile step |
| 10 | DB verify | confirmed +1 | ✅ 8 confirmed (7 seed + Test 1) |

### Session 6B — Admin endpoints (13 cases)

| # | Case | Expected | Result |
|---|------|----------|--------|
| A1 | GET list no auth | 401 | ✅ Unauthorized |
| A2 | GET list logged in | 200 + 21 records + meta | ✅ sort asc, join serviceName |
| A3 | GET filter status=confirmed | 200 + 8 records | ✅ 8 confirmed |
| A4 | GET filter multi-status | 200 + 11 records | ✅ 8 confirmed + 3 pending |
| A5 | GET search "สมชาย" | 200 + 1 record | ✅ Thai Unicode LIKE ทำงาน |
| A6 | GET date range + pagination | 200 + max 5 records | ✅ total 7, totalPages 2 |
| A7 | GET invalid status | 400 | ✅ Zod validation |
| B1 | GET single id=18 | 200 + booking detail | ✅ serviceName joined |
| B2 | GET single 99999 | 404 | ✅ Not found |
| B3 | GET single "abc" | 400 | ✅ Invalid id |
| C1 | PATCH status → completed | 200 + updated | ✅ status changed |
| C2 | PATCH invalid status | 400 | ✅ Zod validation |
| C3 | DB verify PATCH | status = completed | ✅ persisted |

**Total: 22/22 cases pass**

---

## Config Snapshot

### Auth guard usage patterns

**Route Handler (recommended):**
```typescript
export async function GET(request: Request) {
  try {
    const session = await requireRole(request, ["admin", "staff"]);
    // ... query
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;  // re-throw non-Response → 500
  }
}
```

**Server Action:**
```typescript
"use server";
export async function updateService(data: FormData) {
  await requireRoleAction(["admin"]);
  // ... mutation
}
```

### Turnstile env keys

| Purpose | Site Key | Secret Key |
|---|---|---|
| Dev (always pass) | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Dev (always fail) | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |
| Production | generate ที่ Cloudflare Dashboard | via `wrangler secret put` |

### LINE_ENABLED behavior

| Value | Behavior |
|---|---|
| `LINE_ENABLED=false` | `pushLineText()` → log "would push" + return (no API call) |
| `LINE_ENABLED=true` + valid tokens | Push จริงไปที่ LINE Messaging API |
| `LINE_ENABLED=true` + missing tokens | Throw Error → fire-and-forget catch → log error |
| Env var absent | เท่ากับ `!== "true"` → skip (fail-safe) |

### Booking constants

```typescript
// availability.ts
const ADVANCE_BOOKING_DAYS = 30;
const SLOT_GRANULARITY_MIN = 30;
const BLOCKING_STATUSES = ["confirmed"] as const;

// bookings.ts
const CODE_RETRY_ATTEMPTS = 3;
const BOOKING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars
const BOOKING_CODE_LENGTH = 6;
```

---

## Gotchas Summary (สำหรับ Session 7+)

### Route Handler patterns

1. **API endpoints ต้อง `/api/` prefix** — ไม่งั้น conflict กับ page.tsx
2. **1 URL = 1 route.ts หรือ 1 page.tsx** ไม่พร้อมกัน
3. **Multi-method ในไฟล์เดียว** = export `GET`, `POST`, `PATCH`, `DELETE` แยก function ในไฟล์เดียว = pattern ปกติ
4. **`.next` cache aggressive** — ลบ + rebuild หลัง delete/rename route

### Drizzle + D1 quirks

5. **`sql\`\`` template ไม่ auto-serialize Date** — ต้อง convert เอง (`Math.floor(getTime() / 1000)`)
6. **`or()` / `and()` return type = `SQL | undefined`** — ใช้ `!` ถ้ามั่นใจว่า args มีค่า
7. **`.returning()` ไม่รวม joined field** — ต้อง re-fetch ถ้าต้องการ related data
8. **`await getDb()` ทุก function** — pattern ที่ session 3-4 lock ไว้, ห้ามข้าม

### Auth guard

9. **Guard เป็น step แรกเสมอ** — ก่อน parse body/query params (auth ก่อน validation)
10. **try/catch ต้อง re-throw non-Response error** — ไม่งั้น 500 หายเงียบ
11. **Postman cookie state ค้าง** — clear ก่อน test auth boundary cases

### Turnstile

12. **Test keys มี pattern เฉพาะ** (`1x0000...` = pass, `2x0000...` = fail) — ไม่ใช่ magic string arbitrary
13. **`.dev.vars` ไม่ใช้ quotes** — ค่าเก็บตรง (bash-style quotes = broken)
14. **Client IP optional** — ส่งไปเพิ่ม strict, ไม่ส่งก็ verify ได้

### LINE

15. **Fire-and-forget pattern** — booking success ต้องไม่ block บน notification
16. **Feature flag pattern** — env var toggle ดีกว่า comment code
17. **Thai date formatting** — `Intl.DateTimeFormat` + convert year to พ.ศ. manual (`+543`)

### Zod v4

18. **Error API = `.issues[0]` ไม่ใช่ `.errors[0]`** (session 5 gotcha)
19. **`z.coerce.number()` สำหรับ URL params** — string → number auto
20. **`.transform().pipe()` chain** — transform ก่อน validate ต่อ
21. **Enum validation error message** — Zod v4 = `"Invalid option: expected one of ..."`

### Windows-specific (จาก session 3-4)

22. **PowerShell curl = alias** — ใช้ Postman จริง
23. **Wrangler dev hold file lock** — Ctrl+C ก่อน rebuild
24. **Enable Developer Mode** สำหรับ symlink permission

---

## Files Changed Summary

```
D:\n8n\nebula-spa\
├── .env.example                                    [MODIFIED — Turnstile + LINE_ENABLED]
├── .env.local                                      [MODIFIED — same additions]
├── .dev.vars                                       [MODIFIED — same additions]
├── src/
│   ├── lib/
│   │   ├── auth-guard.ts                           [NEW — requireRole + requireRoleAction]
│   │   ├── nanoid.ts                               [NEW — booking code generator]
│   │   ├── turnstile.ts                            [MODIFIED — implement]
│   │   ├── line.ts                                 [MODIFIED — implement + LINE_ENABLED flag]
│   │   ├── validations.ts                          [MODIFIED — 3 schemas]
│   │   └── db/queries/
│   │       ├── bookings.ts                         [MODIFIED — 5 functions implement]
│   │       └── availability.ts                     [MODIFIED — hasBookingConflict D1 type fix]
│   └── app/api/
│       ├── bookings/route.ts                       [NEW — POST public]
│       └── admin/
│           └── bookings/
│               ├── route.ts                        [NEW — GET list]
│               └── [id]/route.ts                   [NEW — GET single + PATCH status]
└── docs/
    └── handover-session-6.md                       [NEW — this file]
```

### Deleted (mid-session, wrong path)

- `src/app/admin/bookings/route.ts` (route conflict — ย้ายไป `/api/`)
- `src/app/admin/bookings/[id]/route.ts` (same)

---

## Git Commit (recommended)

```powershell
git add -A
git commit -m "feat(6): booking CRUD complete (public + admin)

Session 6A — POST /api/bookings (public create):
- Zod validation + Thai error messages
- Turnstile server-side verify (test keys for dev)
- Race-condition guard via hasBookingConflict()
- Booking code gen (nanoid 6 chars, no confusing chars, retry on collision)
- Snapshot price + duration to survive service edits
- LINE push to owner (fire-and-forget, LINE_ENABLED flag)
- Error mapping: 400/404/409/422/500

Session 6B — Admin management:
- GET /api/admin/bookings — list + filter (date/status/service/search) + pagination
- GET /api/admin/bookings/[id] — single detail
- PATCH /api/admin/bookings/[id] — change status only
- requireRole guard (admin + staff)
- Sort asc startsAt (upcoming first)
- Multi-status via comma-separated
- Search LIKE on name/phone/code (Unicode-safe)

Layers:
- src/lib/auth-guard.ts — requireRole + requireRoleAction
- src/lib/nanoid.ts, turnstile.ts, line.ts — implement session 2 stubs
- src/lib/validations.ts — bookingCreateSchema + adminBookingFilterSchema + statusUpdateSchema
- src/lib/db/queries/bookings.ts — 5 functions (create/getByCode/list/getById/updateStatus)

Fixed:
- D1 type error in hasBookingConflict (sql template ไม่ serialize Date)
- Missing await getDb() in conflict guard
- Route conflict /admin/bookings page vs route

Verified: 22 test cases end-to-end (9 public + 13 admin)"
```

---

## Session 7 Kickoff — Ready State

### Infrastructure verified (from Session 3-4-5-6)
- ✅ Cloudflare Workers + D1 + Drizzle pattern established
- ✅ Better Auth (3 roles: admin/staff/manager) + middleware guard
- ✅ Bangkok timezone helpers ready
- ✅ `hasBookingConflict()` D1-safe
- ✅ Booking CRUD full flow (public POST + admin GET/PATCH)
- ✅ `requireRole()` guard reusable สำหรับ services/hours endpoints ต่อไป
- ✅ Type check + build passing

### Session 7 scope
**Admin Panel UI — frontend**

Sub-tasks:
| # | Task | Effort |
|---|---|---|
| 7A | shadcn/ui setup + light theme tokens | 1h |
| 7B | Login page + Better Auth client integration | 1-2h |
| 7C | Dashboard — stat cards + calendar view + recent bookings | 2-3h |
| 7D | Bookings table + filter + change status modal | 2-3h |
| 7E | Services CRUD UI + backend endpoints | 1-2h |
| 7F | Business Hours + Blocked Slots UI + backend | 1-2h |

**Note:** 7E + 7F ต้องสร้าง admin endpoints เพิ่ม (services CRUD, hours update, blocked-slot CRUD) — pattern เดียวกับ 6B ใช้ `requireRole(["admin"])`

### Session 8 candidate scope (parallel-able)
**Public Booking UI**

- Landing page (dark cosmic theme)
- Multi-step booking flow (service → date → time → info)
- Client-side Turnstile widget integration
- Confirmation page `/book/[code]`

### Decisions needed before Session 7 starts

1. **Services/hours CRUD endpoints** — ทำใน Session 7 (พ่วง UI) หรือแยก Session 7-backend + 7-frontend?
2. **shadcn/ui components list** — เริ่มด้วยตัวไหน (Button/Input/Dialog/Table/Calendar/DropdownMenu ที่ spec เขียน)?
3. **Dashboard stat query** — implement `getBookingStats()` ที่ยัง TODO ใน `queries/bookings.ts` (today/week/month + revenue sum)?

### Estimated
- Session 7 (admin UI + supporting endpoints): ~8-12 hours across 3-4 sub-sessions
- Session 8 (public UI): ~8-10 hours

---

## Reference Files

- `booking-system-spec.md` — original scope
- `booking-system-toolstack.md` — tool detail
- `booking-system-workflow.md` — algorithms + user journey
- `booking-system-decisions.md` — locked decisions
- `roadmap.md` — session tracker + timeline + schema evolution
- `handover-session-2.md` — structure + schema
- `handover-session-3-4.md` — infrastructure + auth
- `handover-session-5.md` — availability algorithm
- `handover-session-6.md` — this file

---

## Learning Reflections

### สิ่งที่ user รู้แล้ว (post Session 6)

- Route Handler multi-method pattern (GET + PATCH ในไฟล์เดียว)
- Drizzle mixed use (helpers auto-serialize vs `sql\`\`` manual)
- Auth guard pattern สำหรับทั้ง API + Server Action
- Zod v4 error handling + `.transform().pipe()` chain
- Feature flag pattern (`LINE_ENABLED`)
- Race condition guard via re-check (not atomic — trade-off explicit)
- Snapshot pattern (freeze data at insert time)
- Fire-and-forget for non-critical side effects

### สิ่งที่ยังต้องเจอ pattern ครั้งที่ 2-3 กว่าจะ click

- Server Component vs Client Component boundary (จะเจอ Session 7)
- shadcn/ui customization + theme tokens (จะเจอ Session 7)
- Client-side form state + validation loop (Session 7-8)
- Cloudflare Turnstile widget lifecycle (Session 8)
- Cron Trigger / Durable Object patterns (Session 10)

### Pattern ที่ค้นพบ (Session 6-specific)

**"Test-driven bug discovery":** Session 5 test 9 cases ผ่านหมด → บั๊ก `hasBookingConflict` D1 type ไม่โผล่ เพราะ path นั้นไม่ถูก execute
- **Lesson:** unit test coverage != integration path coverage
- **Mitigation:** Session 6A test = ครั้งแรกที่ integration execute → บั๊กโผล่แล้วแก้ทีเดียว

**"Cost of AI assistant errors":** ผมแนะนำ path ผิด (`/admin/bookings/` แทน `/api/admin/bookings/`) → user save → build fail
- **Lesson:** verify path convention ก่อน paste code
- **Mitigation:** cost = 5-10 นาที fix + `.next` cache clear

**"Feature flag > commented code":** `LINE_ENABLED` flag = 5 นาที setup, ประหยัดปัญหา test blocking + deploy strategy
- **Lesson:** boolean env toggle มี value ชัดเจน เร็ว
- **Reference:** roadmap.md Session 9A ใช้ pattern เดียวกัน

---

**End of handover — Session 6 complete ✅**

Ready for Session 7: Admin Panel UI 🎯
