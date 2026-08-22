"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

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
        <div className="flex items-center justify-between">
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อบริการ</TableHead>
                  <TableHead>ระยะเวลา</TableHead>
                  <TableHead className="text-right">ราคา</TableHead>
                  <TableHead>สถานะ</TableHead>
                  {isAdmin && (
                    <TableHead className="w-20 text-right">จัดการ</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialServices.map((s) => {
                  const isRowPending = pendingId === s.id;
                  return (
                    <TableRow
                      key={s.id}
                      className={isRowPending ? "opacity-50" : undefined}
                    >
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        {s.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {s.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.durationMin} นาที
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(s.price)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(s)}
                            disabled={isRowPending}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">แก้ไข</span>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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
