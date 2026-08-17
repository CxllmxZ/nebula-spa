"use client";

import { cn } from "@/lib/utils";

type Service = {
  id: number;
  name: string;
  description: string | null;
  durationMin: number;
  price: number;
};

type Props = {
  services: Service[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function ServicePicker({ services, selectedId, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {services.map((s) => {
        const selected = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "group flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all duration-200",
              selected
                ? "border-primary/60 bg-primary/10"
                : "border-primary/10 bg-background/30 hover:border-primary/30 hover:bg-background/50",
            )}
          >
            <div className="flex w-full items-center justify-between gap-3">
              <div className="font-serif text-base font-medium tracking-wide text-foreground">
                {s.name}
              </div>
              <div className="flex items-baseline gap-0.5 text-primary">
                <span className="text-xs opacity-60">฿</span>
                <span className="font-serif text-lg font-medium">
                  {s.price.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="text-xs tracking-widest text-foreground/50">
              {s.durationMin} นาที
            </div>
          </button>
        );
      })}
    </div>
  );
}
