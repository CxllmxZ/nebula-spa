# Booking System — Side Project Spec

> ⚠️ **This spec was written during research phase (มิ.ย. 2026).**
> - **Current locked decisions:** [`booking-system-decisions.md`](./booking-system-decisions.md)
> - **Current implementation status:** [`roadmap.md`](./roadmap.md)
> - **What changed since:** See **📝 Update Log** at bottom of this file.
>
> Keep this file as historical context — do not update inline. New decisions go in `roadmap.md`.

---

โปรเจกต์ side สำหรับสร้าง portfolio ประกอบ Fastwork listing "รับทำระบบจัดการธุรกิจขนาดเล็ก"

---

## 📋 Context

### ผมเป็นใคร
- Full-stack Developer 4 ปี ที่ Tokio Marine
- มี portfolio: `project-bimav.vercel.app`
- Portfolio ปัจจุบัน 2 ตัว:
  - **SlipScan** (`receipt-ocr-rouge.vercel.app`) — ระบบ OCR สลิปโอนเงิน + LINE OA
  - **Shop Order Bot** — ระบบรับออเดอร์ผ่าน LINE + LIFF Dashboard

### ทำไมต้องทำโปรเจกต์นี้
กำลังจะเปิด Fastwork listing "รับทำระบบจัดการธุรกิจขนาดเล็ก" (POS/CRM/Booking/Stock/Task/รายรับ-จ่าย) แต่ portfolio ที่มี = LINE OA-focused ทั้งหมด buyer ที่กดเข้ามาดูอาจสงสัยว่าทำ business system เป็นจริงไหม → ต้องมี demo project ที่ตรงกับ listing

### ยุทธศาสตร์
ไม่ใช่ demo one-off แต่เป็น **template ที่ reuse ได้กับลูกค้าจริง**
- Portfolio ได้ผลงานโชว์
- Delivery ให้ลูกค้าเร็วขึ้น (customize จาก base)
- ควบคุมคุณภาพและ scope ได้

---

## 🎯 Project Scope: Booking System

### Positioning
**Single-tenant booking system สำหรับธุรกิจนวด/สปา/คลินิก/ช่างทำผม**

**ไม่ใช่** multi-tenant SaaS (นั่นเกิน scope + มีคู่แข่งเยอะ เช่น SimplyBook, Bookly)

### Demo business จำลอง
เลือก 1 ธุรกิจให้ demo เห็นบริบทชัดเจน — แนะนำ **ร้านนวด/สปา** เพราะ:
- Booking pattern ชัดเจน (slot 60-90 นาที)
- Multiple services (นวดไทย/นวดน้ำมัน/สปาหน้า)
- ตลาดใหญ่ที่จ่ายได้
- ไม่ต้อง staff scheduling ซับซ้อน (assume 1 คนต่อ slot)

---

## 📦 MVP Features

### Public Flow (ลูกค้าจอง)

1. **Landing page ร้าน**
   - โลโก้ + ชื่อร้าน + tagline
   - Services list พร้อมราคา/เวลา
   - เกี่ยวกับร้าน (short)
   - ปุ่มใหญ่ "จองเลย"

2. **Booking Flow (multi-step หรือ 1 หน้า)**
   - เลือก Service
   - เลือกวันที่ (calendar, ปิด slot ที่เต็ม/นอกเวลาทำการ)
   - เลือก Time Slot
   - กรอกชื่อ + เบอร์โทร
   - Confirm → ได้ booking code

3. **Confirmation Page** (`/book/[code]`)
   - แสดง booking code
   - รายละเอียด service + วัน + เวลา
   - ปุ่ม "บันทึกในปฏิทิน" (Google Calendar link)
   - ปุ่ม LINE add friend (ถ้ามี)

### Admin Flow (เจ้าของร้าน)

4. **Login** (single admin)
   - Email + password → JWT

5. **Dashboard** (`/admin`)
   - Stat cards: จองวันนี้ / สัปดาห์นี้ / เดือนนี้ / รายได้ประมาณ
   - Calendar view (booking แสดงเป็นจุดใน calendar)
   - Booking ล่าสุด 5 รายการ

