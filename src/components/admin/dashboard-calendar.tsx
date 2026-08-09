"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { Calendar } from "@/components/ui/calendar";

interface DashboardCalendarProps {
  bookedDates: string[];
}

export function DashboardCalendar({ bookedDates }: DashboardCalendarProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates]);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    setSelected(date);
    const dateStr = format(date, "yyyy-MM-dd");
    // Single-day filter = from and to = same date
    router.push(`/admin/bookings?dateFrom=${dateStr}&dateTo=${dateStr}`);
  }

  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={handleSelect}
      weekStartsOn={1}
      showOutsideDays
      modifiers={{
        booked: (date) => bookedSet.has(format(date, "yyyy-MM-dd")),
      }}
      modifiersClassNames={{
        booked: "bg-primary/15 text-primary font-semibold rounded-md",
        outside: "text-muted-foreground/40",
        today: "bg-primary text-primary-foreground font-bold rounded-md",
      }}
    />
  );
}
