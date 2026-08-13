# Handover — Session 7 (Admin Panel UI)

**Date:** ประมาณ 9-13 สิงหาคม 2026 (Day 14 night → Day 18 บ่าย)
**Chats:** 1 chat ยาวครอบคลุม 7A-7G
**Total effort:** ~16 ชั่วโมง กระจาย 5 วัน

---

## Summary

Session 7 = **Admin Panel UI complete** — จาก zero-frontend admin เป็น 7 หน้า functional:

- Login flow (Better Auth client)
- Dashboard (stats + calendar + recent bookings)
- Bookings management (filter + table + detail modal)
- Services CRUD (add/edit/toggle active)
- Business Hours (7 rows batch save)
- Blocked Slots (one-off dates management)
- **Users/Staff Manager (7G — added scope mid-session)**

**Verified end-to-end:**
- Login → session cookie → protected routes ✅
- Dashboard queries + Bangkok TZ calendar ranges ✅
- Bookings filter + status change via reusable modal ✅
- Services CRUD with soft delete via is_active toggle ✅
- Business hours batch save (D1 transaction) ✅
- Blocked slots with past-date guard ✅
- User management with Better Auth signUpEmail + guards (self, last admin) ✅

**Overall project progress:** ~65-70% complete
- Backend: 100%
- Admin UI: 100%
- Public UI: 0% (Session 8)
- Deploy: 0% (Session 9)
- LINE integration: 0% (Session 10)
- Polish + testing: 0% (Session 11)

---

## Sub-session Breakdown

### 7A — shadcn/ui Setup + Nova Theme (~1.5h)

**Goal:** Install shadcn/ui, configure theme (warm spa colors), install baseline components

**Actions:**
1. `pnpm dlx shadcn@latest init` — interactive CLI
2. Selected: **Radix UI** base + **Nova preset** + **Stone** color
3. Installed 9 components in batch: `button input label card table dialog select badge sonner`
4. Manually restored IBM Plex Sans Thai (Nova overwrote with Geist)
5. Removed dark mode tokens (admin light-only per spec)
6. Applied subtle warm tint: `oklch(0.99 0.005 70)` background, `oklch(0.18 0.01 50)` foreground

**Key discoveries:**
- **shadcn 2026 has new preset system** — no more "default"/"new-york", now 8 presets: Vega (classic), Nova (admin/data-heavy), Maia (consumer), Lyra (dev tools), Mira (spreadsheet), Luma, Sera, Rhea + Custom
- **3 base component libraries** — Radix (default), Base UI, React Aria — user chose the underlying primitives
- **Nova preset opinionated** — packs font (Geist) + dark mode tokens + neutral color palette that override existing project config

**Config decisions locked:**
- **Preset: Nova** — description explicitly says "Good for dashboards, admin panels, data-heavy interfaces"
- **Base library: Radix** — battle-tested, largest community, safest for debugging
- **Base color: Stone** — warm neutral, matches spa mood
- **No dark mode** — admin light-only

**Files created:**
- `components.json`
- `src/components/ui/*.tsx` (9 files: button/input/label/card/table/dialog/select/badge/sonner)

**Files modified:**
- `src/app/globals.css` — Nova tokens + warm color overrides
- `src/app/layout.tsx` — restored Noto Serif Thai + IBM Plex Sans Thai (Nova overwrote with Geist)
- `src/lib/utils.ts` — untouched (already had `cn()`)

---

### 7B — Login + Better Auth Client (~2h)

**Goal:** Wire Better Auth client SDK, create functional login page

**Actions:**
1. Created `src/lib/auth-client.ts` — `createAuthClient` from `better-auth/react` (no baseURL — auto-infer from window.location)
2. Rewrote `src/app/admin/login/page.tsx` as Client Component with:
   - Zod-validated email/password form (`noValidate` on form, zod is source of truth)
   - Better Auth error mapping to Thai (invalid credentials, rate limit)
   - `router.refresh()` after successful login (middleware re-check with new cookie)
   - Callback URL support (redirect after login)
3. Mounted `<Toaster>` in admin layout

**Config decisions locked:**
- **Manual state + zod parse** (not react-hook-form) — 2-field form, install lib not worth it
- **`noValidate` on form** — block browser native validation, zod = single source of truth
- **Error mapping via status code first, then error code** — `error.status === 429` more reliable than string `code` matching

**Files created:**
- `src/lib/auth-client.ts`

**Files modified:**
- `src/app/admin/login/page.tsx` — full rewrite (was placeholder)
- `src/app/admin/layout.tsx` — mount `<Toaster />`

---

### 7C — Dashboard (~3h)

**Goal:** Server-fetched dashboard with stats, calendar, recent bookings

**Actions:**

**Backend queries (`src/lib/db/queries/bookings.ts` extended):**
- `getBookingStats()` — 4 parallel queries via `Promise.all`:
  - Today aggregate (count + revenue)
  - Week aggregate
  - Month aggregate
  - Upcoming today count (confirmed + startsAt > now)
- `getRecentBookings(limit=5)` — sort by createdAt DESC
- `getBookedDatesInMonth(year, month)` — return `Set<string>` for O(1) calendar lookup

**Datetime helpers added (`src/lib/datetime.ts`):**
- `getBangkokDayRange(now)` — `{start, end}` [inclusive, exclusive) Bangkok
- `getBangkokWeekRange(now)` — Monday-Sunday ISO week
- `getBangkokMonthRange(now)` — 1st to 1st next month
- All use `toZonedTime → op → fromZonedTime` pattern for TZ safety

**Format helpers (`src/lib/format.ts` new):**
- `formatCurrency(n)` — `Intl.NumberFormat("th-TH", {style:"currency", currency:"THB", maximumFractionDigits:0})` = `฿1,500`
- `formatCount(n)` — Thai decimal separator

**UI structure:**
- Hero card: "คิวถัดไปวันนี้" (bg-primary, large number)
- 6 stat cards (responsive grid: 1/2/3/6 cols by breakpoint)
- Calendar widget (react-day-picker + modifiers for booked/today/outside)
- Recent bookings widget (5 rows compact)
- 40/60 grid split (2-col/5-col responsive)

