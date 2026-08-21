"use client";

import { useState } from "react";
import { Check, Lock, Rocket, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type FlowState = "initial" | "authed" | "complete";
type StepStatus = "locked" | "active" | "complete";

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

export function LineConnectCard() {
  const [state, setState] = useState<FlowState>("initial");
  const showPreviewToggle = process.env.NEXT_PUBLIC_LINE_PREVIEW === "true";

  const authStatus: StepStatus = state === "initial" ? "active" : "complete";
  const friendStatus: StepStatus =
    state === "initial" ? "locked" : state === "authed" ? "active" : "complete";

  const stateLabels: Record<FlowState, string> = {
    initial: "1 · เริ่มต้น",
    authed: "2 · Auth ผ่าน",
    complete: "3 · เชื่อมครบ",
  };

  return (
    <div className="mt-6">
      {showPreviewToggle && (
        <div className="mb-4">
          <div className="mb-2 text-xs uppercase tracking-widest text-foreground/40">
            Preview mode
          </div>
          <div className="flex gap-1.5 rounded-full border border-primary/10 bg-background/40 p-1">
            {(["initial", "authed", "complete"] as FlowState[]).map((s) => {
              const active = state === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setState(s)}
                  className={cn(
                    "flex-1 cursor-pointer rounded-full px-3 py-2 text-[13px] tracking-wide transition-all",
                    active
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-foreground/60 hover:bg-primary/10 hover:text-foreground",
                  )}
                >
                  {stateLabels[s]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Step 01: Auth */}
        <StepShell
          number="01"
          title="เชื่อม LINE"
          status={authStatus}
          summary="เชื่อมต่อ LINE สำเร็จ · @nebulaspa รู้จักคุณแล้ว"
        >
          <AuthStepContent />
        </StepShell>

        {/* Step 02: Add Friend */}
        <StepShell
          number="02"
          title="เพิ่มเพื่อน"
          status={friendStatus}
          summary="เพิ่ม @nebulaspa เป็นเพื่อนแล้ว"
        >
          <FriendStepContent />
        </StepShell>

        {/* Step 03: Complete (only when everything done) */}
        {state === "complete" && <CompleteCard />}
      </div>
    </div>
  );
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
function AuthStepContent() {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#06C755]">
          <LineIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm tracking-wide text-foreground/80">
            เชื่อม LINE เพื่อรับการแจ้งเตือน
          </p>
          <p className="mt-0.5 text-[12px] tracking-wide text-foreground/50">
            ยืนยันด่วนก่อนถึงเวลา · ฟรี
          </p>
        </div>
      </div>

      <ul className="mb-5 space-y-1.5 text-sm tracking-wide text-foreground/80">
        {[
          "แจ้งเตือน 6 ชม. ก่อนถึงเวลา",
          "ยืนยัน/ยกเลิกจาก LINE",
          "ส่วนลด 10% ครั้งถัดไป",
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

      <ConnectButton
        label="เชื่อม LINE"
        icon={<LineIcon className="h-4 w-4" />}
      />
    </>
  );
}

/* ─── Step 02 content ─── */
function FriendStepContent() {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#06C755]">
          <UserPlus className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm tracking-wide text-foreground/80">
            เพิ่มร้าน{" "}
            <span className="font-medium text-primary">@nebulaspa</span>{" "}
            เป็นเพื่อน
          </p>
          <p className="mt-0.5 text-[12px] tracking-wide text-foreground/50">
            เพื่อให้ระบบส่งข้อความหาคุณได้
          </p>
        </div>
      </div>

      <ConnectButton
        label="เพิ่มเพื่อน"
        icon={<UserPlus className="h-4 w-4" strokeWidth={2} />}
      />
      <button
        type="button"
        disabled
        className="mt-1 w-full px-2 py-2.5 text-[13px] tracking-wide text-foreground/40 disabled:cursor-not-allowed"
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
              พร้อมรับการแจ้งเตือน
            </h3>
          </div>
          <p className="mt-1.5 text-sm tracking-wide text-foreground/70">
            ทุกอย่างเชื่อมครบแล้ว จะแจ้งเตือน 6 ชม. ก่อนถึงเวลา
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Shared disabled CTA ─── */
function ConnectButton({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      title="จะเปิดใช้งานเร็วๆนี้"
      className="relative flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-[#06C755] px-4 py-3.5 text-sm font-medium tracking-[0.14em] text-white opacity-70"
    >
      {icon}
      {label}
      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] tracking-widest">
        <Rocket className="h-2.5 w-2.5" strokeWidth={2.5} />
        เร็วๆนี้
      </span>
    </button>
  );
}
