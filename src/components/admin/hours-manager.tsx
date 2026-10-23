"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { th } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BusinessHour } from "@/lib/db/schema";
import { BANGKOK_TZ } from "@/lib/datetime";

/** คิวที่จะหลุดนอกเวลาใหม่ — รูปแบบเดียวกับหน้าวันหยุด (409 OVERLAP) */
interface Overlap {
  code: string;
  customerName: string;
  customerPhone: string;
  startsAt: string; // ISO (Bangkok)
}

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
  const [overlaps, setOverlaps] = useState<Overlap[] | null>(null);

  // Reflect prop changes (after router.refresh) into local state
  useEffect(() => {
    setRows(toRowState(initialHours));
    setOverlaps(null);
  }, [initialHours]);

  const isDirty =
    JSON.stringify(rows) !== JSON.stringify(toRowState(initialHours));

  function updateRow(day: number, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r)),
    );
    setOverlaps(null); // แก้เวลา → ต้องเช็คคิวชนใหม่
  }

  function reset() {
    setRows(toRowState(initialHours));
    setOverlaps(null);
  }

  async function handleSave(confirmOverlap = false) {
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
          confirmOverlap,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
          overlaps?: Overlap[];
          issues?: { path: string; message: string }[];
        };
        if (res.status === 409 && body.code === "OVERLAP" && body.overlaps) {
          setOverlaps(body.overlaps); // โชว์รายชื่อ ให้ยืนยันอีกครั้ง
          return;
        }
        // Prefer first issue message over generic error
        const message =
          body.issues?.[0]?.message ?? body.error ?? "บันทึกไม่สำเร็จ";
        throw new Error(message);
      }

      toast.success(
        confirmOverlap
          ? "บันทึกแล้ว — อย่าลืมติดต่อลูกค้าที่ได้รับผลกระทบ"
          : "บันทึกเวลาทำการแล้ว",
      );
      setOverlaps(null);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">เวลาทำการ</h2>
          <p className="text-sm text-muted-foreground">
            กำหนดเวลาเปิด-ปิด แต่ละวันในสัปดาห์
            {!canEdit && " · เฉพาะดู"}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={reset}
              disabled={!isDirty || isSaving}
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
              variant={overlaps ? "destructive" : "default"}
              onClick={() => void handleSave(overlaps !== null)}
              disabled={!isDirty || isSaving}
            >
              {isSaving
                ? "กำลังบันทึก..."
                : overlaps
                  ? "ยืนยันบันทึก"
                  : "บันทึก"}
            </Button>
          </div>
        )}
      </div>

      {overlaps && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            มีคิวที่จองไว้แล้ว {overlaps.length} คิว อยู่นอกเวลาทำการใหม่
          </div>
          <ul className="space-y-1 text-sm text-amber-900">
            {overlaps.map((b) => (
              <li key={b.code} className="flex justify-between gap-2">
                <span>
                  {formatInTimeZone(
                    new Date(b.startsAt),
                    BANGKOK_TZ,
                    "EEE d MMM HH:mm",
                    { locale: th },
                  )}{" "}
                  · {b.customerName}
                </span>
                <span className="font-mono text-xs">{b.customerPhone}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-800">
            คิวเหล่านี้จะไม่ถูกยกเลิกอัตโนมัติ — ต้องติดต่อลูกค้าเอง
            แล้วเปลี่ยนสถานะในหน้าการจอง · กด &quot;ยืนยันบันทึก&quot;
            เพื่อบันทึกต่อ หรือ &quot;ยกเลิก&quot; เพื่อกลับไปเวลาเดิม
          </p>
        </div>
      )}

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
