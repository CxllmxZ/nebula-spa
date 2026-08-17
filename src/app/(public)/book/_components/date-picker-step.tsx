"use client";

import { th } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";

type Props = {
  value: string | null; // YYYY-MM-DD
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

export function DatePickerStep({ value, onSelect }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + 30);

  return (
    <div className="flex justify-center">
      <Calendar
        mode="single"
        locale={th}
        weekStartsOn={1}
        selected={fromYMD(value)}
        onSelect={(d) => d && onSelect(toYMD(d))}
        disabled={(d) => d < today || d > max}
        className="rounded-xl border border-primary/10 bg-background/40 p-3"
      />
    </div>
  );
}
