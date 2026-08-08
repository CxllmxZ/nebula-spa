# Booking System — Decisions Locked

สรุปทุก decision ที่ตัดสินใน research chat พร้อมเหตุผล — ใช้เป็น input สำหรับ chat scaffold ตัวจริง

---

## 🎯 Overview

- **Project type:** Portfolio piece (side project เสริม Fastwork listing)
- **Focus:** Serverless-first architecture
- **Stack summary:** Next.js 15 + Cloudflare Workers + D1 + Drizzle + Better Auth
- **Business demo:** Nebula Spa (Cosmic aesthetic, ไม่ใช่ warm/spa ทั่วไป)
- **Timeline realistic:** 3-4 สัปดาห์ (ไม่ใช่ 2 ตาม spec — เผื่อ buffer สำหรับงานประจำ)

---

## 1. Business Identity

### ชื่อร้าน demo
**Nebula Spa** (เนบิวล่าสปา)

**ทำไม:**
- Unique มาก collision ต่ำในตลาดร้านนวดไทย
- Aesthetic ต่างจากคู่แข่ง Fastwork ที่ใช้ warm/beige generic
- Portfolio differentiation ชัด — buyer จำได้

### Positioning
- ยังเป็น**ร้านนวด/สปาไทย**เหมือนเดิม
- Branding cosmic แค่ที่ UI/vibe
- Service names ใช้แบบมาตรฐานไทย (นวดไทย, นวดน้ำมัน, ...) ไม่ทำ cosmic-themed

---

## 2. Data Model — TIMESTAMP (not DATE+TEXT)

### เปลี่ยนจาก spec เดิม

**เดิม (spec):**
```sql
booking_date DATE,     -- '2026-03-15'
booking_time TEXT,     -- '14:30'
duration_min INTEGER,  -- 60
```

**ใหม่:**
```sql
starts_at INTEGER NOT NULL,  -- Unix timestamp (UTC)
ends_at   INTEGER NOT NULL,  -- computed = starts_at + duration*60
```

### Drizzle schema
```typescript
export const bookings = sqliteTable('bookings', {
  startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
  endsAt: integer('ends_at', { mode: 'timestamp' }).notNull(),
});
```

### เหตุผล
- Query overlap สะอาด: `WHERE starts_at < :end AND ends_at > :start`
- Index-friendly: `CREATE INDEX idx_bookings_time ON bookings(starts_at, ends_at)`
- Timezone-safe: เก็บ UTC, convert Asia/Bangkok ตอน display
- Drizzle handle convert `Date ↔ INTEGER` ให้อัตโนมัติ

### Trade-off ที่ยอมรับ
- Debug raw DB อ่านยาก (Drizzle Studio ช่วยได้)
- Migrate data จาก CSV ต้อง convert

---

## 3. Seed Data — Services

**8 services** (ครอบคลุม duration 30/45/60/90 นาที เพื่อโชว์ slot logic รับได้ทุกช่วง)

```
1. นวดไทย 60 นาที              ฿300
2. นวดไทย 90 นาที              ฿450
3. นวดน้ำมัน 60 นาที            ฿450
4. นวดน้ำมัน 90 นาที            ฿650
5. นวดฝ่าเท้า 45 นาที            ฿280
6. นวดคอ-บ่า-ไหล่ 30 นาที       ฿200
7. สปาหน้า 60 นาที              ฿550
8. ประคบสมุนไพร 45 นาที        ฿350
```

**Category coverage:** นวด / สปา / ประคบ → admin dashboard filter ดูมีของ

**Additional seed:** 15-20 mock bookings, status ต่างกัน (pending 3, confirmed 8, completed 5, cancelled 2, no-show 2) เพื่อ demo alive

---

## 4. Business Hours

```
จันทร์-ศุกร์:   10:00 - 21:00
เสาร์-อาทิตย์:  09:00 - 22:00
(ไม่มีวันปิด สำหรับ demo)
```

---

## 5. Design Tokens — Cosmic Palette

### Palette
```css
--night:     #0F1024   /* deep space — main bg (dark mode) */
--nebula-1:  #4B3F72   /* indigo — primary accent */
--nebula-2:  #7B6CA8   /* soft purple — secondary */
--star:      #F5E6C8   /* warm cream — text on dark */
--gold:      #C9A961   /* metallic — CTA / highlight */
--mist:      #E8E4F0   /* light bg — cards, forms */
--ink:       #1A1B2E   /* text on light bg */
```

**Feel:** deep night sky + gold highlights = premium ethereal (ไม่ใช่ tech/gamer vibe)

### Design Mode — Hybrid

