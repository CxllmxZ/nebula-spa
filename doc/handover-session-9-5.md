# Handover — Session 9.5 (Playwright E2E Setup)

**Date:** 28 สิงหาคม 2026 (Day 28) + 30 สิงหาคม 2026 (Day 30)
**Chats:** 2 sessions ต่อกัน (Day 29 = พัก)
**Total effort:** ~4-5 ชั่วโมงจริง (รวม discussion phase + implementation)

---

## Summary

ตั้งค่า Playwright end-to-end test framework สำหรับ Nebula Spa จบ:
- Framework install + config พร้อม CI mode + Windows/pnpm compat
- 4 test files, 8 tests + 1 setup — **all passing (19.9s total)**
- Auth session persistence pattern (storageState)
- Turnstile handled ผ่าน dev-time env override (cross-env)

**Motivation dual purpose:**
1. Coverage ขั้นต่ำสำหรับ MVP demo (critical customer path + admin action)
2. เรียนรู้ Playwright สำหรับใช้ในงานประจำ

**Backend bug discovered as side effect:** ระบบให้จอง slot เดียวกันได้ 4+ ครั้ง — availability guard ไม่ทำงาน (ยังไม่ fix — log ไว้)

**Test coverage progress:**
- Public: landing smoke × 3 + customer booking end-to-end
- Admin: dashboard access × 2 + change booking status (idempotent)

---

## Discussion Phase (Before Implementation)

Session เริ่มด้วยการคุย fundamentals + design decision — ไม่กระโดดเขียน code ทันที เพราะ context ของ project (Cloudflare Workers + Next.js 16 + Turnstile + Better Auth) มี nuance เยอะ

### Topic 1: Playwright fundamentals

พื้นฐานที่คุยไว้:
- **คืออะไร:** Framework ทำ E2E test ที่ขับ browser จริง (Chrome/Firefox/Safari)
- **ทำไมย้ายมาจาก Selenium/Cypress:** auto-wait แก้ปัญหา flaky test, cross-browser API เดียว, parallel เร็ว
- **Core concepts 4 ตัว:** Browser context (isolation) + Locator (บอกจะกดอะไร) + Action (กด/พิมพ์) + Assertion (verify)
- **Trade-off:** เขียนช้ากว่า unit test, flake ไม่หายหมด, CI ช้ากว่า unit test

### Topic 2: Performance — เขียนยังไงให้เร็ว

หลักคิด: เวลาที่ test กิน มาจาก 4 จุด — เปิด browser, navigate/reload, wait ที่ไม่จำเป็น, run ทีละตัวไม่ขนาน

**Techniques ที่ตกลงใช้:**
1. Parallel workers (แต่ต้องระวังกับ D1 — เจอปัญหาภายหลัง)
2. Persistent auth (storageState) — login 1 ครั้ง reuse ตลอด suite
3. Setup state ผ่าน API แทน UI clicks (ทฤษฎีเท่านั้น — MVP ไม่ทำ)
4. Headless + block resources (ไม่ต้อง manual — Playwright default)
5. Avoid `sleep()`, ใช้ web-first assertions (auto-retry)
6. `waitUntil: 'domcontentloaded'` แทน default `'load'`
7. Fail-fast ตอน CI

**Anti-patterns ที่ตกลงเลี่ยง:**
- CSS class selector ที่ fragile
- Login ผ่าน UI ทุก test
- `sleep(3000)` มั่ว ๆ
- Create data ผ่าน UI clicks
- Test แชร์ user/data
- รัน suite เต็มทุก commit

### Topic 3: Local vs Production testing

**สรุปกลยุทธ์ที่ตกลง:**
- **Layer 1 (Local dev):** เขียน 80-90% ของ test ที่นี่ — เร็ว, ฟรี, debug ง่าย, Turnstile test key
- **Layer 2 (Preview env):** ⚠️ ตัดสินใจ **ไม่ทำ** — over-engineered สำหรับ MVP solo
- **Layer 3 (Prod smoke):** 2-3 read-only test หลัง deploy — อนาคต

**Gotcha ที่ต้องระวังถ้าจะเทสบน prod:**
- Free tier CPU limit 10ms
- Rate limit บน Cloudflare edge
- Turnstile prod widget = ยากจะ bypass ใน headless
- Test booking = pollute demo data
- Better Auth strict CORS
- Test mutation = แก้ booking จริง = ต้อง cleanup

### Topic 4: Preview environment (ตัดสินใจไม่ทำ)

**เหตุผลจริงที่ preview มี:**
- จับ bug ก่อนถึง prod
- เทส mutation ปลอดภัย
- CI/CD gate
- Share URL ให้ทีมดู
- Test integration ต้อง public URL (LINE LIFF, OAuth)

**Cost ของ preview:**
- Config เยอะขึ้น 2 เท่า (2 wrangler, 2 D1, 2 Better Auth URL, 2 Turnstile)
- Data drift
- Mental overhead ("ผมอยู่ env ไหน?")
- Extra deploy time
- Management burden

