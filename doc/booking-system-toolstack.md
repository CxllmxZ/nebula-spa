# Booking System — Tool Stack Reference

เอกสารสรุป tools ทั้งหมดที่จะใช้ในโปรเจกต์ Booking System พร้อมรายละเอียดว่าแต่ละตัวทำอะไร ใช้ตอนไหน และมีทางเลือกอื่นอะไรบ้าง

**Stack ระดับสูง:**
```
Next.js 15 (frontend + backend)
    ↓ deploy ผ่าน
@opennextjs/cloudflare
    ↓ ขึ้นไปรัน
Cloudflare Workers
    ↓ อ่าน/เขียน
Cloudflare D1 (SQLite database)
```

---

## 1. Core Framework

### Next.js 15
**คือ:** React framework ที่รวม frontend + backend ในโปรเจกต์เดียวกัน (fullstack)

**ทำอะไร:**
- Server Components / Client Components (React ที่รันบน server ได้)
- App Router — file-based routing (`app/page.tsx` = `/`, `app/admin/page.tsx` = `/admin`)
- Server Actions — เขียน function ที่รัน server-side โดยไม่ต้องสร้าง API endpoint แยก
- Route Handlers — สร้าง API endpoint ที่ `app/api/*/route.ts` เมื่อจำเป็น

**ใช้ในโปรเจกต์นี้:**
- ทั้งหน้าลูกค้า (`/`, `/book`, `/book/[code]`) และหน้าแอดมิน (`/admin/*`)
- ทั้ง form submit ผ่าน Server Actions และ API endpoints บางส่วน

**ทำไมเลือก:** Mainstream ที่สุด, คุณคุ้นแล้ว, portfolio consistency กับตัวอื่น

**ทางเลือก:** Remix / React Router 7, SvelteKit, Astro

**Docs:** https://nextjs.org/docs

---

### TypeScript
**คือ:** JavaScript ที่มี type system

**ทำอะไร:** ตรวจ type ก่อน runtime, ช่วยจับ bug, autocomplete ดีขึ้นมาก

**ใช้ในโปรเจกต์นี้:** ทั้งหมดเป็น `.ts` / `.tsx` ไม่ใช้ `.js`

**Config ที่แนะนำ:** `strict: true` — ห้าม implicit any

**Docs:** https://www.typescriptlang.org/docs

---

## 2. Deploy & Runtime

### Cloudflare Workers
**คือ:** Serverless runtime ที่รันบน edge network 300+ locations ทั่วโลก

**ทำอะไร:**
- รัน JavaScript/TypeScript code แบบ serverless (ไม่มี server ต้อง manage)
- Auto-scale
- Cold start ต่ำมาก (~5ms) เทียบกับ AWS Lambda
- มี "binding" ต่อกับ service อื่นของ Cloudflare (D1, R2, KV) โดยตรง ไม่ต้อง network call

**ใช้ในโปรเจกต์นี้:** เป็น runtime หลักที่ Next.js app จะรันอยู่บน production

**Free tier:** 100,000 requests/วัน (เกินพอสำหรับ demo)

**Docs:** https://developers.cloudflare.com/workers

---

### @opennextjs/cloudflare
**คือ:** Adapter ที่แปลง Next.js build output ให้รันบน Cloudflare Workers ได้

**ทำอะไร:**
- แทน Vercel deployment
- เอา Next.js app build เสร็จแล้ว transform ให้เข้ากับ Workers runtime
- Support Node.js compatible mode (feature ครบกว่า `next-on-pages` เดิม)

**ใช้ในโปรเจกต์นี้:** เอาไว้ deploy ตอน push code ไป production

**Command หลัก:**
```bash
npx @opennextjs/cloudflare build    # build
npx wrangler deploy                  # deploy
```

**หมายเหตุ:** ตัวเดิมชื่อ `@cloudflare/next-on-pages` แต่ Cloudflare ย้าย recommendation มาที่ตัวนี้แล้ว

**Docs:** https://opennext.js.org/cloudflare

---

### Wrangler CLI
**คือ:** Command-line tool ทางการของ Cloudflare สำหรับจัดการ Workers, D1, R2, KV

**ทำอะไร:**
- Deploy Workers
- Manage D1 databases (create, migrate, query)
- Local development ที่จำลอง Cloudflare environment
- ตั้งค่า environment variables + secrets
- Manage bindings ผ่านไฟล์ `wrangler.toml`

**ใช้ในโปรเจกต์นี้:**
```bash
wrangler login                        # ล็อกอินครั้งแรก
wrangler d1 create booking-db         # สร้าง D1 database
wrangler d1 execute booking-db --file schema.sql
wrangler dev                          # local dev
wrangler deploy                       # deploy production
```

