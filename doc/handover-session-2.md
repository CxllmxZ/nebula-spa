# Handover — Session 2 (Structure + DB Schema)

**Date:** 21 กรกฎาคม 2026
**Duration:** 2 sessions ต่อกัน
**Scope ที่ตกลง:** structure code + database schema เท่านั้น (ไม่ implement logic, ไม่ Cloudflare setup)

---

## Deliverables

- 31 files สร้างใหม่
- 4 tables Drizzle schema พร้อม indexes + FK + unique constraints
- 6 git commits, clean history
- Type check ผ่านทั้งโปรเจกต์

---

## ที่ทำในลำดับเวลา

### 1. Foundation Cleanup

- ตั้ง PowerShell execution policy → `RemoteSigned`
- Verify Node 22.13, pnpm 10.23, Git 2.28
- ยึด D: HDD ต่อ (SSD C: เก่า — trade off dev speed กับ reliability)
- Windows Terminal (แนะนำแทน CMD)

### 2. Env + gitignore

- `.gitignore` — เพิ่ม cloudflare (`.wrangler/`, `.dev.vars`, `.open-next/`), env exception (`!.env.example`), editor (`.vscode/*` + exceptions), Thumbs.db
- `.env.example` — 5 group secrets (Better Auth, LINE, Turnstile, Drizzle Kit, Admin Seed)
- `.env.local` — copy จาก example + fill `BETTER_AUTH_SECRET` (generated ด้วย PowerShell)

### 3. Scaffold Customization

- `package.json` — เพิ่ม `packageManager: pnpm@10.23.0` + `engines.node: >=22`
- `layout.tsx` — Noto Serif Thai + IBM Plex Sans Thai, metadata Nebula Spa, `lang="th"`
- ลบ Next.js/Vercel SVG assets ทั้ง 5
- แทน default `page.tsx` ด้วย minimal "Coming soon"
- `.vscode/settings.json` + `extensions.json` (Prettier + Tailwind IntelliSense + pretty-ts-errors + errorlens)

### 4. Folder Structure (Phase A)

สร้าง folder tree ทั้งหมด:

```
src/
├── app/
│   ├── (public)/book/[code]/
│   ├── admin/{login,bookings,settings/{services,hours,blocked}}/
│   └── api/{availability,auth/[...all]}/
├── components/{ui,public,admin}/
├── lib/db/queries/
├── actions/
└── types/
scripts/
drizzle/migrations/
```

### 5. Placeholder Files (Phase B) — 18 files

**Public routes (3):**
- `(public)/layout.tsx` — placeholder layout
- `(public)/page.tsx` — moved from `src/app/page.tsx` (minimal "Coming soon")
- `(public)/book/page.tsx` — booking flow placeholder
- `(public)/book/[code]/page.tsx` — **async params syntax (Next 16 requirement)**

**Admin routes (7):**
- `admin/layout.tsx` — light theme layout with header
- `admin/page.tsx` — dashboard placeholder
- `admin/login/page.tsx`
- `admin/bookings/page.tsx`
- `admin/settings/services/page.tsx`
- `admin/settings/hours/page.tsx`
- `admin/settings/blocked/page.tsx`

**API routes (2):**
- `api/availability/route.ts` — real endpoint stub (returns empty slots)
- `api/auth/[...all]/route.ts` — Better Auth catch-all placeholder (returns 501)

**Middleware (1):**
- `src/middleware.ts` — matcher `/admin/:path*`, currently passthrough

**Lib basic (2):**
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `lib/datetime.ts` — Bangkok timezone helpers (placeholder, native Date for now)

**Server Actions (3):**
- `actions/bookings.ts`, `actions/services.ts`, `actions/hours.ts` — all throw "Not implemented"

### 6. Dependencies Installed

**Prod (7):** `drizzle-orm 0.45`, `zod 4`, `nanoid 6`, `date-fns 4`, `date-fns-tz 3`, `clsx`, `tailwind-merge`

