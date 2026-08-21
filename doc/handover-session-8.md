# Handover — Session 8 (Public Booking UI)

**Session:** 8
**Date range:** Day 18–26 (Aug 12–27, 2026)
**Effort actual:** ~12h spread across 6 evening sessions
**Status:** ✅ Complete

---

## Overview

Session 8 delivered the full customer-facing booking experience — landing page, multi-step booking flow, confirmation page, and LINE UI shell (planning-only wire, Session 10 will connect).

**Public URLs live locally:**
- `/` — Landing page (dark cosmic theme, 4 sections)
- `/book` — Booking flow (service → date → time → form)
- `/book?service=X` — Booking flow with service preselected
- `/book/[code]` — Confirmation page with LINE connect card (UI shell)
- `/book/[invalid]` — Not-found fallback

**Backend consumption:**
- Server components fetch `getActiveServices()` + `getBookingByCode()` directly (no separate API route)
- Client components fetch `GET /api/availability` + `POST /api/bookings`

---

## Sub-sessions Timeline

### 8A — Public Layout Shell (Day 18, ~1h)

**Delivered:**
- Route group `(public)/` created — parallel to admin `(app)/`
- Layout wrapper with `.cosmic` class scope isolation (dark theme lives only inside this group; admin stays light warm)
- Sticky header + minimal footer

**Files:**
- `src/app/(public)/layout.tsx` (created)
- `src/app/globals.css` (modified — added `.cosmic {}` block mapping cosmic tokens to shadcn semantic tokens: background, foreground, primary, card, border, input, ring; plus `.cosmic input,textarea,select { color: oklch(0.20 0.03 280) }` for readable text on mist-colored input bg)

**Decisions:**
- Theme isolation via class scope (not separate Tailwind config) — cheaper, cleaner, no build split
- Header: text logo "Nebula" (semibold cream) + "Spa" (light gold) + jong-ley CTA

**Verified:** Screenshots confirmed `/` renders dark cosmic + `/admin` remains light warm.

---

### 8B — Landing Page (Day 18–21, ~3h with iterations)

**Delivered:**
Full landing page with 4 major sections + iterative design work spanning 4 days.

**Sections:**
1. **Hero** — Sun-like radial gradient at top-right corner + starfield with twinkle animation (~15 dots, 7s cycle) + BANGKOK location pill + main headline "หยุดเวลา ปล่อยใจ / ให้ดวงดาวดูแล" + subhead + CTA + meta row
2. **Services** — Grid of 8 services fetched from D1 with icon + gradient card (see refactor below)
3. **About** — "หนึ่งค่ำคืน หลายจักรวาล" with full-width nebula clouds ambient + star glow text animation on paragraphs
4. **Visit** — Full-width section 03 (split from About Day 25) with 2 cards: Hours + Contact
5. **Footer CTA** — Repeat CTA with deep starfield background

**Iteration highlights:**

**Day 18–19: Claude Design mockup exploration**
- Opened Claude Design to design hero
- Multiple rounds fixing Thai typography line-height, dropping solar system SVG for radial gradient
- Extracted HTML bundle → extracted design tokens + palette + typography rules
- Final palette: `#0F1024` night bg, `#C9A961` gold, `#F5E6C8` star cream

**Day 21: Responsive pass + polish**
- Added hamburger mobile menu (`site-header.tsx`)
- Fluid horizontal padding: `clamp(1.5rem, 5vw, 6rem)` on all sections
- Header content wrapped in `max-w-6xl` → later switched to fluid (edge-to-edge on wide screens)
- Font swap: IBM Plex Sans Thai (weight 300, tech feel) → **Bai Jamjuree** (weight 400, humanist warm)
- Added `textStarGlow` keyframe: 2-layer text-shadow (cream + gold) 6s cycle on About paragraphs
- Services grid: dropped AI-generated photo idea (Canva safety filter blocked spa/massage prompts) → **icon + gradient card** with 4 corner-glow variants cycling (`HandHelping`, `Droplets`, `Layers`, `Sparkles`, `Footprints`, `Leaf`, `Flower`, `Heart` from lucide-react)
- Split About + Visit into 2 separate sections (Visit now section 03 full-width, not nested inside About)

