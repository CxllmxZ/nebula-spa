"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  booking: {
    serviceId: number;
    date: string;
    startTime: string;
  };
  summary: string; // for display
};

const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

function mapError(status: number, errorCode?: string): string {
  if (status === 409) return "เวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น";
  if (status === 422 && errorCode === "PAST_DATE")
    return "ไม่สามารถจองวันที่ผ่านมาแล้ว";
  if (status === 422 && errorCode === "BEYOND_ADVANCE_LIMIT")
    return "ไม่สามารถจองล่วงหน้าเกิน 30 วัน";
  if (status === 404) return "ไม่พบบริการนี้ กรุณาเริ่มใหม่";
  if (status === 400) return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export function CustomerForm({ booking, summary }: Props) {
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

      const data = (await res.json()) as {
        code?: string;
        error?: string;
        errorCode?: string;
      };

      if (!res.ok) {
        setError(mapError(res.status, data.errorCode));
        resetTurnstile();
        setSubmitting(false);
        return;
      }

      if (data.code) {
        router.push(`/book/${data.code}`);
      } else {
        setError("Response ผิดปกติ กรุณาลองใหม่");
        resetTurnstile();
        setSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดเครือข่าย ลองใหม่อีกครั้ง");
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
    </form>
  );
}
