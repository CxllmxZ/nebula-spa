"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import { formatCurrency } from "@/lib/format";
import type { Service } from "@/lib/db/schema";
import { ServiceFormDialog } from "./service-form-dialog";

interface Props {
  initialServices: Service[];
  isAdmin: boolean;
}

export function ServicesManager({ initialServices, isAdmin }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  function openCreate() {
    setEditingService(null);
    setDialogOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setDialogOpen(true);
  }

  async function toggleActive(service: Service, next: boolean) {
    setPendingId(service.id);
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "อัพเดตสถานะไม่สำเร็จ");
      }
      toast.success(
        next
          ? `เปิดใช้งาน "${service.name}" แล้ว`
          : `ปิดใช้งาน "${service.name}" แล้ว`,
      );
      startTransition(() => router.refresh());
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      toast.error(message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header + Add button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">บริการทั้งหมด</h2>
            <p className="text-sm text-muted-foreground">
              {initialServices.length} รายการ · เปิดใช้งาน{" "}
              {initialServices.filter((s) => s.isActive).length} รายการ
            </p>
          </div>
          {isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มบริการ
            </Button>
          )}
        </div>

        {/* Table */}
        {initialServices.length === 0 ? (
          <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
            ยังไม่มีบริการ — คลิก "เพิ่มบริการ" เพื่อเริ่มต้น
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-2">
              {initialServices.map((s) => {
                const isRowPending = pendingId === s.id;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-md border bg-card p-3",
                      isRowPending && "opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{s.name}</div>
                        {s.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {s.description}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground mt-1">
                          {s.durationMin} นาที · {formatCurrency(s.price)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {isAdmin && (
                          <Switch
                            checked={s.isActive}
                            disabled={isRowPending}
                            onCheckedChange={(next) => toggleActive(s, next)}
                          />
                        )}
                        <Badge
                          variant={s.isActive ? "default" : "outline"}
                          className="text-xs"
                        >
                          {s.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        </Badge>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="mt-2 pt-2 border-t flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => openEdit(s)}
                          disabled={isRowPending}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          แก้ไข
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block rounded-md border">
              <Table>
                {/* keep existing table structure — TableHeader + TableBody */}
                ...
              </Table>
            </div>
          </>
        )}
      </div>

      <ServiceFormDialog
        service={editingService}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