- **Public site** (`/`, `/book`, `/book/[code]`) = **Dark cosmic**
  - bg: `--night`
  - cards/forms: `--mist` (contrast)
  - CTA: `--gold`
- **Admin** (`/admin/*`) = **Light practical**
  - bg: `--mist` หรือ white
  - Dashboard ใช้ standard patterns เพื่อ demo functionality

**เหตุผล Hybrid:** public โชว์ cosmic feel ให้ buyer เห็นทันที, admin เป็น practical dashboard สำหรับ demo functionality

### Fonts (ตาม spec)
- **Noto Serif Thai** — headings (weight 500-700, letter-spacing กว้าง)
- **IBM Plex Sans Thai** — body (weight 400-500)

---

## 6. Infrastructure

### Domain
**`<worker-name>.<subdomain>.workers.dev`** (ฟรี Cloudflare default)

- URL แบบ: `nebula-spa.YOURNAME.workers.dev`
- ไม่ต้องซื้อ domain
- Upgrade path มี: ถ้าหลัง 3 เดือน demo ได้ผลตอบรับดี, ค่อยซื้อ domain (setup ง่าย ~10 นาที)

### Cloudflare Account
**สร้าง account ใหม่แยกจาก project เดิม**

**เหตุผล:**
- Isolation ระหว่าง project (billing, permissions, D1 databases)
- Handover ให้ลูกค้าจริงในอนาคต transfer account ง่ายกว่า

### Editor
**VS Code**

Extensions ที่ต้องลง (จะระบุใน scaffold chat):
- Biome
- Tailwind CSS IntelliSense
- Prisma/Drizzle syntax
- ES7+ React snippets

### Package Manager
**Pending** — คุณจะเช็ค npm/npx version ก่อนตัดสิน

**Options:**
- npm (default, ok)
- pnpm (แนะนำ 2026, เร็ว disk-efficient)
- bun (เร็วสุด, TypeScript native)

### Repo
**Public GitHub repo**

**เหตุผล:**
- Buyer ตรวจ code quality ได้ → ช่วยขาย
- Fastwork listing แนบ GitHub link → trust signal
- Self-discipline เขียน code สะอาดขึ้น
- ทุกอย่างเป็น mock ยกเว้น secrets → ไม่มีอะไรต้องปกปิด

---

## 7. LINE OA — Provider ใหม่แยก

### Setup
สร้าง **Provider ใหม่** ชื่อ "Nebula Spa" (หรือชื่อคุณ) → **1 Channel = Messaging API**

**ไม่ reuse provider จาก SlipScan/Shop Order Bot**

### เหตุผล
1. Clean separation — brand ต่างกัน portfolio ต่างกัน
2. Handover ง่าย — ถ้าให้ลูกค้าจริงเอา template ไปใช้ โอน provider ทั้ง unit
3. Debugging ง่าย — log ไม่ปน
4. Overhead ต่ำ — สร้าง provider ใช้เวลา ~2 นาที
5. **User IDs ไม่ share ข้าม provider** — ต้องแยก provider เพื่อความสะอาด

### LINE limits ที่ต้องรู้
- 1 Developer account → 10 Providers (สูงสุด)
- 1 Provider → 100 Channels
- Nebula Spa ใช้ 1 provider → คุณเหลืออีก 7 providers สำหรับโปรเจกต์อื่น

### Setup steps
1. เข้า https://developers.line.biz/console/
2. Login ด้วย LINE account เดิม
3. Create Provider → "Nebula Spa" (หรือชื่อคุณ)
4. Create Channel → Messaging API
5. เก็บ Channel Access Token → `.env.local`
6. Follow OA ด้วย LINE ส่วนตัว → เก็บ User ID (= "เจ้าของร้าน" ใน demo)

---

## 8. Secrets & Environment

### `.env.local` (ห้าม commit)

```bash
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_OWNER_USER_ID=...           # user ID เจ้าของร้าน demo (คุณเอง)
LINE_CHANNEL_SECRET=...          # สำหรับ webhook verification (ถ้าใช้)

# Better Auth
BETTER_AUTH_SECRET=...            # random 32 chars
BETTER_AUTH_URL=http://localhost:3000  # dev only

# Cloudflare Turnstile
TURNSTILE_SITE_KEY=...            # public (client-side ก็ใช้)
TURNSTILE_SECRET_KEY=...          # server-side verify

# Admin seed
ADMIN_SEED_EMAIL=admin@nebula-spa.demo
ADMIN_SEED_PASSWORD=...           # ใช้ตอน seed admin user
```

### `.env.example` (commit ได้)
Copy `.env.local` แต่ค่าเป็น placeholder เช่น `your_channel_token_here`

