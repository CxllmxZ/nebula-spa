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
import { Switch } from "@/components/ui/switch";
import { serviceCreateSchema } from "@/lib/validations";
import type { Service } from "@/lib/db/schema";

interface Props {
  /** null = create mode, Service = edit mode */
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  description: string;
  durationMin: string; // string for input control (parse on submit)
  price: string;
  isActive: boolean;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  durationMin: "60",
  price: "300",
  isActive: true,
};

export function ServiceFormDialog({ service, open, onOpenChange }: Props) {
  const router = useRouter();
  const isEdit = service !== null;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync form when service prop changes (open edit / switch between edits)
  useEffect(() => {
    if (service) {
      setForm({
        name: service.name,
        description: service.description ?? "",
        durationMin: String(service.durationMin),
        price: String(service.price),
        isActive: service.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [service, open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const input = {
      name: form.name,
      description: form.description,
      durationMin: Number(form.durationMin),
      price: Number(form.price),
      isActive: form.isActive,
    };
    console.log("[submit] input:", input);
    console.log(
      "[submit] description type:",
      typeof input.description,
      JSON.stringify(input.description),
    );

    //const parsed = serviceCreateSchema.safeParse(input);

    // Parse numbers + validate via zod (reuse create schema for both modes)
    const parsed = serviceCreateSchema.safeParse({
      name: form.name,
      description: form.description,
      durationMin: Number(form.durationMin),
      price: Number(form.price),
      isActive: form.isActive,
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
      const url = isEdit
        ? `/api/admin/services/${service.id}`
        : "/api/admin/services";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "บันทึกไม่สำเร็จ");
      }

      toast.success(isEdit ? "แก้ไขบริการแล้ว" : "เพิ่มบริการแล้ว");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "แก้ไขบริการ" : "เพิ่มบริการใหม่"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "ราคาและระยะเวลาที่แก้จะไม่กระทบการจองที่มีอยู่แล้ว (snapshot)"
              : "กรอกข้อมูลบริการ ราคาและระยะเวลาจะใช้กับการจองใหม่เท่านั้น"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อบริการ *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="เช่น นวดไทย 60 นาที"
              disabled={isSaving}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">คำอธิบาย</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="รายละเอียดสั้นๆ (ไม่บังคับ)"
              disabled={isSaving}
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Duration + Price (grid) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="durationMin">ระยะเวลา (นาที) *</Label>
              <Input
                id="durationMin"
                type="number"
                inputMode="numeric"
                min={15}
                max={240}
                step={15}
                value={form.durationMin}
                onChange={(e) => update("durationMin", e.target.value)}
                disabled={isSaving}
                aria-invalid={!!errors.durationMin}
              />
              {errors.durationMin && (
                <p className="text-sm text-destructive">{errors.durationMin}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">ราคา (บาท) *</Label>
              <Input
                id="price"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                disabled={isSaving}
                aria-invalid={!!errors.price}
              />
              {errors.price && (
                <p className="text-sm text-destructive">{errors.price}</p>
              )}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="isActive" className="text-sm">
                เปิดใช้งาน
              </Label>
              <p className="text-xs text-muted-foreground">
                ปิดเพื่อไม่ให้ลูกค้าเห็นในหน้าจอง (booking เก่ายังคงอยู่)
              </p>
            </div>
            <Switch
              id="isActive"
              checked={form.isActive}
              onCheckedChange={(v) => update("isActive", v)}
              disabled={isSaving}
            />
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
              {isSaving
                ? "กำลังบันทึก..."
                : isEdit
                  ? "บันทึกการแก้ไข"
                  : "เพิ่มบริการ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
