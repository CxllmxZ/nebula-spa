import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "..", ".auth", "admin.json");

setup("authenticate as admin", async ({ page }) => {
  console.log("🔐 Setting up admin session...");

  // Step 1: ไปหน้า login
  await page.goto("/admin/login", { waitUntil: "domcontentloaded" });

  // Step 2: กรอก credentials
  // ⚠️ ตรวจ label ก่อน — ถ้าไม่ใช่ 'Email' / 'Password' ต้องปรับ
  await page.getByLabel("อีเมล").fill("admin-test@nebula-spa.demo");
  await page.getByLabel("รหัสผ่าน").fill("ChangeMe123!Long");

  // Step 3: กด login button (ปรับชื่อปุ่มตามจริง)
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  // Step 4: รอ redirect ไป /admin (แสดงว่า login สำเร็จ)
  await page.waitForURL("/admin", { timeout: 10_000 });

  // Step 5: Verify session valid — เห็น dashboard content
  // (ปรับ text ตามจริงในหน้า dashboard)
  await expect(page.locator("body")).toBeVisible();

  // Step 6: Save session state (cookies + localStorage)
  await page.context().storageState({ path: authFile });

  console.log(`✅ Admin session saved to ${authFile}`);
});