6. **Bookings List** (`/admin/bookings`)
   - Table รายการทั้งหมด
   - Filter: date range, status, service
   - Search: ชื่อ/เบอร์/code
   - Change status (pending → confirmed → completed / cancelled / no-show)
   - View detail modal

7. **Settings** (`/admin/settings`)
   - Manage Services (CRUD): ชื่อ, ราคา, เวลา, active/inactive
   - Manage Business Hours: 7 วัน × เปิด-ปิด time
   - Blocked Slots: ปิด slot วันหยุด/เวลาพิเศษ

### ✂️ ตัดออก (nice to have — ทำหลัง)

- ❌ Multi-staff scheduling (ซับซ้อน)
- ❌ Recurring bookings
- ❌ Payment integration
- ❌ Customer account/login
- ❌ Reschedule จากฝั่ง customer (ให้โทรบอกร้าน)
- ❌ Email confirmation (มีแต่ LINE notify — ถ้ามีเวลา)

---

## 🗄️ Data Model

```sql
-- Services
services (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL,  -- 30, 60, 90, 120
  price INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP
)

-- Business hours per day of week
business_hours (
  id INTEGER PRIMARY KEY,
  day_of_week INTEGER NOT NULL,  -- 0=Sunday, 6=Saturday
  open_time TEXT,   -- '09:00'
  close_time TEXT,  -- '20:00'
  is_closed BOOLEAN DEFAULT false
)

-- Bookings
bookings (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,  -- 6-digit random unique
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  service_id INTEGER REFERENCES services(id),
  booking_date DATE NOT NULL,   -- '2026-03-15'
  booking_time TEXT NOT NULL,   -- '14:30'
  duration_min INTEGER NOT NULL,  -- snapshot from service
  price INTEGER NOT NULL,          -- snapshot from service
  status TEXT DEFAULT 'confirmed',  -- pending/confirmed/completed/cancelled/no-show
  notes TEXT,
  created_at TIMESTAMP
)

-- Blocked slots (special closures)
blocked_slots (
  id INTEGER PRIMARY KEY,
  date DATE NOT NULL,
  start_time TEXT,  -- optional, if null = whole day
  end_time TEXT,
  reason TEXT
)

-- Admin
admin_users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP
)
```

---

## 🎨 Design Direction

### Style guide
- **Feel**: warm spa aesthetic — cream, sage green, terracotta
- **Font**: Noto Serif Thai (headings) + IBM Plex Sans Thai (body)
- **Match กับ portfolio + Fastwork cover** (เดียวกัน tone)

### Color palette (แนะนำ)
```
--paper:    #FBF6EC   (background)
--paper-2:  #F4EBDA   (card)
--ink:      #2B2622   (text primary)
--ink-soft: #5A4F45   (text secondary)
--clay:     #C5553B   (accent, primary CTA)
--moss:     #6E7A4F   (success, secondary)
--line:     #E2D6C0   (borders)
```

### UI components
- ใช้ **shadcn/ui** เป็น base (Button, Input, Dialog, Calendar, DropdownMenu, etc.)
- Radix UI Calendar สำหรับ date picker
- ปุ่ม primary = clay color
- Cards มี subtle shadow + rounded corners

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14+** (App Router)
- **Tailwind CSS**
- **shadcn/ui** components
- **TypeScript**

### Backend + Database (ยังตัดสินไม่ลง — เลือก 1)

**Option A: Cloudflare Workers + D1** (ตาม Fastwork description)
- Pros: fast edge, cheap/free, matches marketing
- Cons: SQLite features จำกัด, learning curve ถ้าไม่คุ้น

**Option B: Vercel + Supabase** (คุ้นเคยจาก SlipScan)
- Pros: dev experience ดี, ทำเสร็จเร็ว, มี auth built-in
- Cons: ไม่ตรงกับที่โฆษณา 100%

**คำแนะนำ:** ถ้าอยากให้เสร็จเร็ว → B. ถ้าอยาก match brand + เรียนของใหม่ → A

### Deploy
- Frontend: Cloudflare Pages หรือ Vercel
- Domain: subdomain ธรรมดา (booking-demo.pages.dev) ก็พอ

### Auth
- JWT simple สำหรับ admin
- ไม่ต้อง OAuth/social login (single admin)

### LINE Notify (optional)
- แจ้งเตือนเจ้าของร้านเมื่อมีจองใหม่
- ใช้ LINE Messaging API push message

