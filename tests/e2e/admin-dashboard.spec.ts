import { test, expect } from "@playwright/test";

test.describe("Admin Dashboard", () => {
  test("admin เห็น dashboard โดยไม่ต้อง login", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL("/admin");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin เข้าหน้า bookings ได้", async ({ page }) => {
    await page.goto("/admin/bookings", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL("/admin/bookings");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
  });
});
