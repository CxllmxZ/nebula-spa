import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // ที่เก็บ test
  testDir: "./tests/e2e",

  // ห้ามใช้ .only บน CI (safety)
  forbidOnly: !!process.env.CI,

  // Retry
  retries: process.env.CI ? 2 : 0,

  // Workers
  workers: process.env.CI ? 4 : 1, // local = auto
  fullyParallel: true,

  // Reporter — HTML สวย + list ใน terminal
  reporter: [
    ["list"],
    ["html", { open: "never" }], // ไม่ auto-open, เปิดเองด้วย pnpm exec playwright show-report
  ],

  // Global settings
  use: {
    baseURL: "http://localhost:8787", // ← wrangler dev default port
    trace: "on-first-retry", // trace เก็บตอน retry เท่านั้น (ประหยัดพื้นที่)
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // Projects — Chromium อย่างเดียวก่อน
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // *** ไม่ auto-start server ตอนนี้ ***
  // เหตุผล: wrangler dev ต้อง build ก่อน + start ช้า → run manual จะควบคุม flow ได้ดีกว่า
  // จะเปิดใช้ webServer: {...} ใน 9.5B ถ้าต้องการ
});
