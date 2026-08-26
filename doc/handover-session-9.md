# Handover — Session 9: Deploy MVP to Production

**Date:** 22 Aug 2026 (Day 27)
**Duration:** ~5-6 ชม.
**Goal:** Deploy Nebula Spa MVP ขึ้น Cloudflare Workers production
**Status:** ✅ Complete (9H deferred → หลัง Session 10)

---

## Executive Summary

Session 9 ทำ MVP หลุดจาก local dev environment ขึ้นสู่ production URL ที่ใช้งานได้จริง — end-to-end booking flow ทำงานบน Cloudflare Workers + D1 + Better Auth + Turnstile

**Production URL:** `https://nebula-spa.bimav.workers.dev`

**Achievements:**
- Cloudflare stack lock-in สำเร็จในสนามจริง (ไม่ใช่แค่ dev preview)
- 3 production-only bugs พบและแก้ได้ก่อน buyer เห็น (จริงๆ 2 root causes — CPU exceeded เป็นอาการของ Turnstile mismatch)
- Admin + Public flow verified บน production

**Trade-off ที่ยอมรับ:**
- Client UI ยังโชว์ปุ่ม admin-only ให้ staff (backend guard OK, แต่ UX confusing)
- 3 UI patches ที่ค้างไว้ deferred → Session 10

---

## Sub-tasks Completion

| Task | Status | Notes |
|---|---|---|
| 9A LINE_ENABLED flag | ✅ | ทำจาก session 6A |
| 9B OpenNext build test | ✅ | Local preview pass 6 smoke tests |
| 9C D1 remote migrate + seed | ✅ | 8 services, 7 hours, 20 bookings |
| 9D Wrangler secrets + vars | ✅ | 2 secrets + 3 vars |
| 9E Deploy | ✅ | Deploy ID: `185682c1-debf-401a-b190-49f0b155fa62` |
| 9F Fix production issues | ✅ | 3 symptoms, 2 root causes (CPU + Turnstile = same bug) |
| 9G End-to-end test | ✅ | Bundle กับ session 7-8 fixes |
| 9H Fastwork listing update | ⏭️ | **Deferred** — รอ Session 10 (LINE integration) เสร็จก่อน |

---

## Timeline (Chronological)

### Phase 1: Prep & Verification (~30 นาที)

**Blocking questions ที่ต้องเคลียร์:**
1. Domain: **workers.dev subdomain** (fast, ฟรี) หรือ custom domain
2. Cloudflare account: ใช้ account เดิมที่ใช้ dev
3. Smoke test 18-item จาก session 8: ผ่านหมด

**Verified state:**
- Remote D1 มีอยู่แล้ว (`811ec54d-8cbe-494d-bd0b-718363071ad6`) แต่ `num_tables: 0`
- Migrations 2 ไฟล์: `0000_outstanding_pandemic.sql` (business), `0001_solid_zarda.sql` (auth)
- Seed script มีทั้ง `.sql` (generated) และ `.ts` (generator)

### Phase 2: 9C — D1 Remote Migration (~15 นาที)

**Issue พบก่อน migrate:** `scripts/seed.sql` generate ตอน 24 ก.ค. 26 — timestamp bookings hardcode (`1783661400` = 15 ก.ค. ถึง `1786095000` = 13 ก.ย.) → วันนี้ 22 ส.ค. bookings "future" กลายเป็นอดีตหมด

**Fix:** Regenerate จาก `seed.ts` (ใช้ `Date.now()` + `daysFromNow ±14`):
```powershell
pnpm exec tsx scripts/seed.ts
# ✓ Generated scripts/seed.sql (6456 bytes)
```

**Migration flow:**
```powershell
pnpm exec wrangler d1 migrations apply nebula-spa-db --remote
# → "No migrations to apply!" (session 3-4 ทำไว้แล้ว, แค่ empty tables)

pnpm exec wrangler d1 execute nebula-spa-db --remote --file=scripts\seed.sql
# → 40 queries, 196 rows written
```

**Verified result:**
- services: 8 rows
- business_hours: 7 rows
- bookings: 20 rows
- 11 tables ทั้งหมด (4 business + 4 auth + 3 system)