### Production secrets
```bash
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_OWNER_USER_ID
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put TURNSTILE_SECRET_KEY
```

### `.gitignore`
```
node_modules/
.next/
.env*
!.env.example
.wrangler/
.dev.vars
.DS_Store
*.log
```

---

## 9. Gotchas ที่ต้องระวัง (จาก research)

### Better Auth on D1
ต้อง init database แบบ **async** ผ่าน `getCloudflareContext({ async: true })` ไม่ใช่ import ตรงๆ

**Action:** clone template `zpg6/better-auth-cloudflare` มาดู pattern ก่อนเขียนเอง

### `@opennextjs/cloudflare` ยัง evolving
บาง Next.js feature ยัง flaky (image optimization, บาง middleware patterns)

**Action:** check compatibility list ที่ https://opennext.js.org/cloudflare ก่อนใช้ feature ใหม่

### Wrangler local dev ≠ production
`wrangler dev` จำลอง Workers แต่ไม่ครบ 100%

**Action:** test บน preview deployment ก่อน merge to main

### D1 migration ต่างระหว่าง local กับ production
Miniflare (local) กับ production มี edge case ต่างกัน

**Action:** run migration บน preview env ก่อน production

### LINE Notify ตายแล้ว (สำคัญ)
ตั้งแต่ 31 มี.ค. 2025 → **ใช้ Messaging API เท่านั้น**

**Action:** spec เดิมเขียน "LINE Notify" — ignore, ใช้ Messaging API push endpoint

---

## 10. Setup Checklist (Day 0 — ก่อนเริ่ม Day 1)

### Accounts
- [ ] Cloudflare account ใหม่ + verify email
- [ ] LINE Developers Console — create Provider "Nebula Spa" + Messaging API channel
- [ ] GitHub — สร้าง public repo ใหม่

### Local Environment
- [ ] Node.js 20 LTS installed
- [ ] Package manager selected (npm/pnpm/bun)
- [ ] Wrangler CLI: `npm install -g wrangler` แล้ว `wrangler login`
- [ ] VS Code + extensions

### Secrets
- [ ] LINE Channel Access Token → save
- [ ] LINE Owner User ID → save (follow OA เอง ด้วย LINE ส่วนตัว)
- [ ] Cloudflare Turnstile site key + secret key
- [ ] Generate Better Auth secret (random 32 chars)

### Repo Setup
- [ ] `.gitignore` ครบตามลิสต์ข้างบน
- [ ] `.env.example` เขียน placeholder
- [ ] README เขียนโครง (fill รายละเอียดตอนโปรเจกต์เดิน)
- [ ] LICENSE (MIT ก็ได้)

---

## 11. Reality Check

### Timeline
- **Spec เดิม:** 54 ชั่วโมง ใน 14 วัน
- **Realistic:** 3-4 สัปดาห์ (มีงานประจำ + buffer 30%)
- **Deadline แนะนำ:** ตั้ง 3 สัปดาห์ ไม่ใช่ 2

### Scope Discipline
- ✂️ ตัดเอา nice-to-have ออกอย่างเด็ดขาด ระหว่าง 2-3 สัปดาห์แรก
- ให้ MVP เสร็จก่อนค่อยเพิ่ม feature
- **อย่ายัด feature เพิ่มระหว่างทาง** — ตัดสินตอน planning ที่นี่ พอ

### Extra ที่ควรคิดเผื่อ
- **Portfolio integration** — พอ demo เสร็จ ต้องเอาไปใส่ `project-bimav.vercel.app` (แนะนำ: หลังจาก demo stable 1 สัปดาห์)
- **Fastwork listing copy** — เตรียมไว้ตั้งแต่กำลังโค้ด จะรู้ว่าต้องโชว์ feature ไหน
- **Screenshots strategy** — 6-8 รูปสำหรับ portfolio + Fastwork ต้องคิดตั้งแต่ตอนออกแบบ UI ให้ถ่ายภาพสวย

---

## 12. Handover Note สำหรับ Chat ใหม่

เริ่ม chat scaffold โดย upload 4 ไฟล์:

1. `booking-system-spec.md` (จาก project)
2. `booking-system-toolstack.md` (สร้างใน research chat)
3. `booking-system-workflow.md` (สร้างใน research chat)
4. `booking-system-decisions.md` (ไฟล์นี้)

พร้อมบอก:
> "ผ่าน research + lock decisions หมดแล้ว มา scaffold project ได้เลย ตาม 4 ไฟล์นี้"

---

**Status:** ✅ Research phase complete. Ready to scaffold.
