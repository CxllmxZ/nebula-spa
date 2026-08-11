"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { blockedSlotCreateSchema } from "@/lib/validations";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  date: "",
  startTime: "10:00",
  endTime: "18:00",
  reason: "",
};

export function BlockedSlotFormDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog closes/opens
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = blockedSlotCreateSchema.safeParse({
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      reason: form.reason,
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
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "บันทึกไม่สำเร็จ");
      }
      toast.success("เพิ่มวันหยุดแล้ว");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มวันหยุด</DialogTitle>
          <DialogDescription>
            กำหนดช่วงเวลาที่ไม่รับจอง — เช่น วันหยุดยาว, ปิดปรับปรุง
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "กำลังบันทึก..." : "เพิ่ม"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