**Design iterations that happened:**
- Calendar: 4 rounds — week start (Mo not Su), outside-month dim, today color conflict with booked, layout too narrow → too wide → 40/60 split
- Stat card responsive: originally proposed 6-col desktop, changed to 3-col laptop / 6-col wide

**Config decisions locked:**
- **Revenue counting: `confirmed + completed`** (exclude cancelled/no-show), labeled "รายได้คาดการณ์" — honest with business meaning
- **Data fetch pattern: RSC direct query** (not `/api/admin/dashboard` endpoint) — dashboard is read-only aggregate, no interactive filters
- **Calendar click → `/admin/bookings?dateFrom=X&dateTo=X`** (single-day filter, not `?date=X` — schema uses dateFrom/dateTo)
- **`react-day-picker`** (bundled with shadcn) — not FullCalendar (200KB, over-engineer)

**Files created:**
- `src/lib/format.ts`
- `src/components/admin/dashboard-calendar.tsx` (Client)
- `src/components/admin/recent-bookings.tsx` (initially Server, later Client — see 7D changes)

**Files modified:**
- `src/lib/db/queries/bookings.ts` — added 3 queries + `REVENUE_STATUSES` const
- `src/lib/datetime.ts` — added 3 range helpers
- `src/app/admin/page.tsx` — full rewrite (was smoke test)

---

### 7D — Bookings Management (~3h)

**Goal:** Bookings list page with filter, table, pagination, status change modal

**Actions:**

**Backend prep:**
- Verified session 6 endpoints exist: `/api/admin/bookings` (GET list) + `/api/admin/bookings/[id]` (GET/PATCH) ✅
- Added `getActiveServices()` to `services.ts` (was empty stub)
- Extracted `BOOKING_STATUS_CONFIG` + `BOOKING_STATUS_LIST` to `src/lib/booking-status.ts` (shared between recent widget + table + detail dialog)

**Pages/components:**
- `/admin/bookings` page (Server Component) — parse `searchParams: Promise<...>` (Next 16 async), validate via `adminBookingFilterSchema`, fallback to defaults on invalid
- `BookingsFilterBar` (Client) — date range (2 Popover+Calendar), status pills, service Select, search input (300ms debounce), reset button, URL sync via `useTransition`
- `BookingsTable` (Client) — 6 columns, whole-row click opens detail dialog, pagination preserves filter in URL
- `BookingDetailDialog` (Client, **reusable**) — used by both dashboard recent widget AND bookings table

**Nav header (`AdminNav`):**
- Created `src/components/admin/admin-nav.tsx` — Client Component with `usePathname()` for active state
- Modified `src/app/admin/layout.tsx` — header with logo (link to `/admin`) + 3 tabs
- Removed hardcoded gray → theme tokens (`bg-muted/40`, `bg-card`)

**Config decisions locked:**
- **URL query params + RSC refetch** (not TanStack Table + client fetch) — shareable URL, browser history works
- **Filter layout: horizontal top bar** (not sidebar) — spa doesn't need 10+ filters
- **Row click → modal** (not `/admin/bookings/[id]` detail page) — 1 click faster, defer detail page post-MVP
- **Status pill: single-select** (radio pattern) — user preference (multi-select confusing)
- **Modal reusable** — same component for recent widget + table row click, `<BookingDetailDialog>` accepts `booking + open + onOpenChange` props
- **Save button + Select dropdown** in modal (not click-instant pills) — user preference (prevent mis-click)

**Files created:**
- `src/lib/booking-status.ts` (extracted from `recent-bookings.tsx`)
- `src/app/admin/bookings/page.tsx`
- `src/components/admin/admin-nav.tsx`
- `src/components/admin/bookings-filter-bar.tsx`
- `src/components/admin/bookings-table.tsx`
- `src/components/admin/booking-detail-dialog.tsx`

**Files modified:**
- `src/lib/db/queries/services.ts` — `getActiveServices()` (was empty)
- `src/components/admin/recent-bookings.tsx` — converted to Client Component, wire dialog
- `src/app/admin/layout.tsx` — nav header
- `src/app/admin/page.tsx` — remove clickable link on recent rows (initially pointed to non-existent detail page)

**Components installed via shadcn CLI during 7D:**
- `dropdown-menu` (initially for status change, later removed when modal replaced it)
- `popover` (wrap date picker filter)
- `calendar` (already in 7C but re-verified)

---

### 7E — Services CRUD (~2.5h)

**Goal:** Admin CRUD for services (name/description/duration/price) + soft delete via is_active toggle

**Actions:**

**Backend queries (`src/lib/db/queries/services.ts` extended):**
- `getAllServices()` — include inactive (for admin)
- `getServiceById(id)` — for future edit dialog pre-fill
- `createService(input)` — auto-assign `displayOrder = MAX + 1`
- `updateService(id, input)` — partial update, returns null if not found
- `toggleServiceActive(id, isActive)` — convenience wrapper

**Zod schemas (`src/lib/validations.ts` extended):**
- `serviceCreateSchema` — name/description/durationMin (15-240)/price (min 1)/isActive
- `serviceUpdateSchema` — all fields optional, plus displayOrder
- **Critical fix:** description uses `.nullish()` not `.optional()` — see problems section

**Routes:**
- `GET /api/admin/services` — admin + staff (staff needs to see prices)
- `POST /api/admin/services` — admin only
- `GET /api/admin/services/[id]` — admin + staff
- `PATCH /api/admin/services/[id]` — admin only (includes toggle isActive)

**Frontend:**
- `/admin/settings` page with Tabs shell (services/hours/blocked)
- `ServicesManager` — table with name/duration/price/isActive switch/edit button
- `ServiceFormDialog` — reusable Add + Edit (same form, different mode)

**Components installed:**
- `tabs`
- `switch`

**Config decisions locked:**
- **Soft delete via `is_active` toggle** (not hard delete) — bookings FK integrity + snapshot pricing
- **Duration input: `type="number" step=15 min=15 max=240`** — hint 30-min multiple but not strict
- **Price input: `type="number" min=1`** — currency prefix in label, not value
- **Form validation: manual state + zod parse** (same pattern as 7B login)
- **Reuse `serviceCreateSchema` for both create + edit** — form always has all fields, no need for partial
- **`serviceUpdateSchema` (partial)** used only for backend to support toggle-only PATCH from Switch