**Install:** `npm install -g wrangler`

**Docs:** https://developers.cloudflare.com/workers/wrangler

---

## 3. Database

### Cloudflare D1
**คือ:** SQLite database serverless ที่รันบน Cloudflare edge

**ทำอะไร:**
- Relational database (SQL) ที่ไม่ต้อง manage server
- Read replication ทั่วโลก (query จาก region ใกล้ user)
- Time Travel — restore point-in-time ย้อนได้ 30 วัน
- Zero egress fees
- Native binding ใน Workers (ไม่ต้อง connection string, ไม่ต้อง pool)

**ใช้ในโปรเจกต์นี้:** เก็บ services, bookings, business_hours, blocked_slots, users

**Free tier:** 5 GB storage, ~150M reads/เดือน, ~3M writes/เดือน

**Limitation ที่ต้องรู้:**
- Single-writer architecture — write throughput จำกัด (ไม่กระทบ booking app)
- SQLite dialect — ไม่มี stored procedures, ALTER TABLE จำกัด
- ไม่มี real-time subscription (ต้อง poll เอง หรือใช้ Durable Objects)

**Docs:** https://developers.cloudflare.com/d1

---

### Drizzle ORM
**คือ:** TypeScript-first ORM (Object-Relational Mapper) น้ำหนักเบา

**ทำอะไร:**
- เขียน database query ด้วย TypeScript syntax แทน raw SQL
- Type-safe — return type ของ query จะตรงกับ schema อัตโนมัติ
- Schema-first — declare schema ใน TypeScript แล้ว generate SQL migration
- มี D1 driver ทางการ

**ใช้ในโปรเจกต์นี้:**
```typescript
// declare schema
export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey(),
  code: text('code').notNull().unique(),
  customerName: text('customer_name').notNull(),
  // ...
});

// query
const todaysBookings = await db.select()
  .from(bookings)
  .where(eq(bookings.bookingDate, today));
```

**ทำไมเลือก:**
- Prisma — หนัก, edge runtime มีปัญหา ❌
- Raw SQL — เร็วสุด แต่ไม่มี type safety
- Kysely — เบา แต่ต้องเขียน migration แยก
- **Drizzle — middle ground ที่ balance ที่สุด**

**Docs:** https://orm.drizzle.team

---

## 4. Authentication

### Better Auth
**คือ:** TypeScript-first authentication library รุ่นใหม่ (2024-2026 hot)

**ทำอะไร:**
- Handle email/password, OAuth (Google/GitHub/LINE), magic link, 2FA
- Session management (cookie + database)
- Role & permission system
- Plugin architecture (organizations, admin, passkey ฯลฯ)
- Edge-compatible

**ใช้ในโปรเจกต์นี้:**
- Login แอดมิน (email + password)
- Session cookie
- Middleware ป้องกันหน้า `/admin/*`

**ทำไมเลือก (แทน NextAuth):**
- Type safety ดีกว่ามาก
- API สะอาดกว่า
- Plugin system ยืดหยุ่นกว่า
- Cloudflare integration official (มี `better-auth-cloudflare`)

**Docs:** https://www.better-auth.com

---

### better-auth-cloudflare
**คือ:** Adapter/plugin ที่ทำให้ Better Auth ทำงานกับ Cloudflare D1/KV/R2 ได้

**ทำอะไร:**
- ต่อ Better Auth เข้ากับ D1 ผ่าน Drizzle
- Support ตัว async initialization ที่ Cloudflare Workers ต้องการ
- CLI generate schema + migrate ให้อัตโนมัติ

**ใช้ในโปรเจกต์นี้:** เป็น glue ระหว่าง Better Auth กับ D1

**Repo:** https://github.com/zpg6/better-auth-cloudflare

---

## 5. UI & Styling

### Tailwind CSS
**คือ:** Utility-first CSS framework

**ทำอะไร:** เขียน CSS ผ่าน class name แทนไฟล์ CSS แยก
```jsx
<div className="flex items-center gap-4 rounded-lg bg-cream p-6 shadow-sm">
```

**ใช้ในโปรเจกต์นี้:** Styling ทุก component

**ทำไมเลือก:** Standard ในปัจจุบัน, ทำ prototype เร็ว, มี design tokens ในตัว

**Docs:** https://tailwindcss.com

---

### shadcn/ui
**คือ:** Collection ของ React components ที่ **copy-paste** เข้าโปรเจกต์ ไม่ใช่ npm install

**ทำอะไร:** ให้ Button, Input, Dialog, Calendar, DropdownMenu, Select, Toast ฯลฯ ที่:
- Built ด้วย Radix UI (accessible)
- Styled ด้วย Tailwind
- Copy code เข้า repo → แก้ไขได้เต็มที่ ไม่ผูก version

