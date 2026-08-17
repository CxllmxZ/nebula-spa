"use client";

import { cn } from "@/lib/utils";

type Slot = { start: string; end: string };

type Props = {
  slots: Slot[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
};

function extractHour(iso: string): number {
  return parseInt(iso.slice(11, 13), 10);
}

function extractTime(iso: string): string {
  return iso.slice(11, 16);
}

export function TimePicker({ slots, selectedTime, onSelect }: Props) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-primary/10 bg-background/30 p-8 text-center text-sm text-foreground/60">
        ไม่มีเวลาว่างในวันนี้ ลองเลือกวันอื่น
      </div>
    );
  }

  const morning = slots.filter((s) => extractHour(s.start) < 12);
  const afternoon = slots.filter((s) => {
    const h = extractHour(s.start);
    return h >= 12 && h < 18;
  });
  const evening = slots.filter((s) => extractHour(s.start) >= 18);

  const groups = [
    { label: "เช้า", subLabel: "Morning", slots: morning },
    { label: "บ่าย", subLabel: "Afternoon", slots: afternoon },
    { label: "เย็น", subLabel: "Evening", slots: evening },
  ];

  return (
    <div className="space-y-6">
      {groups.map(
        (g) =>
          g.slots.length > 0 && (
            <div key={g.label}>
              <div className="mb-3 flex items-baseline gap-3">
                <div className="font-serif text-base font-medium text-foreground">
                  {g.label}
                </div>
                <div className="text-xs uppercase tracking-widest text-foreground/40">
                  {g.subLabel}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {g.slots.map((slot) => {
                  const t = extractTime(slot.start);
                  const selected = t === selectedTime;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => onSelect(t)}
                      className={cn(
                        "rounded-lg border py-3 text-sm font-medium tracking-wide transition-all",
                        selected
                          ? "border-primary/60 bg-primary/15 text-foreground"
                          : "border-primary/10 bg-background/30 text-foreground/80 hover:border-primary/30 hover:bg-background/50",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          ),
      )}
    </div>
  );
}