### Phase 3: 9D — Secrets & Vars Setup (~45 นาที)

**Turnstile Production Widget:**
- Cloudflare Dashboard → Turnstile → Add site manually
- Widget name: `Nebula Spa Production`
- Hostname: `nebula-spa.example.workers.dev` (placeholder — แก้ทีหลัง)
- Widget mode: Managed (default)
- **Site Key:** `0x4AAAAAAEYUSK9NyWXTlUxn` (public — commit ได้)
- Secret Key: (encrypted, ใช้ครั้งเดียวใน `wrangler secret put`)

**Subdomain decision:**
- ตั้ง workers.dev subdomain = `bimav`
- URL production: `nebula-spa.bimav.workers.dev`
- เหตุผล: brand-consistent กับ `project-bimav.vercel.app`, สั้น, unique global

**Secret generation:** ใช้ Node script bypass PowerShell strip-first-letter bug:
```powershell
'console.log(require("crypto").randomBytes(32).toString("base64"))' | Out-File -Encoding utf8 gen-secret.js
node gen-secret.js
# → 44-char base64 string
```

**wrangler.toml updated:**
```toml
[vars]
BETTER_AUTH_URL = "https://nebula-spa.bimav.workers.dev"
NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x4AAAAAAEYUSK9NyWXTlUxn"
LINE_ENABLED = "false"
```