**ใช้ในโปรเจกต์นี้:**
- Booking form (Input, Select, Calendar, Button)
- Admin dashboard (Table, Dialog, DropdownMenu)
- Confirmation UI (Card, Badge)

**Install:**
```bash
npx shadcn@latest init
npx shadcn@latest add button input calendar dialog
```

**Docs:** https://ui.shadcn.com

---

### Lucide Icons
**คือ:** Icon library open-source (fork ของ Feather Icons)

**ทำอะไร:** ให้ SVG icon 1,400+ ตัว เป็น React components

**ใช้ในโปรเจกต์นี้:** ไอคอนใน UI ทั้งหมด (calendar, user, phone, check ฯลฯ)

**Install:** มากับ shadcn/ui อยู่แล้ว, `npm install lucide-react`

**Usage:**
```jsx
import { Calendar, User, Phone } from 'lucide-react';
<Calendar className="h-4 w-4" />
```

**Docs:** https://lucide.dev

---

### Fonts: Noto Serif Thai + IBM Plex Sans Thai
**คือ:** Google Fonts ที่ support ภาษาไทย

**ใช้ในโปรเจกต์นี้:**
- **Noto Serif Thai** — headings (ให้ feel warm/premium สไตล์สปา)
- **IBM Plex Sans Thai** — body text (อ่านง่าย, modern)

**Setup ใน Next.js:**
```typescript
import { Noto_Serif_Thai, IBM_Plex_Sans_Thai } from 'next/font/google';

const serif = Noto_Serif_Thai({ subsets: ['thai'] });
const sans = IBM_Plex_Sans_Thai({ subsets: ['thai'], weight: ['400', '500', '600'] });
```

**Docs:** https://fonts.google.com

---

## 6. Forms & Validation

### Zod
**คือ:** TypeScript-first schema validation library

**ทำอะไร:**
- Define schema สำหรับ data structure
- Validate ที่ runtime + infer TypeScript type ได้
- ใช้ทั้ง client (form) และ server (API validation)

**ใช้ในโปรเจกต์นี้:**
```typescript
const bookingSchema = z.object({
  customerName: z.string().min(1, 'กรอกชื่อ'),
  customerPhone: z.string().regex(/^0\d{9}$/, 'เบอร์ไม่ถูกต้อง'),
  serviceId: z.number().int().positive(),
  bookingDate: z.string().date(),
  bookingTime: z.string().regex(/^\d{2}:\d{2}$/),
});

type BookingInput = z.infer<typeof bookingSchema>;
```

**Use cases:**
- Validate form input ก่อน submit
- Validate API request body ที่ server
- Type inference สำหรับ Drizzle schema

**Docs:** https://zod.dev

---

### React Hook Form
**คือ:** Form library สำหรับ React ที่เน้น performance (uncontrolled)

**ทำอะไร:**
- Handle form state (values, errors, touched, dirty)
- Integrate กับ Zod ผ่าน `@hookform/resolvers/zod`
- Re-render น้อยกว่า controlled form ทั่วไป

**ใช้ในโปรเจกต์นี้:**
- Booking form ฝั่งลูกค้า
- Service edit form ฝั่งแอดมิน
- Business hours settings form

**Usage:**
```typescript
const form = useForm<BookingInput>({
  resolver: zodResolver(bookingSchema),
});
```

**Docs:** https://react-hook-form.com

---

## 7. Utilities

### date-fns + date-fns-tz
**คือ:** Date manipulation library (function-based, tree-shakable)

**ทำอะไร:**
- Format, parse, compare, add/subtract dates
- Timezone conversion (ผ่าน `date-fns-tz`)
- ทดแทน moment.js ที่ deprecated แล้ว

**ใช้ในโปรเจกต์นี้:**
- Format `2026-03-15` → "15 มีนาคม 2569"
- Compute available slots (`addMinutes`, `isBefore`, `isAfter`)
- Convert UTC ↔ Asia/Bangkok

**Docs:** https://date-fns.org

**ทางเลือก:** Day.js (เบากว่า), Temporal API (ยังไม่ stable)

---

### nanoid
**คือ:** ID generator แบบ URL-safe, ขนาดเล็ก

**ทำอะไร:** สร้าง unique ID ที่ readable กว่า UUID

**ใช้ในโปรเจกต์นี้:**
```typescript
import { customAlphabet } from 'nanoid';
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
// ตัด 0/O/1/I ที่อ่านผิด → ได้ code แบบ "A3F9K2"
```

**Docs:** https://github.com/ai/nanoid

---

## 8. External Services

