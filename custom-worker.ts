/**
 * Custom worker — ครอบ worker ที่ OpenNext สร้าง เพื่อเพิ่ม Cron (scheduled)
 * อ้างอิง: https://opennext.js.org/cloudflare/howtos/custom-worker
 *
 * cron ไม่เรียกโค้ดแอปตรงๆ — ยิง request เข้า /api/cron/tick ผ่าน handler ของ Next เอง
 * → โค้ดรันในเส้นทางปกติ (getCloudflareContext / DB ใช้ได้เหมือน request ทั่วไป)
 *
 * Day 39: เช็คล่วงหน้า (pre-check) จาก D1 ตรงๆ ก่อนปลุก Next
 * cron รันวันละ 4 รอบ (06–09 น.) แต่ส่งจริงแค่รอบเดียว — อีก 3 รอบไม่ต้องปลุก Next
 * (ปลุก Next = ยอด CPU ที่เห็นในกราฟ)
 *
 * กติกา: เช็คเฉพาะเงื่อนไขที่ "ข้ามได้แน่นอน" — ไม่แน่ใจ/อ่านไม่ได้/error → ปลุก Next ตามเดิม
 * ตัดสินใจจริงยังอยู่ที่ runMorningSummary (ที่เดียว) — ตรงนี้แค่ตัดรอบที่ไม่มีงานออก
 *
 * Day 42: cron ตัวที่ 2 (รายเดือน) — ปิดบังข้อมูลลูกค้าที่ไม่ได้จอง 6 เดือน (PDPA มาตรา 37(3))
 * ทำด้วย SQL ตรงจาก D1 ไม่ปลุก Next (CPU ต่ำ) · แยกจากสรุปเช้า (ร้านไม่ใช้ LINE ก็ยังลบตามกำหนด)
 *
 * ⚠️ ไฟล์นี้ import .open-next/worker.js ซึ่งเกิดตอน build → ต้อง exclude จาก tsconfig
 */

// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

/** ชื่อ binding ตาม wrangler.toml [[d1_databases]] */
const DB_BINDING = "nebula_spa_db";

/** เวลาไทย (UTC+7 ไม่มี DST) */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Like {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<{ meta?: { changes?: number } }[]>;
}

/** ต้องตรงกับ wrangler.toml [triggers] crons (ตัวอักษรต่อตัวอักษร) */
const CRON_MORNING = "0 23,0-2 * * *"; // 06:00–09:00 ไทย — สรุปเช้า
const CRON_MONTHLY = "0 20 1 * *"; // วันที่ 2 ของเดือน 03:00 ไทย — ปิดบังข้อมูลเก่า

/** ไม่ได้จองเลยกี่วัน (นับจากวันนัดล่าสุดของเบอร์นั้น) → ปิดบังชื่อ/เบอร์ */
const ANONYMIZE_AFTER_DAYS = 183; // ~6 เดือน

interface Env {
  CRON_SECRET?: string;
  [key: string]: unknown;
}

type PreCheck = { run: true } | { run: false; reason: string };

/**
 * อ่าน line_settings ตรงจาก D1 (~1ms) แล้วบอกว่าควรปลุก Next ไหม
 * คอลัมน์ตาม migration 0002 (line_settings): summary_enabled, summary_time,
 * last_summary_date, staff_group_status
 * ใช้ SELECT * → ถ้าภายหลังเปลี่ยนชื่อคอลัมน์ (ได้ undefined) = ไม่แน่ใจ → run
 */
async function preCheck(env: Env): Promise<PreCheck> {
  const db = env[DB_BINDING] as D1Like | undefined;
  if (!db) return { run: true };

  const row = await db
    .prepare("SELECT * FROM line_settings WHERE id = 1")
    .first<Record<string, unknown>>();
  if (!row) return { run: true }; // ยังไม่มีแถว → ให้ Next สร้าง

  const bkk = new Date(Date.now() + BANGKOK_OFFSET_MS).toISOString();
  const today = bkk.slice(0, 10); // YYYY-MM-DD
  const nowHHMM = bkk.slice(11, 16); // HH:MM

  const enabled = row.summary_enabled;
  const time = row.summary_time;
  const lastDate = row.last_summary_date;

  if (enabled === 0 || enabled === false) {
    return { run: false, reason: "summary disabled" };
  }
  // ไม่เคยผูกกลุ่ม → runMorningSummary ไม่มีปลายทางอยู่แล้ว
  // (disconnected ยังต้องปลุก — สรุปส่งหาเจ้าของแทน)
  if (row.staff_group_status === "not_linked") {
    return { run: false, reason: "staff group not linked" };
  }
  if (typeof lastDate === "string" && lastDate === today) {
    return { run: false, reason: "already sent today" };
  }
  if (
    typeof time === "string" &&
    /^\d{2}:\d{2}$/.test(time) &&
    nowHHMM < time
  ) {
    return { run: false, reason: `before summary time (${nowHHMM} < ${time})` };
  }
  return { run: true };
}

