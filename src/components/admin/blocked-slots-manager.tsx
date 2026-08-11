"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
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
import { BlockedSlotFormDialog } from "./blocked-slot-form-dialog";

export interface BlockedSlotDTO {
  id: number;
  startsAt: string; // Bangkok ISO
  endsAt: string;
  reason: string | null;
  createdAt: string;
}

interface Props {
  initialSlots: BlockedSlotDTO[];
}

export function BlockedSlotsManager({ initialSlots }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function handleDelete(slot: BlockedSlotDTO) {
    const label = slot.reason ?? "วันหยุด";
    if (!confirm(`ลบ "${label}" ใช่หรือไม่?`)) return;

    setPendingId(slot.id);
    try {
      const res = await fetch(`/api/admin/blocked-slots/${slot.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "ลบไม่สำเร็จ");
      }
      toast.success("ลบวันหยุดแล้ว");
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">วันหยุด / ปิดพิเศษ</h2>
            <p className="text-sm text-muted-foreground">
              {initialSlots.length > 0
                ? `${initialSlots.length} รายการที่จะถึง`
                : "ยังไม่มีวันหยุดที่กำหนดไว้"}
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มวันหยุด
          </Button>
        </div>

        {initialSlots.length === 0 ? (
          <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
            ยังไม่มีวันหยุด — คลิก "เพิ่มวันหยุด" เพื่อกำหนดวันปิดพิเศษ
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>เวลา</TableHead>
                  <TableHead>เหตุผล</TableHead>
                  <TableHead className="w-20 text-right">ลบ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialSlots.map((s) => {
                  const start = parseISO(s.startsAt);
                  const end = parseISO(s.endsAt);
                  const isRowPending = pendingId === s.id;
                  return (
                    <TableRow
                      key={s.id}
                      className={isRowPending ? "opacity-50" : undefined}
                    >
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        {format(start, "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(start, "HH:mm")} - {format(end, "HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.reason ?? (
                          <span className="text-muted-foreground italic">
                            (ไม่ระบุเหตุผล)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s)}
                          disabled={isRowPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">ลบ</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <BlockedSlotFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