**Dev (2):** `drizzle-kit 0.31`, `@cloudflare/workers-types`

**Build scripts approved** (`pnpm-workspace.yaml`):
```yaml
onlyBuiltDependencies:
  - esbuild
  - sharp
  - unrs-resolver
```

### 7. Database Schema (Phase C)

**File:** `src/lib/db/schema.ts`

**4 tables:**

| Table | Highlights |
|---|---|
| `services` | soft delete via `is_active`, `display_order`, snapshot source |
| `business_hours` | unique constraint on `day_of_week`, nullable open/close for closed days |
| `bookings` | timestamp-based (`starts_at`, `ends_at`), snapshot pattern (price/duration), 5-status enum, 3 indexes (time / status / code) |
| `blocked_slots` | timestamp-based เหมือน bookings, 1 index |

**Type exports:** `Service`, `NewService`, `BusinessHour`, `NewBusinessHour`, `Booking`, `NewBooking`, `BlockedSlot`, `NewBlockedSlot` (via `$inferSelect` / `$inferInsert`)

**File:** `src/lib/db/index.ts` — placeholder factory (`throw new Error` จนกว่า Cloudflare setup)

**File:** `drizzle.config.ts` (root) — driver `d1-http`, credentials จาก env

### 8. Extra Skeletons (post-scope, requested)

**Lib (3):**
- `validations.ts` — Zod schemas placeholder (with TODO for each entity)
- `line.ts` — LINE Messaging API wrapper skeleton (⚠️ LINE Notify dead — ต้องใช้ Messaging API)
- `turnstile.ts` — CAPTCHA verify skeleton

**DB queries (3):**
- `queries/services.ts` — CRUD stubs (public + admin)
- `queries/bookings.ts` — createBooking (race condition guard note), stats, filter list stubs
- `queries/availability.ts` — algorithm pseudocode in comments

**Config + docs (3):**
- `scripts/seed.ts` — seed script skeleton with 8 services list embedded (comment)
- `wrangler.toml` — D1 binding placeholder + compat flags (`nodejs_compat`, date `2026-01-01`)
- `open-next.config.ts` — commented out (dep ยังไม่ install), จะ uncomment ตอน chat หน้า

**README.md** — portfolio-quality: tech stack table, features, architecture, setup instructions

---

## Git History

```
xxxxxxx docs: add session 2 handover (structure + schema phase)
3b5887a feat: add remaining lib skeletons + cloudflare config + README
xxxxxxx feat: scaffold folder structure + database schema
a5630a4 chore: customize scaffold for Nebula Spa
2dc408f chore: add cloudflare/dev.vars to gitignore + env template
4ad71e5 Initial commit from Create Next App
```

---

## Key Decisions ที่ทำในระหว่างทาง

### Deviate จาก decisions.md

- **Next.js 16** (แทน 15) — พร้อม Cloudflare official support, breaking change `async params` handle ในโค้ดใหม่
- **Prettier** (แทน Biome ชั่วคราว) — เพื่อไม่ต้อง install ทันที ค่อย migrate ภายหลัง

### Reaffirm decisions.md

- Timestamp-based (UTC) — ไม่ใช่ DATE+TEXT
- 30-min slot granularity (comment ใน seed script)
- Snapshot price/duration on booking
- Soft delete services via `is_active`
- 5 booking statuses (pending/confirmed/completed/cancelled/no-show)
- Fixed hours storage per day-of-week

### Discoveries + Fixes

- **PowerShell UTF-8 display bug** — `cat` แสดง `â€"` แต่ไฟล์จริง UTF-8 (verify ด้วย Node — ไม่ใช่ปัญหาไฟล์)
- **PNPM 10 approve-builds gotcha** — ถ้าเผลอ Enter ก่อนเลือก → package โดน ignore ถาวร ต้องแก้ `pnpm-workspace.yaml` โดยตรง
- **Ghost page.tsx bug** — Step 3.4.4 save ไม่จริง → welcome page ค้าง commit → เจอตอน move ไป `(public)/` → แก้ที่ปลายทาง
- **Middleware Next 16 caveat** — `async_hooks` import กระทบ Cloudflare Workers → note ให้ใส่ `export const runtime = 'edge'` ตอน implement
- **Next 16 async params** — `params: Promise<{...}>` ต้อง `await` ใน dynamic routes