**Verdict สำหรับ Nebula Spa ตอนนี้:** solo dev + deploy น้อย + no paying customer → ไม่คุ้ม → ทำเป็น cheap alternatives แทน:
- `wrangler dev --remote` = quasi-preview
- `wrangler rollback` ถ้า deploy พัง
- Feature flag ปิดฟีเจอร์ก่อน public

### Topic 5: Chromium vs Chrome vs Edge (ข้อมูล 2026)

**Key finding:** Playwright 1.57 (Q4 2025) เปลี่ยนไปใช้ **Chrome for Testing (CfT)** แทน custom Chromium build เก่า

**หมายความว่า:** `pnpm exec playwright install chromium` = ได้ Chrome จริงที่ Google build แยกสำหรับ testing (pin version ได้, มี codec ครบ)

**เทียบ 3 ทางเลือก:**
| | Chromium (CfT) | Chrome system | Edge system |
|---|---|---|---|
| Version pin | ✅ | ❌ auto-update | ❌ Windows Update |
| Reproducible | ✅ high | ⚠️ med | ⚠️ med |
| CI ready | ✅ | ❌ | ❌ |
| Disk | +200MB | 0 | 0 |
| Community support | ✅ 99% | ⚠️ | ❌ |

**Decision:** ใช้ default Chromium (CfT) — 200MB คุ้มค่าเทียบ reproducibility + CI compat

---

## Sub-tasks Breakdown

### 9.5A — Install + Config (20 min)

**Actions:**
- `pnpm add -D @playwright/test` (version 1.62)
- `pnpm exec playwright install chromium` (~200MB)
- สร้าง `playwright.config.ts` — baseURL, projects, reporter, trace
- สร้าง folders: `tests/e2e/`, `tests/fixtures/`, `tests/.auth/`
- Update `.gitignore`: test-results, playwright-report, tests/.auth

**Config decisions:**
- `baseURL: 'http://localhost:8787'` (wrangler dev port)
- `retries: process.env.CI ? 2 : 0`
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`
- **ไม่ใช้ `webServer` block** — ให้ user รัน wrangler dev เองใน terminal แยก (ควบคุมได้ดีกว่า MVP)

### 9.5B — First smoke test (20 min)

**File:** `tests/e2e/smoke.spec.ts` — 3 tests
1. Landing page loads (title contains "Nebula")
2. Has book link (จองเลย)
3. `/book` page opens

**Passed after 2 iterations** (เจอ waitUntil timeout + strict mode violation)

### 9.5C — Public booking flow (~2 ชม.)

**File:** `tests/e2e/booking-flow.spec.ts`

**Full customer journey:**
1. เข้า `/book`
2. เลือก service ตัวแรก (locator `/นาที/`)
3. รอ calendar render (`getByRole('grid')`)
4. เลือก day available (retry 3 เดือน)
5. เลือก time slot (`/^\d{2}:\d{2}$/`)
6. กรอกฟอร์ม (ชื่อ + เบอร์)
7. รอ submit enabled (Turnstile ผ่าน)
8. Submit
9. Verify redirect `/book/[6-char-code]`
10. Verify booking code format

**Iterations:** 5-6 ครั้งกว่าจะ pass — เจอปัญหา timing + selector หลายรอบ

**Success:** สร้าง booking จริงใน local D1, log code เช่น `T3QG9L`

### 9.5D — Admin auth fixture (30 min)

**Files:**
- `tests/fixtures/auth.setup.ts` — login script (รันครั้งเดียว)
- Update `playwright.config.ts` — เพิ่ม 3 projects: setup, public, admin

**Test admin account:**
- Email: `admin-test@nebula-spa.demo`
- Password: `ChangeMe123!Long`
- Role: `admin`
- Created ผ่าน Better Auth signup API + promote role manually

**Flow:**
1. Playwright เห็น admin test ต้อง auth
2. รัน setup project ก่อน (login → save cookie)
3. Save session ที่ `tests/.auth/admin.json`
4. Admin test project preload storageState = ไม่ต้อง login ใหม่

**Result:** setup รัน 2.2s (vs 30s timeout เดิม) → save session สำเร็จ

### 9.5E — Admin change status test (45 min)

**Files:**
- `tests/e2e/admin-dashboard.spec.ts` — 2 smoke tests (dashboard + bookings page)
- `tests/e2e/admin-bookings.spec.ts` — change status test

**Change status flow:**
1. เข้า `/admin/bookings`
2. รอ table
3. คลิก row แรก → dialog เปิด
4. อ่าน current status
5. เลือก status ที่ **ต่างจาก current** (idempotent logic)
6. กดบันทึก
7. Verify dialog ปิด

**Iterations:** 2 ครั้ง — ครั้งแรกเจอ test state pollution (save button disabled)

### 9.5F — Cleanup + docs (30 min)

**Actions:**
- เขียน handover doc นี้
- Verify `tests/.auth/` gitignored
- Commit + push
- Threads post

---

## Deliverables

### Files created (7)

```
playwright.config.ts                       — config (baseURL, 3 projects, workers)
tests/
├── fixtures/
│   └── auth.setup.ts                      — login admin + save storageState
├── e2e/
│   ├── smoke.spec.ts                      — landing × 3 tests
│   ├── booking-flow.spec.ts               — customer flow × 1 test
│   ├── admin-dashboard.spec.ts            — dashboard access × 2 tests
│   └── admin-bookings.spec.ts             — change status × 1 test
└── .auth/                                 — session state (gitignored)
docs/handover-session-9-5.md               — this file
```

### package.json changes

**Deps added:**
- `@playwright/test@^1.62.1` (dev)
- `cross-env@^10.1.0` (dev) — env override สำหรับ Windows

**Scripts added (8):**
```json
"dev:cf": "cross-env NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA opennextjs-cloudflare build && wrangler dev",
"build:cf": "opennextjs-cloudflare build",
"deploy": "opennextjs-cloudflare deploy",
"deploy:dry": "opennextjs-cloudflare deploy --dry-run",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:headed": "playwright test --headed",
"test:e2e:report": "playwright show-report"
```

### .gitignore updated
```gitignore
# Playwright
/test-results/
/playwright-report/
/tests/.auth/
```

### playwright.config.ts structure

```typescript
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'public',
    testMatch: /e2e\/(smoke|booking-flow)\.spec\.ts/,
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'admin',
    testMatch: /e2e\/admin.*\.spec\.ts/,
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'tests/.auth/admin.json',
    },
    dependencies: ['setup'],
  },
]
```

---

## Test Results

```
Running 8 tests using 1 worker

  ✓  setup: authenticate as admin                                 (2.2s)
  ✓  public: booking flow customer end-to-end                     (4.8s) — Booking NT9J4G
  ✓  public: landing page loads                                   (1.2s)
  ✓  public: has book link                                        (1.4s)
  ✓  public: /book page opens                                     (1.0s)
  ✓  admin: change booking status via dropdown                    (2.5s) — ยืนยันแล้ว → รอยืนยัน
  ✓  admin: dashboard accessible                                  (1.4s)
  ✓  admin: bookings page accessible                              (1.2s)
  
  8 passed (19.9s)
