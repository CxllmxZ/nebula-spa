"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Lock, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Liff = (typeof import("@line/liff"))["default"];

/**
 * การ์ดเชื่อม LINE บนหน้ายืนยันการจอง (Day 40 — ใช้งานจริง)
 *
 * 01 เชื่อม LINE : LIFF login → ส่ง ID token ให้ server ตรวจ → ผูกกับคิว
 * 02 เพิ่มเพื่อน  : ถ้ายังไม่เป็นเพื่อน OA → ปุ่มแอดเพื่อน (แอดแล้ว webhook ส่งรายละเอียดให้)
 * 03 เสร็จ       : ได้ข้อความรายละเอียด + ปุ่มยกเลิกทาง LINE
 *
 * หลัง liff.login() LINE พากลับมาหน้าเดิม → mount ใหม่ → init แล้วเห็นว่า login แล้ว → ผูกต่ออัตโนมัติ
 */

type FlowState = "initial" | "authed" | "complete";
type StepStatus = "locked" | "active" | "complete";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
const OA_BASIC_ID = process.env.NEXT_PUBLIC_LINE_OA_BASIC_ID ?? "";
const ADD_FRIEND_URL = OA_BASIC_ID
  ? `https://line.me/R/ti/p/${encodeURIComponent(OA_BASIC_ID)}`
  : "";

const LINK_ERRORS: Record<string, string> = {
  LINKED_TO_OTHER: "คิวนี้เชื่อมกับ LINE บัญชีอื่นไปแล้ว",
  PHONE_TAKEN:
    "เบอร์โทรนี้เชื่อมกับ LINE บัญชีอื่นไปแล้ว — ติดต่อร้านเพื่อเปลี่ยนบัญชี",
  CLOSED: "คิวนี้ถูกยกเลิกหรือเลยเวลานัดแล้ว",
  NOT_FOUND: "ไม่พบคิวนี้",
  INVALID_TOKEN: "การเข้าสู่ระบบ LINE หมดอายุ — กดเชื่อมอีกครั้ง",
};

function LineIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 5.58 2 10c0 3.94 3.44 7.23 8.07 7.86.32.07.75.21.86.48.1.24.06.62.03.86l-.14.83c-.04.24-.19.96.84.52 1.03-.44 5.55-3.27 7.57-5.6C20.72 13.32 22 11.77 22 10c0-4.42-4.48-8-10-8z" />
    </svg>
  );
}

type Props = {
  code: string;
  /** คิวนี้ผูก LINE ไว้แล้ว (จาก server) */
  initialLinked: boolean;
};

