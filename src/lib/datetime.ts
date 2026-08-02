import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { getDay, format } from "date-fns";

/**
 * Bangkok timezone name (IANA).
 * ไทยไม่มี DST — offset คงที่ +07:00 ตลอด
 */
export const BANGKOK_TZ = "Asia/Bangkok";

/**
 * รวม date string + time string (Bangkok local) → Date object (UTC internal).
 *
 * @param date - "2026-08-15" (Bangkok calendar date)
 * @param time - "14:00" (Bangkok local time, HH:MM)
 * @returns Date object ที่ represent 07:00 UTC (= 14:00 Bangkok)
 *
 * @example
 * bangkokDateTimeToUtc("2026-08-15", "14:00")
 * // Date { 2026-08-15T07:00:00.000Z }
 */
export function bangkokDateTimeToUtc(date: string, time: string): Date {
  // Concat เป็น ISO-like string ที่ยังไม่มี timezone info
  const localIso = `${date}T${time}:00`;
  // fromZonedTime บอกว่า "string นี้คือเวลาที่ Bangkok" → return UTC Date
  return fromZonedTime(localIso, BANGKOK_TZ);
}

/**
 * Format Date → ISO 8601 string with Bangkok offset (+07:00).
 * ใช้ตอน serialize response ให้ client
 *
 * @param date - Date object (any timezone internally)
 * @returns "2026-08-15T14:00:00+07:00"
 */
export function toBangkokIsoString(date: Date): string {
  return formatInTimeZone(date, BANGKOK_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * หา day-of-week ตาม Bangkok calendar (0=Sunday, 6=Saturday).
 * สำคัญ: ต้อง compute ใน Bangkok timezone ไม่ใช่ UTC
 * เพราะ 2026-08-15 23:00 UTC = 2026-08-16 06:00 Bangkok (คนละวัน)
 *
 * @param date - "2026-08-15"
 * @returns 6 (Saturday)
 */
export function getBangkokDayOfWeek(date: string): number {
  // ตีความ date string เป็น midnight Bangkok → แปลงเป็น UTC → getDay จะให้ค่าถูก
  const utcDate = bangkokDateTimeToUtc(date, "00:00");
  // toZonedTime แปลงกลับเป็น "Date ที่มองเห็นเป็น Bangkok" เพื่อ getDay อ่านถูก
  const bangkokView = toZonedTime(utcDate, BANGKOK_TZ);
  return getDay(bangkokView);
}

/**
 * ปัจจุบัน as Date object (JS Date ใช้ UTC internally อยู่แล้ว).
 * แยกเป็น function เพื่อ mock ตอน test ได้ง่าย
 */
export function getBangkokNow(): Date {
  return new Date();
}

/**
 * เช็คว่า date string ที่ให้มา = "วันนี้" (ตาม Bangkok calendar) หรือไม่
 *
 * @param date - "2026-08-15"
 * @returns true ถ้าเป็นวันนี้ตามเวลาไทย
 */
export function isBangkokToday(date: string): boolean {
  const todayInBangkok = formatInTimeZone(
    getBangkokNow(),
    BANGKOK_TZ,
    "yyyy-MM-dd",
  );
  return date === todayInBangkok;
}

/**
 * Parse "HH:MM" → { hour, minute } (internal helper).
 * ไม่ validate — assume input ผ่าน Zod มาแล้ว
 */
export function parseTimeString(time: string): {
  hour: number;
  minute: number;
} {
  const [h, m] = time.split(":");
  return { hour: Number(h), minute: Number(m) };
}

/**
 * บวก minutes เข้ากับ "HH:MM" string → return "HH:MM" ใหม่.
 * ใช้ generate 30-min slot grid
 *
 * @param time - "14:00"
 * @param minutes - 30
 * @returns "14:30"
 *
 * @example
 * addMinutesToTime("21:30", 60) // "22:30"
 * addMinutesToTime("23:30", 60) // "00:30" (wrap — แต่ไม่ควรเกิดใน context นี้)
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const { hour, minute } = parseTimeString(time);
  const totalMin = hour * 60 + minute + minutes;
  const newHour = Math.floor(totalMin / 60) % 24;
  const newMin = totalMin % 60;
  return `${String(newHour).padStart(2, "0")}:${String(newMin).padStart(2, "0")}`;
}

/**
 * เทียบ 2 "HH:MM" strings — return true ถ้า a <= b.
 * ใช้เทียบว่า slot end ≤ business close
 */
export function isTimeBeforeOrEqual(a: string, b: string): boolean {
  return a <= b; // string comparison ก็ใช้ได้เพราะ "HH:MM" zero-padded
}
