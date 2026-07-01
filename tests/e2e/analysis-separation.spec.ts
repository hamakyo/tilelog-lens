import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type TestInfo
} from "@playwright/test";
import { randomInt } from "node:crypto";

type SnapshotFixture = {
  id: number;
  observed_date: string;
  observed_time: string;
  matches: number;
};

const minuteRange = 365 * 24 * 60 - 2;

test.describe.configure({ mode: "serial" });

function fixtureBaseMinute(): number {
  return randomInt(0, minuteRange);
}

function observedAt(baseMinute: number, offsetMinutes: number): {
  observed_date: string;
  observed_time: string;
} {
  const date = new Date(Date.UTC(1970, 0, 1, 0, baseMinute + offsetMinutes));
  return {
    observed_date: date.toISOString().slice(0, 10),
    observed_time: date.toISOString().slice(11, 16)
  };
}

function snapshotPayload(baseMinute: number, offsetMinutes: number, matches: number) {
  return {
    ...observedAt(baseMinute, offsetMinutes),
    timezone: "Asia/Tokyo",
    game_mode: "east",
    player_name: `=E2E Analysis ${baseMinute}`,
    player_id: `e2e-analysis-${baseMinute}-${offsetMinutes}`,
    rank_name: "雀士",
    rank_level: 1,
    rank_points: 100 + offsetMinutes,
    rank_points_max: 800,
    matches,
    avg_win_score: 6542 + offsetMinutes,
    avg_place: 2.5,
    max_renchan: 4,
    avg_win_turn: 12.67,
    first_rate: 25,
    second_rate: 25,
    third_rate: 25,
    fourth_rate: 25,
    bust_rate: 2.87,
    win_rate: 20,
    tsumo_rate: 30,
    deal_in_rate: 10,
    call_rate: 28,
    riichi_rate: 18,
    note: `E2E analysis fixture ${baseMinute} #e2e`,
    source_image_sha256: null,
    file_name: `analysis-${baseMinute}-${offsetMinutes}.png`,
    file_last_modified: null,
    exif_taken_at: null,
    image_width: 2556,
    image_height: 1179,
    parser_version: "e2e-analysis-v1"
  };
}

async function createSnapshot(
  request: APIRequestContext,
  baseMinute: number,
  offsetMinutes: number,
  matches: number
): Promise<SnapshotFixture> {
  const payload = snapshotPayload(baseMinute, offsetMinutes, matches);
  const response = await request.post("/api/snapshots", { data: payload });
  expect(response.status()).toBe(201);

  const body = (await response.json()) as { item: { id: number } };
  return {
    id: body.item.id,
    observed_date: payload.observed_date,
    observed_time: payload.observed_time,
    matches
  };
}

async function deleteSnapshots(
  request: APIRequestContext,
  snapshots: SnapshotFixture[]
): Promise<void> {
  const responses = await Promise.all(
    snapshots.map((snapshot) => request.delete(`/api/snapshots/${snapshot.id}`))
  );
  responses.forEach((response) => {
    expect(response.status()).toBe(200);
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow).toBe(false);
}

function expectDesktopProject(testInfo: TestInfo): void {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "sidebar collapse is a desktop-only interaction"
  );
}

test("/ shows latest summary, major trends, and navigation to detailed analysis", async ({
  page,
  request
}) => {
  const baseMinute = fixtureBaseMinute();
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 104));

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "TileLog Lens" })).toBeVisible();
    await expect(page.getByText("ダッシュボード").first()).toBeVisible();
    await expect(page.getByText("最新の平均順位")).toBeVisible();
    await expect(page.getByText("最新の和了率 / 放銃率")).toBeVisible();
    await expect(page.getByText("最新の対戦数差分")).toBeVisible();
    await expect(page.getByRole("heading", { name: "主要トレンド" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "最新順位率" })).toBeVisible();
    await expect(page.getByRole("button", { name: "詳細分析", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "詳細分析", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("/ does not show detailed-analysis-only blocks", async ({ page, request }) => {
  const baseMinute = fixtureBaseMinute();
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 104));

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "TileLog Lens" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "改善優先度" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "分析テンプレート" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "自由選択チャート" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "タグ別分析" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "分析コメント" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "分析フィルタ" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "期間比較" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "期間差分の推定" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "立直トレンド" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "立直リスクシグナル" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "悪化要因ランキング" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "見るべき項目" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "指標分布" })).not.toBeVisible();
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("/analysis shows detailed analysis blocks", async ({ page, request }) => {
  const baseMinute = fixtureBaseMinute();
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 104));

    await page.goto("/analysis");

    await expect(page.getByRole("heading", { name: "詳細分析" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "分析フィルタ" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "概要" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "立直" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "改善" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "詳細" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "分析目標" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "攻撃タイプ" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "直近期間" })).toBeVisible();

    await page.getByRole("tab", { name: "立直" }).click();
    await expect(page.getByRole("heading", { name: "立直トレンド" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "立直リスクシグナル" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "改善優先度" })).not.toBeVisible();

    await page.getByRole("tab", { name: "改善" }).click();
    await expect(page.getByRole("heading", { name: "改善優先度" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "悪化要因ランキング" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "見るべき項目" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "分析テンプレート", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "変化点" })).toBeVisible();

    await page.getByRole("tab", { name: "詳細" }).click();
    await expect(page.getByRole("heading", { name: "指標分布" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "自由選択チャート" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "タグ別分析" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "分析コメント" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "期間比較" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "期間差分の推定" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("/analysis restores selected analysis tab", async ({ page, request }) => {
  const baseMinute = fixtureBaseMinute();
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 104));

    await page.goto("/analysis?tab=detail");
    await expect(page.getByRole("heading", { name: "指標分布" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "改善優先度" })).not.toBeVisible();

    await page.getByRole("tab", { name: "改善" }).click();
    await expect(page).toHaveURL(/\/analysis\?tab=improvement$/);
    await expect(page.getByRole("heading", { name: "改善優先度" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "改善優先度" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "指標分布" })).not.toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("dashboard button navigates to /analysis", async ({ page, request }) => {
  const baseMinute = fixtureBaseMinute();
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));

    await page.goto("/");
    await page.getByRole("button", { name: "詳細分析" }).first().click();

    await expect(page).toHaveURL(/\/analysis(?:\?tab=overview)?$/);
    await expect(page.getByRole("heading", { name: "詳細分析" })).toBeVisible();
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("sidebar navigates to /analysis", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("link", { name: "詳細分析" }).click();

  await expect(page).toHaveURL(/\/analysis(?:\?tab=overview)?$/);
  await expect(page.getByRole("heading", { name: "詳細分析" })).toBeVisible();
});

test("desktop sidebar can be collapsed and restored", async ({ page }, testInfo) => {
  expectDesktopProject(testInfo);

  await page.goto("/");
  const shell = page.locator(".app-shell");
  const detailLabel = page.locator(".sidebar nav a span", { hasText: "詳細分析" });

  await expect(shell).not.toHaveClass(/sidebar-collapsed/);
  await expect(detailLabel).toBeVisible();

  await page.getByRole("button", { name: "メニューを閉じる" }).click();
  await expect(shell).toHaveClass(/sidebar-collapsed/);
  await expect(detailLabel).toBeHidden();
  await expect(
    page.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("link", { name: "詳細分析" })
  ).toBeVisible();

  await page.reload();
  await expect(shell).toHaveClass(/sidebar-collapsed/);

  await page.getByRole("button", { name: "メニューを開く" }).click();
  await expect(shell).not.toHaveClass(/sidebar-collapsed/);
  await expect(detailLabel).toBeVisible();
});
