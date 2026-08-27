import { test, expect } from "@playwright/test";

test.describe("Public Booking Flow", () => {
  test("customer จองสำเร็จ end-to-end", async ({ page }) => {
    // Step 1: เข้าหน้า booking
    await page.goto("/book", { waitUntil: "domcontentloaded" });

    // Step 2: เลือก service ตัวแรก
    const firstService = page.getByRole("button", { name: /นาที/ }).first();
    await expect(firstService).toBeVisible();
    await firstService.click();

    // Step 3: รอ calendar render (สำคัญ! รอ grid โผล่ก่อน)
    const calendar = page.getByRole("grid");
    await expect(calendar).toBeVisible({ timeout: 10_000 });

    // Step 4: เลือกวัน — พยายาม 3 เดือน
    let clicked = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const availableDay = page
        .locator('button[aria-label^="วัน"]:not([disabled])')
        .first();

      // count() = ตอบทันที ไม่รอ timeout
      if ((await availableDay.count()) > 0) {
        await availableDay.click();
        clicked = true;
        break;
      }

      // ไม่เจอ → next month (exact name จาก page snapshot)
      await page.getByRole("button", { name: "Go to the Next Month" }).click();
      await page.waitForTimeout(500); // รอ animation
    }

    expect(clicked, "ไม่เจอวันว่างใน 3 เดือน").toBe(true);

    // Step 5: เลือก time slot
    const firstSlot = page
      .getByRole("button", { name: /^\d{2}:\d{2}$/ })
      .first();
    await expect(firstSlot).toBeVisible({ timeout: 5_000 });
    await firstSlot.click();

    // Step 6: กรอกฟอร์ม
    await page
      .getByRole("textbox", { name: "ชื่อ-นามสกุล" })
      .fill("Playwright Test");
    await page.getByRole("textbox", { name: "เบอร์โทร" }).fill("0891234567");

    // Step 7: รอ Turnstile → submit enabled
    const submitBtn = page.getByRole("button", { name: /ยืนยันการจอง/ });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });

    // Step 8: Submit
    await submitBtn.click();

    // Step 9: Verify redirect + content
    await page.waitForURL(/\/book\/[A-Za-z0-9]{6}$/, { timeout: 10_000 });
    await expect(page.getByText("Playwright Test")).toBeVisible();

    const bookingCode = page.url().split("/").pop();
    expect(bookingCode).toMatch(/^[A-Za-z0-9]{6}$/);
    console.log(`✅ Booking created: ${bookingCode}`);
  });
});
