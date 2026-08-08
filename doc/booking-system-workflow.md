# Booking System — Workflow

เอกสารอธิบาย flow การทำงานของระบบทั้งฝั่งลูกค้า, ฝั่งแอดมิน และ algorithm เบื้องหลัง

---

## 1) Public Booking Flow (ลูกค้าจอง)

```
/  Landing page
    │  ดูร้าน + services + ปุ่ม "จองเลย"
    ▼
/book  Step 1: เลือก Service
    │  [นวดไทย 60 นาที ฿300] [นวดน้ำมัน 90 นาที ฿500] ...
    ▼
Step 2: เลือกวัน
    │  Calendar (ปิด: วันที่ปิดร้าน / วันเต็ม / วันย้อนหลัง)
    ▼
Step 3: เลือกเวลา
    │  ─┐
    │   │ [Server] คำนวณ available slots:
    │   │   1. ดึง business_hours ของ day-of-week
    │   │   2. ดึง existing bookings วันนั้น (status ≠ cancelled)
    │   │   3. ดึง blocked_slots วันนั้น
    │   │   4. Generate 30-min grid → filter slots ที่ไม่ overlap
    │  ─┘
    │  Show [10:00] [10:30] [11:00] ... (เฉพาะที่ว่าง)
    ▼
Step 4: กรอกข้อมูล
    │  ชื่อ + เบอร์ + Turnstile
    │  (React Hook Form + Zod validate)
    ▼
Submit → Server Action: createBooking()
    │  ─┐
    │   │ Transaction (D1):
    │   │   1. Re-check availability (race condition guard)
    │   │   2. Generate code (nanoid 6-char)
    │   │   3. INSERT bookings
    │   │   4. Fire-and-forget: LINE push แจ้งเจ้าของร้าน
    │  ─┘
    ▼
/book/[code]  Confirmation
    │  Show: code + service + วัน + เวลา + ราคา
    │  Actions: [เพิ่มลง Google Calendar] [Add LINE OA]
    ▼
Done ✅
```

### รายละเอียดแต่ละ Step

**Step 1 — เลือก Service**
- Query: `SELECT * FROM services WHERE is_active = 1 ORDER BY display_order`
- Show: ชื่อ, ราคา, ระยะเวลา, description สั้นๆ
- Cache ได้ (services ไม่เปลี่ยนบ่อย)

**Step 2 — เลือกวัน**
- Calendar UI (shadcn/ui Calendar component)
- Disable วัน:
  - ย้อนหลัง (`< today`)
  - วันที่ `is_closed = true` ใน business_hours
  - วันเต็ม (optional — คำนวณล่วงหน้าถ้าอยาก) 
- ข้อจำกัด: ให้จองล่วงหน้าได้ไม่เกิน 30 วัน (business rule)

**Step 3 — เลือกเวลา**
- Trigger API call: `GET /api/availability?service_id=X&date=Y`
- Return: array of ISO time strings ที่ว่าง
- Show เป็น grid ปุ่ม → tap เพื่อเลือก
- Loading state ระหว่างรอ

**Step 4 — กรอกข้อมูล**
- Field: `customerName` (required, min 1 char), `customerPhone` (required, regex `/^0\d{9}$/`)
- Cloudflare Turnstile widget (invisible)
- Submit disabled ถ้า form invalid

**Submit — createBooking Server Action**
```typescript
async function createBooking(input: BookingInput) {
  // 1. Validate Turnstile token
  await verifyTurnstile(input.turnstileToken);
  
  // 2. Re-check availability (guard race condition)
  const conflict = await db.select().from(bookings).where(
    and(
      eq(bookings.serviceDate, input.date),
      // overlap condition
      lt(bookings.startsAt, requestedEnd),
      gt(bookings.endsAt, requestedStart),
      notInArray(bookings.status, ['cancelled', 'no-show'])
    )
  );
  if (conflict.length > 0) throw new Error('SLOT_TAKEN');
  
  // 3. Generate code + insert
  const code = generateCode(); // nanoid 6-char
  await db.insert(bookings).values({ code, ...input });
  
  // 4. Fire-and-forget LINE notify
  sendLineNotify(booking).catch(console.error);
  
  redirect(`/book/${code}`);
}
```

---

## 2) Admin Flow (เจ้าของร้าน)