**Files:**
- `src/app/(public)/page.tsx` — server component composing sections + `getActiveServices()`
- `src/app/(public)/_components/hero-section.tsx`
- `src/app/(public)/_components/services-grid.tsx` (revised with icon mapping helper)
- `src/app/(public)/_components/about-section.tsx`
- `src/app/(public)/_components/visit-section.tsx` (split from about)
- `src/app/(public)/_components/footer-cta.tsx`
- `src/app/(public)/_components/section-eyebrow.tsx` (exports `SectionEyebrow` + `GoldDivider` reusable primitives)
- `src/app/(public)/_components/site-header.tsx` (Day 21 — replaced inline header in layout.tsx with client component supporting hamburger)

**Modified:**
- `src/app/layout.tsx` — font swap `IBM_Plex_Sans_Thai` → `Bai_Jamjuree` weight `["300","400","500","600","700"]`
- `src/app/(public)/layout.tsx` — updated to use `<SiteHeader />` (client component) instead of inline header
- `src/app/globals.css` — appended cosmic tokens `--nebula-1/2`, `--indigo`; keyframes `twinkle`, `glow`, `textStarGlow`; autofill CSS override for input bg

**Design decisions locked:**
- Body font: Bai Jamjuree weight 400 (better contrast on dark bg than IBM Plex 300 light)
- Service cards: icon + gradient (no photography — asset problem + AI safety filter blocks)
- Fluid padding: `clamp(1.5rem, 5vw, 6rem)` applied to all sections
- Content max-widths kept per-section (hero 3xl, services 1600px, about 3xl, visit 1400px, footer 2xl)
- Header content: fluid `clamp(1.5rem, 5vw, 6rem)` padding (edge-to-edge)

---

### 8C — Booking Flow Picker (Day 22, ~3h)

**Delivered:**
Single-page booking flow with 3 unlock-progression sections. User picks service → date section unlocks → date pick → time section unlocks + availability fetched → time pick → sticky Continue enabled.

**Pattern locked:**
- **Single page + section unlock** (not multi-step wizard)
- URL: `/book?service=X` (query param, optional preselect)
- Time slot picker: grid buttons + group เช้า/บ่าย/เย็น
- Field order: service → date → time → customer info

**Files:**
- `src/app/(public)/book/page.tsx` — server component fetching services + parsing `?service` param + validating preselect
- `src/app/(public)/book/_components/booking-flow.tsx` — main client orchestrator (state, availability fetch, section composition)
- `src/app/(public)/book/_components/step-section.tsx` — reusable section shell with locked/active/complete states + edit button
- `src/app/(public)/book/_components/service-picker.tsx` — grid of services with select
- `src/app/(public)/book/_components/date-picker-step.tsx` — wraps shadcn Calendar with Thai locale + 30-day advance limit
- `src/app/(public)/book/_components/time-picker.tsx` — slots grouped by morning/afternoon/evening (< 12:00 / < 18:00 / else)

**Client-side data flow:**
```
useEffect: when (serviceId && date) both set
  → GET /api/availability?serviceId=X&date=Y
  → parse { slots: [{ start, end }] } (ISO+07:00)
  → extract HH:MM from ISO string manually (bypass browser timezone)
  → render buttons grouped by hour
```

**Edge cases handled:**
- Past date + 30+ future date: disabled in Calendar
- Empty availability: "ไม่มีเวลาว่างในวันนี้ ลองเลือกวันอื่น"
- Fetch error: red inline error with retry hint
- Loading state: spinner + "กำลังโหลดเวลาว่าง..."

---

### 8D — Customer Form + Submit + Turnstile (Day 23, ~1.5h)

**Delivered:**
Section 04 form added to booking flow. Name + phone + Turnstile widget → submit → POST /api/bookings → redirect to confirmation.

**Files:**
- `src/app/(public)/book/_components/customer-form.tsx` (created) — form with:
  - Name input (min 2 chars validation)
  - Phone input (Thai format `0XXXXXXXXX`, digits-only strip)
  - Turnstile widget via `@marsidev/react-turnstile`
  - Zod-like client validation (button disabled until valid)
  - Error mapper: status 400/404/409/422 → Thai messages
  - Success → `router.push(/book/${code})`

**Modified:**
- `src/app/(public)/book/_components/booking-flow.tsx`:
  - Added import `CustomerForm`
  - Removed `handleContinue` placeholder function
  - Removed sticky Continue bar (form has own submit)
  - Removed `pb-32` container padding
  - Added Section 04 rendering `<CustomerForm>` when time selected
  - Removed unused `Button` + `canContinue` state

