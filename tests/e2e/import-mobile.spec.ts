import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";

const forbiddenPayloadKeys = [
  "image",
  "screenshot",
  "file",
  "blob",
  "base64",
  "dataUrl"
];

function syntheticScreenshotBuffer(width = 2556, height = 1179): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f4f6f8"/>
    <rect x="120" y="100" width="2316" height="900" rx="24" fill="#ffffff" stroke="#8aa1ad" stroke-width="8"/>
    <g fill="#1f6f8b" font-family="Arial, sans-serif" font-size="64">
      <text x="220" y="240">Synthetic mobile screenshot fixture</text>
      <text x="220" y="360">Matches 241</text>
      <text x="220" y="480">Average place 2.59</text>
      <text x="220" y="600">No official game assets</text>
    </g>
  </svg>`;
  return Buffer.from(svg);
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow).toBe(false);
}

async function fillRequiredStats(page: Page, observedTime = "21:34"): Promise<void> {
  await page.getByLabel("日付").fill("2026-06-04");
  if (observedTime) {
    await page.getByLabel("時刻").fill(observedTime);
  }
  await page.getByLabel("モード").selectOption("east");
  await page.getByLabel("対戦数").fill("241");
  await page.getByLabel("平均順位").fill("2.59");
  await page.getByLabel("一位率").fill("19.09");
  await page.getByLabel("二位率").fill("26.97");
  await page.getByLabel("三位率").fill("30.29");
  await page.getByLabel("四位率").fill("23.65");
  await page.getByLabel("和了率").fill("19.80");
  await page.getByLabel("放銃率").fill("17.66");
  await page.getByLabel("副露率").fill("27.83");
  await page.getByLabel("立直率").fill("26.07");
}

function assertNoImagePayload(value: unknown): void {
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      expect(current).not.toContain("data:image/");
      continue;
    }
    if (current == null || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    for (const [key, child] of Object.entries(current)) {
      expect(forbiddenPayloadKeys).not.toContain(key);
      stack.push(child);
    }
  }
}

test("mobile import page is usable", async ({ page }) => {
  await page.goto("/import");

  await expect(page.getByRole("heading", { name: "新規記録" })).toBeVisible();
  await expect(page.getByLabel("日付")).toBeVisible();
  await expect(page.getByLabel("時刻")).toBeVisible();
  await expect(page.getByLabel("時刻")).toHaveAttribute("required", "");
  await expect(page.locator('input[type="file"]')).toHaveAttribute("accept", "image/*");
  await expect(page.getByLabel("対戦数")).toBeVisible();
  await expect(page.getByLabel("平均順位")).toBeVisible();
  await expect(page.getByLabel("和了率")).toBeVisible();
  await expect(page.getByLabel("立直率")).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("local screenshot metadata is read but image is not uploaded", async ({ page }) => {
  await page.goto("/import");

  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic-mobile-landscape.svg",
    mimeType: "image/svg+xml",
    buffer: syntheticScreenshotBuffer()
  });

  await expect(page.locator(".local-preview")).toBeVisible();
  await expect(page.getByText("画像メタデータを取得しました。画像本体はブラウザ内に留まります。")).toBeVisible();
  await expect(page.getByLabel("ファイル名")).toHaveValue("synthetic-mobile-landscape.svg");
  await expect(page.getByLabel("幅")).toHaveValue("2556");
  await expect(page.getByLabel("高さ")).toHaveValue("1179");
  await expect(page.getByLabel("SHA-256")).toHaveValue(/^[a-f0-9]{64}$/);

  await fillRequiredStats(page);

  let postedJson: Record<string, unknown> | null = null;
  await page.route("**/api/snapshots", async (route) => {
    postedJson = route.request().postDataJSON() as Record<string, unknown>;
    assertNoImagePayload(postedJson);
    expect(postedJson).toMatchObject({
      observed_date: "2026-06-04",
      observed_time: "21:34",
      game_mode: "east",
      matches: 241,
      avg_place: 2.59,
      file_name: "synthetic-mobile-landscape.svg",
      image_width: 2556,
      image_height: 1179
    });
    expect(postedJson.source_image_sha256).toMatch(/^[a-f0-9]{64}$/);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ item: { id: 1 }, warnings: [] })
    });
  });

  await page.getByRole("button", { name: "記録を保存" }).click();
  await expect(page.getByText("記録を保存しました。")).toBeVisible();
  expect(postedJson).not.toBeNull();
});

test("HH:mm is required on mobile", async ({ page }) => {
  await page.goto("/import");
  await fillRequiredStats(page, "");

  let requestCount = 0;
  await page.route("**/api/snapshots", async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ item: { id: 2 }, warnings: [] })
    });
  });

  const timeInput = page.getByLabel("時刻");
  await page.getByRole("button", { name: "記録を保存" }).click();
  expect(
    await timeInput.evaluate((input) => (input as HTMLInputElement).validity.valueMissing)
  ).toBe(true);
  expect(requestCount).toBe(0);

  await timeInput.fill("21:34");
  const requestPromise = page.waitForRequest("**/api/snapshots");
  await page.getByRole("button", { name: "記録を保存" }).click();
  const request = await requestPromise;
  expect((request.postDataJSON() as Record<string, unknown>).observed_time).toBe("21:34");
  expect(requestCount).toBe(1);
});

test("mobile export page is reachable", async ({ page }) => {
  await page.goto("/export");

  await expect(page.getByRole("heading", { name: "ダウンロード" })).toBeVisible();
  await expect(page.getByRole("link", { name: "記録CSV" })).toHaveAttribute(
    "href",
    "/api/export/snapshots.csv"
  );
  await expect(page.getByRole("link", { name: "記録CSV" })).toHaveAttribute(
    "download",
    "tilelog-snapshots.csv"
  );
  await expect(page.getByRole("link", { name: "差分CSV" })).toHaveAttribute(
    "href",
    "/api/export/deltas.csv"
  );
  await expect(page.getByRole("link", { name: "差分CSV" })).toHaveAttribute(
    "download",
    "tilelog-deltas.csv"
  );
  await expect(page.getByRole("link", { name: "AI用JSON" })).toHaveAttribute(
    "href",
    /\/api\/export\/ai-context\.json\?anonymize=true/
  );
  await expect(page.getByRole("link", { name: "AI用JSON" })).toHaveAttribute(
    "download",
    "tilelog-ai-context.json"
  );
  await expectNoDocumentOverflow(page);
});

test("captures mobile import diagnostic screenshot via CDP", async ({
  page,
  browserName
}, testInfo) => {
  test.skip(browserName !== "chromium");

  await page.goto("/import");
  const client = await page.context().newCDPSession(page);

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });

  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true
  });

  await testInfo.attach("mobile-import-cdp.png", {
    body: Buffer.from(result.data, "base64"),
    contentType: "image/png"
  });
});
