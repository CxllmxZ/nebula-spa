/**
 * LINE settings → ข้อมูลที่ส่งไปหน้าเว็บ (ใช้ร่วม: API route + หน้า settings)
 *
 * ไม่ส่ง LINE user ID / group ID ออกไป — ส่งแค่สถานะ
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { LineSettings } from "@/lib/db/schema";
import { getLineSettings } from "@/lib/db/queries/line";
import { toBangkokIsoString } from "@/lib/datetime";

export interface LineSettingsDTO {
  owner: {
    linked: boolean;
    /** ยังไม่ผูก #owner แต่มี LINE_OWNER_USER_ID ใน env → ยังได้แจ้งเตือนอยู่ */
    usingFallback: boolean;
    notifyEnabled: boolean;
  };
  group: {
    status: "not_linked" | "linked" | "disconnected";
    linkedAt: string | null; // Bangkok ISO
    disconnectedAt: string | null;
  };
  summary: {
    enabled: boolean;
    time: string; // HH:MM
    lastSentDate: string | null;
  };
}

export function toLineSettingsDTO(
  s: LineSettings,
  hasEnvFallback: boolean,
): LineSettingsDTO {
  return {
    owner: {
      linked: !!s.ownerLineUserId,
      usingFallback: !s.ownerLineUserId && hasEnvFallback,
      notifyEnabled: s.ownerNotifyEnabled,
    },
    group: {
      status: s.staffGroupStatus,
      linkedAt: s.staffGroupLinkedAt
        ? toBangkokIsoString(s.staffGroupLinkedAt)
        : null,
      disconnectedAt: s.staffGroupDisconnectedAt
        ? toBangkokIsoString(s.staffGroupDisconnectedAt)
        : null,
    },
    summary: {
      enabled: s.summaryEnabled,
      time: s.summaryTime,
      lastSentDate: s.lastSummaryDate,
    },
  };
}

/** ใช้ใน Server Component — อ่าน settings + เช็ค env fallback */
export async function getLineSettingsDTO(): Promise<LineSettingsDTO> {
  const { env } = await getCloudflareContext({ async: true });
  const settings = await getLineSettings();
  return toLineSettingsDTO(settings, !!env.LINE_OWNER_USER_ID);
}