```

---

## Problems Encountered + Fixes (Chronological)

### Day 28 — Session 9.5 (Kickoff → 9.5C partial)

#### 1. `page.goto()` default waitUntil 'load' timeout 30s

**Symptom:** Smoke test แรก timeout 30-40s ทั้ง 3 tests

**Root cause:** Default `page.goto()` = `waitUntil: 'load'` → รอทุก resource (รูป, font, Turnstile script, Google Fonts) โหลดครบ — landing page มี external assets เยอะ

**Fix:** เปลี่ยนเป็น `{ waitUntil: 'domcontentloaded' }`

**Lesson:** สำหรับ Next.js app ใช้ `'domcontentloaded'` เสมอ — พอ HTML พร้อมก็ interact ได้

---

#### 2. Strict mode violation — resolved to 11 elements

**Symptom:** `getByRole('link', { name: /จอง/i })` → error "resolved to 11 elements"

**Root cause:** Landing page มี:
- "จองเลย" × 2 (sm + lg ใน hero)
- "จองบริการนี้" × 8 (card ต่อ service)

Regex `/จอง/i` match ทั้งหมด — Playwright strict mode = ต้อง 1 element เท่านั้น

**Fix:** ใช้ `.first()` + `exact: true`
```typescript
page.getByRole('link', { name: 'จองเลย', exact: true }).first()
```

**Lesson:** เจอหลาย elements ต้อง scope ให้แคบลง — `first()`, `nth()`, `exact: true`, หรือ chain parent locator

---

#### 3. Chromium install decision (Chrome for Testing)

**Discussion:** ลง Chromium 200MB vs ใช้ Edge system

**Trade-off คุยแล้ว:**
- Bundled Chromium (CfT) = version pin + reproducible + CI ready
- Edge system = 0 disk แต่ Windows Update ทับ + CI ไม่มี Edge บน Linux

**Decision:** ลง Chromium — 200MB คุ้ม เพราะ:
1. Future GitHub Actions ต้องใช้อยู่แล้ว
2. Community support 99% ใช้ Chromium
3. ไม่เจอปัญหา Windows Update ทำ test พังเงียบ

---

#### 4. Turnstile Error 110200 (domain mismatch)

**Symptom:** เปิด `/book` ใน browser — widget แสดง "ความปลอดภัยยังไม่ได้" + error 110200 + Cloudflare API return `{"err": 110200}`

**Investigation chain:**
- ครั้งแรกเดา = ad blocker / privacy extension
- User confirm ว่า incognito ก็เจอ + `.env.local` มี test key
- ผู้ใช้บอก `.env.production.local` มี prod key
- **Root cause ชัด:** `opennextjs-cloudflare build` = production mode → อ่าน `.env.production.local` → inline **prod site key** เข้า client bundle → hostname `localhost` ไม่อยู่ใน allowed list ของ prod key → Cloudflare reject

**Fix:** เพิ่ม `pnpm dev:cf` script override key ผ่าน `cross-env`:
```
cross-env NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA opennextjs-cloudflare build && wrangler dev
```

**Ecosystem understanding เพิ่ม:**
- Next.js env precedence: shell env > `.env.production.local` > `.env.local` > `.env.production`
- `NEXT_PUBLIC_*` inline ตอน build (ไม่ใช่ runtime)
- Shell env var priority สูงสุด = override ได้เสมอ

**Lesson:** เจอ error 110200 = ไม่ใช่ config issue หรือ network — ตรวจว่า client bundle มี prod key ปะปนมั้ย

**Related decision:** ทำไมไม่แก้ package.json แต่แรกเลย?
- คุยเทียบ 3 tions: A) rename file B) shell env override C) แก้ package script
- User เลือก C — cleanest, ไม่ต้องจำอะไร, `pnpm dev:cf` = 1 คำสั่งจบ

---

#### 5. Deploy workflow confusion (session 9 pattern)

**Confusion:** User สงสัยว่าทำไมต้องมี script `deploy` แยก + ต้อง build ก่อน deploy หรือไม่

**Clarification:**
- `opennextjs-cloudflare deploy` = build + upload ในตัว
- Session 9 ทำ `deploy --dry-run` (ไม่ใช่ `build`) เพื่อ verify config ก่อน
- Script `pnpm deploy` = ตรงกับ session 9 workflow แบบย่อ

**Cheat sheet finalized:**
```powershell
# Dev + Playwright test
pnpm dev:cf              # Terminal 1
pnpm test:e2e            # Terminal 2

