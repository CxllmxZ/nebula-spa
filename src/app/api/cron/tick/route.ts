import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notifyEnvFrom } from "@/lib/notify";
import { runMorningSummary } from "@/lib/morning-summary";

/**
 * POST /api/cron/tick
 *
 * ภายในเท่านั้น — ถูกเรียกจาก custom-worker.ts (Cloudflare Cron ทุก 15 นาที)
 * งานในรอบนี้: สรุปคิวเช้า (session ถัดไปจะเพิ่ม Flex เตือนลูกค้า T-6h ที่นี่)
 *
 * ป้องกัน: header x-cron-secret ต้องตรงกับ env CRON_SECRET
 *
 * เทสด้วยมือ: body { "force": true } = ข้ามเช็คเวลา/ส่งแล้ววันนี้ (ยังเคารพวันร้านปิด)
 */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });

  const secret = env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (!(await safeEqual(request.headers.get("x-cron-secret") ?? "", secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let force = false;
  try {
    const body = (await request.json()) as { force?: boolean };
    force = body?.force === true;
  } catch {
    // ไม่มี body = รอบปกติจาก cron
  }

  try {
    const summary = await runMorningSummary(notifyEnvFrom(env), { force });
    console.log("[cron] morning summary", summary);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[cron] morning summary failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Summary failed" }, { status: 500 });
  }
}

/** เทียบ string แบบเวลาคงที่ (กันเดารหัสทีละตัวจากเวลาตอบ) */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