**Secrets pushed:**
```powershell
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

**หมายเหตุ:** ครั้งแรกที่ push secret Wrangler ถามว่า "Worker doesn't exist. Create?" → กด Y → auto-create empty Worker placeholder แล้ว attach secret

### Phase 4: 9E — Deploy (~10 นาที)

**Dry-run verify ก่อน:**
```powershell
pnpm exec opennextjs-cloudflare deploy --dry-run
```
→ 3 vars show, secrets not shown (ปกติ), 12MB bundle / 2.4MB gzip

**Deploy จริง:**
```powershell
pnpm exec opennextjs-cloudflare deploy
```
→ 67 assets uploaded, Worker startup 31ms, **Deploy ID: `185682c1-debf-401a-b190-49f0b155fa62`**

**Warnings 2 อัน** (cosmetic, ไม่ block):
- `workers_dev` not in config — enabled by default
- `preview_urls` not set — enabled by default

### Phase 5: 9F — Production-Only Bugs (~2 ชม.)

**นี่คือ phase ที่กินเวลาที่สุด** — เจอ 3 อาการ (symptoms) ที่ dev/preview pass แต่ production พัง

หลัง diagnose จริง พบว่า **2 อาการเป็น bug เดียวกัน** (CPU exceeded เป็นอาการของ Turnstile mismatch, ไม่ใช่ cold start ตามที่คิดตอนแรก)

รายละเอียดใน section "Bugs Encountered" ด้านล่าง

### Phase 6: 9G — E2E Testing (bundled)

Session 9G ผ่านบางส่วนตอน session 9 แล้ว (public flow) + ผ่านครบตอนกลับไปทำ session 7-8 patches → redeploy → test พร้อมกัน = admin flow verified

---

## Bugs Encountered & Solutions

### 🐛 Bug 1: Stale Seed Timestamps

**Symptom:** ถ้ารัน seed.sql เดิมทันที → 20 mock bookings ที่ควรเป็น "อนาคต" กลายเป็น "อดีต" ทั้งหมด → dashboard demo ดูตาย

**Root Cause:** `seed.sql` generate ตอน 24 ก.ค. 26 (1 เดือนก่อน) — timestamp hardcoded ไว้ในไฟล์

**Fix:** Regenerate seed.sql ก่อน apply — `seed.ts` เขียนดี ใช้ `Date.now()` + relative days → รัน `tsx scripts/seed.ts` ครั้งเดียวจบ

**Lesson:** Generator scripts ควรรัน fresh ก่อน deploy — อย่า commit generated artifacts แล้วใช้ตรงๆ

---

### 🐛 Bug 2: Turnstile Config Mismatch 🔥 (bug ยากที่สุด — แสดงออก 2 อาการ)

**Symptoms (สองอย่างที่ตอนแรกคิดว่าเป็นคนละ bug):**

**อาการ A: CPU Limit Exceeded**
```
POST https://nebula-spa.bimav.workers.dev/api/bookings - Exceeded CPU Limit
✘ [ERROR] Error: Worker exceeded CPU time limit.
```

**อาการ B: Turnstile verification failed**
```
POST /api/bookings - Ok
(warn) [Turnstile] Verification failed [ 'invalid-input-response' ]
```

Client เห็น "สำเร็จ ✓" บน widget → กด submit → error "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง"
Widget แสดงข้อความ "สำหรับการทดสอบเท่านั้น" — ข้อความนี้แสดง**เฉพาะเมื่อใช้ Test Site Key** (`1x00000...`)

**Diagnosis flow (rabbit hole ก่อนเจอต้นเหตุ):**
1. Suspect hostname mismatch → verified Cloudflare Dashboard config ถูก
2. Suspect Site Key mismatch → verified `wrangler.toml` = Turnstile Dashboard
3. Suspect token expire/duplicate → fresh incognito test ยัง fail
4. **Suspect cold start เป็นสาเหตุ CPU exceeded** (ผิด — จะอธิบายด้านล่าง)
5. **Screenshot booking form → เห็น "test only" watermark** → confirmed client ใช้ test key
6. `findstr` bundle → เจอ test key inline

**Root Cause investigation:**
```powershell
findstr /S /N "1x0000" src\*.tsx src\*.ts
# src\app\(public)\book\_components\customer-form.tsx:21:
#   process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";
```

→ Fallback `??` ทำงาน = env var เป็น `undefined` ตอน build client bundle

**Root Cause ที่แท้จริง:**

Next.js **inline `NEXT_PUBLIC_*` env vars เข้า client bundle ตอน build time** (ไม่ใช่ runtime)
- ✅ `wrangler.toml` `[vars]` มี Site Key production
- ❌ **แต่ Wrangler vars ใช้ตอน server runtime เท่านั้น** ไม่ inject ตอน Next build
- ❌ Build อ่านจาก `.env.local` เท่านั้น (มี test key) → inline test key เข้า bundle

**Fix Attempt 1 (ผิด):** สร้าง `.env.production` → deploy ยัง fail

**เพราะอะไร:** Next.js **env file precedence** — `.env.local` ทับ `.env.production` เสมอ:
```
Priority (สูง → ต่ำ):
1. process.env (shell)
2. .env.production.local          ← ใช้ตัวนี้
3. .env.local                     ← ตอนแรก WIN (มี test key)
4. .env.production                ← แพ้ .env.local
```

**Fix Attempt 2 (ถูก):**
```powershell
Rename-Item .env.production .env.production.local
Remove-Item -Recurse -Force .next, .open-next -ErrorAction SilentlyContinue
pnpm exec opennextjs-cloudflare build
```

**Verify inline สำเร็จ:**
```powershell
findstr /S /C:"0x4AAAAAAEYUSK9NyWXTlUxn" .open-next\assets\_next\static\chunks\*.js
# ✅ เจอใน chunk
findstr /S /C:"1x00000000000000000000AA" .open-next\assets\_next\static\chunks\*.js
# ✅ ไม่เจอ
```

**เชื่อมโยง 2 อาการ:**

CPU exceeded (อาการ A) และ Turnstile verify fail (อาการ B) = **bug เดียวกัน** ที่แสดงออก 2 แบบ:

- **Chain of events:**
  1. Client ส่ง test token (จาก test site key ที่ inline ผิด)
  2. Server call Turnstile siteverify ด้วย production secret
  3. Cloudflare siteverify reject → return `invalid-input-response`
  4. Turnstile verify path (retry loop หรือ inefficient code path) → CPU busy → เกิน 10ms → Worker killed
  5. Log แสดง `Exceeded CPU Limit` (แทนที่จะโชว์ Turnstile fail เพราะยังไม่ถึง log statement)

- **หลัง fix Turnstile:** siteverify pass ครั้งแรก → no retry loop → CPU ใช้ปกติ → อาการทั้ง 2 หายพร้อมกัน

**หลักฐาน rule out cold start hypothesis:**

ตอนแรก assume ว่า CPU exceeded = cold start (Free tier 10ms hard limit + bundle 12MB)
แต่ **test case ต่อมาพิสูจน์ผิด**:
- เปิดใหม่วันถัดไป (isolate ตาย + restart แน่นอน) → **request แรกก็ผ่านทันที**
- ถ้าเป็น cold start จริง ควรเจอ CPU exceeded ซ้ำทุกครั้งที่ isolate reboot
- → confirmed: **cold start ไม่ใช่สาเหตุ** — Turnstile mismatch เป็นสาเหตุจริง

**Lesson:**
- Next.js env precedence ไม่ intuitive — ต้อง check docs ก่อน assume
- `.local` suffix pattern สำคัญ (naturally gitignored + priority สูงกว่า base file)
- Fallback `??` ใน critical config = trap — ควรใช้ throw error แทน
- **อาการหลายอย่างพร้อมกัน อาจเป็น bug เดียวกัน** — ต้องหา common root ก่อน treat แยก

---

### 🐛 Bug 3: Better Auth "Missing or null Origin"

**Symptom:** ยิง Postman POST `/api/auth/sign-up/email` เพื่อสร้าง staff → error:
```json
{
  "message": "Missing or null Origin",
  "code": "MISSING_OR_NULL_ORIGIN"
}
```

**Root Cause:** Better Auth v1.x บังคับ CORS check ทุก request แม้จาก non-browser client — reject ถ้าไม่มี `Origin` header

**Confused moment:** ตอนสร้าง admin ครั้งแรกผ่าน → สร้าง staff pang. เหตุผลไม่ชัด (อาจ Postman default header ต่างกันระหว่าง 2 requests)

**Fix:** เพิ่ม header manual ใน Postman:
```
Origin: https://nebula-spa.bimav.workers.dev
```

**Lesson:** Better Auth strict-by-default — ต้องรู้ pattern นี้ก่อนใช้ tool ที่ไม่ใช่ browser

---

## Decisions Made

### Decision 1: workers.dev subdomain (ไม่ใช้ custom domain)

**เหตุผล:**
- Session 9 goal = get URL live เพื่อ demo — workers.dev ตอบโจทย์ 100%
- Custom domain = ต้องซื้อ + รอ DNS propagate = block ครึ่งวัน
- Upgrade เป็น custom domain ทีหลังทำง่าย (`wrangler custom-domains add` = 15 นาที)

**Trade-off:** URL ดู "dev-y" ไม่ pro เท่า custom domain — แต่ Cloudflare = brand ที่ dev community รู้จัก, SME buyer ไม่น่า care มาก

### Decision 2: Subdomain name `bimav`

**Options considered:**
- `bimav` ← เลือก
- `npattanasarn` (ยาว, spell ยาก)
- `bimav-dev` (ลด perception)

**เหตุผล:** brand consistency กับ `project-bimav.vercel.app` — future projects ต่อไปใช้ pattern `xxx.bimav.workers.dev` = ecosystem เดียวกัน

### Decision 3: `.env.production.local` แทน `.env.production`

**Context:** Bug 2 flow แนะนำ `.env.production` ก่อน → พบว่า `.env.local` ทับ

**Final choice:** `.env.production.local`
- Priority สูงกว่า `.env.local` (ตาม Next.js precedence)
- Naturally gitignored (`.local` pattern)
- Dev workflow ไม่กระทบ (`.env.local` ยังใช้ test keys)

### Decision 4: Admin-only สำหรับ Services/Hours/Blocked

**Original design (session 3-4):** 2-tier
- admin: full CRUD
- staff: bookings CRUD + view others

**Discussion mid-session:** อาจจะให้ staff แก้ blocked slots ได้ (operational — ปิดร้านฉุกเฉิน)

**Final choice:** Keep admin-only ทั้ง 3 endpoints
- Services = revenue impact
- Hours = business setup ตั้งครั้งเดียว
- Blocked = admin approve, staff แจ้งเจ้าของ

**เหตุผลปิด option 3-tier (manager role):** YAGNI — 90% SME ร้านสปาไม่ต้อง manager tier, add ทีหลังได้ถ้าลูกค้าจริงร้องขอ

### Decision 5: UI patches (hide admin buttons) → Session 10

**Context:** Screenshot แสดง staff เห็นปุ่ม pencil/toggle/add ใน services (ทั้งที่ backend guard = admin only)

**Server guard OK:** staff คลิก → เจอ 403 message `"มีแค่เจ้าของร้านที่เปลี่ยนได้"` = security ไม่พัง

**Client UX bug:** ปุ่มโชว์แต่กดไม่ได้ = confusing

**Final choice:** Defer patches ไป Session 10
- Session 9 = deploy, ไม่ใช่ UX refactor
- Bundle patches กับ LINE integration = 1 rebuild cycle
- Demo ยังใช้ได้ (buyer login เป็น admin — เห็น full features)

**Patches ค้าง (ทำใน Session 10):**
- `services-manager.tsx` — 5 จุด (interface, signature, add button, toggle, edit column)
- `hours-manager.tsx` — pattern เดียวกัน
- `blocked-slots-manager.tsx` — pattern เดียวกัน
- `settings/page.tsx` — pass `isAdmin` prop ให้ 3 components

### Decision 6: 9H Fastwork listing → หลัง Session 10

**เหตุผล:**
- LINE integration = feature ที่ buyer เห็นค่ามาก
- Listing update ครั้งเดียวคุ้มกว่าอัพ 2 รอบ
- ลด context switch dev mode ↔ marketing mode

---

## Production State Snapshot

### Infrastructure
```
Worker Name:      nebula-spa
Production URL:   https://nebula-spa.bimav.workers.dev
Cloudflare Acct:  N.pattanasarn@gmail.com's Account
Account ID:       e26878922c653ec6ba76e474172489bd
Subdomain:        bimav.workers.dev
Deploy ID:        185682c1-debf-401a-b190-49f0b155fa62
Startup Time:     31ms
Bundle Size:      12MB (2.4MB gzip)
```

### D1 Database
```
Name:             nebula-spa-db
UUID:             811ec54d-8cbe-494d-bd0b-718363071ad6
Tables:           11 (services, business_hours, bookings, blocked_slots,
                     users, sessions, accounts, verifications,
                     _cf_KV, d1_migrations, sqlite_sequence)