# Deploy
pnpm deploy:dry          # verify config
pnpm deploy              # ยิงจริง (build+upload ในตัว)
```

**Critical warning:** ห้ามใช้ `pnpm dev:cf` แล้ว deploy — เพราะ bundle มี test key = production ถูก bypass ได้ = spam bot

---

#### 6. Playwright parallel workers vs wrangler dev (D1 lock)

**Symptom:** 4 workers รันพร้อมกัน → booking flow test timeout / `ERR_CONNECTION_REFUSED`

**User observation ที่แม่นยำ:** "รันแบบ UI ทีละอันได้, รันพร้อมกันค้าง"

**Root cause:**
- Default `workers: undefined` = auto (1/core) = 4-8 workers
- wrangler dev = single Worker instance, ไม่มี auto-scale
- D1 local = SQLite file, มี write lock ตอน insert
- 4 workers ยิง page load + form submit พร้อมกัน = CPU spike + connection queue overflow

**Fix:** `workers: process.env.CI ? 4 : 1`

**Lesson:** local dev server ไม่ควรถูก stress test — CI environment (Ubuntu container) เท่านั้นที่ควร parallel เพราะ isolated + fresh

---

#### 7. `hasNot` filter ไม่ทำงานตามที่คิด

**Symptom:** Booking flow — locator ยัง match ปุ่มวัน disabled → click ปุ่ม disabled → timeout รอ enable 30s

**Root cause:** `.filter({ hasNot: page.locator('[disabled]') })` = filter parent-child relationship — button ไม่มี child = filter ผ่านทุก button (รวม disabled)

**Fix:** CSS selector ตรง ๆ:
```typescript
page.locator('button[aria-label^="วัน"]:not([disabled])')
```

**Lesson:** `hasNot` ใช้ตอน check child element ไม่มี (เช่น card ที่ไม่มี "sold-out badge") — ไม่ใช่ตอน check attribute ของตัวเอง

**Learning bonus:** อ่าน page snapshot จาก Playwright error message = ทองคำ — บอก DOM structure จริง + attribute ทั้งหมด

---

### Day 30 — Session 9.5 resumed → complete

#### 8. Calendar render race condition

**Symptom:** Loop หา available day fail — เมื่อ `isVisible()` return false ครั้งแรก (calendar ยัง render ไม่เสร็จ) → เข้า block กด "next month" → แต่ปุ่มยังไม่มี → timeout

**Root cause:** Loop logic assume calendar พร้อม แต่ทำ visibility check ก่อนที่ calendar จะ render จริง

**Fix (2 จุด):**
1. รอ `getByRole('grid')` ก่อนหา day
2. ใช้ `.count()` แทน `.isVisible()` — `count()` ตอบทันทีไม่รอ timeout

```typescript
await expect(page.getByRole('grid')).toBeVisible({ timeout: 10_000 });
// ...
if (await availableDay.count() > 0) { ... }
```

**Lesson:** รอ parent container ก่อนหา child — race condition classic

---

#### 9. Wrangler dev crash silently

**Symptom:** ตอน retry test — ทุก test fail กะทันหัน `ERR_CONNECTION_REFUSED`

**Investigation:** Terminal 1 (wrangler dev) ตายไป — อาจเป็น memory pressure จาก 4 workers ก่อนหน้า, Windows sleep, หรือ workerd crash

**Fix:** Restart `pnpm dev:cf` + verify `curl http://localhost:8787` ก่อนรัน test