**Files created:**
- `src/app/admin/settings/page.tsx`
- `src/app/api/admin/services/route.ts`
- `src/app/api/admin/services/[id]/route.ts`
- `src/components/admin/services-manager.tsx`
- `src/components/admin/service-form-dialog.tsx`

**Files modified:**
- `src/lib/db/queries/services.ts` — full CRUD (was just `getActiveServices`)
- `src/lib/validations.ts` — added 2 schemas

---

### 7F — Business Hours + Blocked Slots (~2h)

**Goal:** Admin manage 7 fixed weekly hours + one-off blocked dates

**Actions:**

**Backend queries:**
- `src/lib/db/queries/business-hours.ts` NEW:
  - `getAllHours()` — auto-fill missing days with closed defaults (guarantee 7 rows for UI)
  - `updateAllHours(rows[])` — atomic via `db.batch([delete, ...inserts])`
- `src/lib/db/queries/blocked-slots.ts` NEW:
  - `getUpcomingBlockedSlots()` — filter `endsAt >= now`, sort ASC
  - `createBlockedSlot(input)`
  - `deleteBlockedSlot(id)`

**Zod schemas:**
- `businessHourRowSchema` — dayOfWeek/openTime/closeTime/isClosed with 2 `.refine()`:
  - isClosed OR both times set
  - openTime < closeTime (unless closed)
- `businessHoursUpdateSchema` — array `.length(7)` + `.refine()` unique days 0-6
- `blockedSlotCreateSchema` — date/startTime/endTime/reason with 2 `.refine()`:
  - endTime > startTime
  - **date >= today Bangkok** (past-date guard added after bug — see problems)

**Routes:**
- `GET/PUT /api/admin/hours` (staff read, admin write)
- `GET/POST /api/admin/blocked-slots` (staff + admin — operational)
- `DELETE /api/admin/blocked-slots/[id]`

**Frontend:**
- `HoursManager` — 7 fixed rows with time inputs + Switch toggle + batch save button
- `BlockedSlotsManager` — table + Add button + browser `confirm()` for delete
- `BlockedSlotFormDialog` — date + start/end times + reason

**Config decisions locked:**
- **Hours save: PUT all 7 rows batched** (atomic, matches unique constraint)
- **Blocked slot: full datetime range** (not full-day only) — supports "ปิดครึ่งวันสงกรานต์"
- **Blocked slot list: upcoming only** (`endsAt >= now`) — past = noise
- **7 rows fixed** — no multi-range per day (break-time = future via recurring blocked slots)
- **Backend auto-fill missing days** — guarantee UI always has 7 rows

**Files created:**
- `src/lib/db/queries/business-hours.ts`
- `src/lib/db/queries/blocked-slots.ts`
- `src/app/api/admin/hours/route.ts`
- `src/app/api/admin/blocked-slots/route.ts`
- `src/app/api/admin/blocked-slots/[id]/route.ts`
- `src/components/admin/hours-manager.tsx`
- `src/components/admin/blocked-slots-manager.tsx`
- `src/components/admin/blocked-slot-form-dialog.tsx`

**Files modified:**
- `src/lib/validations.ts` — added 3 schemas
- `src/app/admin/settings/page.tsx` — wire 2 new tabs + parallel fetch

---

### 7G — Staff Manager (added scope) (~2h)

**Goal:** Admin-only user management (add staff, change role, delete)

**Note:** Not in original roadmap. Added mid-session per user request — buyer demo value ("แสดงว่าจัดการทีมได้")

**Actions:**

**Backend queries (`src/lib/db/queries/users.ts` NEW):**
- `getAllUsers()` — list with role, sort by createdAt
- `getUserById(id)` — id is **string** (Better Auth uses UUID/nanoid, not int)
- `countAdmins()` — for last-admin guard
- `updateUserRole(id, role)` — direct Drizzle update (bypass Better Auth)
- `deleteUserById(id)` — cascade sessions/accounts via FK

**Zod schemas:**
- `userCreateSchema` — email/name/password (min 8)/role (default staff)
- `userRoleUpdateSchema` — role only

**Routes (all admin-only):**
- `GET/POST /api/admin/users`
- `PATCH/DELETE /api/admin/users/[id]`

