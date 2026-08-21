# LINE Integration Plan — Session 10

**Status:** 📋 Planning complete, implementation pending
**Planning done:** Day 25 (extended discussion, ~3h)
**Implementation target:** Session 10 (~6-10h)
**Prerequisite:** Session 9 deploy done (need production URL for LIFF endpoint registration)

---

## Executive Summary

Add LINE integration to Nebula Spa booking system, allowing customers to:
1. Authenticate via LIFF (LINE Frontend Framework) → link `line_user_id` to their booking
2. Add spa's Official Account as friend → enable push notifications
3. Receive Flex message confirmation reminders 6h before appointment
4. Confirm/cancel bookings via LINE

**Owner benefits:**
- Reduced no-shows (dual verification for LINE-connected customers)
- Direct communication channel with customers
- Reminder push (currently console-logged only)

**Customer benefits:**
- Automated reminders on their preferred channel
- Cancel/confirm without calling
- 10% discount promo (optional business decision)

---

## Locked Decisions (Day 25)

| Decision | Choice | Rationale |
|---|---|---|
| Status flow for LINE customers | Two-tier: no-LINE=confirmed, LINE=pending | Use available channels wisely — if we can reach them, ask for confirmation |
| Link mechanism | **LIFF Flavor 2** (SDK in web page) | User stays in web context, auth via LINE OAuth redirect (5-10s once), then automatic |
| Flow order | **2-step: Auth → Add Friend** (separate) | Auth ≠ Add Friend in LINE API; must handle both |
| Security level | **Level 2** (code + expire 48h + rate limit) | Balanced for spa/wellness (low-risk transactions) |
| No-response handling | **Stay pending** — owner manual decide | Safer than auto-cancel; human judgment beats algorithm |
| Slot blocking (pending) | **Block** | Session 6 availability query already blocks all statuses except cancelled/no-show — no code change needed |
| UX pattern | **3-step unlock** (matches booking flow 8C) | Consistency + implemented already in 8G |

---

## Architecture: Two-Tier Status Model

**Non-LINE booking flow (existing):**
```
Customer submit form (Turnstile only)
  ↓
INSERT booking status = "confirmed"
  ↓
Slot blocked · booking done · trust the customer
```
- No further verification (we have no channel to reach them)
- Turnstile is sufficient anti-bot
- Matches industry norm (StyleSeat, Booksy, Fresha)

**LINE-connected booking flow (Session 10 addition):**
```
Customer submit form (Turnstile) → status = "confirmed"
  ↓
Confirmation page shows LineConnectCard (Step 01)
  ↓
Customer clicks "เชื่อม LINE"
  ↓
LIFF auth → get userId → POST /api/line/link
  ↓
Backend:
  1. UPSERT customers (phone, name, line_user_id)
  2. UPDATE booking SET customer_id + status = "pending"
     (only if T-6h > now — else skip status downgrade)
  3. Send LINE ack: "รอยืนยันก่อนถึงเวลา"
  ↓
UI transitions to Step 02 (Add Friend)
  ↓
Customer adds @nebulaspa OA as friend
  ↓
Wait until T-6h before appointment
  ↓
Cron sends Flex message with [ยืนยัน] [ยกเลิก] buttons
  ↓
Customer taps:
  - [ยืนยัน] → status = "confirmed"
  - [ยกเลิก] → status = "cancelled" + slot released
  - No response → wait 1h → send retry once
  - Still no response → stay pending → owner sees "รอยืนยัน (ไม่ตอบ 2 ครั้ง)"
```

**Rationale for two-tier:**
- Non-LINE: we have no way to remind them, so auto-confirm and let them show up
- LINE: we CAN reach them, so we use that capability for dual-verification
- Not about trust level — about capability match

---

## LIFF vs Alternatives Analysis

### The core question
How to link customer's LINE `user_id` to a booking record after they've already booked on web (with no LINE session).

### Options considered

**Pattern 1: Deep link + text message**
- URL: `https://line.me/R/oaMessage/@nebulaspa/?A3F9K2`
- Opens LINE app → auto-add OA → pre-fill code in chat → user taps Send
- Webhook receives message → extract code → link user_id
- **Rejected:** User completely leaves web context, must manual return tab

