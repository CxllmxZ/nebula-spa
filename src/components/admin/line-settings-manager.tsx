"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Copy, KeyRound, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { BANGKOK_TZ } from "@/lib/datetime";
import type { LineSettingsDTO } from "@/lib/line-settings-dto";

type Purpose = "owner" | "staff_group";

interface ActiveCode {
  code: string;
  expiresAt: string; // ISO
}

interface Props {
  initial: LineSettingsDTO;
}

/** เช็คสถานะใหม่ระหว่างรอผู้ใช้พิมพ์รหัสใน LINE */
const POLL_MS = 5000;

export function LineSettingsManager({ initial }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [codes, setCodes] = useState<Partial<Record<Purpose, ActiveCode>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // สรุปเช้า — ฟอร์มแบบมีปุ่มบันทึก (เหมือนหน้าเวลาทำการ)
  const [summaryEnabled, setSummaryEnabled] = useState(initial.summary.enabled);
  const [summaryTime, setSummaryTime] = useState(initial.summary.time);
  useEffect(() => {
    setSummaryEnabled(initial.summary.enabled);
    setSummaryTime(initial.summary.time);
  }, [initial.summary.enabled, initial.summary.time]);
  const summaryDirty =
    summaryEnabled !== initial.summary.enabled ||
    summaryTime !== initial.summary.time;

  // รหัสถูกใช้แล้ว (สถานะเปลี่ยน) → ซ่อนรหัส + แจ้ง
  useEffect(() => {
    if (initial.owner.linked && codes.owner) {
      setCodes((c) => ({ ...c, owner: undefined }));
      toast.success("เชื่อม LINE เจ้าของร้านแล้ว");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.owner.linked]);

  useEffect(() => {
    if (initial.group.status === "linked" && codes.staff_group) {
      setCodes((c) => ({ ...c, staff_group: undefined }));
      toast.success("เชื่อมกลุ่มพนักงานแล้ว");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.group.status, initial.group.linkedAt]);

  // มีรหัสค้างอยู่ → refresh เป็นระยะเพื่อดูว่าผูกสำเร็จหรือยัง
  const hasActiveCode = !!codes.owner || !!codes.staff_group;
  useEffect(() => {
    if (!hasActiveCode) return;
    const t = setInterval(
      () => startTransition(() => router.refresh()),
      POLL_MS,
    );
    return () => clearInterval(t);
  }, [hasActiveCode, router]);

  async function call(
    key: string,
    url: string,
    body: unknown,
    method: "POST" | "PATCH" = "POST",
  ): Promise<unknown> {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "ทำรายการไม่สำเร็จ");
      return data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function createCode(purpose: Purpose) {
    const data = (await call(`code-${purpose}`, "/api/admin/line/link-code", {
      purpose,
    })) as ActiveCode | null;
    if (data) setCodes((c) => ({ ...c, [purpose]: data }));
  }

  async function unlink(target: Purpose) {
    const label = target === "owner" ? "LINE เจ้าของร้าน" : "กลุ่มพนักงาน";
    const extra = target === "staff_group" ? " (บอทจะออกจากกลุ่ม)" : "";
    if (!confirm(`ยกเลิกการเชื่อม${label}ใช่หรือไม่?${extra}`)) return;
    const ok = await call(`unlink-${target}`, "/api/admin/line/unlink", {
      target,
    });
    if (ok) {
      toast.success(`ยกเลิกการเชื่อม${label}แล้ว`);
      startTransition(() => router.refresh());
    }
  }

  async function toggleOwnerNotify(next: boolean) {
    const ok = await call(
      "owner-notify",
      "/api/admin/line/settings",
      { ownerNotifyEnabled: next },
      "PATCH",
    );
    if (ok) {
      toast.success(
        next ? "เปิดแจ้งเตือนเจ้าของร้านแล้ว" : "ปิดแจ้งเตือนเจ้าของร้านแล้ว",
      );
      startTransition(() => router.refresh());
    }
  }

  async function saveSummary() {
    const ok = await call(
      "summary",
      "/api/admin/line/settings",
      { summaryEnabled, summaryTime },
      "PATCH",
    );
    if (ok) {
      toast.success("บันทึกสรุปคิวเช้าแล้ว");
      startTransition(() => router.refresh());
    }
  }

  const { owner, group } = initial;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">LINE</h2>
        <p className="text-sm text-muted-foreground">
          เชื่อม LINE เจ้าของร้านและกลุ่มพนักงาน เพื่อรับแจ้งเตือนคิว
        </p>
      </div>

      <div className="rounded-md border divide-y">
        {/* ── เจ้าของร้าน ─────────────────────────────────── */}
        <section className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">LINE เจ้าของร้าน</span>
                {owner.linked ? (
                  <Badge>เชื่อมแล้ว</Badge>
                ) : owner.usingFallback ? (
                  <Badge variant="secondary">ใช้ค่าจากระบบ</Badge>
                ) : (
                  <Badge variant="outline">ยังไม่เชื่อม</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                ได้รับรายละเอียดคิวครบ รวมเบอร์โทรลูกค้า — ส่งทุกวัน
                รวมวันร้านปิด
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => createCode("owner")}
                disabled={busy !== null}
              >
                <KeyRound className="mr-1 h-4 w-4" />
                {owner.linked ? "เปลี่ยนบัญชี" : "สร้างรหัสเชื่อม"}
              </Button>
              {owner.linked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => unlink("owner")}
                  disabled={busy !== null}
                >
                  <Unlink className="mr-1 h-4 w-4" />
                  ยกเลิก
                </Button>
              )}
            </div>
          </div>

          {codes.owner && (
            <CodeBox
              code={codes.owner}
              command="#owner"
              steps="แอดเพื่อน LINE ของร้าน แล้วพิมพ์ในแชทส่วนตัวกับร้าน:"
              onExpired={() => setCodes((c) => ({ ...c, owner: undefined }))}
            />
          )}

          {(owner.linked || owner.usingFallback) && (
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <Label htmlFor="owner-notify" className="text-sm cursor-pointer">
                แจ้งเตือนส่วนตัว
                <span className="block text-xs text-muted-foreground font-normal">
                  ปิดได้ถ้าอยู่ในกลุ่มพนักงานอยู่แล้ว (กันได้ข้อความซ้ำ)
                </span>
              </Label>
              <Switch
                id="owner-notify"
                checked={owner.notifyEnabled}
                onCheckedChange={toggleOwnerNotify}
                disabled={busy !== null}
              />
            </div>
          )}
        </section>

        {/* ── กลุ่มพนักงาน ─────────────────────────────────── */}
        <section className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">กลุ่มพนักงาน</span>
                {group.status === "linked" && <Badge>เชื่อมแล้ว</Badge>}
                {group.status === "disconnected" && (
                  <Badge variant="destructive">หลุด</Badge>
                )}
                {group.status === "not_linked" && (
                  <Badge variant="outline">ยังไม่เชื่อม</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {group.status === "linked" && group.linkedAt
                  ? `เชื่อมตั้งแต่ ${formatTh(group.linkedAt)} · แจ้งคิวใหม่/ยกเลิก (ไม่มีเบอร์โทรลูกค้า)`
                  : group.status === "disconnected" && group.disconnectedAt
                    ? `บอทออกจากกลุ่มเมื่อ ${formatTh(group.disconnectedAt)} — ระหว่างนี้แจ้งไปที่ LINE เจ้าของร้านแทน`
                    : "แจ้งคิวใหม่/ยกเลิกเข้ากลุ่ม LINE ที่พนักงานใช้อยู่ (ไม่มีเบอร์โทรลูกค้า)"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant={
                  group.status === "disconnected" ? "default" : "outline"
                }
                size="sm"
                onClick={() => createCode("staff_group")}
                disabled={busy !== null}
              >
                <KeyRound className="mr-1 h-4 w-4" />
                {group.status === "linked"
                  ? "เปลี่ยนกลุ่ม"
                  : group.status === "disconnected"
                    ? "เชื่อมกลุ่มใหม่"
                    : "สร้างรหัสเชื่อม"}
              </Button>
              {group.status === "linked" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => unlink("staff_group")}
                  disabled={busy !== null}
                >
                  <Unlink className="mr-1 h-4 w-4" />
                  ยกเลิก
                </Button>
              )}
            </div>
          </div>

          {codes.staff_group && (
            <CodeBox
              code={codes.staff_group}
              command="#link"
              steps="เชิญบัญชี LINE ของร้านเข้ากลุ่มพนักงาน แล้วพิมพ์ในกลุ่ม:"
              onExpired={() =>
                setCodes((c) => ({ ...c, staff_group: undefined }))
              }
            />
          )}
        </section>

        {/* ── สรุปคิวเช้า ─────────────────────────────────── */}
        <section className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <span className="font-medium">สรุปคิวเช้า</span>
              <p className="text-sm text-muted-foreground">
                ส่งรายการคิวของวันเข้ากลุ่มพนักงาน · ไม่ส่งวันที่ร้านปิดทั้งวัน
                {group.status === "not_linked" && " · ต้องเชื่อมกลุ่มก่อน"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSummaryEnabled(initial.summary.enabled);
                  setSummaryTime(initial.summary.time);
                }}
                disabled={!summaryDirty || busy !== null}
              >
                ยกเลิก
              </Button>
              <Button
                size="sm"
                onClick={saveSummary}
                disabled={!summaryDirty || busy !== null}
              >
                {busy === "summary" ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="summary-enabled"
                checked={summaryEnabled}
                onCheckedChange={setSummaryEnabled}
                disabled={busy !== null}
              />
              <Label
                htmlFor="summary-enabled"
                className="text-sm cursor-pointer"
              >
                {summaryEnabled ? "เปิด" : "ปิด"}
              </Label>
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="summary-time"
                className="text-xs text-muted-foreground"
              >
                เวลาส่ง
              </Label>
              <Select
                value={summaryTime}
                onValueChange={setSummaryTime}
                disabled={!summaryEnabled || busy !== null}
              >
                <SelectTrigger id="summary-time" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["06:00", "07:00", "08:00", "09:00"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t} น.
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ส่งจริงภายใน 15 นาทีหลังเวลาที่ตั้ง
          </p>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function CodeBox({
  code,
  command,
  steps,
  onExpired,
}: {
  code: ActiveCode;
  command: string;
  steps: string;
  onExpired: () => void;
}) {
  const remaining = useCountdown(code.expiresAt);
  const text = `${command} ${code.code}`;

  useEffect(() => {
    if (remaining <= 0) onExpired();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("คัดลอกแล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ — พิมพ์เองได้เลย");
    }
  }

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="rounded-md border border-dashed p-3 space-y-2">
      <p className="text-sm">{steps}</p>
      <div className="flex items-center gap-2">
        <code className="rounded bg-muted px-3 py-1.5 font-mono text-lg font-semibold tracking-wider">
          {text}
        </code>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copy}>
          <Copy className="h-4 w-4" />
          <span className="sr-only">คัดลอก</span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        หมดอายุใน {mm}:{ss} · ใช้ได้ครั้งเดียว ·
        หน้านี้จะอัปเดตเองเมื่อเชื่อมสำเร็จ
      </p>
    </div>
  );
}

function useCountdown(expiresAt: string): number {
  const calc = () =>
    Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
    );
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  return left;
}

function formatTh(iso: string): string {
  return formatInTimeZone(new Date(iso), BANGKOK_TZ, "d MMM yyyy HH:mm");
}