**Better Auth integration:**
- POST route calls `auth.api.signUpEmail({body: {email, password, name}})` server-side
- Default role from signup = "staff" (config's `additionalFields.role.defaultValue`)
- If admin/manager role requested → PATCH via `updateUserRole` after signup (2-step)
- `autoSignIn: true` creates orphan session for new user — negligible, expires per default

**Backend guards:**
- Cannot change own role (403)
- Cannot delete self (403)
- Cannot demote/delete last admin (400)
- Duplicate email → catch Better Auth error keyword "already" → 400 "อีเมลนี้ถูกใช้แล้ว"

**Frontend:**
- `/admin/settings` — server-side role check → conditionally add "ทีมงาน" tab (admin only)
- `UsersManager` — table with role badge dropdown + delete button
- `UserFormDialog` — email/name/password (show/hide toggle)/role select
- UI guards mirror backend: self row → disabled with "(คุณ)" label, last admin → dropdown items disabled

**Config decisions locked:**
- **Full admin create** (email + password + role) — not signup-then-promote
- **Admin-only tab + endpoints** — staff sees 3 tabs, admin sees 4
- **Show self in list** with "(คุณ)" indicator + disabled actions
- **"ทีมงาน" tab rightmost** — order: บริการ → เวลาทำการ → วันหยุด → ทีมงาน
- **Password reset defer** — MVP admin delete + recreate as workaround
- **Any admin can promote/demote** — no super-admin concept for MVP
- **Manager role placeholder retained** — future-proof, permissions ≈ staff currently

**Files created:**
- `src/lib/db/queries/users.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/components/admin/users-manager.tsx`
- `src/components/admin/user-form-dialog.tsx`

**Files modified:**
- `src/lib/validations.ts` — added 2 schemas
- `src/lib/auth-guard.ts` — added `getSessionUserId()` helper (optional)
- `src/app/admin/settings/page.tsx` — role check + conditional tab + user fetch

---

## Problems Encountered + Fixes (Chronological)

### 7A — Setup

#### P1. shadcn CLI has new component library prompt (unfamiliar)

**Symptom:** CLI asks "Select a component library" with 3 options (Base UI / React Aria / Radix UI) — not documented in old tutorials

**Root cause:** shadcn v2 (late 2025) expanded to support 3 base primitive libraries. Old assumption "shadcn = Radix always" no longer true

**Fix:** Chose Radix UI — matures ecosystem, most community references, best debugging support

**Lesson:** shadcn ecosystem evolves fast — search + verify current CLI behavior before assuming

---

#### P2. shadcn CLI has "preset" system (unfamiliar)

**Symptom:** After base library, CLI asks "Which preset?" with 8 options (Vega/Nova/Maia/Lyra/Mira/Luma/Sera/Rhea) — no idea what they mean

**Root cause:** shadcn added preset system Dec 2025 — packages font + spacing + tokens per use case. Nova specifically designed for admin/dashboards

**Fix:** Chose Nova — docs explicitly recommend for admin panels

**Lesson:** shadcn presets are opinionated packages, not just "themes" — they overwrite existing config (fonts, dark mode) → must patch post-init

---

#### P3. Nova preset overwrote IBM Plex Sans Thai

**Symptom:** After `shadcn init`, `layout.tsx` had `Geist` font instead of `IBM_Plex_Sans_Thai`. Console showed CLI logged "Updating fonts"

**Root cause:** Nova preset defaults to Geist font. CLI blindly overwrote existing font import in layout.tsx

**Fix:** Restored IBM Plex Sans Thai with `--font-sans` variable name (matches token in globals.css):
```typescript
const sansThai = IBM_Plex_Sans_Thai({
  variable: "--font-sans",  // sync with globals.css
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});
```

**Lesson:** After `shadcn init`, verify layout.tsx font imports — presets may override

---

#### P4. Browser extension noise in console

**Symptom:** Console errors after first render:
```
TypeError: Cannot read properties of undefined (reading 'location')
SecurityError: Blocked a frame with origin ... from accessing a cross-origin frame
Injection error: Content already injected
```

**Root cause:** Password manager extension (1Password/Bitwarden/etc.) injecting autofill logic into `<Input>` fields. Line numbers `:68 :107 :368` don't match any project file → extension script

**Fix:** Verified in incognito mode (extensions disabled) — errors disappeared → confirmed extension noise, not code bug

**Lesson:** Errors with fingerprint `checkExistingInputs / runInjection / cross-origin frame` = extension noise, safe to ignore in dev

---

### 7B — Login

#### P5. Layout had duplicate `{children}` (my mistake)

**Symptom:** After adding `<Toaster />` to admin layout, page rendered content twice on `/admin`

**Root cause:** I pasted incomplete patch snippet — user inserted `<Toaster />` after `<main>{children}</main>` but I unclear that the `{children}` outside main should be removed

**Fix:**
```tsx
<main className="flex-1 p-6">{children}</main>
{children}   // ← REMOVED
<Toaster position="top-right" richColors />
```

**Lesson:** When patching existing layout, always show the ENTIRE new version, not just "add this line" snippets

---

#### P6. Hardcoded `bg-gray-50` / `bg-white` overrode warm theme

**Symptom:** After all the Nova + warm token tuning, admin layout still looked cold grey

**Root cause:** Session 3-4 layout used Tailwind palette classes directly (`bg-gray-50`, `bg-white`) — not semantic tokens. These bypass CSS variable system entirely

**Fix:** Replaced with semantic tokens:
- `bg-gray-50` → `bg-muted/40`
- `bg-white` → `bg-card`

**Lesson:** Semantic tokens (`bg-muted`, `bg-card`) always > Tailwind palette (`bg-gray-50`, `bg-white`) — token-based respects theme system

---

#### P7. Better Auth rate limit English message leaked

**Symptom:** After 10 failed login attempts, toast showed "Too many requests. Please try again later." (English)

**Root cause:** My `error.code` mapping assumed `TOO_MANY_REQUESTS` code, but Better Auth returns `error.status === 429` with no code. Fallback branch returned raw English message

**Fix:** Check status code first (more reliable than string code matching):
```typescript
const message =
  error.status === 429
    ? "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่"
    : error.code === "INVALID_EMAIL_OR_PASSWORD"
      ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      : "เกิดข้อผิดพลาด กรุณาลองใหม่";
```

**Lesson:** HTTP status codes = standard, string codes = fragile. Check status first when mapping API errors

---

### 7C — Dashboard

#### P8. Calendar visual design took 4 iteration rounds

**Symptom:** User feedback rounds:
1. "UI แปลกๆ" — outside-month dates not dimmed, today conflicts with booked
2. "week start ควรเป็น Mo" — default was Sunday
3. "highlighted ควรใช้พื้นสี ไม่ใช่แค่ underline" — dot styling too subtle
4. "calendar อันนิดเดียว แต่ UI card ดันกว้าง" — grid ratio wrong

**Root cause:** Each iteration exposed a design assumption I made without confirming with user

**Fixes iteratively:**
1. Added `outside: "text-muted-foreground/40"` modifier
2. Added `weekStartsOn={1}` prop
3. Changed booked style: `bg-primary/15 text-primary font-semibold rounded-md`
4. Changed dashboard grid from `lg:grid-cols-3` (2/3 col span) → `lg:grid-cols-5` (2 col + 3 col) = 40/60 split — calendar fits natural width

**Lesson:** Visual components need iteration — my initial CSS almost always misses UX nuance. Present options with trade-offs, let user pick

---

#### P9. Recent widget click → broken URL (my design mistake)

**Symptom:** User clicked recent booking row → navigate to `/admin/bookings/{id}` → 404

**Root cause:** I designed clickable row in 7C.5 assuming detail page would exist by 7D. But 7D scope defer detail page → orphan link

**Fix iterations:**
1. First patch: change link to `/admin/bookings?search={code}` → user confused ("ทำไม search box มี code แปลกๆ")
2. Second patch: change to `?dateFrom=X&dateTo=X` → user asked "ทำไมกดได้ในเมื่อไม่มี modal"
3. Final decision: **remove Link entirely**, unlink until 7D adds modal
4. Then 7D added reusable `BookingDetailDialog` used by both dashboard + bookings table — proper solution

**Lesson:** Don't design "click → destination" until destination exists. Or plan destinations before UX (didn't happen here)

