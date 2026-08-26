import { test, expect } from "@playwright/test";

test.describe("Smoke — Landing page", () => {
  test("landing page โหลดได้", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Nebula/i);
  });

  test("มีปุ่มไปหน้า booking", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // "จองเลย" มี 2 ตัว (sm + lg ใน hero) → เอาตัวแรก
    const bookLink = page
      .getByRole("link", { name: "จองเลย", exact: true })
      .first();
    await expect(bookLink).toBeVisible();
  });

  test("หน้า /book เปิดได้", async ({ page }) => {
    await page.goto("/book", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