**Pattern 2: LIFF Flavor 1 (LIFF URL)**
- URL: `https://liff.line.me/{LIFF_ID}`
- On mobile: opens LINE app in-app browser rendering your page
- **Rejected:** Still bounces to LINE app fully

**Pattern 2': LIFF Flavor 2 (SDK in own web page)** ✅ **CHOSEN**
- LIFF SDK loaded in confirmation page
- Call `liff.init()` → `liff.login()` → `liff.getProfile()`
- Auth: redirects briefly (5-10s) to LINE for OAuth grant, then returns to your page
- Get `userId` directly in JavaScript → POST to backend
- **Chose because:** User stays in web context; auth redirect is like Google Login pattern; get userId synchronously in JS

**Pattern 3: LINE Login OAuth (manual)**
- Full custom OAuth flow with state parameter
- **Rejected:** Overkill, more setup than LIFF for same result

### LIFF Flavor 2 behavior details

**On mobile with LINE app installed:**
- First time: brief LINE app popup for auth grant (5-10s)
- Subsequent: instant (session cached)
- Returns automatically to your web page

**On mobile without LINE app:**
- LINE Login form in browser (email/password or QR)
- Redirects back to your page

**On desktop:**
- LINE Login page with QR code option (scan from mobile LINE)
- Redirects back after auth

**All cases: user ends up back on your web page with `liff.getProfile().userId` available synchronously**

---

## Auth vs Add Friend — Two Separate Things

Common misunderstanding: "LIFF auth" adds friend automatically. **It doesn't.**

| Action | Purpose | LINE API |
|---|---|---|
| **LINE Auth** (LIFF) | Get `user_id` to identify who they are | OAuth via `liff.login()` |
| **Add Friend** (follow OA) | Enable push messages to them | User must tap "Add" button in LINE app |

**Critical:** Even if we have `user_id`, `line.pushMessage(userId)` returns `403 "user not friend"` if they haven't added the OA.

**Therefore: 2-step flow is mandatory** — auth alone is insufficient for push notifications.

---

## Retroactive Link Mechanism

**The identity problem:** How do we prove that the LINE user linking = the person who booked?

**Answer for Nebula Spa:** Code + 48h expiration + rate limit (Security Level 2)

### Flow
```
1. Customer books → gets code A3F9K2 (unique 6-char)
2. Booking saved to DB with code
3. Confirmation page loads with code in URL: /book/A3F9K2
4. Customer clicks "เชื่อม LINE" on LineConnectCard
5. LIFF SDK → OAuth → returns userId
6. Browser POSTs: /api/line/link { bookingCode: "A3F9K2", lineUserId: "U123..." }
7. Backend:
   a. Check code exists + not expired (< 48h from booking creation)
   b. Rate limit: max 5 link attempts per hour per lineUserId
   c. UPSERT customer by phone (from booking) with line_user_id
   d. Link booking.customer_id to customer
   e. If T-6h > now → downgrade status "confirmed" → "pending"
   f. Return success + trigger Step 02 UI
```

### Attack surface

**Threat:** Alice steals Bob's booking code → links her LINE to Bob's booking.

**Impact:**
- Bob won't receive LINE reminders
- Alice could tap "cancel" via Flex → Bob's booking cancelled
- Bob shows up, confused, calls shop

**Mitigations in place:**
- Code visible only on Bob's confirmation page (URL knowledge required)
- Code expires 48h after creation (limits sharing window)
- Rate limit 5/hour prevents brute force
- Owner has audit log (can restore + investigate)

**Attack cost vs damage:** 1 customer complaint. Not catastrophic. Acceptable for spa/wellness (low-risk domain).

### Security level trade-off table

| Level | Approach | Security | Friction | Effort |
|---|---|---|---|---|
| 1 | Code only | ⭐ | ⭐ low | ⭐ low |
| **2** | **Code + expire 48h + rate limit** ✅ | ⭐⭐ | ⭐ low | ⭐⭐ med |
| 3 | Code + phone last 4 digits | ⭐⭐⭐ | ⭐⭐ med | ⭐⭐ med |
| 4 | Phone full verification | ⭐⭐⭐⭐ | ⭐⭐⭐ high | ⭐⭐⭐ high |
| 5 | LINE Login OAuth cryptographic | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ high | ⭐⭐⭐⭐ very high |