**Lesson:** long-running dev server บน Windows = fragile — พิจารณา `webServer` block ใน Playwright config ตอน session ถัดไป (auto-start + reuse pattern)

---

#### 10. Login label ภาษาไทย

**Symptom:** `getByLabel(/email/i)` ใน auth setup timeout 30s

**Root cause:** Login form ใช้ label "อีเมล" / "รหัสผ่าน" ไม่ใช่ English

**Fix:** Update locator ตาม label จริง:
```typescript
getByLabel('อีเมล')
getByLabel('รหัสผ่าน')  
getByRole('button', { name: 'เข้าสู่ระบบ' })
```

**Lesson:** อย่าเดา label — เปิด page code ดูจริง หรือใช้ codegen ก่อนเขียน

---

#### 11. Test state pollution — save button disabled

**Symptom:** Change status test — run แรก pass, run ที่ 2 fail (save button disabled)

**Root cause:** Test เลือก "รอยืนยัน" เสมอ — run แรก status เดิม = "ยืนยันแล้ว" → เปลี่ยนเป็น "รอยืนยัน" → save enable ✓ → run ที่ 2 status เดิม = "รอยืนยัน" แล้ว → เลือก "รอยืนยัน" อีก → ไม่ต่างจากเดิม → save disable ✗

Form logic: enable save เฉพาะเมื่อ status ต่างจาก current

**Fix:** Auto-toggle logic — อ่าน current status → เลือก status ที่ **ต่างจาก current**
```typescript
const currentStatus = await statusCombobox.textContent();
const newStatus = currentStatus.includes('รอยืนยัน') ? 'ยืนยันแล้ว' : 'รอยืนยัน';
```

**Lesson:** Test idempotency — ต้องรันได้กี่ครั้งก็ pass เท่ากัน โดยไม่ขึ้นกับ previous state

**Anti-patterns:**
- Assume initial state ("booking status = confirmed")
- Depend on execution order
- Share data across tests

**Best practices:**
- อ่าน current state → เลือก action ที่ทำให้ **เปลี่ยน** (relative change)
- หรือ create fresh data ก่อน test
- หรือ reset DB ก่อนทุก suite (Option B ที่ตัดสินใจไม่ทำ)

---

#### 12. Test file duplicate content

**Symptom:** Test change status โผล่ 2 ครั้งใน result — 1 pass 1 fail

**Root cause:** สร้างไฟล์ `admin-dashboard.spec.ts` และ `admin-bookings.spec.ts` มี code เหมือนกันเป๊ะ (test change status) — Playwright เจอ 2 file รันคนละครั้ง

**Fix:**
1. ลบ `admin-dashboard.spec.ts` (เนื้อผิด concern)
2. สร้างใหม่ — dashboard smoke check เท่านั้น
3. Keep `admin-bookings.spec.ts` — change status logic เดียว

**Lesson:** Separation of concerns ในระดับไฟล์ = แต่ละไฟล์ทำ 1 หน้าที่ชัดเจน

---

### Discovered but Not Fixed (log ไว้)

#### A. Build error `std::terminate()` (Windows/OpenNext)

**Encountered:** Day 28 ตอนพยายาม build

**Symptom:**
```
*** std::terminate() called with no exception
MiniflareCoreError [ERR_RUNTIME_FAILURE]
Error occurred prerendering page "/"
```

**Root cause suspected:**
- `wrangler` / `workerd` version compat (คุณอาจ auto-update ไป version ใหม่)
- Corrupted `.next` / `.open-next` cache
- Windows native binary bug ใน workerd ใหม่
- OpenNext warning: "not fully compatible with Windows"

**Status:** ไม่ได้ verify fix — clean build (`Remove-Item .next, .open-next`) น่าจะช่วย แต่ไม่ได้ทดสอบ

**Impact:** ไม่กระทบ dev workflow ปัจจุบัน (`pnpm dev:cf` ยังทำงาน) แต่ **จะ block session 10 ตอน deploy**

**Priority:** แก้ก่อน deploy รอบถัดไป

---

#### B. 🔴 Bug: Booking duplicate allowed (business critical)

**Discovered:** Day 30 ตอน user เห็น screenshot admin bookings — เห็น 4 booking:
- Customer: Playwright Test 0891234567
- Date: 28 Aug 2026
- Time: 12:00
- Service: นวดไทย 60 นาที
- Price: ฿350
- Status: รอยืนยัน × 4 rows