---

## 📅 Timeline: 2 สัปดาห์

```
เสาร์ W1     8h    Setup + Data model + Landing page
อาทิตย์ W1    8h    Public booking flow (service → date → time → confirm)
จ-ศ W1       15h   Admin auth + Dashboard + Bookings list
เสาร์ W2     8h    Services CRUD + Business Hours + Calendar view
อาทิตย์ W2    6h    Polish UI + Responsive + Bug fixes
จ-ศ W2       9h    Deploy + LINE notify + Screenshots

Total: ~54 hours ใน 14 วัน
```

---

## 💡 Tricks

### 1. Seed data ที่ทำให้ demo alive
- 15-20 mock bookings ใน database (status ต่างกัน: pending 3, confirmed 8, completed 5, cancelled 2, no-show 2)
- Bookings กระจายในเดือน (บางวันเยอะ บางวันน้อย)
- ชื่อไทยจริง เบอร์มือถือดูจริง
- **จุดประสงค์**: Dashboard สถิติมีตัวเลข, Calendar เห็นจุดเยอะ, List page มี content ให้ scroll → buyer เห็นแล้วรู้สึกเหมือน production

### 2. Configurable business info
- เก็บชื่อร้าน / โลโก้ / tagline / colors ใน env vars หรือ config file
- ทำให้ template ปรับใช้กับลูกค้าจริงง่าย (แค่เปลี่ยน config)

### 3. Public URL แบบ readable
- Booking confirmation URL: `/book/A3F9K2` (readable code)
- Admin panel: `/admin/*`

### 4. Time slot logic
- Granularity: **30 นาที** (ยืดหยุ่นสุด — service 60/90 min ใช้ได้)
- Business hours + duration → generate available slots
- Skip slot ที่ overlap กับ existing booking

---

## ✅ Definition of Done

Demo ถือว่าเสร็จเมื่อ:

- [ ] Public flow ครบ: landing → เลือก service → เลือก date/time → กรอกข้อมูล → confirmation
- [ ] Admin flow ครบ: login → dashboard → bookings list → change status → settings
- [ ] Services CRUD ทำงานได้จริง
- [ ] Business Hours CRUD ทำงานได้จริง
- [ ] Deploy live URL public เข้าดูได้
- [ ] Responsive ผ่านทั้ง desktop + มือถือ
- [ ] มี 15+ mock bookings ให้ demo ดูมีชีวิต
- [ ] ถ่าย screenshots 6-8 รูปสำหรับ portfolio + Fastwork
- [ ] Update portfolio (`project-bimav.vercel.app`) ให้มี Booking section
- [ ] มี tagline + capability bullets สำหรับ portfolio

---

## 🎁 Demo Business Suggestion (ต้องตัดสินก่อนเริ่ม)

### ตัวเลือกชื่อร้าน (เลือก 1)
- **ต้อยสปา** (Toi Spa) — ชื่อไทยน่ารัก
- **Zenith Massage** — ดู premium
- **บ้านนวดจ๊ะเอ๋** — friendly มาก
- **Mala Spa & Wellness** — modern

### Services suggested (ประมาณนี้ 6-8 อัน)
```
- นวดไทย 60 นาที         300฿
- นวดไทย 90 นาที         450฿
- นวดน้ำมัน 60 นาที      450฿
- นวดน้ำมัน 90 นาที      650฿
- นวดฝ่าเท้า 45 นาที     280฿
- นวดคอ-บ่า-ไหล่ 30 นาที 200฿
- สปาหน้า 60 นาที        550฿
- ประคบสมุนไพร 45 นาที   350฿
```

### Business Hours suggested
- จันทร์-ศุกร์: 10:00 - 21:00
- เสาร์-อาทิตย์: 09:00 - 22:00
- (ไม่มีวันปิด สำหรับ demo)

---

## 📌 Important Notes

### เรื่อง scope creep
- ตัดเอา nice-to-have ออกอย่างเด็ดขาด ระหว่าง 2 สัปดาห์แรก
- ให้ MVP เสร็จก่อนค่อยเพิ่ม feature
- **อย่ายัด feature เพิ่มระหว่างทาง** — ตัดสินใจตอน planning ที่นี่ พอ