---

#### P10. Datetime range helpers didn't exist yet

**Symptom:** Initial `getBookingStats()` code imported `getBangkokDayRange` etc. — TypeScript error module not found

**Root cause:** I assumed these helpers existed. Session 5 handover added 5 datetime helpers but not calendar ranges

**Fix:** Added 3 new helpers to `datetime.ts`:
```typescript
export function getBangkokDayRange(now: Date = new Date()): DateRange
export function getBangkokWeekRange(now: Date = new Date()): DateRange
export function getBangkokMonthRange(now: Date = new Date()): DateRange
```

Half-open `[start, end)` intervals, Monday-week start, TZ-safe via `toZonedTime → op → fromZonedTime` pattern

**Lesson:** Verify existing helpers before assuming — grep the file first

---

### 7D — Bookings

#### P11. useEffect infinite loop in filter bar

**Symptom:** URL changing rapidly ("http://localhost:8787/admin/bookings?status=..." with URL bar loading nonstop)

**Root cause:** `useEffect` that pushes URL fires on mount. First render → push URL → RSC refetch → re-render → state reference changes → deps see change → push again → loop

**Fix:** Skip mount push via ref:
```typescript
const isFirstRender = useRef(true);

useEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false;
    return;
  }
  // ... push URL
}, [...]);
```

**Lesson:** useEffect that pushes state to URL must skip mount — URL already reflects initial state, no need to re-push

---

#### P12. `body?.error` type error in change status handler

**Symptom:** `Property 'error' does not exist on type '{}'`

**Root cause:** `res.json().catch(() => ({}))` — TS infers catch return as literal `{}` (no properties), not any/unknown. `body?.error` reads property that TS thinks doesn't exist

**Fix:** Type cast at boundary:
```typescript
const body = (await res.json().catch(() => ({}))) as { error?: string };
throw new Error(body.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
```

**Lesson:** `.catch(() => ({}))` returns literal `{}` type — need cast at fetch boundary. Use `as { error?: string }` pattern for API error responses

---

#### P13. Calendar `?date=` filter didn't work (schema mismatch)

**Symptom:** User clicked calendar date → URL `?date=2026-08-15` → filter shows all bookings (not filtered)

**Root cause:** I pushed `?date=X` from calendar but `adminBookingFilterSchema` only has `dateFrom` and `dateTo` — no `date` field → schema ignored → filter empty

**Fix:** Change calendar push to single-day range:
```typescript
router.push(`/admin/bookings?dateFrom=${dateStr}&dateTo=${dateStr}`);
```

**Lesson:** Verify schema fields before pushing URL params. Test data flow end-to-end not just UI

---

#### P14. Multi-select vs single-select status pills

**Symptom:** User clicked status pill "ยืนยันแล้ว" then "รอยืนยัน" — both highlighted, filter combined both → confused

**Root cause:** I designed multi-select intentionally (backend supports `status=confirmed,pending` array) — but users expect pills = radio pattern

**Fix:** User chose single-select. Changed toggle function:
```typescript
function toggleStatus(s: BookingStatus) {
  setStatuses((prev) => (prev[0] === s ? [] : [s]));
}
```

**Lesson:** Pill UI pattern connotation = radio/single-select for most users. If backend supports multi, still show single unless user explicitly wants combos

---

#### P15. Recent widget click destination confusion

**Symptom:** After 7D added modal, user asked "สรุปยังไง ไม่ให้กด หรือจะทำ modal เพื่อดู booking แต่ละรายการ"

**Root cause:** Following P9, I kept iterating on link destination. User correctly pushed back — the right solution was a reusable modal component

**Fix:** Created `BookingDetailDialog` (reusable) — wired to both:
1. Dashboard recent widget row click → modal
2. Bookings table row click → modal (replaced `⋮ dropdown`)

**Lesson:** Design components for reuse. If same interaction happens in 2 places, extract to reusable component from start

---

### 7E — Services

#### P16. Zod v4 transform round-trip bug (BIG lesson)

**Symptom:** Frontend submit form → toast "Validation failed" → response `issues[0].message = "Invalid input: expected string, received null"` at `path: "description"`

**Investigation:**
1. Console log input at frontend → `description: ""` (empty string, string type)
2. Frontend Zod parse: `"".string().trim().max().optional().transform((v) => v && v.length > 0 ? v : null)` → output `null`
3. Body sent to backend: `{description: null, ...}`
4. Backend re-parses SAME schema → `.string()` at head of chain rejects `null` → fail

**Root cause:** Schema uses `transform` — input type ≠ output type. Frontend `.parse()` produces null. Backend re-parses null through schema that only accepts string.

**Fix:** Change `.optional()` → `.nullish()` to accept null:
```typescript
description: z
  .string()
  .trim()
  .max(500, "คำอธิบายยาวเกินไป")
  .nullish()   // ← was .optional()
  .transform((v) => (v && v.length > 0 ? v : null)),
```

`.nullish()` = `.optional().nullable()` — accepts `undefined | null | string`

**Lesson (critical):** When schema has `.transform()` + shared frontend/backend:
- Input type MUST accept output type of transform
- Round-trip safe = parse output can be re-parsed by same schema
- Use `.nullish()` (or `.nullable().optional()`) at every layer that produces null

---

#### P17. User edited wrong schema (my documentation failure)

**Symptom:** After I told user to change `.optional()` → `.nullish()`, still same error

**Root cause:** I said "เปลี่ยน `.optional()` → `.nullish()` ใน serviceCreateSchema" but user changed `serviceUpdateSchema` instead (they saw `.optional()` on `description` and thought that was it)

**Fix:** Specified which schema by name + line number. Both schemas needed the fix.

**Lesson:** When multiple schemas have similar-looking code, ALWAYS specify by name AND show the exact block. Never assume user will find the right one from context

---

#### P18. Build cache aggressive after schema change

**Symptom:** After schema fix + rebuild, POST still returned old error