**Dependency added:**
```
pnpm add @marsidev/react-turnstile
```

**Turnstile config:**
- Site key fallback: `1x00000000000000000000AA` (Cloudflare test key, always pass)
- Env var: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (overrides in production)
- Theme: `"dark"` to match cosmic

**Error mapping (`mapError` function):**
- 409 → "เวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น"
- 422 PAST_DATE → "ไม่สามารถจองวันที่ผ่านมาแล้ว"
- 422 BEYOND_ADVANCE_LIMIT → "ไม่สามารถจองล่วงหน้าเกิน 30 วัน"
- 404 → "ไม่พบบริการนี้ กรุณาเริ่มใหม่"
- 400 → "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"
- Other → "เกิดข้อผิดพลาด กรุณาลองใหม่"

---

### 8E — Confirmation Page (Day 23, ~1h)

**Delivered:**
Success page after booking submit. Shows booking code prominently + all details + Google Calendar link + navigation.

**Files:**
- `src/app/(public)/book/[code]/page.tsx` (created) — server component:
  - Fetch `getBookingByCode(code)`
  - `notFound()` if null
  - Success hero (Check icon + "จองเรียบร้อยแล้ว")
  - Big prominent code display (`font-serif text-5xl tracking-[0.32em]`)
  - Details card: บริการ / วัน / เวลา / ราคา / ผู้จอง / เบอร์โทร
  - Google Calendar template URL button (opens pre-filled event in new tab)
  - "กลับหน้าแรก" button

- `src/app/(public)/book/[code]/not-found.tsx` (created) — 404 page with:
  - Message: "ไม่พบการจองนี้"
  - Explanation: "โค้ดที่คุณกรอกอาจไม่ถูกต้อง หรือการจองอาจถูกลบไปแล้ว"
  - Buttons: "จองใหม่" (→ /book) + "กลับหน้าแรก" (→ /)

**Google Calendar URL helper:**
```typescript
function toGoogleCalendarUrl(b: {...}) {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `Nebula Spa — ${b.serviceName}`,
    dates: `${fmt(b.startsAt)}/${fmt(b.endsAt)}`,
    details: `Booking code: ${b.code}\nจองผ่าน Nebula Spa`,
    location: "Nebula Spa, Bangkok",
  })}`;
}
```

**Decision:** Template URL only (no OAuth) — user manually saves in Google Calendar. Rationale: standard pattern (Airbnb, Eventbrite), no API quota, no permission scope needed.

---

### 8F — Public API Polish + Verify (Day 23, ~30min)

**Delivered:**
Audit confirmed no new API endpoints needed. Smoke test checklist prepared.

**Audit result:**

| Endpoint | Status | Note |
|---|---|---|
| `GET /api/services` | ⏭️ Skip | Server components use `getActiveServices()` directly — no API layer needed |
| `GET /api/availability` | ✅ Ready | Session 5 built + booking-flow.tsx consumes |
| `POST /api/bookings` | ✅ Ready | Session 6 built + customer-form.tsx consumes |

**Smoke test checklist (18 items) — for user to run:**
- [ ] Landing renders 8 services + cosmic bg + glow text
- [ ] "จองเลย" navigates to /book with service picker
- [ ] `/book?service=1` preselects service 1
- [ ] Service select → date unlocks + calendar visible
- [ ] Date select → availability fetched + time slots grouped
- [ ] Time select → section 04 unlocks + form + Turnstile
- [ ] Edit buttons work (return to picker)
- [ ] Invalid name/phone → submit disabled
- [ ] Turnstile not passed → submit disabled
- [ ] Submit valid → redirect /book/[code]
- [ ] Confirmation shows all fields correctly
- [ ] Google Calendar link opens pre-filled event
- [ ] "กลับหน้าแรก" navigates to /
- [ ] `/book/ABCDEF` (fake code) → not-found page
- [ ] Mobile 375px: hamburger works, sections stack, form usable
- [ ] Admin: booking appears in /admin/bookings
- [ ] Console log: "[LINE disabled] would push:" during booking
- [ ] Status = "ยืนยันแล้ว" (auto-confirm as per session 6 decision)

---

### 8G — LINE UI Shell (Day 26, ~2h)

**Context:** Added late in session per user request — wanted UI preview of Session 10 LINE integration in current MVP. Not functionally wired (Session 10 will connect to real LIFF + backend).

**Delivered:**
LineConnectCard component with 3-state step-unlock pattern, consistent with booking flow section unlock (8C). All buttons disabled with "🚀 เร็วๆนี้" badge. Dev-only preview toggle to test 3 states visually.

**Design pattern (chose 3rd iteration):**

| State | Step 01 | Step 02 | Step 03 |
|---|---|---|---|
| **1 · เริ่มต้น** | active (full) | 🔒 locked | hidden |
| **2 · Auth ผ่าน** | ✓ done (summary) | active (full) | hidden |
| **3 · เชื่อมครบ** | ✓ done (summary) | ✓ done (summary) | active (success card) |

**Rejected alternatives:**
- Single card with state morph (compact but no journey visibility)
- Stacked static cards (steps visible but no progressive unlock — feels heavy)

**Files:**
- `src/app/(public)/book/[code]/_components/line-connect-card.tsx` (created) — ~200 lines:
  - Main `LineConnectCard` component (state + step orchestration)
  - Internal `StepShell` reusable wrapper (mirrors step-section.tsx from booking flow)
  - `AuthStepContent` (Step 01 body)
  - `FriendStepContent` (Step 02 body)
  - `CompleteCard` (Step 03 success)
  - `ConnectButton` disabled CTA with "เร็วๆนี้" badge
  - `LineIcon` inline SVG (LINE brand — not in Lucide)
  - `LINE_GREEN = "#06C755"` used throughout

- `src/app/(public)/book/[code]/page.tsx` (modified) — added:
  - `import { LineConnectCard } from "./_components/line-connect-card"`
  - `<LineConnectCard />` inserted between details card and CTA buttons

**Preview toggle env var:**
```
NEXT_PUBLIC_LINE_PREVIEW=true  # Show dev toggle to test 3 states
```
Default (unset or false): only shows State 1 (initial) — real user sees clean UI.

**Design details:**
- LINE brand green (`#06C755`) throughout: top strip 3px, icon backgrounds, button primary
- Consistency with 8C: same step number style (`text-xs font-medium uppercase tracking-[0.32em] text-primary`) + same locked/active/complete visual states
- Escape hatch: "ข้ามไปก่อน" text-link on Step 02 (currently disabled, will work in Session 10)

