/**
 * ส่งข้อมูลการยกเลิกเข้า Google Sheets ของร้าน (Day 43)
 *
 * ปลายทาง = Google Apps Script web app ที่ร้านติดตั้งไว้ใน Sheet (doPost)
 *   - ตรวจ secret · รหัสจองซ้ำ = ไม่เพิ่มแถว (ส่งซ้ำได้ปลอดภัย) · กันสูตรแอบแฝง
 *
 * ไม่ส่งข้อมูลส่วนตัว (PDPA — ตรงกับหน้า privacy):
 *   ชื่อ = อักษรแรก + "xxxxx" · ไม่ส่งเบอร์ · ไม่ส่ง LINE userId
 *   อยากรู้ว่าเป็นใคร → เอารหัสจองไปค้นในหน้า admin
 *
 * ไม่ได้ตั้ง URL/secret = ร้านไม่ใช้ Sheets → ข้ามเงียบๆ
 * ส่งไม่ผ่าน → log อย่างเดียว ไม่กระทบการยกเลิก (D1 มีข้อมูลครบ)
 * Caller ต้องห่อ ctx.waitUntil() (webhook ห่อทั้ง event อยู่แล้ว)
 */

import { formatInTimeZone } from "date-fns-tz";
import { BANGKOK_TZ } from "@/lib/datetime";
import { cancelReasonLabel } from "@/lib/cancel-reasons";

export interface SheetsConfig {
  url?: string;
  secret?: string;
}

export function sheetsConfigFrom(env: CloudflareEnv): SheetsConfig {
  return {
    url: env.SHEETS_WEBHOOK_URL || undefined,
    secret: env.SHEETS_WEBHOOK_SECRET || undefined,
  };
}

export interface CancellationForSheet {
  code: string;
  customerName: string;
  customerBookingNo: number | null;
  serviceName: string;
  startsAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

/** ชื่อแบบปิดบัง — รูปแบบเดียวกับที่ระบบปิดบังข้อมูลรายเดือน */
export function maskName(name: string): string {
  const first = Array.from(name.trim())[0] ?? "";
  return `${first}xxxxx`;
}

const fmt = (d: Date) => formatInTimeZone(d, BANGKOK_TZ, "yyyy-MM-dd HH:mm");

export async function sendCancellationToSheet(
  config: SheetsConfig,
  b: CancellationForSheet,
): Promise<void> {
  if (!config.url || !config.secret) return;

  const row = {
    cancelledAt: fmt(b.cancelledAt ?? new Date()),
    code: b.code,
    customer: maskName(b.customerName),
    bookingNo: b.customerBookingNo ?? "",
    service: b.serviceName,
    appointmentAt: fmt(b.startsAt),
    reason: cancelReasonLabel(b.cancelReason) ?? "",
  };

  try {
    // Apps Script ตอบ 302 → fetch ตามไปเอง (doPost ทำงานไปแล้วตั้งแต่คำขอแรก)
    const res = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.secret, row }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      duplicate?: boolean;
    } | null;

    if (!res.ok || !data?.ok) {
      console.error("[sheets] append failed", {
        code: b.code,
        status: res.status,
        error: data?.error ?? "invalid response",
      });
    }
  } catch (err) {
    console.error("[sheets] request failed", {
      code: b.code,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