---

## Files Structure Snapshot

```
D:\n8n\nebula-spa\
├── .env.example
├── .env.local (gitignored)
├── .gitignore (updated)
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── docs/
│   └── handover-session-2.md  ← this file
├── drizzle/
│   └── migrations/            (empty, drizzle-kit will populate)
├── public/                    (empty — SVG assets deleted)
├── scripts/
│   └── seed.ts
├── src/
│   ├── actions/
│   │   ├── bookings.ts
│   │   ├── services.ts
│   │   └── hours.ts
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── book/
│   │   │       ├── page.tsx
│   │   │       └── [code]/page.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── bookings/page.tsx
│   │   │   └── settings/
│   │   │       ├── services/page.tsx
│   │   │       ├── hours/page.tsx
│   │   │       └── blocked/page.tsx
│   │   ├── api/
│   │   │   ├── availability/route.ts
│   │   │   └── auth/[...all]/route.ts
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   └── layout.tsx         (Thai fonts + Nebula metadata)
│   ├── components/
│   │   ├── ui/                (empty, shadcn later)
│   │   ├── public/            (empty)
│   │   └── admin/             (empty)
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts      (4 tables)
│   │   │   ├── index.ts       (placeholder factory)
│   │   │   └── queries/
│   │   │       ├── services.ts
│   │   │       ├── bookings.ts
│   │   │       └── availability.ts
│   │   ├── utils.ts
│   │   ├── datetime.ts
│   │   ├── validations.ts
│   │   ├── line.ts
│   │   └── turnstile.ts
│   ├── types/                 (empty)
│   └── middleware.ts
├── drizzle.config.ts
├── open-next.config.ts        (commented out)
├── wrangler.toml              (placeholder)
├── package.json               (packageManager + engines)
├── pnpm-workspace.yaml        (onlyBuiltDependencies)
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── AGENTS.md
└── README.md                  (portfolio-quality)
```

---

## Next Chat Priority

1. **Cloudflare account** ใหม่ (Provider ใหม่ per decisions.md)
2. `wrangler login` + `wrangler d1 create nebula-spa-db`
3. Cloudflare API token (D1:Edit) — สำหรับ Drizzle Kit
4. Fill `.env.local` + update `wrangler.toml` (database_id)
5. `pnpm add @opennextjs/cloudflare` + uncomment `open-next.config.ts`
6. Update `src/lib/db/index.ts` — replace placeholder with `getCloudflareContext()`
7. `pnpm drizzle-kit generate` + apply migration (local + remote)
8. Implement seed script — populate 8 services + 15-20 bookings
9. First deploy test — `pnpm exec opennextjs-cloudflare build` + `wrangler dev`

**Estimated time:** 2-3 ชั่วโมง

---

## Reference Files

- `booking-system-spec.md` — original scope
- `booking-system-toolstack.md` — tool detail
- `booking-system-workflow.md` — algorithms + user journey
- `booking-system-decisions.md` — locked decisions
- `handover-session-2.md` — this file

---

## Session 3 Kickoff Message

```
Scaffold ครบแล้ว 6 commits — folder structure + Drizzle schema + placeholder ทุก module
มาทำ Cloudflare setup + implement Module 2 (Database)

Current state:
- Node 22 + pnpm 10 + Windows Terminal ready
- Next.js 16 + Cloudflare Workers stack pinned
- 4 tables schema (services, business_hours, bookings, blocked_slots) — awaiting D1 create + migrate
- All lib/action/query files are placeholder stubs waiting for logic

ดู docs/handover-session-2.md สำหรับรายละเอียดทั้งหมด
```
