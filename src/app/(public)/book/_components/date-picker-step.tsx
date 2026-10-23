"use client";

import { th } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { ADVANCE_BOOKING_DAYS } from "@/lib/booking-rules";

type Props = {
  value: string | null; // YYYY-MM-DD
  /** วันที่ร้านปิดทั้งวัน (YYYY-MM-DD) — กดไม่ได้ในปฏิทิน */
  closedDates?: string[];
  onSelect: (date: string) => void;
};

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromYMD(ymd: string | null): Date | undefined {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DatePickerStep({ value, closedDates = [], onSelect }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + ADVANCE_BOOKING_DAYS);

  const closed = new Set(closedDates);

  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        mode="single"
        locale={th}
        weekStartsOn={1}
        selected={fromYMD(value)}
        onSelect={(d) => d && onSelect(toYMD(d))}
        disabled={(d) => d < today || d > max || closed.has(toYMD(d))}
        modifiers={{ closed: (d) => closed.has(toYMD(d)) }}
        modifiersClassNames={{
          // ขีดที่ปุ่มข้างใน — text-decoration ของ <td> ไม่ส่งต่อไปถึง inline-block
          closed: "[&_button]:line-through [&_button]:decoration-foreground/50",
        }}
        className="rounded-xl border border-primary/10 bg-background/40 p-3"
      />
      {closed.size > 0 && (
        <p className="text-xs text-foreground/50">วันที่ขีดฆ่า = ร้านปิด</p>
      )}
    </div>
  );
}