**Root cause:** Session 3-4 gotcha — `.next` and `.open-next` build cache doesn't always pick up validation.ts changes (shared lib compiled into route bundles)

**Fix:**
```powershell
# Ctrl+C wrangler
Remove-Item -Recurse -Force .next, .open-next
pnpm exec opennextjs-cloudflare build
pnpm exec wrangler dev
```

**Lesson:** When shared lib (validation.ts, datetime.ts, queries) change → full clean rebuild required, not just hot reload

---

### 7F — Business Hours + Blocked Slots

#### P19. Blocked slot added but not showing in UI

**Symptom:** User added blocked slot via UI → toast success → refresh → not visible in list. DB verify showed row exists

**Root cause:** `getUpcomingBlockedSlots()` filters `endsAt >= now`. User added slot for today at 15:00-25:00, but current time was 04:10 next day (after midnight) → slot already `past`

**Fix approach:**
- Confirmed backend behavior is correct (past slots = noise, filtered intentionally)
- But UX confusing: user added, doesn't see, thinks bug
- Added past-date guard in Zod schema to prevent this:

```typescript
.refine(
  (d) => {
    const todayBkk = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
    });
    return d.date >= todayBkk;
  },
  { message: "ไม่สามารถเพิ่มวันหยุดในอดีตได้", path: ["date"] },
)
```

**Neat trick:** `toLocaleDateString("en-CA", {timeZone: "Asia/Bangkok"})` returns `"YYYY-MM-DD"` (Canadian ISO) — no date-fns needed, TZ-safe

**Lesson:** When query filters exclude data, either:
1. Prevent creation of excluded data (add validation upstream)
2. OR show all data (frontend indicate past vs upcoming)
Don't leave orphan state where data exists but user can't see it

---

### 7G — Staff Manager

#### P20. `users.id` is text not integer (Better Auth quirk)

**Symptom:** Route handler pattern `Number.parseInt(idParam)` doesn't work for users

**Root cause:** Better Auth generates user IDs as text UUIDs/nanoid, not auto-increment integers

**Fix:** Route handlers use string id directly:
```typescript
const { id } = await params;
if (!id || typeof id !== "string") {
  return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
}
```

**Lesson:** Auth tables from Better Auth use text IDs. Check schema before writing route handlers

---

## Config Decisions Locked (Cross-cutting)

### Theme + Design System
- **shadcn Nova preset** — admin/dashboard style
- **IBM Plex Sans Thai** — main sans-serif (Thai + Latin)
- **Noto Serif Thai** — display/serif fallback (rare use)
- **Warm subtle tint** — `oklch(0.99 0.005 70)` background, `oklch(0.18 0.01 50)` foreground
- **Light theme only** — no dark mode for admin

### Form Validation Pattern
- **Manual useState + zod.safeParse at submit** (not react-hook-form)
- **`noValidate` on all forms** — zod = single source of truth
- **Error mapping via status code first, then string code** for API responses
- **Type cast `as { error?: string }` at fetch boundary** — TypeScript strict friendly

### Data Fetching Pattern
- **Server Components fetch** for read-only pages (Dashboard, Settings) — no unnecessary API endpoints
- **REST endpoints only for mutations** (POST/PATCH/DELETE) and complex filters (bookings list)
- **URL query params + `useTransition` + `router.push`** for interactive filters — shareable URLs

### Component Patterns
- **Row click → Dialog** (not detail page) — MVP scope, defer detail pages
- **Reusable Dialog components** — `BookingDetailDialog` used by 2 places, `ServiceFormDialog` handles add + edit
- **Whole-row clickable via `<button>` or `<TableRow onClick>`** — larger tap target
- **Status pill = single-select** (radio pattern) — MVP user preference
- **Native `<input type="time">` + `<input type="date">`** — browser built-in pickers, mobile-friendly

### Auth Guards
- **Backend enforcement always** — `requireRole()` on every admin route
- **Frontend guards = UX** (hide/disable buttons) — not security
- **Self-mutation blocked** at both layers — self-check via `session.user.id === param.id`
- **Last admin protection** — count query before role change/delete

### Role Access
- **Staff read-only for settings** (services, hours) but can manage blocked slots (operational)
- **Admin write** — services, hours
- **Admin only** — user management (7G tab hidden for staff)

### Soft Delete
- **Services: `is_active` toggle** — booking FK integrity + snapshot pricing preserves history
- **Users: hard delete** — cascade sessions/accounts via FK (safe, no dangling refs)
- **Blocked slots: hard delete** — no downstream FK

---

## Gotchas Summary (Session 7-specific)

### shadcn / Nova
1. **Preset lock-in** — Nova overwrites fonts + dark tokens. Verify layout.tsx font imports after `init`
2. **Component library choice matters** — Radix ecosystem largest, easiest to debug
3. **Angle brackets get stripped in chat markdown render** — `Record<K, V>` may lose `<>` when pasting. Verify TypeScript generics
4. **`shadcn add` may create button.tsx during init** — subsequent `add button` skipped, verify output

### Better Auth v1.6
5. **User IDs are text (UUID/nanoid)** — not integer. Route params typed `string`
6. **`autoSignIn: true` creates orphan session on admin-created signup** — negligible, expires per default
7. **`signUpEmail` doesn't accept `additionalFields` directly** — need PATCH after for role override
8. **Duplicate email error message contains "already"** — fragile keyword match for semantic 400
9. **Role field read from user table every request** — no session cache, role changes take effect immediately on next request

### Zod v4
10. **`.optional()` does NOT accept null** — use `.nullish()` for null | undefined | string
11. **Transform + shared frontend/backend = round-trip issue** — output type must be re-parseable by input schema. Fix: `.nullish()` at chain
12. **`.refine()` array-level** — for cross-field validation (7 unique days, end > start)
13. **Error messages Thai from schema** — path.join('.') gives clean field name

### Next.js 16
14. **`searchParams: Promise<...>`** — always await before use (Next 15+ breaking)
15. **`useTransition` for router.push** — prevents infinite loops, gives isPending flag
16. **`router.refresh()` after mutation** — RSC re-fetch, no client state duplication needed

