"use client";

import { Lock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "locked" | "active" | "complete";

type Props = {
  number: string;
  title: string;
  status: Status;
  summary?: string;
  onEdit?: () => void;
  children: React.ReactNode;
};

export function StepSection({
  number,
  title,
  status,
  summary,
  onEdit,
  children,
}: Props) {
  const locked = status === "locked";
  const complete = status === "complete";

  return (
    <section
      className={cn(
        "rounded-2xl border p-6 transition-all duration-300 md:p-8",
        locked && "border-primary/5 bg-card/30 opacity-40",
        complete && "border-primary/20 bg-card/60",
        status === "active" && "border-primary/30 bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium uppercase tracking-[0.32em] text-primary md:text-sm">
            {number}
          </span>
          <h2 className="font-serif text-xl font-medium tracking-wide text-foreground md:text-2xl">
            {title}
          </h2>
          {locked && (
            <Lock className="h-4 w-4 text-foreground/40" strokeWidth={1.5} />
          )}
        </div>
        {complete && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-primary hover:opacity-70"
          >
            <Pencil className="h-3 w-3" />
            แก้ไข
          </button>
        )}
      </div>

      <div className="mt-6">
        {complete && summary ? (
          <div className="text-base text-foreground/80">{summary}</div>
        ) : (
          !locked && children
        )}
      </div>
    </section>
  );
}
