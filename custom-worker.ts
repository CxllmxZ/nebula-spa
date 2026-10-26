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
 * ⚠️ ไฟล์นี้ import .open-next/worker.js ซึ่งเกิดตอน build → ต้อง exclude จาก tsconfig
 */

// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

/** ชื่อ binding ตาม wrangler.toml [[d1_databases]] */
const DB_BINDING = "nebula_spa_db";

/** เวลาไทย (UTC+7 ไม่มี DST) */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

interface D1Like {
  prepare(query: string): {
    first<T = Record<string, unknown>>(): Promise<T | null>;
  };
}

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

export default {
  fetch: handler.fetch,

  async scheduled(
    _controller: unknown,
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    ctx.waitUntil(
      (async () => {
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
      })(),
    );
  },
};