### เรื่อง reusability
- คิดเสมอว่า "template ต่อไปเอาไปขายลูกค้าจริงได้"
- Config-driven design (colors, name, services ใน database ไม่ใช่ hard-code)
- Clean code + comments เผื่อ hand-off

### เรื่อง portfolio integration
- พอเสร็จต้องเอาไปใส่ใน portfolio (`project-bimav.vercel.app`) แล้ว
- Update Hero eyebrow ให้ mention "Booking system" ด้วย
- เพิ่ม case study section ใหม่คู่กับ SlipScan / Shop Order Bot

### เรื่อง Fastwork integration
- พอ demo live → update Fastwork description ให้อ้าง demo URL ได้
- ทำให้ buyer ที่กดจาก Fastwork "ลองด้วยตัวเอง" ได้
- เพิ่ม screenshot demo ในหน้าประกาศ

---

## 🚀 Next Steps

พอเริ่ม chat ใหม่ ต้องตัดสินใจก่อน:

1. **Stack** — Cloudflare Workers + D1 หรือ Vercel + Supabase
2. **Demo business** — ชื่อร้าน + service list ที่จะ seed
3. **Design decisions** — ยืน spa aesthetic ตามที่กำหนดหรือปรับ

พอตัดสินแล้ว → เริ่ม Day 1 (setup + data model + landing) ได้เลย

---

## 🎯 User Preferences (สำคัญ — บอก AI ตอนเริ่ม chat ใหม่)

```
- ตอบภาษาไทย ปนอังกฤษ tech term ตามธรรมชาติ
- Get to the point ไม่ต้องอวย ไม่ต้องเยิ่นเย้อ
- แย้งได้เมื่อข้อมูลผิด
- ให้ trade-off analysis เมื่อมีทางเลือก
- เข้าใจว่าผมมีงานประจำ ทำ side project นอกเวลา
- Prioritize impact สูงก่อน ตัด feature ต่ำก่อนเสมอ
```

---

จบ spec — เอกสารนี้ควรพอสำหรับเริ่มโปรเจกต์

---

## 📝 Update Log

**เอกสารนี้เขียนตอน research phase (มิ.ย. 2026)**

Decision + implementation ที่ lock ทีหลังอยู่ใน:
- **`booking-system-decisions.md`** — locked decisions
- **`booking-system-toolstack.md`** — final tool detail
- **`booking-system-workflow.md`** — algorithms + user journey
- **`roadmap.md`** — session tracker + timeline + schema evolution
- **`handover-session-*.md`** — actual implementation per session

### สรุปสิ่งที่เปลี่ยนจาก spec นี้

#### 🔧 Tech Stack — Locked

| Spec (เดิม) | Locked (ปัจจุบัน) | ที่ไหน |
|---|---|---|
| Next.js 14+ | **Next.js 16** (ที่ scaffold ได้จริง) | Session 2 |
| Backend TBD (A/B) | **Cloudflare Workers + D1** (Option A) | decisions.md |
| Simple JWT auth | **Better Auth** (session cookie + role-based) | Session 3-4 |
| ORM ไม่ระบุ | **Drizzle ORM 0.45** (schema-first, D1 driver) | Session 3-4 |
| Deploy TBD | **@opennextjs/cloudflare** adapter | Session 3-4 |
| Package manager ไม่ระบุ | **pnpm 10.23** | Session 2 |
| Linter | Biome (planned) → **Prettier** ชั่วคราว | Session 2 |
| Anti-spam ไม่ระบุ | **Cloudflare Turnstile** | Session 6A |

#### 📱 LINE Integration — Expand scope

**Spec เดิม:** "LINE Notify (optional) — แจ้งเตือนเจ้าของร้าน"

**Locked ใหม่ (roadmap.md Session 10):**

1. ⚠️ **LINE Notify shutdown 31 มี.ค. 2025** — ใช้ **Messaging API** แทน (decisions.md gotcha)
2. **ไม่ optional อีกต่อไป** — เป็น Session 10 หลักของ project
3. Scope ขยายเยอะ:
   - Owner push (Session 6A code + Session 10A activate)
   - Customer "จองสำเร็จ" Flex message
   - Add OA popup + phone-based linking via booking code
   - Cron reminder T-1 hour
   - Postback confirm button (nice-to-have)
