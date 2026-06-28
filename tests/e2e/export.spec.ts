import { expect, test, type APIRequestContext, type TestInfo } from "@playwright/test";
import { randomInt } from "node:crypto";

type SnapshotExportFixture = {
  id: number;
  observed_date: string;
  observed_time: string;
  matches: number;
};

const minuteRange = 365 * 24 * 60 - 2;

test.describe.configure({ mode: "serial" });

function exportBaseMinute(): number {
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
    game_mode: "other",
    player_name: `=E2E Export ${baseMinute}`,
    player_id: `e2e-export-${baseMinute}-${offsetMinutes}`,
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
    note: `E2E export fixture ${baseMinute}`,
    source_image_sha256: null,
    file_name: `export-${baseMinute}-${offsetMinutes}.png`,
    file_last_modified: null,
    exif_taken_at: null,
    image_width: 2556,
    image_height: 1179,
    parser_version: "e2e-export-v1"
  };
}

async function createSnapshot(
  request: APIRequestContext,
  baseMinute: number,
  offsetMinutes: number,
  matches: number
): Promise<SnapshotExportFixture> {
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
  snapshots: SnapshotExportFixture[]
): Promise<void> {
  await Promise.all(
    snapshots.map((snapshot) => request.delete(`/api/snapshots/${snapshot.id}`))
  );
}

function expectDesktopProject(testInfo: TestInfo): void {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "export API E2E uses shared local D1 data and only needs one browser project"
  );
}

test("export CSV endpoints return real D1 data with download headers", async ({
  request
}, testInfo) => {
  expectDesktopProject(testInfo);

  const baseMinute = exportBaseMinute();
  const snapshots: SnapshotExportFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 104));

    const snapshotsResponse = await request.get("/api/export/snapshots.csv");
    expect(snapshotsResponse.status()).toBe(200);
    expect(snapshotsResponse.headers()["content-type"]).toBe(
      "text/csv; charset=utf-8"
    );
    expect(snapshotsResponse.headers()["content-disposition"]).toBe(
      'attachment; filename="tilelog-snapshots.csv"'
    );

    const snapshotsCsv = await snapshotsResponse.text();
    expect(snapshotsCsv).toContain(
      "id,observed_date,observed_time,timezone,observed_at_utc,game_mode"
    );
    expect(snapshotsCsv).toContain(
      `${snapshots[0].id},${snapshots[0].observed_date},${snapshots[0].observed_time},Asia/Tokyo`
    );
    expect(snapshotsCsv).toContain(`'=E2E Export ${baseMinute}`);
    expect(snapshotsCsv).toContain(`E2E export fixture ${baseMinute}`);

    const deltasResponse = await request.get("/api/export/deltas.csv");
    expect(deltasResponse.status()).toBe(200);
    expect(deltasResponse.headers()["content-type"]).toBe(
      "text/csv; charset=utf-8"
    );
    expect(deltasResponse.headers()["content-disposition"]).toBe(
      'attachment; filename="tilelog-deltas.csv"'
    );

    const deltasCsv = await deltasResponse.text();
    expect(deltasCsv).toContain(
      "from_snapshot_id,to_snapshot_id,from_observed_at_utc,to_observed_at_utc,matches_delta"
    );
    const deltaRow = deltasCsv
      .split("\n")
      .find((row) => row.startsWith(`${snapshots[0].id},${snapshots[1].id},`));
    expect(deltaRow).toBeDefined();
    const deltaCells = deltaRow?.split(",");
    expect(deltaCells?.[4]).toBe("4");
    expect(deltaCells?.at(-1)).toBe("ok");
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("AI JSON export returns real D1 data with privacy metadata and download headers", async ({
  request
}, testInfo) => {
  expectDesktopProject(testInfo);

  const baseMinute = exportBaseMinute();
  const snapshots: SnapshotExportFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 120));

    const response = await request.get("/api/export/ai-context.json?anonymize=true");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe(
      "application/json; charset=utf-8"
    );
    expect(response.headers()["content-disposition"]).toBe(
      'attachment; filename="tilelog-ai-context.json"'
    );

    const body = (await response.json()) as {
      privacy: { anonymized: boolean; screenshots_included: boolean };
      summary: {
        snapshot_count: number;
        summary_text: string;
      };
      snapshots: Array<{
        id: number;
        player_name: string | null;
        player_id: string | null;
        matches: number;
      }>;
      derived_metrics: Array<{ snapshot_id: number }>;
    };
    const exportedSnapshot = body.snapshots.find(
      (snapshot) => snapshot.id === snapshots[0].id
    );

    expect(body.privacy).toMatchObject({
      anonymized: true,
      screenshots_included: false
    });
    expect(exportedSnapshot).toMatchObject({
      id: snapshots[0].id,
      player_name: null,
      player_id: null,
      matches: snapshots[0].matches
    });
    expect(
      body.derived_metrics.some((metric) => metric.snapshot_id === snapshots[0].id)
    ).toBe(true);
    expect(body.summary.snapshot_count).toBeGreaterThan(0);
    expect(body.summary.summary_text).toContain("最新記録");
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("AI JSON preview shows analysis section counts", async ({
  page,
  request
}, testInfo) => {
  expectDesktopProject(testInfo);

  const baseMinute = exportBaseMinute();
  const snapshots: SnapshotExportFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 120));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 126));

    await page.goto("/export");
    await page.getByRole("button", { name: "AI用JSONプレビュー" }).click();

    await expect(page.getByRole("heading", { name: "AI用JSONプレビュー" })).toBeVisible();
    const preview = page.locator(".export-preview");
    await expect(preview).toContainText("analysis_counts");
    await expect(preview).toContainText("summary_text");
    await expect(preview).toContainText("riichi_trends");
    await expect(preview).toContainText("stability");
    await expect(preview).toContainText("top_improvement_priority");
    await expect(preview).toContainText("snapshots_preview");
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});