**Session 10 will wire up:**
1. Setup LINE OA + LIFF app (in LINE Developers Console)
2. Add real env vars: `NEXT_PUBLIC_LIFF_ID`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_OA_BASIC_ID`
3. Remove `NEXT_PUBLIC_LINE_PREVIEW` toggle logic (replace with real state fetch)
4. `GET /api/line/status?bookingCode=X` → returns `{ authed, isFriend }` → renders correct state
5. Step 01 button → `liff.login()` → get userId → POST `/api/line/link`
6. Step 02 button → deep link `https://line.me/R/ti/p/@nebulaspa`
7. See separate doc: `line-integration-plan.md` for full spec

---

## Files Inventory

### Created (14 files)

**Public layout:**
- `src/app/(public)/layout.tsx`
- `src/app/(public)/_components/site-header.tsx`

**Landing:**
- `src/app/(public)/page.tsx`
- `src/app/(public)/_components/hero-section.tsx`
- `src/app/(public)/_components/services-grid.tsx`
- `src/app/(public)/_components/about-section.tsx`
- `src/app/(public)/_components/visit-section.tsx`
- `src/app/(public)/_components/footer-cta.tsx`
- `src/app/(public)/_components/section-eyebrow.tsx`

**Booking flow:**
- `src/app/(public)/book/page.tsx`
- `src/app/(public)/book/_components/booking-flow.tsx`
- `src/app/(public)/book/_components/step-section.tsx`
- `src/app/(public)/book/_components/service-picker.tsx`
- `src/app/(public)/book/_components/date-picker-step.tsx`
- `src/app/(public)/book/_components/time-picker.tsx`
- `src/app/(public)/book/_components/customer-form.tsx`

**Confirmation:**
- `src/app/(public)/book/[code]/page.tsx`
- `src/app/(public)/book/[code]/not-found.tsx`
- `src/app/(public)/book/[code]/_components/line-connect-card.tsx`

### Modified

- `src/app/layout.tsx` — font swap `IBM_Plex_Sans_Thai` → `Bai_Jamjuree` weight `["300","400","500","600","700"]`
- `src/app/globals.css` — cosmic tokens (`--nebula-1/2`, `--indigo`), keyframes (`twinkle`, `glow`, `textStarGlow`), webkit-autofill CSS override, input color rules for `.cosmic` scope