**Chose Level 2** — matches spa/wellness low-risk profile. Upgrade to Level 3 later if abuse observed.

---

## Backend Endpoints Needed

### `POST /api/line/link`

**Request:**
```json
{
  "bookingCode": "A3F9K2",
  "lineUserId": "U1a2b3c4d5..."
}
```

**Handler logic:**
```typescript
// 1. Validate input (Zod)
// 2. Rate limit check: max 5 attempts/hour per lineUserId
//    → 429 if exceeded
// 3. Lookup booking by code
//    → 404 if not found
// 4. Check code age
//    → 410 if > 48h from createdAt
// 5. UPSERT customer:
//    - SELECT customer WHERE phone = booking.customerPhone
//    - if exists: UPDATE line_user_id
//    - else: INSERT (phone, name, line_user_id)
// 6. UPDATE booking SET customer_id = customer.id
// 7. If (booking.startsAt - now > 6h):
//    - UPDATE booking SET status = 'pending'
//    - Send LINE push: "รอยืนยันก่อนถึงเวลา"
// 8. Return { success: true, isFriend: <check via LINE profile API> }
```

**Response:**
```json
{
  "success": true,
  "isFriend": false,
  "addFriendUrl": "https://line.me/R/ti/p/@nebulaspa"
}
```

**Errors:**
- 400 — Invalid input (Zod)
- 404 — Booking not found
- 410 — Code expired (> 48h)
- 429 — Rate limit exceeded
- 500 — Internal error

---

### `GET /api/line/status?bookingCode=X`

**Purpose:** Frontend queries on confirmation page load to determine which state to render.

**Response:**
```json
{
  "authed": true,       // customer.line_user_id exists for this booking
  "isFriend": false,    // whether OA follows check succeeds
  "bookingStatus": "pending"
}
```

**Handler logic:**
```typescript
// 1. Lookup booking with join to customer
// 2. authed = customer.line_user_id != null
// 3. If authed:
//    - Try GET https://api.line.me/v2/bot/profile/{userId}
//    - 200 → isFriend = true
//    - 404 → isFriend = false (added then blocked, or never added)
// 4. Return state
```

Used by frontend to render:
- `authed=false` → State 1 (Auth active, Add Friend locked)
- `authed=true, isFriend=false` → State 2 (Auth complete, Add Friend active)
- `authed=true, isFriend=true` → State 3 (both complete)

---

### `POST /api/webhooks/line`

**Purpose:** Receive events from LINE (follow, unfollow, message, postback from Flex buttons).

**Event types to handle:**

**follow** — User adds OA as friend
```
Send welcome message with next steps
```

**unfollow** — User blocks OA (idempotent, log only)
```
Mark customer.line_notify_enabled = false
```

**postback** — User taps Flex message button
```json
{
  "type": "postback",
  "source": { "userId": "U123..." },
  "postback": {
    "data": "action=confirm&bookingId=42"
  }
}
```
- Parse action + bookingId
- Verify booking.customer.line_user_id === source.userId (security)
- If confirm: UPDATE booking SET status = "confirmed", reply "ยืนยันเรียบร้อย"
- If cancel: UPDATE booking SET status = "cancelled", reply "ยกเลิกเรียบร้อย, slot คืน"

**message** — Fallback text handler
```
If plain text: reply with FAQ or "โปรดใช้ปุ่มในการยืนยัน"
```

---

## Database Changes

### Migration 0002: `customers` table

```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  line_user_id TEXT UNIQUE,
  line_notify_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_customers_line_user_id ON customers(line_user_id);
CREATE INDEX idx_customers_phone ON customers(phone);
```

### Migration 0002: Add `customer_id` to bookings

```sql
ALTER TABLE bookings ADD COLUMN customer_id INTEGER REFERENCES customers(id);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
```

**Data migration:** Existing bookings have no customer_id (NULL is OK). Backfill script optional — creates customer records from unique phone numbers in bookings table.

### No changes to bookings status enum
Already includes `pending` from session 3-4 seed data.

