/**
 * สาเหตุการยกเลิก (Day 43) — ที่เดียวที่กำหนดรายการ
 * ใช้ร่วม: ปุ่มใน LINE · บันทึก D1 (bookings.cancel_reason = code) · หน้า admin · Google Sheets
 *
 * ⚠️ code เก็บลงฐานข้อมูล → อย่าเปลี่ยน code ของรายการเดิม (แก้ label ได้)
 *    ปุ่ม Quick Reply ของ LINE: label ไม่เกิน 20 ตัวอักษร · รวมไม่เกิน 13 ปุ่ม
 * ไฟล์นี้ต้องไม่ import อะไรฝั่ง server — หน้า admin (client) ใช้ด้วย
 */

export const CANCEL_REASONS = [
  { code: "busy", label: "ติดธุระ / งานด่วน" },
  { code: "sick", label: "ไม่สบาย" },
  // ลูกค้ายังอยากมา → แจ้งร้านให้โทรนัดใหม่ (ไม่ให้ลูกค้าจองใหม่เอง — ตามสเปก)
  { code: "reschedule", label: "ขอเลื่อน / จองผิด" },
  { code: "travel", label: "เดินทางไม่สะดวก" },
  { code: "elsewhere", label: "ไปใช้บริการที่อื่น" },
  { code: "other", label: "อื่นๆ / ไม่ระบุ" },
] as const;

/** สาเหตุที่ต้องให้ร้านติดต่อกลับ */
export const RESCHEDULE_REASON: CancelReasonCode = "reschedule";

export type CancelReasonCode = (typeof CANCEL_REASONS)[number]["code"];

export function isCancelReasonCode(v: string): v is CancelReasonCode {
  return CANCEL_REASONS.some((r) => r.code === v);
}

/** code → ข้อความ (code ที่ไม่รู้จัก เช่น จากเวอร์ชันเก่า → คืน code เดิม) */
export function cancelReasonLabel(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return CANCEL_REASONS.find((r) => r.code === code)?.label ?? code;
}
