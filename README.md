# Nebula Spa — Booking System

ระบบจองออนไลน์สำหรับธุรกิจนวด/สปา ทำเป็น demo + reusable template
สำหรับรับงานลูกค้าจริงในอนาคต

**Status:** 🚧 Work in progress — scaffold complete, feature implementation ongoing

---

## Tech Stack

| Layer      | Tool                                   |
| ---------- | -------------------------------------- |
| Framework  | Next.js 16 (App Router) + React 19.2   |
| Language   | TypeScript 5.9 (strict mode)           |
| Runtime    | Cloudflare Workers (edge)              |
| Adapter    | @opennextjs/cloudflare                 |
| Database   | Cloudflare D1 (SQLite at edge)         |
| ORM        | Drizzle 0.45 (schema-first, type-safe) |
| Auth       | Better Auth (single admin)             |
| Validation | Zod 4                                  |
| Styling    | Tailwind CSS 4 + shadcn/ui             |
| Fonts      | Noto Serif Thai + IBM Plex Sans Thai   |
| Anti-spam  | Cloudflare Turnstile                   |
| Notify     | LINE Messaging API                     |

---

## Features

### Public — ลูกค้าจอง

- Landing page + service catalog
- Multi-step booking (service → date → time → info → confirm)
- Real-time slot availability (business hours + existing bookings + blocked slots)
- Bot protection via Cloudflare Turnstile
- Booking confirmation with unique code + Google Calendar link

### Admin — เจ้าของร้าน

- Dashboard: today/week/month stats + revenue + calendar view
- Booking list with filters (date/status/service) + search
- Booking status management (pending → confirmed → completed / cancelled / no-show)
- Services CRUD (name, price, duration, active state)
- Business hours (7-day weekly schedule)
- Blocked slots (special closures — holidays, training)

---

## Architecture

\`\`\`
Customer flow:
Browser → Next.js (App Router) → Server Action → Drizzle → D1

Admin flow:
Browser → Middleware (Better Auth) → Server Action → Drizzle → D1

Notifications:
Server Action → LINE Messaging API → Shop owner's LINE
\`\`\`

**Key design decisions:**

- **Timestamp-based bookings** (UTC in DB, Asia/Bangkok in UI) — clean overlap queries
- **Race condition guard** — re-check availability inside transaction to prevent double-booking
- **Snapshot pattern** — booking stores price/duration at time of booking, immune to service updates
- **Soft delete services** — via \`is_active\` flag, prevents orphan bookings
- **30-min slot granularity** — flexible enough for 30/45/60/90 min services

See \`docs/\` for detailed specs, workflow, and design decisions.

---

## Local Development

### Prerequisites

- Node.js ≥ 22 (LTS)
- pnpm ≥ 10
- Cloudflare account (for D1 database)

### Setup

\`\`\`bash

# 1. Install dependencies

pnpm install

# 2. Copy env template + fill in values

cp .env.example .env.local

# Edit .env.local with your credentials (see comments in file)

# 3. Create D1 database

wrangler d1 create nebula-spa-db

# Copy the database_id into wrangler.toml

# 4. Generate + apply migrations

pnpm drizzle-kit generate
wrangler d1 execute nebula-spa-db --local --file=drizzle/migrations/0000\_\*.sql

# 5. Seed mock data

pnpm tsx scripts/seed.ts

# 6. Run dev server

pnpm dev
\`\`\`

Open http://localhost:3000

---

## Deployment

\`\`\`bash

# Set production secrets

wrangler secret put BETTER_AUTH_SECRET
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_OWNER_USER_ID
wrangler secret put TURNSTILE_SECRET_KEY

# Apply migrations to remote D1

wrangler d1 execute nebula-spa-db --remote --file=drizzle/migrations/0000\_\*.sql

# Build + deploy

pnpm run deploy
\`\`\`

Live at: TBD (link when live)

---

## Project Structure

\`\`\`
src/
├── app/
│ ├── (public)/ Dark cosmic-themed public site
│ │ ├── page.tsx Landing
│ │ └── book/
│ │ ├── page.tsx Booking flow
│ │ └── [code]/ Confirmation
│ ├── admin/ Light practical admin panel
│ │ ├── page.tsx Dashboard
│ │ ├── login/
│ │ ├── bookings/ List + filter
│ │ └── settings/ Services, hours, blocked slots
│ └── api/
│ ├── availability/ Time slot calculation
│ └── auth/[...all]/ Better Auth handler
├── components/
│ ├── ui/ shadcn/ui primitives
│ ├── public/ Landing, ServiceCard, TimeSlotGrid
│ └── admin/ DashboardStats, BookingsTable
├── lib/
│ ├── db/
│ │ ├── schema.ts Drizzle table definitions
│ │ ├── index.ts DB client factory
│ │ └── queries/ Reusable query functions
│ ├── auth.ts Better Auth config
│ ├── validations.ts Zod schemas
│ ├── line.ts LINE Messaging wrapper
│ ├── turnstile.ts CAPTCHA verification
│ ├── datetime.ts Timezone helpers (Asia/Bangkok)
│ └── utils.ts cn() and shared utilities
├── actions/ Server Actions
└── middleware.ts /admin/\* auth protection
\`\`\`

---

## License

MIT
