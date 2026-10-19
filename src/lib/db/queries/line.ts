/**
 * LINE queries — line_settings (singleton) + line_link_codes
 *
 * Business logic layer — no HTTP concerns.
 */

import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lineLinkCodes, lineSettings } from "@/lib/db/schema";
import type { LineSettings } from "@/lib/db/schema";

const SETTINGS_ID = 1;
const LINK_CODE_TTL_MIN = 30;

export type LinkCodePurpose = "owner" | "staff_group";

// ─────────────────────────────────────────────────────────────
// Settings (singleton row id = 1)
// ─────────────────────────────────────────────────────────────

/**
 * อ่าน settings — ถ้ายังไม่มีแถว สร้างให้ด้วยค่า default
 * (ไม่ insert ใน migration → seed/reset DB แล้วไม่พัง)
 */
export async function getLineSettings(): Promise<LineSettings> {
  const db = await getDb();

  await db
    .insert(lineSettings)
    .values({ id: SETTINGS_ID })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(lineSettings)
    .where(eq(lineSettings.id, SETTINGS_ID))
    .limit(1);

  return row;
}

/** ผูก LINE เจ้าของร้าน */
export async function setOwnerLineUserId(userId: string): Promise<void> {
  const db = await getDb();
  await getLineSettings(); // ensure row
  await db
    .update(lineSettings)
    .set({ ownerLineUserId: userId })
    .where(eq(lineSettings.id, SETTINGS_ID));
}

/**
 * ผูกกลุ่มพนักงาน
 * @returns groupId เดิมที่ถูกแทนที่ (caller ให้บอทออกจากกลุ่มนั้น) หรือ null
 */
export async function linkStaffGroup(groupId: string): Promise<string | null> {
  const db = await getDb();
  const current = await getLineSettings();

  const previousGroupId =
    current.staffGroupStatus === "linked" &&
    current.staffGroupId &&
    current.staffGroupId !== groupId
      ? current.staffGroupId
      : null;

  await db
    .update(lineSettings)
    .set({
      staffGroupId: groupId,
      staffGroupStatus: "linked",
      staffGroupLinkedAt: new Date(),
      staffGroupDisconnectedAt: null,
    })
    .where(eq(lineSettings.id, SETTINGS_ID));

  return previousGroupId;
}

/**
 * บอทออกจากกลุ่ม (event leave)
 * @returns true ถ้าเป็นกลุ่มที่ผูกไว้ (caller แจ้งเจ้าของ) / false = กลุ่มอื่น ไม่สนใจ
 */
export async function markStaffGroupDisconnected(
  groupId: string,
): Promise<boolean> {
  const db = await getDb();

  const updated = await db
    .update(lineSettings)
    .set({
      staffGroupStatus: "disconnected",
      staffGroupDisconnectedAt: new Date(),
    })
    .where(
      and(
        eq(lineSettings.id, SETTINGS_ID),
        eq(lineSettings.staffGroupId, groupId),
        eq(lineSettings.staffGroupStatus, "linked"),
      ),
    )
    .returning({ id: lineSettings.id });

  return updated.length > 0;
}

// ─────────────────────────────────────────────────────────────
// Link codes
// ─────────────────────────────────────────────────────────────

/** รหัส 6 หลัก (มี 0 นำหน้าได้) — crypto RNG ไม่ใช่ Math.random */
function generateSixDigitCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

/**
 * สร้างรหัสใหม่ — รหัสเก่าที่ยังไม่ใช้ของ purpose เดียวกันถูกทำให้ใช้ไม่ได้
 * (ใช้จาก admin endpoint — session ถัดไป)
 */
export async function createLinkCode(
  purpose: LinkCodePurpose,
): Promise<{ code: string; expiresAt: Date }> {
  const db = await getDb();
  const now = new Date();

  // ปิดรหัสเก่า purpose เดียวกัน
  await db
    .update(lineLinkCodes)
    .set({ usedAt: now })
    .where(
      and(eq(lineLinkCodes.purpose, purpose), isNull(lineLinkCodes.usedAt)),
    );

  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MIN * 60 * 1000);

  // retry ถ้าชน PK (โอกาสต่ำมาก)
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateSixDigitCode();
    try {
      await db.insert(lineLinkCodes).values({ code, purpose, expiresAt });
      return { code, expiresAt };
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("UNIQUE constraint failed") &&
        attempt < 2
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to generate link code");
}

/**
 * ใช้รหัส — atomic ในคำสั่งเดียว (ใช้แล้ว / หมดอายุ / purpose ผิด = ไม่ผ่าน)
 * กันกรณีส่งรหัสเดียวกัน 2 ครั้งพร้อมกันแล้วผ่านทั้งคู่
 */
export async function consumeLinkCode(
  code: string,
  purpose: LinkCodePurpose,
): Promise<boolean> {
  const db = await getDb();
  const now = new Date();

  const consumed = await db
    .update(lineLinkCodes)
    .set({ usedAt: now })
    .where(
      and(
        eq(lineLinkCodes.code, code),
        eq(lineLinkCodes.purpose, purpose),
        isNull(lineLinkCodes.usedAt),
        gt(lineLinkCodes.expiresAt, now),
      ),
    )
    .returning({ code: lineLinkCodes.code });

  return consumed.length > 0;
}

// ─────────────────────────────────────────────────────────────
// Admin (หน้า settings → LINE)
// ─────────────────────────────────────────────────────────────

export interface LineSettingsPatch {
  ownerNotifyEnabled?: boolean;
  summaryEnabled?: boolean;
  summaryTime?: string; // HH:MM
}

export async function updateLineSettings(
  patch: LineSettingsPatch,
): Promise<LineSettings> {
  const db = await getDb();
  await getLineSettings(); // ensure row
  if (Object.keys(patch).length > 0) {
    await db
      .update(lineSettings)
      .set(patch)
      .where(eq(lineSettings.id, SETTINGS_ID));
  }
  return getLineSettings();
}

export async function unlinkOwner(): Promise<void> {
  const db = await getDb();
  await getLineSettings();
  await db
    .update(lineSettings)
    .set({ ownerLineUserId: null })
    .where(eq(lineSettings.id, SETTINGS_ID));
}

/**
 * ยกเลิกผูกกลุ่ม
 * @returns groupId เดิม (caller ให้บอทออกจากกลุ่ม) หรือ null
 */
export async function unlinkStaffGroup(): Promise<string | null> {
  const db = await getDb();
  const current = await getLineSettings();
  await db
    .update(lineSettings)
    .set({
      staffGroupId: null,
      staffGroupStatus: "not_linked",
      staffGroupLinkedAt: null,
      staffGroupDisconnectedAt: null,
    })
    .where(eq(lineSettings.id, SETTINGS_ID));
  return current.staffGroupStatus === "linked" ? current.staffGroupId : null;
}