---

## Frontend Changes (Session 10 Wire-up)

### Files to modify

**`src/app/(public)/book/[code]/_components/line-connect-card.tsx`** (~200 lines rewrite):

Remove:
- `NEXT_PUBLIC_LINE_PREVIEW` toggle logic
- Manual `useState` for state (`initial`/`authed`/`complete`)
- Preview mode UI block

Add:
- LIFF SDK loading (`<Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" />`)
- Initial state fetch: `useSWR('/api/line/status?bookingCode=X')`
- `handleAuth` function using LIFF
- `handleAddFriend` function using deep link
- Real button `onClick` handlers (replace disabled stubs)
- Loading/error states during API calls

**`src/lib/liff.ts`** (create):

```typescript
import type { Liff } from '@line/liff';

let liffInstance: Liff | null = null;

export async function initLiff(): Promise<Liff> {
  if (liffInstance) return liffInstance;
  const { default: liff } = await import('@line/liff');
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  liffInstance = liff;
  return liff;
}

export async function getLineUserId(): Promise<string> {
  const liff = await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    throw new Error('Redirecting to login...');
  }
  const profile = await liff.getProfile();
  return profile.userId;
}
```

**`src/app/api/line/link/route.ts`** (create) — POST handler per spec above
**`src/app/api/line/status/route.ts`** (create) — GET handler per spec above
**`src/app/api/webhooks/line/route.ts`** (create) — POST handler per spec above

**`src/lib/line.ts`** (modify) — extend with:
- `sendPushMessage(userId, message)`
- `sendFlexMessage(userId, altText, contents)`
- `isFriendOfOA(userId)` — calls GET `/v2/bot/profile/{userId}`
- `verifyWebhookSignature(body, signature)` — HMAC-SHA256 with channel secret

**Existing `sendBookingNotification` in `src/lib/line.ts`** — update tone:
- Non-LINE booking: keep existing text
- LINE booking: "รอยืนยัน — ลูกค้าเชื่อม LINE แล้ว, จะยืนยันก่อนถึงเวลา"

---

## LINE Developers Console Setup

**Prerequisites:**
- LINE personal account (for developer login)
- LINE Business account (create at admin-official.line.me — free)
- Session 9 deploy done (need production HTTPS URL)

### Step 1: Create LINE Official Account
1. Go to https://www.linebiz.com/th/entry/
2. Create OA "Nebula Spa" (business plan: free tier OK)
3. Get **basic ID** (e.g., `@nebulaspa` or auto-generated like `@abc1234d`)

### Step 2: Create Messaging API Channel
1. Go to https://developers.line.biz/console/
2. Create Provider (business name)
3. Create Messaging API channel
4. Get:
   - **Channel ID**
   - **Channel Secret**
   - **Channel Access Token** (long-lived)
5. Set webhook URL: `https://nebula-spa.YOUR.workers.dev/api/webhooks/line`
6. Enable "Use webhook"
7. Disable "Auto-reply messages" (we send custom replies)

### Step 3: Create LIFF App
1. Same channel → LIFF tab → Add
2. Endpoint URL: `https://nebula-spa.YOUR.workers.dev/book/*` (or specific path)
3. Scope: `profile` (minimum needed)
4. Size: Full (or Tall — up to design)
5. Get **LIFF ID** (format `1234567890-abcdefgh`)

### Step 4: Configure env vars

**Local dev (`.env.local`):**
```
NEXT_PUBLIC_LIFF_ID=1234567890-abcdefgh
NEXT_PUBLIC_LINE_OA_BASIC_ID=@nebulaspa
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
LINE_CHANNEL_SECRET=xxxxx
LINE_ENABLED=true
```

**Cloudflare secrets (production):**
```powershell
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_CHANNEL_SECRET
```

Env vars in `wrangler.toml` (`[vars]`):
```toml
NEXT_PUBLIC_LIFF_ID = "1234567890-abcdefgh"
NEXT_PUBLIC_LINE_OA_BASIC_ID = "@nebulaspa"
LINE_ENABLED = "true"
```