```
/admin/login
    │  email + password
    │  Better Auth → set session cookie
    ▼
/admin  Dashboard
    │  ─┬─ Stat cards (วันนี้ / สัปดาห์ / เดือน / รายได้)
    │   ├─ Calendar view (จุดแสดง booking)
    │   └─ Booking ล่าสุด 5 รายการ
    │
    ├─→ /admin/bookings
    │       │  Table + filter (date / status / service)
    │       │  Search (ชื่อ / เบอร์ / code)
    │       ▼
    │       Click row → Detail modal
    │       │  [Change status ▼] confirmed / completed / cancelled / no-show
    │       │  ─→ Server Action: updateBookingStatus()
    │
    ├─→ /admin/settings/services
    │       │  Table: services
    │       │  [+ เพิ่มบริการ] → dialog form (ชื่อ / เวลา / ราคา)
    │       │  [แก้ไข] / [ปิด/เปิด] per row
    │       │  ─→ Server Actions: createService, updateService
    │
    └─→ /admin/settings/hours
            │  7 rows (อาทิตย์-เสาร์)
            │  each: [เปิด/ปิด] [เวลาเปิด] [เวลาปิด]
            │  ─→ Server Action: updateBusinessHours
```

### รายละเอียดแต่ละหน้า

**`/admin/login`**
- Form: email + password
- Better Auth handle → set session cookie
- Redirect → `/admin`

**Middleware (`middleware.ts`)**
- Match: `/admin/*` (ยกเว้น `/admin/login`)
- Check session ผ่าน Better Auth
- ถ้าไม่มี → redirect `/admin/login`

**`/admin` Dashboard**
- Stat cards:
  - `จองวันนี้` = COUNT bookings WHERE date = today
  - `สัปดาห์นี้` = COUNT WHERE date BETWEEN monday..sunday
  - `เดือนนี้` = COUNT WHERE MONTH(date) = current
  - `รายได้ประมาณ` = SUM(price) WHERE status = 'completed' AND MONTH = current
- Calendar view: bookings ในเดือนนี้ เห็นเป็นจุด/สี ตาม status
- Recent: SELECT ... ORDER BY created_at DESC LIMIT 5

**`/admin/bookings`**
- Table columns: code, ชื่อลูกค้า, เบอร์, service, วัน, เวลา, status, action
- Filters:
  - Date range picker
  - Status multi-select
  - Service dropdown
- Search input → search across name/phone/code
- Server-side pagination (ถ้า data เยอะ)
- Click row → modal show detail + change status

**`/admin/settings/services`**
- CRUD services
- Fields: ชื่อ, description, duration_min, price, display_order, is_active
- Toggle is_active = ซ่อนจาก public โดยไม่ต้องลบ
- ป้องกันลบ service ที่มี booking → ให้ soft delete/inactive แทน

**`/admin/settings/hours`**
- 7 rows fixed (Sunday=0 ... Saturday=6)
- Toggle is_closed + time picker เปิด/ปิด
- Save all → 1 transaction

---

## 3) Behind-the-scenes: Availability Algorithm

```
คำนวณ available slots สำหรับ (service_id, date):

INPUT: service_id, date
   │
   ▼
1. ดึงข้อมูล:
   • service.duration_min
   • business_hours[day_of_week] → open_time, close_time, is_closed
   • bookings WHERE date=? AND status IN ('pending','confirmed')
   • blocked_slots WHERE date=?
   │
   ▼
2. ถ้า is_closed → return []
   │
   ▼
3. Generate candidate slots (grid 30 นาที):
   [open_time, open_time+30, open_time+60, ...]
   │
   ▼
4. Filter สำหรับแต่ละ candidate:
   ┌────────────────────────────────────────────┐
   │ end = candidate + duration_min             │
   │                                            │
   │ ❌ ถ้า end > close_time                    │
   │ ❌ ถ้า overlap booking:                    │
   │      candidate < b.end AND end > b.start   │
   │ ❌ ถ้า overlap blocked_slot                │
   │ ❌ ถ้าเป็นวันนี้ + candidate < now         │
   │ ✅ else: keep                              │
   └────────────────────────────────────────────┘
   │
   ▼
5. Return available slots
```

### Pseudocode