**Interpretation:** ทุกครั้งที่ Playwright booking flow รัน = สร้าง booking ใหม่ **ที่ slot เดียวกัน** ได้ (4 booking overlap)

**Expected behavior (จาก `booking-system-workflow.md`):**
```typescript
// Re-check availability (guard race condition)
const conflict = await db.select().from(bookings).where(
  and(
    eq(bookings.serviceDate, input.date),
    lt(bookings.startsAt, requestedEnd),
    gt(bookings.endsAt, requestedStart),
    notInArray(bookings.status, ['cancelled', 'no-show'])
  )
);
if (conflict.length > 0) throw new Error('SLOT_TAKEN');
```

**Actual behavior:** ระบบยอมสร้าง overlap = **guard ไม่ทำงาน**

**สาเหตุที่เป็นไปได้ 3 อย่าง (ยังไม่ verify):**
1. Availability endpoint คืน slot ที่มี booking แล้ว (50%)
2. `createBooking` ไม่ check conflict ก่อน insert (30%)
3. Frontend hide slot แต่ Playwright bypass (20%)

**Impact:**
- ⚠️ Production launch ห้ามปล่อยไป — ลูกค้าจริง 2 คนจอง slot เดียวกัน = ร้านซวย
- ✅ MVP demo ไม่กระทบ (buyer ไม่ทดลอง book ซ้ำ)

**Priority:** ต้องแก้ก่อน sell Fastwork / launch จริง

**Note about Playwright value:** ที่เจอ bug นี้ = **คุณค่าจริงของ E2E test** — manual test ครั้งเดียวไม่มีทางเจอเพราะ "จองได้ = ผ่าน" แต่ automated รันซ้ำ ๆ = expose race condition + missing validation

---

## Key Decisions

### 1. Default Chromium (CfT) over Edge/Chrome system
Reproducibility + CI compat + community support 99% — 200MB disk คุ้มค่า

### 2. 1 worker local, 4 workers CI
wrangler dev + D1 handle concurrent ห่วย → local ไม่ควร parallel  
CI (Ubuntu container) = isolated environment → parallel OK

### 3. Test admin แยก account
`admin-test@nebula-spa.demo` แยกจาก demo admin — ไม่ pollute demo data ที่ buyer เห็น

### 4. No data cleanup (Option A)
Test สร้าง booking = สะสมใน local D1 — reset manual เมื่อจำเป็น  
Trade-off: simple > clean; รู้ว่าอาจสะสมมาก ยอมรับได้ระยะสั้น

### 5. storageState pattern สำหรับ admin
Login 1 ครั้งใน setup → save cookie → admin tests preload session  
Cost saving: login 5-15s/test → 0s/test (5+ admin tests = save 25-75s)

### 6. Test key override ผ่าน dev script (`pnpm dev:cf`)
ไม่แก้ `.env.production.local` — เผื่อ deploy workflow เดิม  
`cross-env` = Windows/Mac/Linux compatible

### 7. Auto-toggle status logic (idempotent)
อ่าน current → เลือกต่าง — pragmatic กว่า reset DB per test  
Trade-off: simple > pure; test ทำงานเป็น "state machine tick" (pending ↔ confirmed)

### 8. ไม่ใช้ `webServer` block ใน config
User รัน `pnpm dev:cf` เอง Terminal แยก — ควบคุมได้ดีกว่า MVP  
พิจารณาเพิ่มใน future session ถ้าเบื่อ manage 2 terminal

### 9. ไม่สร้าง preview environment
Solo dev + deploy น้อย + no paying customer = ไม่คุ้ม  
Cheap alternatives: `wrangler dev --remote` (quasi-preview) + `wrangler rollback` + feature flag

---

## Lessons Learned

### E2E test setup process

**Reality:** เขียน E2E test ตัวแรก มักเจอ **5-10 iteration** กว่าจะเสถียร — ไม่ใช่ user ทำผิด, ไม่ใช่ AI สอนไม่ดี — เป็น process ปกติ

**Session 9.5 นี้เจอ 12 issues** — ตรงกับ pattern session 3-4 ที่เจอ 12 issues ตอน backend + auth setup

### Debugging pattern ที่ effective

1. **อ่าน page snapshot ใน error** — บอก DOM จริง + attributes → fix ตรงจุด (ไม่เดา)
2. **UI mode (`pnpm test:e2e:ui`)** — timeline + screenshot ทุก step + network → เห็น root cause visually
3. **Codegen สำหรับ initial exploration** — record → clean up = เร็วกว่าเดา
4. **Console log ใน test** — verify state assumption (current status, actual value)

### Locator hierarchy (best to worst)

1. `getByRole('button', { name: 'text' })` — semantic + accessible
2. `getByLabel('label text')` — form fields
3. `getByPlaceholder('...')` — ถ้าไม่มี label
4. `getByTestId('...')` — เมื่อ semantic ไม่ชัด
5. `getByText('...')` — content-based
6. `page.locator('css-selector')` — last resort

