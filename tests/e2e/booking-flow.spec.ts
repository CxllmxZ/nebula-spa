import { test, expect } from "@playwright/test";

test.describe("Public Booking Flow", () => {
  test("customer จองสำเร็จ end-to-end", async ({ page }) => {
    // Step 1: เข้าหน้า booking
    await page.goto("/book", { waitUntil: "domcontentloaded" });

    // Step 2: เลือก service ตัวแรก
    const firstService = page.getByRole("button", { name: /นาที/ }).first();
    await expect(firstService).toBeVisible();
    await firstService.click();

    // Step 3: เลือกวัน (พยายาม 3 เดือนไปข้างหน้าถ้าไม่เจอวันว่าง)
    // ใช้ CSS selector ตรง ๆ: button ที่มี aria-label ขึ้นด้วย "วัน" และ ไม่มี attribute disabled
    let availableDay = page
      .locator('button[aria-label^="วัน"]:not([disabled])')
      .first();

    for (let i = 0; i < 3; i++) {
      if (await availableDay.isVisible().catch(() => false)) break;

      // เดือนนี้ไม่มีวันว่าง → กด next month
      const nextMonthBtn = page.getByRole("button", { name: /next month/i });
      await expect(nextMonthBtn).toBeVisible();
      await nextMonthBtn.click();

      await page.waitForTimeout(300);

      availableDay = page
        .locator('button[aria-label^="วัน"]:not([disabled])')
        .first();
    }

    await expect(availableDay).toBeVisible({ timeout: 5_000 });
    await availableDay.click();

    // Step 4: เลือก time slot ตัวแรก
    const firstSlot = page
      .getByRole("button", { name: /^\d{2}:\d{2}$/ })
      .first();
    await expect(firstSlot).toBeVisible();
    await firstSlot.click();

    // Step 5: กรอกฟอร์ม
    await page
      .getByRole("textbox", { name: "ชื่อ-นามสกุล" })
      .fill("Playwright Test");
    await page.getByRole("textbox", { name: "เบอร์โทร" }).fill("0891234567");

    // Step 6: รอ Turnstile → submit button enabled
    const submitBtn = page.getByRole("button", { name: /ยืนยันการจอง/ });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });

    // Step 7: Submit
    await submitBtn.click();

    // Step 8: Verify redirect
    await page.waitForURL(/\/book\/[A-Za-z0-9]{6}$/, { timeout: 10_000 });

    // Step 9: Verify content
    await expect(page.getByText("Playwright Test")).toBeVisible();

    const url = page.url();
    const bookingCode = url.split("/").pop();
    expect(bookingCode).toMatch(/^[A-Za-z0-9]{6}$/);

    console.log(`✅ Booking created: ${bookingCode}`);
  });
});