### LINE Messaging API
**คือ:** API ทางการของ LINE สำหรับส่ง message ผ่าน LINE Official Account

**ทำอะไร:**
- Push message ไปหา user ที่ follow OA
- Reply message ตอบ user
- Broadcast message
- Rich message (buttons, carousel, images)

**ใช้ในโปรเจกต์นี้:**
- แจ้งเจ้าของร้านเมื่อมีจองใหม่
- (Optional) แจ้ง reminder ก่อนถึงคิว 1 ชั่วโมง

**สำคัญ:** LINE Notify **shut down ตั้งแต่ 31 มี.ค. 2025** ต้องใช้ Messaging API เท่านั้น

**Free tier:** 500 push messages/เดือน (พอสำหรับ demo)

**Setup:**
1. สร้าง Channel ใน LINE Developers Console
2. เอา Channel Access Token
3. Follow OA แล้วเอา User ID เจ้าของร้าน
4. Call API `POST https://api.line.me/v2/bot/message/push`

**Docs:** https://developers.line.biz/en/docs/messaging-api

---

### Cloudflare Turnstile
**คือ:** CAPTCHA แบบ privacy-friendly (ทดแทน reCAPTCHA)

**ทำอะไร:**
- ตรวจว่า user เป็นคนจริง ไม่ใช่ bot
- ไม่ต้องกด "select all traffic lights" แบบ reCAPTCHA — เป็น invisible
- ฟรี unlimited

**ใช้ในโปรเจกต์นี้:** ป้องกัน bot spam booking หน้าจอง (สำคัญเพราะเป็น public form)

**Setup:**
1. เพิ่ม site ใน Cloudflare Dashboard → Turnstile
2. เอา site key + secret key
3. Render widget ในหน้า booking form
4. Verify token ที่ Server Action

**Docs:** https://developers.cloudflare.com/turnstile

---

## 9. Dev Tools

### Biome
**คือ:** Linter + Formatter รวมในตัวเดียว (Rust-based, เร็วมาก)

**ทำอะไร:**
- Lint code (แทน ESLint)
- Format code (แทน Prettier)
- เร็วกว่า ESLint 10-20x

**ใช้ในโปรเจกต์นี้:** ตรวจ code style + auto-format ตอน save

**Install:** `npm install --save-dev --save-exact @biomejs/biome`

**Config:** `biome.json` — เลือก preset ได้ (`recommended`)

**ทางเลือก:** ESLint + Prettier (มาตรฐานเดิม, config เยอะกว่า)

**Docs:** https://biomejs.dev

---

## สรุปตาราง

| Layer | Tool | บทบาท |
|---|---|---|
| Framework | Next.js 15 | Full-stack React |
| Language | TypeScript | Type safety |
| Runtime | Cloudflare Workers | Serverless edge |
| Adapter | @opennextjs/cloudflare | Next.js → Workers |
| CLI | Wrangler | Manage Cloudflare |
| Database | Cloudflare D1 | SQLite edge |
| ORM | Drizzle | Type-safe DB queries |
| Auth | Better Auth | Login/session |
| Auth adapter | better-auth-cloudflare | Better Auth + D1 |
| CSS | Tailwind | Utility styling |
| Components | shadcn/ui | Pre-built UI |
| Icons | Lucide | SVG icons |
| Fonts | Noto Serif + IBM Plex Sans Thai | Typography |
| Validation | Zod | Schema + types |
| Forms | React Hook Form | Form state |
| Date | date-fns + date-fns-tz | Date utils |
| ID | nanoid | Booking code |
| Notify | LINE Messaging API | LINE messages |
| Anti-spam | Cloudflare Turnstile | Bot prevention |
| Linter/Formatter | Biome | Code quality |

---

## Learning Path (สำหรับ tool ใหม่)

ถ้าจะเรียนตามลำดับ:

1. **Wrangler + D1** — ทำ tutorial สร้าง D1 database + query
2. **Drizzle** — อ่าน quickstart, ลอง `defineSchema` + `select/insert`
3. **@opennextjs/cloudflare** — clone template `fullstack-next-cloudflare` มาดู
4. **Better Auth + Cloudflare adapter** — follow docs setup แบบ example
5. **Turnstile** — 15 นาทีก็เสร็จ
6. **LINE Messaging API** — คุณคุ้นแล้วจาก SlipScan

Zod, React Hook Form, Tailwind, shadcn — คุณน่าจะคุ้นระดับหนึ่งอยู่แล้ว

---

**Ready to start?** ต่อไปคือตัดสิน:
1. Schema (แก้ตาม TIMESTAMP recommendation)
2. ชื่อร้าน + service list สำหรับ seed
3. Design tokens
4. หรือ skip ไป scaffold project เลย
