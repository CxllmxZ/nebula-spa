"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * รับลูกค้าที่กลับมาจากหน้า login ของ LINE (Day 40)
 *
 * LINE พากลับมาที่ Endpoint URL ของ LIFF (/book) ไม่ใช่หน้าที่กดมา
 * แล้วแนบหน้าจริงไว้ใน ?liff.state=/book/XXXXXX
 * → ต้อง liff.init() ที่หน้านี้ LIFF ถึงจะเก็บการ login + พาไปหน้ายืนยันการจองให้
 *
 * ไม่มีพารามิเตอร์จาก LINE → ไม่ทำอะไร ไม่โหลด SDK (คนจองปกติไม่โดนถ่วง)
 */

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";

function cameFromLineLogin(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("liff.state") || params.has("liffClientId");
}

export function LiffRedirect() {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!LIFF_ID || !cameFromLineLogin()) return;
    setRedirecting(true);

    import("@line/liff")
      .then(({ default: liff }) => liff.init({ liffId: LIFF_ID }))
      .catch((err) => {
        console.error("[LIFF] init after login failed", err);
        setRedirecting(false); // พาไปต่อไม่ได้ → ให้เห็นหน้าจองตามปกติ
      });
    // สำเร็จ → LIFF เปลี่ยนหน้าให้เอง ไม่ต้อง setRedirecting(false)
  }, []);

  if (!redirecting) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm tracking-wide text-foreground/70">
        กำลังกลับไปหน้าการจองของคุณ...
      </p>
    </div>
  );
}
