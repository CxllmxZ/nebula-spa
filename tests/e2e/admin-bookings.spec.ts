import { test, expect } from "@playwright/test";

test.describe("Admin Bookings — Change Status", () => {
  test("admin เปลี่ยน status booking จาก dropdown ได้", async ({ page }) => {
    // Step 1: เข้าหน้า bookings
    await page.goto("/admin/bookings", { waitUntil: "domcontentloaded" });

    // Step 2: รอ table render
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Step 3: คลิก row แรก
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Step 4: รอ dialog
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Step 5: อ่าน current status → เลือก status ต่าง
    const statusCombobox = dialog.getByRole("combobox", {
      name: /เปลี่ยนสถานะ/i,
    });
    await expect(statusCombobox).toBeVisible();
    const currentStatus = (await statusCombobox.textContent()) || "";
    console.log(`Current status: "${currentStatus.trim()}"`);

    // Toggle: ถ้าเป็น "รอยืนยัน" → เปลี่ยนเป็น "ยืนยันแล้ว" และ vice versa
    // (ถ้า status ปัจจุบันเป็นอื่น เช่น cancelled → เปลี่ยนเป็น "รอยืนยัน")
    const newStatus = currentStatus.includes("รอยืนยัน")
      ? "ยืนยันแล้ว"
      : "รอยืนยัน";
    console.log(`Changing to: "${newStatus}"`);

    await statusCombobox.click();
    await page.getByRole("option", { name: newStatus }).click();

    // Step 6: กดบันทึก (ต้อง enable แล้วเพราะ status ต่าง)
    const saveBtn = dialog.getByRole("button", { name: /บันทึก/i });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Step 7: Verify dialog ปิด
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });
});
