/**
 * ข้อความ LINE ที่ส่งหาลูกค้า (Day 40)
 *
 * - bookingConfirmationMessage : รายละเอียดการจอง + ปุ่ม [ยกเลิกการจอง]
 * - cancelConfirmMessage       : ถามซ้ำก่อนยกเลิก (กันกดพลาด)
 *
 * ปุ่มใช้ postback → webhook รับ data "action=...&code=..."
 *   cancel          → ถามซ้ำ
 *   cancel_confirm  → ยกเลิกจริง
 *   cancel_keep     → ไม่ยกเลิก
 * ⚠️ data มีแค่รหัสจอง — สิทธิ์ตรวจใน webhook เสมอ (userId ต้องตรงกับคิว)
 */

import type { LineMessage } from "@/lib/line";
import { formatBangkokDate, formatBangkokTime } from "@/lib/line";

export interface MessageBooking {
  code: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  price: number;
}

export type CustomerAction = "cancel" | "cancel_confirm" | "cancel_keep";

/**
 * ปุ่ม [ยืนยันยกเลิก] ใช้ได้กี่นาทีหลังถาม
 * LINE แก้/ปิดปุ่มในข้อความที่ส่งแล้วไม่ได้ → ใส่เวลาที่ถามไว้ใน data แล้วเช็คตอนกด
 * กันกดพลาดย้อนหลัง (เลื่อนแชทขึ้นไปเจอข้อความถามซ้ำอันเก่า)
 */
export const CANCEL_CONFIRM_TTL_MIN = 10;

export function postbackData(
  action: CustomerAction,
  code: string,
  issuedAt?: Date,
): string {
  const params = new URLSearchParams({ action, code });
  if (issuedAt) params.set("t", String(Math.floor(issuedAt.getTime() / 1000)));
  return params.toString();
}

export interface ParsedPostback {
  action: CustomerAction;
  code: string;
  /** เวลาที่ส่งข้อความถาม (เฉพาะ cancel_confirm) */
  issuedAt: Date | null;
}

export function parsePostbackData(data: string): ParsedPostback | null {
  const params = new URLSearchParams(data);
  const action = params.get("action");
  const code = params.get("code");
  if (!code) return null;
  if (
    action !== "cancel" &&
    action !== "cancel_confirm" &&
    action !== "cancel_keep"
  ) {
    return null;
  }
  const t = Number(params.get("t"));
  return {
    action,
    code,
    issuedAt: Number.isFinite(t) && t > 0 ? new Date(t * 1000) : null,
  };
}

/** ปุ่มยืนยันยกเลิกหมดอายุหรือยัง (ไม่มีเวลา = ข้อความรุ่นเก่า → ถือว่าหมดอายุ) */
export function isConfirmExpired(issuedAt: Date | null): boolean {
  if (!issuedAt) return true;
  return Date.now() - issuedAt.getTime() > CANCEL_CONFIRM_TTL_MIN * 60 * 1000;
}

const MUTED = "#888888";

function row(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: MUTED, size: "sm", flex: 2 },
      { type: "text", text: value, size: "sm", flex: 5, wrap: true },
    ],
  };
}

/** รายละเอียดการจอง + ปุ่มยกเลิก (Flex bubble) */
export function bookingConfirmationMessage(b: MessageBooking): LineMessage {
  const date = formatBangkokDate(b.startsAt);
  const time = `${formatBangkokTime(b.startsAt)} - ${formatBangkokTime(b.endsAt)} น.`;

  return {
    type: "flex",
    altText: `ยืนยันการจอง Nebula Spa · ${b.serviceName} ${date} ${formatBangkokTime(b.startsAt)} น.`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "จองเรียบร้อยแล้ว ✅",
            weight: "bold",
            size: "lg",
          },
          { type: "text", text: "Nebula Spa", size: "sm", color: MUTED },
          { type: "separator", margin: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "sm",
            contents: [
              row("บริการ", b.serviceName),
              row("วัน", date),
              row("เวลา", time),
              row("ราคา", `${b.price.toLocaleString()} บาท`),
              row("รหัสจอง", b.code),
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "ยกเลิกการจอง",
              data: postbackData("cancel", b.code),
              displayText: "ขอยกเลิกการจอง",
            },
          },
          {
            type: "text",
            text: "ต้องการเลื่อนนัด กรุณาโทรหาร้าน",
            size: "xs",
            color: MUTED,
            align: "center",
            wrap: true,
          },
        ],
      },
    },
  };
}

/** ถามซ้ำก่อนยกเลิก (confirm template — 2 ปุ่ม) · ปุ่มยืนยันใช้ได้ CANCEL_CONFIRM_TTL_MIN นาที */
export function cancelConfirmMessage(b: MessageBooking): LineMessage {
  const when = `${formatBangkokDate(b.startsAt)} ${formatBangkokTime(b.startsAt)} น.`;
  return {
    type: "template",
    altText: `ยืนยันยกเลิกการจอง ${b.code}`,
    template: {
      type: "confirm",
      text: `ยกเลิกคิวนี้ใช่ไหม?\n${b.serviceName}\n${when}\n(กดยืนยันภายใน ${CANCEL_CONFIRM_TTL_MIN} นาที)`,
      actions: [
        {
          type: "postback",
          label: "ยืนยันยกเลิก",
          data: postbackData("cancel_confirm", b.code, new Date()),
          displayText: "ยืนยันยกเลิก",
        },
        {
          type: "postback",
          label: "ไม่ยกเลิก",
          data: postbackData("cancel_keep", b.code),
          displayText: "ไม่ยกเลิก",
        },
      ],
    },
  };
}

export function textMessage(text: string): LineMessage {
  return { type: "text", text };
}
