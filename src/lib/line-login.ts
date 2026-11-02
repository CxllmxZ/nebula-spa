/**
 * LINE Login — ตรวจ ID token ฝั่ง server
 *
 * หน้าเว็บ (LIFF) ส่ง ID token มา → server ถาม LINE ว่า token นี้จริงไหม
 * ห้ามเชื่อ userId ที่หน้าเว็บส่งมาตรงๆ — ใครก็ปลอมได้
 *
 * client_id = Channel ID ของ LINE Login channel (ไม่ใช่ Messaging API)
 * ⚠️ LINE Login + Messaging API ต้องอยู่ provider เดียวกัน ไม่งั้น userId ไม่ตรงกัน
 *
 * Docs: https://developers.line.biz/en/reference/line-login/#verify-id-token
 */

const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export interface LineIdentity {
  userId: string; // sub
  name: string | null;
}

/**
 * @returns ข้อมูลผู้ใช้ ถ้า token ถูกต้อง / null ถ้าไม่ถูกต้องหรือหมดอายุ
 */
export async function verifyLineIdToken(
  idToken: string,
  channelId: string,
): Promise<LineIdentity | null> {
  if (!idToken || !channelId) return null;

  const response = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });

  if (!response.ok) {
    // 400 = token ผิด / หมดอายุ / client_id ไม่ตรง
    console.warn("[LINE Login] verify failed", response.status);
    return null;
  }

  const data = (await response.json()) as { sub?: string; name?: string };
  if (!data.sub) return null;

  return { userId: data.sub, name: data.name ?? null };
}
