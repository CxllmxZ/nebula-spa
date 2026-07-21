// TODO: implement with date-fns + date-fns-tz
// - toBkkTime(utc: Date): Date            → convert UTC to Asia/Bangkok
// - fromBkkTime(bkk: Date): Date          → convert Asia/Bangkok to UTC
// - formatBkkDate(date: Date): string     → format like "15 มี.ค. 2569"
// - formatBkkTime(date: Date): string     → format like "14:30"

export const BKK_TIMEZONE = "Asia/Bangkok";

export function formatBkkDate(date: Date): string {
  // Placeholder — replace with date-fns-tz format
  return date.toISOString().split("T")[0];
}

export function formatBkkTime(date: Date): string {
  // Placeholder — replace with date-fns-tz format
  return date.toISOString().split("T")[1].slice(0, 5);
}