### Dependencies

**Added:**
- `@marsidev/react-turnstile` — React wrapper for Cloudflare Turnstile widget

**Assumed already present:**
- `date-fns` (for Thai locale in Calendar)
- `lucide-react` (icons)
- `@radix-ui/*` (shadcn base)

### Env Vars Introduced

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Turnstile site key (dev fallback: `1x00000000000000000000AA`)
- `NEXT_PUBLIC_LINE_PREVIEW` — Dev-only flag to show LINE state toggle (default: unset = hide)

---

## Design Decisions Locked This Session

1. **Public theme:** Dark cosmic (isolated via `.cosmic` class scope, admin stays light warm)
2. **Booking flow shape:** Single page + section unlock (not multi-step wizard)
3. **URL pattern:** `/book?service=X` (query param, optional preselect)
4. **Time slot picker:** Grid buttons + group เช้า/บ่าย/เย็น
5. **Field order:** service → date → time → customer info
6. **Body font:** Bai Jamjuree weight 400 (swap from IBM Plex 300)
7. **Service cards:** Icon + gradient (dropped AI photo idea due to safety filter blocks)
8. **Fluid layout:** `clamp(1.5rem, 5vw, 6rem)` horizontal padding on all sections
9. **Google Calendar:** Template URL only (no OAuth flow)
10. **Turnstile:** Test key fallback for dev, real key at production deploy
11. **Booking status default:** `confirmed` (auto-confirm) — reverted from earlier "change to pending" plan back to session 6 original decision
12. **LINE UI pattern:** 3-step unlock (consistent with booking flow 8C)
13. **Header content width:** Fluid edge-to-edge (`clamp` padding, no `max-w-*`)

---

## Bugs Encountered + Fixes

### Bug 1: Edit button no-op (Day 22, 8C)
**Symptom:** Clicking "แก้ไข" in a complete section did nothing visually.
**Root cause:** `onEdit` handler cleared only downstream values (`setDate(null); setTime(null)` from Step 01) — but section's own status was computed from `serviceId` which stayed set → status remained "complete" → picker never re-rendered.
**Fix:** Each `onEdit` clears both self AND downstream:
- Section 01 edit: clear `serviceId + date + time`
- Section 02 edit: clear `date + time`
- Section 03 edit: clear `time`

### Bug 2: Autofill gray input bg (Day 23, 8D)
**Symptom:** Phone input showed gray background but name input didn't.
**Root cause:** Chrome autofill applies its own `-webkit-autofill` styling (yellow/gray bg) when it fills a saved phone. Name field wasn't autofilled so stayed clean.
**Fix:** Added CSS override in `.cosmic` scope in `globals.css`:
```css
.cosmic input:-webkit-autofill,
.cosmic input:-webkit-autofill:hover,
.cosmic input:-webkit-autofill:focus,
.cosmic input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 100px oklch(0.95 0.01 90) inset;
  -webkit-text-fill-color: oklch(0.20 0.03 280);
  caret-color: oklch(0.20 0.03 280);
  transition: background-color 5000s ease-in-out 0s;
}
```

### Bug 3: `startTime` field mismatch (Day 23, 8D)
**Symptom:** POST /api/bookings returned 400 "Validation failed" with error path `time`.
**Root cause:** I assumed field name `startTime` when writing customer-form.tsx. Backend Zod schema (session 6) uses `time`.
**Fix:** Changed payload key `startTime` → `time` in fetch body. Kept prop name `booking.startTime` internally (no need to rename everywhere).
**Lesson:** Don't guess field names — check validation schema before writing payload.

### Bug 4: `Response.json()` type is `unknown` (Day 23, 8D)
**Symptom:** TypeScript error `'data' is of type 'unknown'` when accessing `data.slots`.
**Root cause:** TypeScript 5+ made `Response.json()` return `Promise<unknown>` (was `Promise<any>` before) — safer but requires explicit cast.
**Fix:** Cast at fetch boundary:
```typescript
return r.json() as Promise<{ slots: Slot[] }>;
```
For internal API where we control both sides, cast is acceptable. Zod runtime parse would be overkill.