export function LineConnectCard({ code, initialLinked }: Props) {
  const [state, setState] = useState<FlowState>(
    initialLinked ? "authed" : "initial",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const liffRef = useRef<Liff | null>(null);

  /** โหลด SDK เฉพาะตอนใช้ (ไม่ถ่วงหน้าแรก) + init ครั้งเดียว */
  const getLiff = useCallback(async (): Promise<Liff> => {
    if (liffRef.current) return liffRef.current;
    const liff = (await import("@line/liff")).default;
    await liff.init({ liffId: LIFF_ID });
    liffRef.current = liff;
    return liff;
  }, []);

  /** login แล้ว → ส่ง ID token ให้ server ผูก → เช็คว่าเป็นเพื่อน OA หรือยัง */
  const linkAndCheckFriend = useCallback(
    async (liff: Liff) => {
      const idToken = liff.getIDToken();
      if (!idToken) throw new Error("INVALID_TOKEN");

      const res = await fetch("/api/line/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, idToken }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { code?: string };
        if (data.code === "INVALID_TOKEN") liff.logout(); // ให้ login ใหม่ได้
        throw new Error(data.code ?? "UNKNOWN");
      }

      const { friendFlag } = await liff.getFriendship();
      setState(friendFlag ? "complete" : "authed");
    },
    [code],
  );

  // กลับมาจากหน้า login ของ LINE → ทำต่ออัตโนมัติ
  useEffect(() => {
    if (!LIFF_ID) return;
    let cancelled = false;
    (async () => {
      try {
        const liff = await getLiff();
        if (cancelled || !liff.isLoggedIn()) return;
        setBusy(true);
        await linkAndCheckFriend(liff);
      } catch (err) {
        if (!cancelled) setError(toMessage(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getLiff, linkAndCheckFriend]);

  async function handleConnect() {
    setError(null);
    setBusy(true);
    try {
      const liff = await getLiff();
      if (!liff.isLoggedIn()) {
        // ไปหน้า LINE แล้วกลับมาที่หน้านี้ → useEffect ทำต่อ
        liff.login({ redirectUri: window.location.href });
        return;
      }
      await linkAndCheckFriend(liff);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRecheckFriend() {
    setError(null);
    setBusy(true);
    try {
      const liff = await getLiff();
      if (!liff.isLoggedIn()) {
        // ผูกไว้จากเครื่องอื่น → ไม่รู้สถานะเพื่อน ถือว่าเสร็จ (แอดเมื่อไหร่ webhook ส่งให้)
        setState("complete");
        return;
      }
      const { friendFlag } = await liff.getFriendship();
      if (friendFlag) setState("complete");
      else
        setError("ยังไม่พบการเพิ่มเพื่อน — กดเพิ่มเพื่อนก่อน แล้วลองอีกครั้ง");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!LIFF_ID) return null; // ยังไม่ได้ตั้งค่า LIFF → ไม่โชว์การ์ด

  const authStatus: StepStatus = state === "initial" ? "active" : "complete";
  const friendStatus: StepStatus =
    state === "initial" ? "locked" : state === "authed" ? "active" : "complete";

  return (
    <div className="mt-6">
      <div className="space-y-3">
        {/* Step 01: Auth */}
        <StepShell
          number="01"
          title="เชื่อม LINE"
          status={authStatus}
          summary="เชื่อม LINE กับการจองนี้แล้ว"
        >
          <AuthStepContent busy={busy} onConnect={handleConnect} />
        </StepShell>

        {/* Step 02: Add Friend */}
        <StepShell
          number="02"
          title="เพิ่มเพื่อน"
          status={friendStatus}
          summary={`เพิ่ม ${OA_BASIC_ID} เป็นเพื่อนแล้ว`}
        >
          {skipped ? (
            <p className="text-sm tracking-wide text-foreground/70">
              เพิ่มเพื่อนภายหลังได้ —
              ระบบจะส่งรายละเอียดการจองให้ทันทีที่เพิ่มเพื่อน
            </p>
          ) : (
            <FriendStepContent
              busy={busy}
              onRecheck={handleRecheckFriend}
              onSkip={() => setSkipped(true)}
            />
          )}
        </StepShell>

        {/* Step 03: Complete */}
        {state === "complete" && <CompleteCard />}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm tracking-wide text-foreground/90"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function toMessage(err: unknown): string {
  const key = err instanceof Error ? err.message : "";
  return LINK_ERRORS[key] ?? "เชื่อม LINE ไม่สำเร็จ — ลองใหม่อีกครั้ง";
}

/* ─── Shared step wrapper ─── */
function StepShell({
  number,
  title,
  status,
  summary,
  children,
}: {
  number: string;
  title: string;
  status: StepStatus;
  summary?: string;
  children: React.ReactNode;
}) {
  const locked = status === "locked";
  const complete = status === "complete";
  const active = status === "active";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 transition-all duration-300",
        locked && "border-primary/5 bg-card/30 opacity-40",
        complete && "border-[#06C755]/40 bg-card/60",
        active && "border-[#06C755]/40 bg-card",
      )}
    >
      {active && (
        <div className="absolute inset-x-0 top-0 h-[3px] bg-[#06C755]" />
      )}

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.32em] text-primary md:text-sm">
          {number}
        </span>
        <h3 className="font-serif text-base font-medium tracking-wide text-foreground md:text-lg">
          {title}
        </h3>
        {locked && (
          <Lock className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.5} />
        )}
        {complete && (
          <Check className="h-4 w-4 text-[#06C755]" strokeWidth={3} />
        )}
      </div>

      <div className="mt-3">
        {complete && summary ? (
          <div className="text-sm tracking-wide text-foreground/70">
            {summary}
          </div>
        ) : (
          !locked && children
        )}
      </div>
    </section>
  );
}

/* ─── Step 01 content ─── */
function AuthStepContent({
  busy,
  onConnect,
}: {
  busy: boolean;
  onConnect: () => void;
}) {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#06C755]">
          <LineIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm tracking-wide text-foreground/80">
            รับรายละเอียดการจองทาง LINE
          </p>
          <p className="mt-0.5 text-[12px] tracking-wide text-foreground/50">
            ฟรี · ใช้เวลาไม่ถึงนาที
          </p>
        </div>
      </div>

      <ul className="mb-5 space-y-1.5 text-sm tracking-wide text-foreground/80">
        {[
          "เก็บรายละเอียดการจองไว้ในแชท ไม่ต้องจำรหัส",
          "ยกเลิกได้จาก LINE ไม่ต้องโทร",
        ].map((b) => (
          <li key={b} className="flex items-baseline gap-2">
            <Check
              className="h-3.5 w-3.5 shrink-0 text-[#06C755]"
              strokeWidth={2.5}
            />
            {b}
          </li>
        ))}
      </ul>

      <ActionButton
        label="เชื่อม LINE"
        icon={<LineIcon className="h-4 w-4" />}
        busy={busy}
        onClick={onConnect}
      />
    </>
  );
}

/* ─── Step 02 content ─── */
function FriendStepContent({
  busy,
  onRecheck,
  onSkip,
}: {
  busy: boolean;
  onRecheck: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#06C755]">
          <UserPlus className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm tracking-wide text-foreground/80">
            เพิ่มร้าน{" "}
            <span className="font-medium text-primary">{OA_BASIC_ID}</span>{" "}
            เป็นเพื่อน
          </p>
          <p className="mt-0.5 text-[12px] tracking-wide text-foreground/50">
            เพื่อให้ร้านส่งรายละเอียดการจองหาคุณได้
          </p>
        </div>
      </div>

      <a
        href={ADD_FRIEND_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex w-full items-center justify-center gap-2 rounded-full bg-[#06C755] px-4 py-3.5 text-sm font-medium tracking-[0.14em] text-white transition-opacity hover:opacity-90"
      >
        <UserPlus className="h-4 w-4" strokeWidth={2} />
        เพิ่มเพื่อน
      </a>
      <button
        type="button"
        onClick={onRecheck}
        disabled={busy}
        className="mt-2 w-full px-2 py-2.5 text-[13px] tracking-wide text-primary disabled:opacity-50"
      >
        {busy ? "กำลังตรวจสอบ..." : "เพิ่มแล้ว ตรวจอีกครั้ง"}
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="w-full px-2 py-2 text-[13px] tracking-wide text-foreground/40 hover:text-foreground/60"
      >
        ข้ามไปก่อน
      </button>
    </>
  );
}

/* ─── Step 03: Complete card ─── */
function CompleteCard() {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[#06C755]/40 bg-card p-5">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[#06C755]" />

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#06C755]/15">
          <Check className="h-6 w-6 text-[#06C755]" strokeWidth={3} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.32em] text-primary md:text-sm">
              03
            </span>
            <h3 className="font-serif text-base font-medium tracking-wide text-foreground md:text-lg">
              เชื่อมครบแล้ว
            </h3>
          </div>
          <p className="mt-1.5 text-sm tracking-wide text-foreground/70">
            ดูรายละเอียดและยกเลิกการจองได้ในแชท LINE ของร้าน
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Shared CTA ─── */
function ActionButton({
  label,
  icon,
  busy,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="relative flex w-full items-center justify-center gap-2 rounded-full bg-[#06C755] px-4 py-3.5 text-sm font-medium tracking-[0.14em] text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {busy ? "กำลังเชื่อม..." : label}
    </button>
  );
}
