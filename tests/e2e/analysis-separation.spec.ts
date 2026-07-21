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

function snapshotPayload(
  baseMinute: number,
  offsetMinutes: number,
  matches: number,
  gameMode: "east" | "south" | "three_player" | "other" = "east"
) {
  return {
    ...observedAt(baseMinute, offsetMinutes),
    timezone: "Asia/Tokyo",
    game_mode: gameMode,
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
  matches: number,
  gameMode: "east" | "south" | "three_player" | "other" = "east"
): Promise<SnapshotFixture> {
  const payload = snapshotPayload(baseMinute, offsetMinutes, matches, gameMode);
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

test("@smoke / shows latest summary, major trends, and navigation to detailed analysis", async ({
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
    await expect(page.getByRole("heading", { name: "長期スタイルと直近状態" })).toBeVisible();
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

test("@smoke /analysis applies performance filters", async ({ page, request }) => {
  const baseMinute = fixtureBaseMinute();
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 120));
    await page.goto("/analysis");
    await page.getByLabel("対戦数 下限").fill("110");
    await expect(page.getByLabel("対戦数 下限")).toHaveValue("110");
    await expect(page.getByText(/有効な条件: 1件/)).toBeVisible();
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

test("/analysis saves a reusable view and starts an improvement experiment", async ({
  page,
  request
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "D1 preference sync only needs one browser project"
  );
  const baseMinute = fixtureBaseMinute();
  const snapshots: SnapshotFixture[] = [];
  const viewIds: string[] = [];
  const experimentIds: string[] = [];
  const viewName = `三人戦・ラス回避-${baseMinute}`;
  const experimentTitle = `押し引き基準-${baseMinute}`;

  try {
    const [staleSnapshotsResponse, staleViewsResponse, staleExperimentsResponse] =
      await Promise.all([
        request.get("/api/snapshots?game_mode=three_player&limit=500"),
        request.get("/api/analysis/views"),
        request.get("/api/analysis/experiments")
      ]);
    const staleSnapshots = (await staleSnapshotsResponse.json()) as {
      items: Array<{ id: number; player_id: string | null }>;
    };
    const staleViews = (await staleViewsResponse.json()) as {
      items: Array<{ id: string; name: string }>;
    };
    const staleExperiments = (await staleExperimentsResponse.json()) as {
      items: Array<{ id: string; title: string }>;
    };
    await Promise.all([
      ...staleSnapshots.items
        .filter((snapshot) => snapshot.player_id?.startsWith("e2e-analysis-"))
        .map((snapshot) => request.delete(`/api/snapshots/${snapshot.id}`)),
      ...staleViews.items
        .filter((view) => view.name.startsWith("三人戦・ラス回避"))
        .map((view) => request.delete(`/api/analysis/views/${encodeURIComponent(view.id)}`)),
      ...staleExperiments.items
        .filter(
          (experiment) =>
            experiment.title.startsWith("押し引き基準-") ||
            experiment.title === "押し引き基準を見直す"
        )
        .map((experiment) =>
          request.delete(`/api/analysis/experiments/${encodeURIComponent(experiment.id)}`)
        )
    ]);

    snapshots.push(await createSnapshot(request, baseMinute, 0, 100, "three_player"));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 112, "three_player"));

    await page.goto("/analysis");
    await page.getByRole("button", { name: "三人戦", exact: true }).click();

    await expect(page.getByText("今回の結論", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "直近30日" })).toBeVisible();
    await expect(page.getByRole("button", { name: "すべて", exact: true })).toHaveCount(0);

    await page.getByLabel("ビュー名").fill(viewName);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText(`「${viewName}」を保存しました。`)).toBeVisible();
    const viewsResponse = await request.get("/api/analysis/views");
    const views = (await viewsResponse.json()) as { items: Array<{ id: string; name: string }> };
    const storedView = views.items.find((view) => view.name === viewName);
    expect(storedView).toBeDefined();
    if (storedView) viewIds.push(storedView.id);

    await page.evaluate(() => {
      window.localStorage.removeItem("tilelog-lens:analysis-views");
      window.localStorage.removeItem("tilelog-lens:analysis-experiments");
    });
    await page.reload();
    await page.getByLabel("保存済みビュー").selectOption({ label: viewName });
    await page.getByRole("button", { name: "適用", exact: true }).click();
    await expect(page.getByText(`「${viewName}」を適用しました。`)).toBeVisible();
    if (storedView) {
      const deletedView = await request.delete(
        `/api/analysis/views/${encodeURIComponent(storedView.id)}`
      );
      expect(deletedView.status()).toBe(200);
      viewIds.splice(viewIds.indexOf(storedView.id), 1);
      await page.reload();
      await expect(
        page.getByLabel("保存済みビュー").getByRole("option", {
          name: viewName
        })
      ).toHaveCount(0);
    }

    await page.getByRole("button", { name: "三人戦", exact: true }).click();
    await page.getByRole("tab", { name: "改善" }).click();
    await page.getByText("新しい施策を開始", { exact: true }).click();
    await page.getByLabel("施策名").fill(experimentTitle);
    await page.getByLabel("目標値").fill("9");
    await page.getByLabel("評価対戦数").fill("50");
    await page.getByRole("button", { name: "開始", exact: true }).click();

    await expect(page.getByText(`「${experimentTitle}」を開始しました。`)).toBeVisible();
    await expect(page.getByText(experimentTitle, { exact: true })).toBeVisible();
    const experimentsResponse = await request.get("/api/analysis/experiments");
    const experiments = (await experimentsResponse.json()) as {
      items: Array<{
        id: string;
        title: string;
        baseline_snapshot_id: number | null;
        baseline_value: number;
        baseline_matches: number;
      }>;
    };
    const storedExperiment = experiments.items.find(
      (experiment) => experiment.title === experimentTitle
    );
    expect(storedExperiment).toBeDefined();
    if (storedExperiment) {
      experimentIds.push(storedExperiment.id);
      const baselineIndex = snapshots.findIndex(
        (snapshot) => snapshot.id === storedExperiment.baseline_snapshot_id
      );
      expect(baselineIndex).toBeGreaterThanOrEqual(0);
      const baselineValue = storedExperiment.baseline_value;
      const baselineMatches = storedExperiment.baseline_matches;
      const deleted = await request.delete(`/api/snapshots/${snapshots[baselineIndex].id}`);
      expect(deleted.status()).toBe(200);
      snapshots.splice(baselineIndex, 1);

      const afterDeleteResponse = await request.get("/api/analysis/experiments");
      const afterDelete = (await afterDeleteResponse.json()) as typeof experiments;
      const preserved = afterDelete.items.find(
        (experiment) => experiment.id === storedExperiment.id
      );
      expect(preserved).toMatchObject({
        baseline_snapshot_id: null,
        baseline_value: baselineValue,
        baseline_matches: baselineMatches
      });
    }
    await expectNoHorizontalOverflow(page);
  } finally {
    await Promise.all(
      viewIds.map((id) => request.delete(`/api/analysis/views/${encodeURIComponent(id)}`))
    );
    await Promise.all(
      experimentIds.map((id) =>
        request.delete(`/api/analysis/experiments/${encodeURIComponent(id)}`)
      )
    );
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

test("desktop sidebar width can be selected from settings", async ({
  page
}, testInfo) => {
  expectDesktopProject(testInfo);

  await page.goto("/settings");
  const shell = page.locator(".app-shell");
  const sidebarGroup = page.getByRole("group", { name: "サイドバー" });

  await sidebarGroup.getByRole("button", { name: "コンパクト" }).click();
  await expect(shell).toHaveClass(/sidebar-collapsed/);
  await expect(sidebarGroup.getByRole("button", { name: "コンパクト" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await page.reload();
  await expect(shell).toHaveClass(/sidebar-collapsed/);

  await sidebarGroup.getByRole("button", { name: "通常" }).click();
  await expect(shell).not.toHaveClass(/sidebar-collapsed/);
  await expect(sidebarGroup.getByRole("button", { name: "通常" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  await sidebarGroup.getByRole("button", { name: "自動" }).click();
  await expect(sidebarGroup.getByRole("button", { name: "自動" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});
