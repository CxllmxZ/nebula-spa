import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 1,
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8787",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // 1. Setup project — รัน auth setup ก่อนอื่น
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // 2. Public tests — ไม่ต้อง login
    {
      name: "public",
      testMatch: /e2e\/(smoke|booking-flow)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // 3. Admin tests — ใช้ saved session
    {
      name: "admin",
      testMatch: /e2e\/admin.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/admin.json",
      },
      dependencies: ["setup"], // รัน setup ก่อน
    },
  ],
});