**Anti-patterns:**
- `.p-2 > .font-medium` (styling class = fragile)
- `nth-child(2)` (position-dependent)
- `page.locator('div div div span')` (DOM-structure-dependent)

### Test isolation principles

- **Idempotency:** รันกี่ครั้งก็ผลเดียวกัน
- **Independence:** test ไม่ depend on order
- **State-aware:** อ่าน current state ก่อน action (ไม่ assume initial)
- **Fresh context:** browser context ใหม่ทุก test (Playwright default)

### เมื่อไหร่ E2E "คุ้ม" (จริง ๆ)

**คุ้ม:**
- Critical user journey (booking, checkout, login)
- Flow ที่ manual test ขี้เกียจทำซ้ำ ๆ
- Regression catch หลัง refactor
- Multi-step flow ที่มี state complex

**ไม่คุ้ม:**
- Logic ล้วน (calculate, validate format) → unit test
- Component เดี่ยว → component test (Vitest + Testing Library)
- One-off task
- Rare edge case ที่ manual verify ได้

---

## What's NOT Tested (out of MVP scope)

**Booking flow:**
- Multi-service booking (only tests service ตัวแรก)
- Slot conflict rejection (**bug!** — จริง ๆ ควร reject แต่ตอนนี้ยอม)
- Invalid phone validation (10 หลักขึ้นด้วย 0)
- Past date rejection
- Blocked slot skip

**Admin:**
- Admin CRUD services / hours / blocked slots
- Cancel / no-show status transitions specifically
- Filter + search + pagination
- Bulk operations (ถ้ามี)

**System:**
- Mobile viewport (desktop only)
- Cross-browser (Chromium only)
- Production URL (localhost only)
- Visual regression
- Accessibility (axe-core)
- Performance (Lighthouse)

**Rationale:** MVP scope — coverage current เพียงพอสำหรับ regression detection ของ critical paths + ได้เรียนรู้ Playwright fundamentals ครบแล้ว

---

## Next Session Priorities

### Immediate (before deploy)
- ⚠️ Verify + fix `std::terminate()` build error (Windows/OpenNext)
- 🔴 Fix booking duplicate bug (availability query + createBooking guard)
- Add test case: "ห้ามจอง slot ที่มี active booking แล้ว"

### Test coverage expansion (nice to have)
- Edge cases: past date, phone validation, slot conflict
- Cancel + no-show status flow
- Filter + search test
- Services CRUD test

### Infrastructure (future)
- `webServer` block ใน `playwright.config.ts` — auto-start wrangler
- GitHub Actions CI (only when repo push)
- Visual regression (Playwright screenshots + diff)
- Cross-browser (add Firefox + WebKit projects)

### After Session 10 (LINE integration)
- LINE Login flow test (LIFF mocking)
- Push notification verify (mock LINE API)
- Rich menu interaction

---

## Cheat Sheet (สำหรับกลับมาใช้)

### Dev + Test workflow

```powershell
# Terminal 1 — dev server (build test key + serve localhost)
pnpm dev:cf

# Terminal 2 — tests
pnpm test:e2e                                              # ทุก test
pnpm test:e2e:ui                                           # UI mode (debug)
pnpm test:e2e:headed                                       # เห็น browser
pnpm test:e2e:report                                       # HTML report

# รันเฉพาะ file / project / test
pnpm exec playwright test smoke.spec.ts
pnpm exec playwright test --project=public
pnpm exec playwright test --project=admin
pnpm exec playwright test -g "change status"
```

### Deploy workflow (Session 10+)

```powershell
pnpm deploy:dry          # verify config
pnpm deploy              # build + upload (session 9 pattern)
```

### Clean cache (เมื่อสงสัย bundle เก่าค้าง)

```powershell
Remove-Item -Recurse -Force .next, .open-next -ErrorAction SilentlyContinue
pnpm dev:cf              # rebuild fresh
```

### Verify Turnstile ถูกต้อง

```
Local (localhost:8787):  widget แสดง "สำเร็จ ✓" + watermark "สำหรับการทดสอบเท่านั้น"
Production (workers.dev): widget ไม่มี watermark (ใช้ prod key)

ถ้า localhost เห็น 110200 → build cache มี prod key ค้าง → clean + pnpm dev:cf ใหม่
ถ้า production เห็น watermark → deploy ผิด (ใช้ test key) → deploy ใหม่
```

---

## Git Commit

