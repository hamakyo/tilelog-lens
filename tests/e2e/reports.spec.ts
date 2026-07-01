import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomInt } from "node:crypto";

type SnapshotFixture = {
  id: number;
};

const minuteRange = 365 * 24 * 60 - 2;

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
    player_name: `E2E Report ${baseMinute}`,
    player_id: `e2e-report-${baseMinute}-${offsetMinutes}`,
    rank_name: "雀士",
    rank_level: 1,
    rank_points: 100 + offsetMinutes,
    rank_points_max: 800,
    matches,
    avg_win_score: 6542 + offsetMinutes,
    avg_place: matches >= 120 ? 2.44 : 2.55,
    max_renchan: 4,
    avg_win_turn: 12.67,
    first_rate: 25,
    second_rate: 25,
    third_rate: 25,
    fourth_rate: 25,
    bust_rate: 2.87,
    win_rate: matches >= 120 ? 22 : 20,
    tsumo_rate: 30,
    deal_in_rate: matches >= 120 ? 11 : 10,
    call_rate: 28,
    riichi_rate: 18,
    note: `E2E report fixture ${baseMinute}`,
    source_image_sha256: null,
    file_name: `report-${baseMinute}-${offsetMinutes}.png`,
    file_last_modified: null,
    exif_taken_at: null,
    image_width: 2556,
    image_height: 1179,
    parser_version: "e2e-report-v1"
  };
}

async function createSnapshot(
  request: APIRequestContext,
  baseMinute: number,
  offsetMinutes: number,
  matches: number
): Promise<SnapshotFixture> {
  const response = await request.post("/api/snapshots", {
    data: snapshotPayload(baseMinute, offsetMinutes, matches)
  });
  expect(response.status()).toBe(201);

  const body = (await response.json()) as { item: { id: number } };
  return { id: body.item.id };
}

async function deleteSnapshots(
  request: APIRequestContext,
  snapshots: SnapshotFixture[]
): Promise<void> {
  await Promise.all(
    snapshots.map((snapshot) => request.delete(`/api/snapshots/${snapshot.id}`))
  );
}

test("reports page shows weekly and monthly period reports", async ({
  page,
  request
}) => {
  const baseMinute = fixtureBaseMinute();
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));
    snapshots.push(await createSnapshot(request, baseMinute, 1, 120));

    await page.goto("/reports");

    await expect(page.getByRole("heading", { name: "週次・月次レポート" })).toBeVisible();
    await expect(page.getByRole("link", { name: "レポート" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "週次レポート" })).toBeVisible();
    await expect(page.getByText("東風").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "レポート詳細" })).toBeVisible();
    await expect(page.getByText("次に見る項目")).toBeVisible();

    await page.getByRole("button", { name: "月次" }).click();
    await expect(page.getByRole("heading", { name: "月次レポート", exact: true })).toBeVisible();
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});