### D1 / Drizzle
17. **`db.batch([...])` for atomic operations** — used in `updateAllHours` for delete + insert
18. **`toDate` conversion in Drizzle helpers** — `gte(col, dateObj)` auto-serializes Date to Unix seconds
19. **`COALESCE(SUM, 0)`** — SUM of empty set = NULL, coalesce to 0 for empty ranges

### Wrangler Dev Workflow
20. **Route file changes = rebuild required** — Ctrl+C wrangler, rebuild, restart
21. **Shared lib changes (validation.ts) = clean rebuild** — `Remove-Item .next .open-next`
22. **Postman cookie state persists** — clear between sessions to avoid stale auth

### CSS / Tailwind
23. **Semantic tokens > palette classes** — `bg-muted/40` respects theme, `bg-gray-50` doesn't
24. **shadcn calendar responsive** — needs container width management (40/60 grid split works better than col-span tricks)

---

## Files Changed Summary

### New files (24)

**Library:**
```
src/lib/auth-client.ts             (7B) — Better Auth React SDK
src/lib/booking-status.ts          (7D) — Shared status config
src/lib/format.ts                  (7C) — Currency + count formatters
```

**Queries:**
```
src/lib/db/queries/business-hours.ts   (7F)
src/lib/db/queries/blocked-slots.ts    (7F)
src/lib/db/queries/users.ts            (7G)
```

**API Routes:**
```
src/app/api/admin/services/route.ts               (7E)
src/app/api/admin/services/[id]/route.ts          (7E)
src/app/api/admin/hours/route.ts                  (7F)
src/app/api/admin/blocked-slots/route.ts          (7F)
src/app/api/admin/blocked-slots/[id]/route.ts     (7F)
src/app/api/admin/users/route.ts                  (7G)
src/app/api/admin/users/[id]/route.ts             (7G)
```

**Pages:**
```
src/app/admin/bookings/page.tsx    (7D)
src/app/admin/settings/page.tsx    (7E, extended 7F+7G)
```

**Components (12):**
```
src/components/admin/admin-nav.tsx                  (7D)
src/components/admin/dashboard-calendar.tsx         (7C)
src/components/admin/recent-bookings.tsx            (7C, updated 7D)
src/components/admin/booking-detail-dialog.tsx      (7D)
src/components/admin/bookings-filter-bar.tsx       (7D)
src/components/admin/bookings-table.tsx             (7D)
src/components/admin/services-manager.tsx           (7E)
src/components/admin/service-form-dialog.tsx        (7E)
src/components/admin/hours-manager.tsx              (7F)
src/components/admin/blocked-slots-manager.tsx      (7F)
src/components/admin/blocked-slot-form-dialog.tsx   (7F)
src/components/admin/users-manager.tsx              (7G)
src/components/admin/user-form-dialog.tsx           (7G)
```

**shadcn/ui (auto-generated during init + `add`):**
```
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/calendar.tsx
src/components/ui/card.tsx
src/components/ui/dialog.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/input.tsx
src/components/ui/label.tsx
src/components/ui/popover.tsx
src/components/ui/select.tsx
src/components/ui/sonner.tsx
src/components/ui/switch.tsx
src/components/ui/table.tsx
src/components/ui/tabs.tsx
components.json
```

### Modified files (7)

```
src/app/globals.css               — Nova preset tokens + warm spa colors
src/app/layout.tsx                — Restore IBM Plex Sans Thai + Noto Serif Thai
src/app/admin/layout.tsx          — Header with logo + AdminNav + Toaster
src/app/admin/login/page.tsx      — Full login form (was placeholder)
src/app/admin/page.tsx            — Full dashboard (was smoke test)
src/lib/db/schema.ts              — Already exported auth.schema ✅
src/lib/db/queries/bookings.ts    — Added 3 dashboard queries
src/lib/db/queries/services.ts    — Full CRUD (was empty stub)
src/lib/datetime.ts               — Added 3 range helpers
src/lib/validations.ts            — Added 6 schemas across 4 domains
src/lib/auth-guard.ts             — Added getSessionUserId helper (optional)
```

### Dependencies added

**Prod:**
- All shadcn dependencies (via CLI): `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `sonner`, `lucide-react`, `react-day-picker`, `date-fns`, `tw-animate-css`

**Note:** No manual `pnpm add` needed — shadcn CLI handles all deps

---

## Git Commits (Session 7)

```
feat(7A): shadcn/ui setup + Nova preset + warm spa tokens
- Init shadcn CLI v4 (Radix + Nova preset)
- Install 9 components: button/input/label/card/table/dialog/select/badge/sonner
- Restore IBM Plex Sans Thai (overridden by Nova init)
- Strip dark mode tokens (admin light-only per spec)
- Apply subtle warm spa tint (background/foreground/card)

feat(7B): admin login with Better Auth client
- auth-client.ts (Better Auth React SDK)
- admin/login/page.tsx: zod-validated email/password form
- Better Auth error mapping to Thai (invalid credentials + rate limit)
- Mount Toaster in admin layout
- Fix layout: duplicate {children} + hardcoded gray → theme tokens
- Handle callbackUrl + router.refresh for middleware re-check

feat(7C): admin dashboard with stats, calendar, recent bookings
- getBookingStats (parallel today/week/month aggregates)
- getRecentBookings, getBookedDatesInMonth
- Bangkok TZ range helpers (day/week/month)
- Currency + count formatters (Intl th-TH)
- Hero card + 6 stat cards + Calendar widget + Recent widget
- Calendar: react-day-picker with booked/today/outside modifiers
- 40/60 grid split for calendar + recent

feat(7D): admin bookings management + reusable detail dialog
- Extract BOOKING_STATUS_CONFIG to shared lib
- Bookings page with async searchParams + validation fallback
- Filter bar: date range + status pills (single-select) + service + search
- URL sync via useTransition, skip mount push
- Table with row click → modal, pagination preserves filter
- BookingDetailDialog: reusable for dashboard + bookings table
- AdminNav header (dashboard/bookings/settings)

feat(7E): services CRUD (backend + admin UI)
- Services queries: getAll, create (auto displayOrder), update, toggle
- Zod schemas: create + update
- Routes: GET/POST /api/admin/services + PATCH /[id]
- Settings page with Tabs shell (services/hours/blocked)
- ServicesManager + reusable ServiceFormDialog
- Soft delete via isActive switch
- Zod v4 nullish for description round-trip fix