```
feat: add Playwright E2E testing framework

Session 9.5 (complete) — 8 tests passing (19.9s total)

Test coverage:
- Setup: admin authentication + storageState persistence
- Public: landing smoke × 3, customer booking flow (Turnstile handled)
- Admin: dashboard access × 2, change booking status (idempotent)

Infrastructure:
- @playwright/test 1.62 + Chromium (Chrome for Testing)
- cross-env for Windows-compatible env override
- 1 worker local / 4 workers CI (avoid D1 write lock)
- storageState pattern (login once, reuse across admin tests)
- Auto-toggle status logic (idempotent across runs)

Scripts:
- dev:cf, build:cf, deploy, deploy:dry
- test:e2e, test:e2e:ui, test:e2e:headed, test:e2e:report

Fixes:
- Turnstile 110200 domain mismatch (build inlined prod key)
- Calendar wait timing (getByRole grid + count over isVisible)
- Locator strict mode violations (exact + first)
- Test idempotency (auto-toggle status logic)
- Login labels Thai localization (อีเมล / รหัสผ่าน / เข้าสู่ระบบ)

Discovered (not fixed):
- Build error std::terminate() on Windows/OpenNext (log for next session)
- 🔴 Booking duplicate slot allowed — availability guard not working
  (critical: block production launch, not blocking MVP demo)

See docs/handover-session-9-5.md for full details.
```

---

## Note — Future Exploration (Personal Project)

**Idea:** Excel-driven test framework using Playwright as engine

**Concept:**
```
test-cases.xlsx (rows) → parser → Playwright runner → execute → result → xlsx write-back
```

**Value proposition:**
- QA / BA / PO เขียน test case ผ่าน Excel (ไม่ต้องเขียน code)
- Test case = document + executable ในตัวเดียว
- Version control ผ่าน Excel history หรือ Git
- Playwright = fast, modern engine
- Excel = universal enterprise language

**Market gap (2026):**
- Katalon Studio = proprietary + expensive
- Excel + Selenium = legacy, slow
- **ยังไม่มี Playwright + Excel product ที่โดดเด่น** = niche น่าลง
- Target: SEA/Thai corporate QA teams ที่ยัง manual 80%

**Effort estimate:** MVP ~40-60 ชม.

**Tools stack:**
- Playwright (test runner)
- SheetJS / ExcelJS (parse + write Excel)
- Node.js / TypeScript
- Optional: Next.js dashboard แสดง result trend

**Priority:** side project — ทำเมื่อมีเวลา + energy หลัง Nebula Spa ปิด

---

## Session Reflection

### สิ่งที่ได้จาก session 9.5

**สำหรับ Nebula Spa (project):**
- E2E test foundation ที่ scalable
- 8 tests ครอบ critical flow
- Regression detection ready สำหรับการแก้ code ในอนาคต
- Bug booking duplicate discovered (bonus value)

**สำหรับตัว user (career):**
- ✅ Playwright ทักษะใช้ได้จริง (locator, fixture, storageState, config)
- ✅ Debug pattern (UI mode, page snapshot, screenshot, trace)
- ✅ Test design principles (idempotency, isolation, independence)
- ✅ Config management (workers, projects, dependencies)
- ✅ Cross-platform thinking (cross-env, Windows quirks)
- ✅ CI mindset (retries, forbidOnly, worker scaling)

### Total effort

- Day 28: ~3 ชม. (discussion phase + 9.5A-C partial)
- Day 30: ~2 ชม. (resume 9.5C + 9.5D + 9.5E + 9.5F)
- **Total: ~5 ชม.** — ตรงกับ estimate initial (3-4 ชม.) + discussion overhead

### Iterations ที่เจอ

| Bug/Issue | Attempts | Resolved |
|---|---|---|
| waitUntil timeout | 1 | ✅ |
| Strict mode 11 elements | 1 | ✅ |
| Chromium install decision | 3 rounds discussion | ✅ |
| Turnstile 110200 | 2 (misdiagnosis → correct) | ✅ |
| Deploy workflow understanding | 2 clarifications | ✅ |
| Parallel workers | 1 | ✅ |
| hasNot filter | 1 | ✅ |
| Calendar timing | 2 | ✅ |
| Wrangler crash | 1 | ✅ (manual restart) |
| Login label Thai | 1 (with codegen fallback) | ✅ |
| Test idempotency | 1 | ✅ |
| Duplicate test file | 1 | ✅ |
| Build error std::terminate | 0 | ⏸ deferred |
| Booking duplicate bug | 0 | ⏸ deferred |

**Successful implementations vs deferred:** 12 fixed / 2 deferred = 86% resolution rate

---

## Reference Files

- `docs/handover-session-9.md` — Deploy handover (Turnstile env precedence bug 3 context)
- `docs/handover-session-3-4.md` — Infrastructure + Auth (wrangler dev workflow origin)
- `docs/booking-system-workflow.md` — Availability algorithm (the guard that's not working)
- `docs/roadmap.md` — Session sequence + effort estimates
- `playwright.config.ts` — E2E config
- `tests/` — 4 spec files + 1 setup

---

**End of Session 9.5 handover**

Session 10 = LINE integration (per roadmap)  
Bug fixes (build error + booking duplicate) = ต้องแทรกก่อนสุดท้ายก่อน sell Fastwork