/**
 * ปิดบังข้อมูลส่วนบุคคล (PDPA) — เดือนละครั้ง
 *
 * bookings: เบอร์ที่วันนัดล่าสุด (ทุกสถานะ รวมคิวอนาคต) เก่ากว่า 6 เดือน →
 *   ชื่อ "นxxxxx" (อักษรแรก + x 5 ตัว) · เบอร์ "0xxxxx" · หมายเหตุ = null
 *   เก็บไว้: บริการ วันเวลา ราคา สถานะ ใครยกเลิก สาเหตุ จองครั้งที่ → วิเคราะห์ได้ต่อ
 * customers: ไม่เหลือคิวที่ยังไม่ถูกปิดบัง → ชื่อ "นxxxxx" · เบอร์ "anon-{id}" (คอลัมน์ unique)
 *   · line_user_id = null (ตัดการเชื่อม LINE) · แถวยังอยู่ → สถิติ "เชื่อม LINE ไหม" ไม่หาย
 *
 * ใช้ SQL ตรง (ไม่ผ่าน Drizzle) → updated_at ไม่ขยับ
 *   (ไม่งั้นสรุปเช้าจะนับเป็น "ความเคลื่อนไหวระหว่างร้านปิด")
 */
async function anonymizeOldCustomers(env: Env): Promise<void> {
  const db = env[DB_BINDING] as D1Like | undefined;
  if (!db) throw new Error("D1 binding missing");

  const nowSec = Math.floor(Date.now() / 1000);
  const cutoffSec = nowSec - ANONYMIZE_AFTER_DAYS * 24 * 60 * 60;

  const [bookingsRes, customersRes] = await db.batch([
    db
      .prepare(
        `UPDATE bookings
         SET customer_name = substr(trim(customer_name), 1, 1) || 'xxxxx',
             customer_phone = '0xxxxx',
             notes = NULL,
             anonymized_at = ?1
         WHERE anonymized_at IS NULL
           AND customer_phone IN (
             SELECT customer_phone FROM bookings
             WHERE anonymized_at IS NULL
             GROUP BY customer_phone
             HAVING MAX(starts_at) < ?2
           )`,
      )
      .bind(nowSec, cutoffSec),
    db.prepare(
      `UPDATE customers
       SET name = substr(trim(name), 1, 1) || 'xxxxx',
           phone = 'anon-' || id,
           line_user_id = NULL,
           line_notify_enabled = 0
       WHERE phone NOT LIKE 'anon-%'
         AND id NOT IN (
           SELECT customer_id FROM bookings
           WHERE customer_id IS NOT NULL AND anonymized_at IS NULL
         )`,
    ),
  ]);

  console.log("[cron] anonymized (PDPA)", {
    bookings: bookingsRes?.meta?.changes ?? 0,
    customers: customersRes?.meta?.changes ?? 0,
  });
}

async function runMorningSummaryTick(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
): Promise<void> {
  try {
    const check = await preCheck(env);
    if (!check.run) {
      console.log("[cron] skip (pre-check)", check.reason);
      return;
    }
  } catch (err) {
    // อ่าน DB ไม่ได้ → ไม่เสี่ยงพลาดสรุป ปลุก Next ตามเดิม
    console.error("[cron] pre-check failed, falling back", err);
  }

  const request = new Request("https://internal.cron/api/cron/tick", {
    method: "POST",
    headers: { "x-cron-secret": env.CRON_SECRET ?? "" },
  });
  const res: Response = await handler.fetch(request, env, ctx);
  if (!res.ok) {
    console.error("[cron] tick failed", res.status, await res.text());
  }
}

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: { cron: string },
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    if (controller.cron === CRON_MONTHLY) {
      ctx.waitUntil(
        anonymizeOldCustomers(env).catch((err) => {
          console.error("[cron] anonymize failed", err);
        }),
      );
      return;
    }

    if (controller.cron !== CRON_MORNING) {
      console.warn(
        "[cron] unknown schedule — check wrangler.toml",
        controller.cron,
      );
    }
    ctx.waitUntil(runMorningSummaryTick(env, ctx));
  },
};
