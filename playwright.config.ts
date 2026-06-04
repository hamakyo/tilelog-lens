import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:8787",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "mobile-chrome-pixel",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium"
      }
    },
    {
      name: "mobile-chrome-iphone",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium"
      }
    },
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium"
      }
    }
  ],
  webServer: {
    command: "pnpm run dev:e2e",
    url: "http://127.0.0.1:8787/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