Seed:             8 services, 7 business_hours, 20 bookings
Users:            admin@nebula-spa.demo (role=admin, promoted via SQL)
```

### Secrets (encrypted, in Cloudflare)
```
BETTER_AUTH_SECRET       (44-char base64)
TURNSTILE_SECRET_KEY     (Turnstile production secret)
```

### Vars (wrangler.toml [vars])
```
BETTER_AUTH_URL                  = "https://nebula-spa.bimav.workers.dev"
NEXT_PUBLIC_TURNSTILE_SITE_KEY   = "0x4AAAAAAEYUSK9NyWXTlUxn"
LINE_ENABLED                     = "false"
```

### Turnstile Widget
```
Widget name:  Nebula Spa Production
Hostname:     nebula-spa.bimav.workers.dev  (updated post-deploy)
Widget Mode:  Managed
Pre-clearance: Off
```

### Files Modified/Created
```
scripts/seed.sql              (regenerated with fresh timestamps)
wrangler.toml                 (added [vars] block)
.env.production.local         (created — gitignored)
```

---

## Deferred to Session 10

### Priority 1: LINE Integration
- Create LINE OA + Messaging API channel
- Get access token + channel secret + owner user ID
- Push 3 LINE secrets to Cloudflare
- Update `wrangler.toml` — `LINE_ENABLED=true`
- Rebuild + redeploy
- Test end-to-end (booking → LINE notify)
- Screenshots LINE card State 2 + 3 (ค้างจาก session 8)

### Priority 2: Admin UI Polish (bundled)
- Hide admin-only buttons ใน 3 pages (patches พร้อมแล้ว)
- Pass `isAdmin` prop จาก `settings/page.tsx`

### Priority 3: Optional
- Middleware → Proxy migration (Next 16 deprecation warning)
- Cron worker re-seed demo data ทุกคืน (กัน demo ตายหลัง buyer test)

### Post-Session 10
- **9H Fastwork listing update**
  - Add demo URL
  - Create demo credentials (separate account, not personal admin)
  - Screenshots 4-6 รูป (landing, booking flow, admin dashboard, LINE notify)

---

## Lessons Learned

### 1. Dev pass ≠ Production pass
2 bugs ที่ dev/preview ไม่เจอ (จริงๆ 3 อาการ แต่ 2 อาการเป็น bug เดียวกัน):
- Turnstile env var precedence (Next.js build behavior) → แสดง 2 อาการ = CPU exceeded + verify fail
- Better Auth CORS (browser vs non-browser client)

**Takeaway:** Deploy หลายๆ รอบ + test บน production actual = ปกติ ไม่ใช่ overkill

### 2. ระวัง diagnosis ที่ "ตรงกับ pattern คุ้นเคย" — อาจ misleading

**Mistake ที่ทำใน session นี้:** เห็น "CPU Limit Exceeded" → นึกถึง AWS Lambda cold start → assume Cloudflare ก็เหมือนกัน → เขียน hypothesis ผิด

**หลักฐาน rule out:**
- Cloudflare V8 isolates ≠ Lambda containers (startup ~5ms vs ~500ms)
- Test case: เปิดใหม่วันถัดไป (isolate reboot แน่นอน) → request แรกผ่านทันที → ถ้าเป็น cold start ต้องเจอซ้ำ

**Real root cause:** Turnstile mismatch ทำให้ verify path กิน CPU (อาจ retry loop หรือ inefficient code) → เกิน 10ms

**Takeaway:**
- อย่า port pattern จาก platform อื่นมา assume โดยไม่ verify
- หลาย symptoms พร้อมกัน → หา common root cause ก่อน treat แยก
- **Test hypothesis ด้วย test case ที่ควร disprove** — ถ้ายัง reproduce ได้ = wrong hypothesis

### 3. Next.js env precedence สำคัญมาก
`.env.local` > `.env.production` เสมอ — ต้องใช้ `.env.production.local`

**Takeaway:** Read framework docs before assuming behavior, especially สำหรับ config ที่ affect build output

### 4. Fallback ใน critical config = trap
```typescript
process.env.NEXT_PUBLIC_X ?? "test-value"
```
ดูปลอดภัย แต่ hide bug — production build ไม่มี var ก็ยัง compile ผ่าน + ใช้ test value

**Better pattern:**
```typescript
const x = process.env.NEXT_PUBLIC_X;
if (!x) throw new Error("NEXT_PUBLIC_X required");
```

### 5. Generator scripts ต้อง regenerate before use
Committed generated artifacts (`seed.sql`) = stale over time — always run generator before applying

### 6. Wrangler workflow quirks
- ต้อง push secret ก่อน สร้าง Worker placeholder ได้
- `wrangler deployments list --name X` (Wrangler 4.x syntax)
- `wrangler subdomain` deprecated → check via Dashboard
- `--remote` vs `--local` flag critical สำหรับ D1 commands

### 7. Screenshot debugging faster than log debugging
Bug 2 breakthrough = screenshot booking form เห็น "test only" watermark → skip long log analysis

**Takeaway:** UI evidence สามารถชี้ root cause ได้เร็วกว่า log parsing สำหรับ client-side bugs

### 8. Better Auth default role = "user"
Sign-up API ไม่ set role → ต้อง promote ผ่าน SQL manual

**Pattern:**
```powershell
# 1. Sign-up ผ่าน Postman (with Origin header)
# 2. UPDATE users SET role = 'admin' WHERE email = 'x@y.z'
# 3. Logout + login ใหม่ (session cache new role)
```

---

## Handover Checklist สำหรับ Session 10

- [ ] อ่าน `line-integration-plan.md` — Session 10 detailed plan
- [ ] เตรียม LINE OA account + Messaging API channel
- [ ] Bundle 3 UI patches (services/hours/blocked managers) ทำใน session เดียวกัน
- [ ] Test admin + staff role-based rendering หลัง patches
- [ ] Post-Session 10: กลับมาทำ 9H Fastwork listing

---

**End of Session 9 Handover**

Session 9 = ก้าวใหญ่ — MVP หลุด local จริง, Cloudflare stack proven ในสนามจริง, infra strategy validated

Next up: Session 10 — LINE Integration + UI polish
