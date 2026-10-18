/**
 * Custom worker — ครอบ worker ที่ OpenNext สร้าง เพื่อเพิ่ม Cron (scheduled)
 * อ้างอิง: https://opennext.js.org/cloudflare/howtos/custom-worker
 *
 * cron ไม่เรียกโค้ดแอปตรงๆ — ยิง request เข้า /api/cron/tick ผ่าน handler ของ Next เอง
 * → โค้ดรันในเส้นทางปกติ (getCloudflareContext / DB ใช้ได้เหมือน request ทั่วไป)
 *
 * ⚠️ ไฟล์นี้ import .open-next/worker.js ซึ่งเกิดตอน build → ต้อง exclude จาก tsconfig
 */

// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  [key: string]: unknown;
}

export default {
  fetch: handler.fetch,

  async scheduled(
    _controller: unknown,
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    const request = new Request("https://internal.cron/api/cron/tick", {
      method: "POST",
      headers: { "x-cron-secret": env.CRON_SECRET ?? "" },
    });

    ctx.waitUntil(
      Promise.resolve(handler.fetch(request, env, ctx)).then(
        async (res: Response) => {
          if (!res.ok) {
            console.error("[cron] tick failed", res.status, await res.text());
          }
        },
      ),
    );
  },
};