```typescript
async function getAvailableSlots(
  serviceId: number,
  date: string  // 'YYYY-MM-DD'
): Promise<string[]> {
  const service = await getService(serviceId);
  const dayOfWeek = new Date(date).getDay(); // 0-6
  const hours = await getBusinessHours(dayOfWeek);
  
  if (hours.is_closed) return [];
  
  const existingBookings = await db.select()
    .from(bookings)
    .where(and(
      eq(bookings.serviceDate, date),
      inArray(bookings.status, ['pending', 'confirmed'])
    ));
  
  const blockedSlots = await getBlockedSlots(date);
  
  const candidates = generateGrid(
    hours.open_time,
    hours.close_time,
    30 // 30-min interval
  );
  
  return candidates.filter(candidate => {
    const end = addMinutes(candidate, service.duration_min);
    
    // Must fit in business hours
    if (end > hours.close_time) return false;
    
    // Must not overlap existing bookings
    const hasOverlap = existingBookings.some(b =>
      candidate < b.endsAt && end > b.startsAt
    );
    if (hasOverlap) return false;
    
    // Must not overlap blocked slots
    const isBlocked = blockedSlots.some(bs =>
      candidate < bs.endTime && end > bs.startTime
    );
    if (isBlocked) return false;
    
    // If today, must be in future
    if (date === today() && candidate < now()) return false;
    
    return true;
  });
}
```

### Edge Cases ที่ Algorithm ต้องรอบ

| Case | Behavior |
|---|---|
| Service 90 min + close 21:00 | Slot สุดท้ายต้อง ≤ 19:30 |
| Booking existing 14:00-15:00 + requested 13:30-14:30 | Overlap → block |
| Blocked slot 14:00-15:00 | ทุก candidate ที่ overlap → block |
| วันนี้ + candidate 14:00 + now 14:30 | Past → block |
| 2 คน submit slot เดียวกันพร้อมกัน | Race condition → guard ด้วย re-check ใน transaction |

---

## Key Design Decisions

| Decision | เหตุผล |
|---|---|
| Re-check availability ตอน submit | Race condition — 2 คนกดพร้อมกัน slot สุดท้าย |
| LINE notify แบบ fire-and-forget | ห้ามให้ notification fail แล้ว rollback booking |
| Multi-step ไม่ใช่ single form | UX ดีกว่า + validate ทีละ step |
| Turnstile ใน public form | Bot spam booking เป็นปัญหาจริงในไทย |
| Snapshot price/duration ใน booking | ถ้า service เปลี่ยนราคา booking เก่าต้องคงราคาเดิม |
| Store TIMESTAMP (starts_at, ends_at) | Query overlap ง่ายกว่า DATE+TIME แยก |
| Store UTC, display Asia/Bangkok | Standard practice + scalable ถ้าต่อยอด |
| 30-min slot granularity | ยืดหยุ่นสุด — service 30/60/90/120 min ใช้ grid เดียวกันได้ |
| Fixed 5 statuses (pending/confirmed/completed/cancelled/no-show) | คลุมทุก state ธุรกิจนวด/สปา |
| Soft delete services (is_active) | ป้องกัน orphan bookings ที่ reference service ที่ลบไปแล้ว |

---

## API Endpoints Overview

### Public
- `GET /api/services` — list active services
- `GET /api/availability?service_id=X&date=Y` — available slots
- `POST /api/bookings` (Server Action) — create booking
- `GET /book/[code]` — booking confirmation page

### Admin (protected)
- `GET /admin/api/bookings?filter=...` — list with filters
- `POST /admin/api/bookings/[id]/status` — update status
- `POST /admin/api/services` — CRUD services
- `POST /admin/api/hours` — update business hours
- `POST /admin/api/blocked-slots` — CRUD blocked slots

### Webhooks (optional future)
- `POST /api/webhooks/line` — receive LINE messages (สำหรับ reply)

---

## User Journey Summary

### ลูกค้า (Happy path)
1. Google search "ต้อยสปา จอง" → เข้า landing page
2. เห็น services + ราคา → กด "จองเลย"
3. เลือก "นวดไทย 60 นาที ฿300"
4. เลือกวันเสาร์
5. เลือก 14:00
6. กรอกชื่อ + เบอร์ → Submit
7. เห็น booking code "A3F9K2" + รายละเอียด
8. บันทึกลง Google Calendar

**Total time:** ~90 วินาที

### เจ้าของร้าน (Happy path)
1. LINE เด้ง: "จองใหม่! A3F9K2 นวดไทย 60 นาที เสาร์ 14:00 คุณสมชาย"
2. เปิด `/admin/bookings` → เห็น booking pending
3. เปลี่ยน status เป็น "confirmed"
4. วันเสาร์ 14:00 ลูกค้ามา → เปลี่ยนเป็น "completed"

---

**Next:** ตัดสิน schema (TIMESTAMP recommendation) หรือ scaffold project?
