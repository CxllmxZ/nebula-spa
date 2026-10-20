"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BANGKOK_TZ } from "@/lib/datetime";
import { blockedSlotCreateSchema } from "@/lib/validations";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  reason: string;
}

interface Overlap {
  code: string;
  customerName: string;
  customerPhone: string;
  startsAt: string; // Bangkok ISO
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  date: "",
  allDay: true, // ส่วนใหญ่ปิดทั้งวัน — กันพลาดตั้งแค่บางช่วงโดยไม่ตั้งใจ
  startTime: "10:00",
  endTime: "18:00",
  reason: "",
};

export function BlockedSlotFormDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [overlaps, setOverlaps] = useState<Overlap[] | null>(null);

  // Reset form when dialog closes/opens
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setOverlaps(null);
    }
  }, [open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setOverlaps(null); // เปลี่ยนช่วงเวลา → ต้องเช็คคิวชนใหม่
  }

  async function submit(confirmOverlap: boolean) {
    const parsed = blockedSlotCreateSchema.safeParse({
      date: form.date,
      allDay: form.allDay,
      startTime: form.allDay ? undefined : form.startTime,
      endTime: form.allDay ? undefined : form.endTime,
      reason: form.reason,
      confirmOverlap,
    });

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormState;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        overlaps?: Overlap[];
      };

      if (res.status === 409 && body.code === "OVERLAP" && body.overlaps) {
        setOverlaps(body.overlaps); // โชว์รายชื่อ ให้ผู้ใช้ยืนยัน
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "บันทึกไม่สำเร็จ");

      toast.success(
        confirmOverlap
          ? "เพิ่มวันหยุดแล้ว — อย่าลืมแจ้งลูกค้าที่จองไว้"
          : "เพิ่มวันหยุดแล้ว",
      );
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit(overlaps !== null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มวันหยุด</DialogTitle>
          <DialogDescription>
            กำหนดวันหรือช่วงเวลาที่ไม่รับจอง — เช่น วันหยุดยาว, ปิดปรับปรุง
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="date">วันที่ *</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              disabled={isSaving}
              aria-invalid={!!errors.date}
            />
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="allDay" className="text-sm">
                ปิดทั้งวัน
              </Label>
              <p className="text-xs text-muted-foreground">
                {form.allDay
                  ? "ไม่รับจองทั้งวัน · ไม่ส่งสรุปเช้าและแจ้งเตือนเข้ากลุ่ม"
                  : "ปิดเฉพาะช่วงเวลา · ร้านยังเปิดช่วงอื่น"}
              </p>
            </div>
            <Switch
              id="allDay"
              checked={form.allDay}
              onCheckedChange={(v) => update("allDay", v)}
              disabled={isSaving}
            />
          </div>

          {!form.allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">เวลาเริ่ม *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => update("startTime", e.target.value)}
                  disabled={isSaving}
                  aria-invalid={!!errors.startTime}
                />
                {errors.startTime && (
                  <p className="text-sm text-destructive">{errors.startTime}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">เวลาสิ้นสุด *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => update("endTime", e.target.value)}
                  disabled={isSaving}
                  aria-invalid={!!errors.endTime}
                />
                {errors.endTime && (
                  <p className="text-sm text-destructive">{errors.endTime}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">เหตุผล</Label>
            <Input
              id="reason"
              value={form.reason}
              onChange={(e) => update("reason", e.target.value)}
              placeholder="เช่น วันสงกรานต์, ปิดปรับปรุง (ไม่บังคับ)"
              disabled={isSaving}
              aria-invalid={!!errors.reason}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason}</p>
            )}
          </div>

          {overlaps && (
            <div
              role="alert"
              className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                ช่วงนี้มีคิวที่จองไว้แล้ว {overlaps.length} คิว
              </div>
              <ul className="space-y-1 text-sm text-amber-900">
                {overlaps.map((b) => (
                  <li key={b.code} className="flex justify-between gap-2">
                    <span>
                      {formatInTimeZone(
                        new Date(b.startsAt),
                        BANGKOK_TZ,
                        "d MMM HH:mm",
                      )}{" "}
                      · {b.customerName}
                    </span>
                    <span className="font-mono text-xs">{b.customerPhone}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-800">
                คิวเหล่านี้จะไม่ถูกยกเลิกอัตโนมัติ — ต้องติดต่อลูกค้าเอง
                แล้วเปลี่ยนสถานะในหน้าการจอง
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant={overlaps ? "destructive" : "default"}
              disabled={isSaving}
            >
              {isSaving
                ? "กำลังบันทึก..."
                : overlaps
                  ? "ยืนยันเพิ่มวันหยุด"
                  : "เพิ่ม"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