### Step 5: Test flow
- Open `/book/[real code]` on mobile browser
- Tap "เชื่อม LINE" → should redirect to LINE OAuth
- Grant permission → returns to page
- POST to `/api/line/link` → check DB for updated customer + booking
- Tap "เพิ่มเพื่อน" → deep link opens LINE app
- Add OA as friend → check webhook receives follow event

---

## Open Questions

### 1. First Flex reminder timing
Options:
- **6h before appointment** — buffer for owner to find replacement customer if cancelled
- **3h before** — quicker decision from customer
- **12h before** — more preparation time

**Deferred to Session 10** — best decided after seeing real booking patterns.

### 2. Reminder retry interval
Fixed 1h between attempts, max 2 attempts total (initial + 1 retry).
**Locked:** 1h retry, max 2 attempts.

### 3. Cancel after N no-responses?
**Locked:** No auto-cancel. Stay pending after 2 no-responses. Owner sees "รอยืนยัน (ไม่ตอบ 2 ครั้ง)" flag and decides.

### 4. Cron implementation
Options:
- Cloudflare Cron Triggers (in wrangler.toml)
- External cron (Vercel Cron, GitHub Actions)
- **Recommended:** Cloudflare Cron — same platform, native integration

Schedule: every 15 min (`*/15 * * * *`) — check for bookings needing reminders in next 6-6.25h window.

### 5. LINE deep link for "Add Friend" vs QR code
Deep link URL: `https://line.me/R/ti/p/@nebulaspa`
- On mobile: opens LINE app, taps user through Add Friend flow
- On desktop: shows QR code page

**Locked:** Use deep link. QR fallback happens automatically on desktop.

### 6. Discount promo ("10% off ครั้งถัดไป")
Currently a marketing hook in Step 01 benefits list. Actual implementation:
- Create discount codes tied to `customer_id`
- Send code via LINE after first LINE-connected booking
- Redeemable in future bookings
**Deferred:** Nice-to-have, not blocking. Session 11+ if desired.

---

## Estimated Effort Breakdown

| Task | Time |
|---|---|
| LINE Developers Console setup (OA + Channel + LIFF) | 30-45 min |
| Migration 0002 (customers table + FK) | 30 min |
| `src/lib/liff.ts` wrapper | 30 min |
| `src/lib/line.ts` extensions (Flex, verify, isFriend) | 1-1.5h |
| `POST /api/line/link` endpoint + tests | 1h |
| `GET /api/line/status` endpoint | 30 min |
| `POST /api/webhooks/line` endpoint | 1.5-2h |
| Rewrite `line-connect-card.tsx` (remove preview, wire real) | 1-1.5h |
| Cron trigger for Flex reminders | 1-1.5h |
| Flex message template design | 1h |
| End-to-end testing (real LINE app) | 1-2h |
| **Total** | **8.5-12h** |

**Recommend splitting into sub-sessions:**
- **10A** — Setup + migration + link + status endpoints (~3-4h)
- **10B** — Webhook + wire frontend (~2-3h)
- **10C** — Cron + Flex + reminder flow (~2-3h)
- **10D** — End-to-end test + polish (~1-2h)

---

## Dependencies to Add

```powershell
pnpm add @line/liff
```

Note: `@line/liff` is loaded dynamically in `src/lib/liff.ts` to avoid bundling in server components.

---

## Rollout Plan

**Phase 1 (Session 10 initial):** LINE enabled, all flows working
- Non-LINE bookings continue as before (auto-confirm)
- LINE bookings go through 2-step + pending flow
- Cron sends Flex reminders

**Phase 2 (after live for 1-2 weeks):** Observe
- Watch metrics: LINE opt-in rate, response rate on Flex, no-show rate change
- Check for abuse patterns (rate limit hits, invalid link attempts)

**Phase 3 (if issues):** Upgrade
- Security Level 3 (add phone last 4 verification) if impersonation observed
- Adjust reminder timing based on response rates
- Add discount promo implementation if opt-in rate low

---

## Related Files

- `handover-session-8.md` — What was actually built (includes UI shell)
- `booking-system-decisions.md` — Locked decisions
- `booking-system-workflow.md` — Backend flow documentation
- `roadmap.md` — Overall session plan

---

**Ready to implement when:** Session 9 deploy complete → production URL available for LIFF registration.