feat(7F): business hours + blocked slots
- Business hours queries: getAll (auto-fill 7 rows), updateAll (D1 batch atomic)
- Blocked slots queries: upcoming, create, delete
- Schemas with .refine() for cross-field validation
- Routes: GET/PUT /api/admin/hours, GET/POST/DELETE /api/admin/blocked-slots
- HoursManager: 7 fixed rows, native time inputs, batch save
- BlockedSlotsManager: table + add dialog + browser confirm delete
- Past-date guard via Intl toLocaleDateString('en-CA', tz)

feat(7G): staff manager (admin-only user management)
- Users queries: getAll, byId, countAdmins, updateRole, deleteById
- Better Auth signUpEmail integration
- Guards: self, last admin (backend + UI)
- Routes: GET/POST /api/admin/users + PATCH/DELETE /[id]
- ทีมงาน tab conditionally rendered (hidden for staff)
- UsersManager: table + role dropdown + delete
- UserFormDialog: email + name + password (show/hide) + role

Session 7 complete: admin panel fully functional
- Login → Dashboard → Bookings → Services → Hours → Blocked → Users
```

---

## Session 8 Kickoff — Ready State

### What's built (admin side)
- ✅ Full admin panel (7 pages)
- ✅ Auth flow with role-based access
- ✅ Reusable components (dialog, status config, format helpers)
- ✅ Settings tabs pattern (services/hours/blocked/users)

### Backend ready for public consumption
- ✅ `getAvailability()` (session 5)
- ✅ `createBooking()` (session 6)
- ✅ `getBookingByCode()` (session 6)
- ✅ `getActiveServices()` (session 7D)
- ✅ Business hours + blocked slots respected in availability

### Session 8 scope: Public Booking Flow

**Pages to build:**
1. `/` — Landing page (spa branding, services showcase)
2. `/book` — Multi-step booking form
3. `/book/[code]` — Confirmation page

**Public API routes to build (if not existing):**
- `GET /api/services` — public services list
- `GET /api/availability?serviceId=&date=` — public slot list
- `POST /api/bookings` — create (public + turnstile token)

**Design considerations for Session 8:**
- **Different aesthetic than admin** — customer-facing = warmer, brand-forward, less data-dense
- **Route group `(public)` or separate layout** — no admin nav header
- **Consider Claude Design for landing page** (user mentioned exploring this)
- **Booking form: single page or multi-step wizard?** — decision needed
- **Turnstile integration** — bot protection on booking submit
- **No login required** — public flow, code-based confirmation

**Estimated:** 10-12h (roadmap)

**Reference specs:**
- Business logic: `booking-system-workflow.md`
- Spec: `booking-system-spec.md`
- Roadmap: `roadmap.md`

---

## Learning Reflections

### สิ่งที่ user รู้แล้ว (post Session 7)

- shadcn/ui setup + Nova preset workflow
- Better Auth client SDK integration
- Zod v4 quirks (`.nullish()`, transform round-trip)
- Client Component state patterns (form + useState + useTransition)
- Server Component data fetching + async searchParams
- React Server Component / Client Component boundary
- URL as source of truth for filters (shareable state)
- Reusable dialog pattern (add + edit + view in same component)
- D1 batch operations for atomic updates

### สิ่งที่ยังต้องเจอ pattern ครั้งที่ 2-3 กว่าจะ click

- Public UI patterns (customer-facing vs admin-facing decisions)
- Turnstile / bot protection integration
- LINE OA webhook flow
- Cloudflare Pages deploy pipeline
- Production environment concerns (env vars, secrets, custom domain)

### Key insights from Session 7

**1. "Pay upfront, refund later" pattern for learning curve**
- 7A shadcn setup: 4h (mostly learning)
- 7B-7D: 8h building (learning applied)
- 7E-7G: 6h (pattern reuse, warm mental model)
- Sub-session complexity decreases as pattern establishes

**2. Frontend decisions ≠ backend decisions**
- Backend = correctness (types, constraints, transactions)
- Frontend = user mental model (single-select vs multi, click zones, modal vs page)
- Different failure modes, different debugging approaches

**3. Design components for reuse from start**
- `BookingDetailDialog` used in 2 places → clean
- Status config in 3 places → extracted to `booking-status.ts`
- Format helpers in many places → `format.ts`
- Rule of thumb: 2nd usage = warning, 3rd = mandatory extraction

**4. Zod schemas with transform need round-trip safety**
- Frontend `.parse()` produces output type
- Backend re-parses same schema — input type must accept output type
- Use `.nullish()` (or `.nullable().optional()`) when transform can produce null

**5. Scope creep is real but sometimes right**
- 7G (Staff Manager) added mid-session
- +2h over budget
- But: buyer demo value ("แสดงว่าจัดการทีมได้") justified the addition
- Trade-off decision made explicit → good outcome

---

## Files needing verification before Session 8 starts

### Verify state (paste output to next chat):
```powershell
# 1. Confirm all files exist
Get-ChildItem -Recurse -File src/components/admin, src/app/admin, src/app/api/admin | Select-Object FullName

# 2. Verify no TypeScript errors
pnpm tsc --noEmit

# 3. Verify build succeeds
pnpm exec opennextjs-cloudflare build

# 4. Confirm database seed state
pnpm exec wrangler d1 execute nebula-spa-db --local --command "SELECT COUNT(*) as n FROM users"
pnpm exec wrangler d1 execute nebula-spa-db --local --command "SELECT COUNT(*) as n FROM services WHERE is_active = 1"
pnpm exec wrangler d1 execute nebula-spa-db --local --command "SELECT COUNT(*) as n FROM business_hours"
```

Expected:
- Users: 3+ (seed 3 + any added via 7G test)
- Active services: 8 (seed)
- Business hours: 7 (seed)

---

**End of handover — Session 7 complete ✅**

**Total files touched:** 24 new + 11 modified = 35 files
**Total code added:** ~3,500+ lines (queries, schemas, routes, components)
**Session 7 duration:** 5 days (Day 14 night → Day 18 afternoon), ~16h actual work

Ready for Session 8: Public Booking Flow 🎯
