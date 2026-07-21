import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomInt } from "node:crypto";

type SnapshotFixture = {
  id: number;
  observed_date: string;
  observed_time: string;
};

const minuteRange = 365 * 24 * 60 - 2;

test.describe.configure({ mode: "serial" });

function observedAt(baseMinute: number, offsetMinutes: number) {
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
    player_name: `E2E Import Review ${baseMinute}`,
    player_id: `e2e-import-review-${baseMinute}-${offsetMinutes}`,
    rank_name: "雀士",
    rank_level: 1,
    rank_points: 300,
    rank_points_max: 800,
    matches,
    avg_win_score: 6500,
    avg_place: 2.5,
    max_renchan: 4,
    avg_win_turn: 12.6,
    first_rate: 25,
    second_rate: 25,
    third_rate: 25,
    fourth_rate: 25,
    bust_rate: 3,
    win_rate: 20,
    tsumo_rate: 30,
    deal_in_rate: 12,
    call_rate: 28,
    riichi_rate: 18,
    note: `E2E import review fixture ${baseMinute}`,
    source_image_sha256: null,
    file_name: null,
    file_last_modified: null,
    exif_taken_at: null,
    image_width: null,
    image_height: null,
    parser_version: "e2e-import-review-v1"
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
    observed_time: payload.observed_time
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

async function fillSnapshotForm(page: Page, baseMinute: number) {
  const observed = observedAt(baseMinute, 1);
  await page.getByLabel("日付").fill(observed.observed_date);
  await page.getByLabel("時刻").fill(observed.observed_time);
  await page.getByLabel("モード").selectOption("east");
  await page.getByLabel("対戦数").fill("111");
  await page.getByLabel("平均順位").fill("2.45");
  await page.getByLabel("一位率").fill("26");
  await page.getByLabel("二位率").fill("25");
  await page.getByLabel("三位率").fill("25");
  await page.getByLabel("四位率").fill("24");
  await page.getByLabel("和了率").fill("21");
  await page.getByLabel("放銃率").fill("11");
  await page.getByLabel("副露率").fill("29");
  await page.getByLabel("立直率").fill("19");
}

test("@smoke import requires explicit review when previous snapshot differences exist", async ({
  page,
  request
}) => {
  const baseMinute = randomInt(0, minuteRange);
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));

    await page.goto("/import");
    await fillSnapshotForm(page, baseMinute);

    await expect(page.getByRole("heading", { name: "保存前確認" })).toBeVisible();
    await expect(page.getByText("前回値との差分")).toBeVisible();

    const saveButton = page.getByRole("button", { name: "記録を保存" });
    await expect(saveButton).toBeDisabled();

    await page.getByLabel("保存前確認の内容を確認しました。").check();
    await expect(saveButton).toBeEnabled();
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("@smoke imports a confirmed snapshot", async ({ page, request }) => {
  const baseMinute = randomInt(0, minuteRange);
  const snapshots: SnapshotFixture[] = [];

  try {
    snapshots.push(await createSnapshot(request, baseMinute, 0, 100));
    await page.goto("/import");
    await fillSnapshotForm(page, baseMinute);
    await page.getByLabel("保存前確認の内容を確認しました。").check();
    await page.getByRole("button", { name: "記録を保存" }).click();
    await expect(page.getByText("記録を保存しました。")).toBeVisible();

    const listResponse = await request.get("/api/snapshots?limit=500&order=desc");
    const list = (await listResponse.json()) as { items: Array<SnapshotFixture & { id: number }> };
    const observed = observedAt(baseMinute, 1);
    const created = list.items.find(
      (item) => item.observed_date === observed.observed_date && item.observed_time === observed.observed_time
    );
    expect(created).toBeDefined();
    if (created) snapshots.push(created);
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});

test("@smoke edits a record and stores its revision", async ({ page, request }) => {
  const baseMinute = randomInt(0, minuteRange);
  const snapshots: SnapshotFixture[] = [];

  try {
    const snapshot = await createSnapshot(request, baseMinute, 0, 100);
    snapshots.push(snapshot);
    await page.goto(`/snapshots/${snapshot.id}`);
    await page.getByLabel("対戦数").fill("101");
    const confirmation = page.getByLabel("保存前確認の内容を確認しました。");
    if (await confirmation.isVisible()) await confirmation.check();
    await page.getByRole("button", { name: "記録を更新" }).click();
    await expect(page.getByText("記録を保存しました。")).toBeVisible();
    await expect(page.getByRole("heading", { name: "変更履歴" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "matches" })).toBeVisible();
  } finally {
    await deleteSnapshots(request, snapshots);
  }
});