4. Schema เพิ่ม `customers` table + FK ที่ `bookings.customer_id` (Migration 0002)

#### 📅 Timeline — Reality Check

**Spec เดิม:** 2 สัปดาห์ / 54 ชั่วโมง

**Locked ใหม่:**
- **3-4 สัปดาห์** (decisions.md reality check — pace 1-2h/day, มีงานประจำ)
- **MVP live:** Session 9 (~2 สัปดาห์ ex LINE)
- **Full LINE:** Session 10 (~3 สัปดาห์)
- **Portfolio ready:** Session 11 (~3.5 สัปดาห์)

Timeline detail อยู่ใน `roadmap.md`

#### 🗄️ Data Model — Timestamp-based + Auth + Customers

**Spec เดิม:**
```sql
bookings (
  booking_date DATE,     -- '2026-03-15'
  booking_time TEXT,     -- '14:30'
  duration_min INTEGER,
  ...
)
admin_users (id, email, password_hash)
```

**Locked ใหม่:**

| Migration | Contents | When |
|---|---|---|
| 0000 | services / business_hours / bookings / blocked_slots — **timestamp-based** (`starts_at`, `ends_at` unix ms UTC) | Session 3-4 |
| 0001 | Better Auth tables: users / sessions / accounts / verifications | Session 3-4 |
| 0002 | **`customers`** (phone unique, line_user_id nullable) + `bookings.customer_id` FK + status enum add `confirmed_by_customer` | Session 10 |

Key patterns:
- Store UTC / display Asia/Bangkok (via `date-fns-tz`)
- Snapshot pattern: booking เก็บ `price`/`duration_min` ตอน insert (ไม่ recompute)
- Soft delete: services ใช้ `is_active` flag (ไม่ hard delete)
- 5 status enum → 6 หลัง 0002 (`confirmed_by_customer` ใหม่)
- Auth: **สลับจาก JWT** → **session cookie** (Better Auth)
- ไม่มี `admin_users` table — Better Auth generate `users` + `sessions` แทน

#### 🎨 Design Direction — Nebula Spa Cosmic

**Spec เดิม:** Warm spa palette (cream / clay / moss)

**Locked ใหม่ (decisions.md):**
- **Business:** **Nebula Spa** (cosmic branding แทน warm spa)
- **Public:** Dark cosmic theme
- **Admin:** Light practical theme
- **Fonts:** Noto Serif Thai (headings) + IBM Plex Sans Thai (body) — **เหมือน spec เดิม ✅**

#### 🏪 Demo Business — Locked

**Spec เดิม:** 4 ตัวเลือก (ต้อยสปา / Zenith Massage / บ้านนวดจ๊ะเอ๋ / Mala Spa & Wellness)

**Locked:** **Nebula Spa** (decisions.md)

#### ✅ Features จริงที่ implement

**Spec เดิมเขียน:** JWT + email confirmation (ถ้ามีเวลา)

**Locked ใหม่:**
- ❌ **ตัด email confirmation ทิ้ง** — ใช้ LINE Messaging API แทน (Session 10)
- ✅ **เพิ่ม Turnstile** — anti-bot spam ที่ public booking form (Session 6A)
- ✅ **เพิ่ม race condition guard** — booking POST re-check availability inside transaction (Session 6A)
- ✅ **เพิ่ม role-based access** — admin/staff แยก permission (Session 6B/10)

#### 🚀 Next Steps section — Obsolete

**Spec เดิม:** "ต้องตัดสินใจ Stack / Demo business / Design"

**All 3 locked already** — Section นี้ historical only

**Current next step:** ทำ Session 6B ตาม `roadmap.md`

---

**อ่านต่อ:**
- **สำหรับ AI coding partner:** เปิด `roadmap.md` → หา session ปัจจุบัน → follow scope + tasks
- **สำหรับ Fastwork buyer:** สรุปในไฟล์นี้ (Section MVP Features + Design + Data Model) ยัง give correct feel — detail ปัจจุบัน check `README.md` + live demo
- **สำหรับ handover ในอนาคต:** อ่าน spec นี้ก่อน (context ต้นทาง) แล้วค่อย roadmap (current state)