### Bug 5: oklch conversion killed color contrast (Day 21, 8B)
**Symptom:** Hero Sun glow + About nebula clouds barely visible — background appeared flat dark.
**Root cause:** I converted hex colors from Claude Design to oklch to "use tokens." But my oklch values were too close in lightness — e.g. `oklch(0.15 0.03 280)` base vs `oklch(0.17 0.03 285)` mid-gradient = imperceptible difference.
**Fix:** Reverted to hex values directly in inline styles:
- `#0F1024` (night) → base
- `#241D2E` (indigo) → Sun glow
- `#14152A` → About mid-gradient
- Also bumped nebula rgba opacity from 0.35 → 0.55 for more visibility
**Lesson:** Semantic tokens (bg, text, card) → oklch OK. Decorative gradients → keep designer's hex values (already contrast-tested).

### Bug 6: Preview toggle showing by default (Day 26, 8G)
**Symptom:** LINE card showed "PREVIEW MODE" + state toggle even in normal view (should only show in dev).
**Root cause:** Used env var `NEXT_PUBLIC_LINE_ENABLED` with wrong logic — showed toggle when LINE was disabled (i.e., always, since we don't have LINE yet).
**Fix:** Renamed to `NEXT_PUBLIC_LINE_PREVIEW` — opt-in flag that only shows toggle when explicitly set to `"true"`. Default view shows only Step 1 initial state.

---

## Deferred Decisions

### 1. Auto-confirm vs pending flow (Day 23-25)
User initially wanted `pending` status default. After discussion Day 25 realized this contradicted session 6 original decision. **Reverted:** keep auto-confirm as default.

Related consideration for Session 10: two-tier model (no-LINE=confirmed / LINE=pending) is planned — see `line-integration-plan.md`.

### 2. Service images (Day 21)
Attempted AI generation via Canva → safety filter blocked spa/massage prompts. Fell back to icon + gradient cards. Could re-attempt with Unsplash later or skip entirely for template.

### 3. Background image + scroll parallax (Day 21)
Suggested by third party. Deferred — theme conflict (cosmic abstract vs realistic photos), asset problem, scope creep. Alternative parallax starfield + fade-in noted but not implemented.

### 4. Full LINE integration
**All architectural planning captured in separate doc:** `line-integration-plan.md`. Includes LIFF vs alternatives analysis, 2-step flow, retroactive link mechanism, security levels, backend endpoints spec, LINE Developers setup steps. Implementation deferred to Session 10.

---

## Testing Status

**Automated:** None (no test framework set up)

**Manual smoke testing:**
- Day 23: User confirmed booking submit works, redirect to `/book/[code]` works
- Day 26: LINE card 3 states verified via preview toggle
- Full 18-item checklist: **not yet completed** (blocked on user running through post-Day 26)

**Screenshot inventory:**
- Landing page (Hero + subsequent sections): Day 21 screenshots exist
- Booking flow states: Day 22-23 screenshots exist
- Confirmation page (with LINE card State 1): Day 26 screenshot exists
- LINE card 3 states (State 2 + State 3): **pending user screenshots for portfolio**

---

## Session 9 Kickoff — Ready State

### What's live in local dev
- ✅ Full public flow: landing → book → confirmation
- ✅ Admin panel (session 7)
- ✅ Backend end-to-end tested (22 cases in session 6 + smoke test session 8)
- ✅ LINE UI shell (disabled, ready for wire in Session 10)

### Session 9 scope: Deploy MVP
- Build test → verify production build succeeds
- Cloudflare D1 remote migration (up to 0001 — no new migrations from Session 8)
- Cloudflare secrets: `TURNSTILE_SECRET_KEY`, `JWT_SECRET`, `ADMIN_PASSWORD_HASH`
- Public env vars: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (real production key)
- Deploy Worker
- Update Fastwork listing with demo URL

### LINE stays OFF at deploy
- `LINE_ENABLED=false` — Session 6 push notifications logged to console only
- `NEXT_PUBLIC_LINE_PREVIEW` — not set in production (default hidden)
- LINE card visible on `/book/[code]` but buttons disabled with "เร็วๆนี้" badge — sets user expectation

### Blocking questions before Session 9
- **Domain:** default subdomain `nebula-spa.YOURNAME.workers.dev` or custom domain?
- **Cloudflare account:** existing or new (Free plan is sufficient)
- **Turnstile production keys:** create new site + secret key at deploy time (not the test key)

### Session 10 spec available
See `line-integration-plan.md` for full LINE integration plan — 6-10h implementation with LINE OA setup + LIFF + backend endpoints + wire up existing UI shell.
