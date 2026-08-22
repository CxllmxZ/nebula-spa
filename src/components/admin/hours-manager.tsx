"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BusinessHour } from "@/lib/db/schema";

const DAY_LABELS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

interface Props {
  initialHours: BusinessHour[]; // 7 rows, sorted 0-6
  canEdit?: boolean; // ← เพิ่ม (default undefined = true สำหรับ backward compat)
}

interface RowState {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export function HoursManager({ initialHours, canEdit = true }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState<RowState[]>(() => toRowState(initialHours));
  const [isSaving, setIsSaving] = useState(false);

  // Reflect prop changes (after router.refresh) into local state
  useEffect(() => {
    setRows(toRowState(initialHours));
  }, [initialHours]);

  const isDirty =
    JSON.stringify(rows) !== JSON.stringify(toRowState(initialHours));

  function updateRow(day: number, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r)),
    );
  }

  function reset() {
    setRows(toRowState(initialHours));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: rows.map((r) => ({
            dayOfWeek: r.dayOfWeek,
            openTime: r.isClosed ? null : r.openTime,
            closeTime: r.isClosed ? null : r.closeTime,
            isClosed: r.isClosed,
          })),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: { path: string; message: string }[];
        };
        // Prefer first issue message over generic error
        const message =
          body.issues?.[0]?.message ?? body.error ?? "บันทึกไม่สำเร็จ";
        throw new Error(message);
      }

      toast.success("บันทึกเวลาทำการแล้ว");
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">เวลาทำการ</h2>
          <p className="text-sm text-muted-foreground">
            กำหนดเวลาเปิด-ปิด แต่ละวันในสัปดาห์
            {!canEdit && " · เฉพาะดู"}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={reset}
              disabled={!isDirty || isSaving}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border divide-y">
        {rows.map((row) => (
          <div
            key={row.dayOfWeek}
            className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 items-center p-4"
          >
            {/* Day label */}
            <div className="font-medium">{DAY_LABELS[row.dayOfWeek]}</div>

            {/* Open time */}
            <div className="space-y-1">
              <Label
                htmlFor={`open-${row.dayOfWeek}`}
                className="text-xs text-muted-foreground"
              >
                เวลาเปิด
              </Label>
              <Input
                id={`open-${row.dayOfWeek}`}
                type="time"
                value={row.openTime}
                onChange={(e) =>
                  updateRow(row.dayOfWeek, { openTime: e.target.value })
                }
                disabled={row.isClosed || isSaving}
              />
            </div>

            {/* Close time */}
            <div className="space-y-1">
              <Label
                htmlFor={`close-${row.dayOfWeek}`}
                className="text-xs text-muted-foreground"
              >
                เวลาปิด
              </Label>
              <Input
                id={`close-${row.dayOfWeek}`}
                type="time"
                value={row.closeTime}
                onChange={(e) =>
                  updateRow(row.dayOfWeek, { closeTime: e.target.value })
                }
                disabled={row.isClosed || isSaving}
              />
            </div>

            {/* Closed toggle */}
            <div className="flex items-center justify-end gap-2">
              <Label
                htmlFor={`closed-${row.dayOfWeek}`}
                className="text-sm cursor-pointer"
              >
                {row.isClosed ? "ปิด" : "เปิด"}
              </Label>
              <Switch
                id={`closed-${row.dayOfWeek}`}
                checked={!row.isClosed}
                onCheckedChange={(open) =>
                  updateRow(row.dayOfWeek, { isClosed: !open })
                }
                disabled={isSaving}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Convert DB rows → form state (fill defaults for closed days) */
function toRowState(hours: BusinessHour[]): RowState[] {
  return hours.map((h) => ({
    dayOfWeek: h.dayOfWeek,
    openTime: h.openTime ?? "10:00",
    closeTime: h.closeTime ?? "21:00",
    isClosed: h.isClosed,
  }));
}
