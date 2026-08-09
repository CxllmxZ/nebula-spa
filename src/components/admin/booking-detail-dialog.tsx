"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { BANGKOK_TZ } from "@/lib/datetime";
import { formatCurrency } from "@/lib/format";
import {
  BOOKING_STATUS_CONFIG,
  BOOKING_STATUS_LIST,
} from "@/lib/booking-status";
import type {
  AdminBookingListItem,
  BookingStatus,
} from "@/lib/db/queries/bookings";

interface Props {
  booking: AdminBookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingDetailDialog({ booking, open, onOpenChange }: Props) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<BookingStatus | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync selected status when booking prop changes
  useEffect(() => {
    if (booking) setSelectedStatus(booking.status);
  }, [booking]);

  if (!booking) return null;

  const currentCfg = BOOKING_STATUS_CONFIG[booking.status];
  const hasChanges =
    selectedStatus !== null && selectedStatus !== booking.status;

  async function handleSave() {
    if (!booking || !selectedStatus || !hasChanges) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
      }
      toast.success(
        `เปลี่ยนสถานะเป็น "${BOOKING_STATUS_CONFIG[selectedStatus].label}" แล้ว`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>รายละเอียดการจอง</DialogTitle>
          <DialogDescription>
            รหัส: <span className="font-mono font-medium">{booking.code}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info grid */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <div className="text-muted-foreground">ลูกค้า</div>
            <div className="col-span-2 font-medium">{booking.customerName}</div>

            <div className="text-muted-foreground">เบอร์โทร</div>
            <div className="col-span-2">{booking.customerPhone}</div>

            <div className="text-muted-foreground">บริการ</div>
            <div className="col-span-2">
              {booking.serviceName}
              <span className="ml-2 text-xs text-muted-foreground">
                ({booking.durationMin} นาที)
              </span>
            </div>

            <div className="text-muted-foreground">วันเวลา</div>
            <div className="col-span-2 font-medium">
              {formatInTimeZone(
                booking.startsAt,
                BANGKOK_TZ,
                "d MMM yyyy, HH:mm",
              )}
            </div>

            <div className="text-muted-foreground">ราคา</div>
            <div className="col-span-2 font-medium">
              {formatCurrency(booking.price)}
            </div>

            <div className="text-muted-foreground">สถานะปัจจุบัน</div>
            <div className="col-span-2">
              <Badge variant={currentCfg.variant}>{currentCfg.label}</Badge>
            </div>

            {booking.notes && (
              <>
                <div className="text-muted-foreground">หมายเหตุ</div>
                <div className="col-span-2">{booking.notes}</div>
              </>
            )}

            <div className="text-muted-foreground">จองเมื่อ</div>
            <div className="col-span-2 text-xs text-muted-foreground">
              {formatInTimeZone(
                booking.createdAt,
                BANGKOK_TZ,
                "d MMM yyyy, HH:mm",
              )}
            </div>
          </div>

          {/* Status change section */}
          <div className="border-t pt-4 space-y-2">
            <Label htmlFor="status-select">เปลี่ยนสถานะ</Label>
            <Select
              value={selectedStatus ?? undefined}
              onValueChange={(v) => setSelectedStatus(v as BookingStatus)}
              disabled={isSaving}
            >
              <SelectTrigger id="status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_STATUS_LIST.map((s) => (
                  <SelectItem key={s} value={s}>
                    {BOOKING_STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            ยกเลิก
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
