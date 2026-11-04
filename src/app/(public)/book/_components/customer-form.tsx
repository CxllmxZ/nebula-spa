"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADVANCE_BOOKING_DAYS } from "@/lib/booking-rules";

/**
 * จองไม่ผ่านแล้วต้องทำอะไรต่อ
 * - stay:      อยู่หน้าฟอร์ม โชว์ข้อความ (Turnstile / เน็ต / server)
 * - pickTime:  เวลานี้ใช้ไม่ได้แล้ว → กลับไปเลือกเวลา (โหลดเวลาว่างใหม่)
 * - pickDate:  วันนี้ใช้ไม่ได้ → กลับไปเลือกวัน
 */
export type BookingFailAction = "stay" | "pickTime" | "pickDate";

type Props = {
  booking: {
    serviceId: number;
    date: string;
    startTime: string;
  };
  summary: string; // for display
  /** pickTime / pickDate → ให้ booking-flow พากลับไปขั้นตอนนั้น พร้อมข้อความ */
  onFail?: (
    action: Exclude<BookingFailAction, "stay">,
    message: string,
  ) => void;
};

const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

/** server ส่งชื่อ error มาใน `code` (ดู api/bookings/route.ts) */
function mapError(
  status: number,
  code?: string,
): { action: BookingFailAction; message: string } {
  switch (code) {
    case "SLOT_CONFLICT":
      return {
        action: "pickTime",
        message: "เวลานี้มีคนจองไปก่อนแล้ว — กรุณาเลือกเวลาใหม่",
      };
    case "SLOT_UNAVAILABLE":
      return {
        action: "pickTime",
        message: "เวลานี้ไม่เปิดรับจองแล้ว — กรุณาเลือกเวลาใหม่",
      };
    case "PAST_DATE":
      return {
        action: "pickDate",
        message: "วันหรือเวลานี้ผ่านไปแล้ว — กรุณาเลือกใหม่",
      };
    case "BEYOND_ADVANCE_LIMIT":
      return {
        action: "pickDate",
        message: `จองล่วงหน้าได้ไม่เกิน ${ADVANCE_BOOKING_DAYS} วัน — กรุณาเลือกวันที่ใกล้กว่านี้`,
      };
    case "TURNSTILE_FAILED":
      return {
        action: "stay",
        message:
          "ยืนยันว่าไม่ใช่บอทไม่สำเร็จ — รอให้กล่องยืนยันขึ้นเครื่องหมายถูก แล้วกดจองอีกครั้ง",
      };
    case "SERVICE_NOT_FOUND":
      return {
        action: "stay",
        message: "บริการนี้ปิดรับจองแล้ว — กรุณารีเฟรชหน้าแล้วเลือกบริการใหม่",
      };
  }
  if (status === 400)
    return {
      action: "stay",
      message: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบชื่อและเบอร์โทร",
    };
  return {
    action: "stay",
    message: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หรือโทรจองกับทางร้าน",
  };
}

export function CustomerForm({ booking, summary, onFail }: Props) {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = name.trim().length >= 2;
  const phoneValid = /^0\d{9}$/.test(phone.trim());
  const canSubmit = nameValid && phoneValid && !!turnstileToken && !submitting;

  const resetTurnstile = () => {
    turnstileRef.current?.reset();
    setTurnstileToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          customerPhone: phone.trim(),
          serviceId: booking.serviceId,
          date: booking.date,
          time: booking.startTime,
          turnstileToken,
        }),
      });

      // 500 จาก Worker อาจไม่ใช่ JSON → อย่าให้ตกไปเป็น "เครือข่ายผิดพลาด"
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };

      if (!res.ok) {
        const { action, message } = mapError(res.status, data.code);
        resetTurnstile();
        setSubmitting(false);
        if (action !== "stay" && onFail) {
          onFail(action, message); // booking-flow พากลับไปขั้นตอนนั้น (ฟอร์มนี้จะถูกซ่อน)
          return;
        }
        setError(message);
        return;
      }

      if (data.code) {
        router.push(`/book/${data.code}`);
      } else {
        setError("ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง");
        resetTurnstile();
        setSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setError("เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง");
      resetTurnstile();
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Summary card */}
      <div className="rounded-xl border border-primary/10 bg-background/40 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-primary/70">
          สรุปการจอง
        </div>
        <div className="mt-2 text-sm tracking-wide text-foreground/80">
          {summary}
        </div>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="cust-name" className="text-sm tracking-wide">
          ชื่อ-นามสกุล
        </Label>
        <Input
          id="cust-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="สมชาย ใจดี"
          className="mt-2"
          maxLength={100}
          autoComplete="name"
          required
        />
      </div>

      {/* Phone */}
      <div>
        <Label htmlFor="cust-phone" className="text-sm tracking-wide">
          เบอร์โทร
        </Label>
        <Input
          id="cust-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          placeholder="0812345678"
          className="mt-2"
          maxLength={10}
          autoComplete="tel"
          required
        />
        <p className="mt-1 text-xs text-foreground/50">
          กรอก 10 หลัก ขึ้นต้นด้วย 0
        </p>
      </div>

      {/* Turnstile */}
      <div className="pt-2">
        <Turnstile
          ref={turnstileRef}
          siteKey={SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          onError={() => setTurnstileToken(null)}
          options={{ theme: "dark" }}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm tracking-wide text-foreground/90">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        size="lg"
        className="w-full rounded-full py-6 text-sm tracking-[0.14em]"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            กำลังยืนยัน...
          </>
        ) : (
          <>ยืนยันการจอง →</>
        )}
      </Button>

      {/* PDPA: ใช้ข้อมูลเพื่อให้บริการตามที่ลูกค้าขอจอง → แจ้งให้ทราบ ไม่ต้องติ๊กยินยอม */}
      <p className="text-center text-xs leading-relaxed tracking-wide text-foreground/50">
        การยืนยันการจองถือว่าคุณรับทราบ{" "}
        <Link
          href="/privacy"
          target="_blank"
          className="text-primary underline-offset-4 hover:underline"
        >
          นโยบายความเป็นส่วนตัว
        </Link>
      </p>
    </form>
  );
}
