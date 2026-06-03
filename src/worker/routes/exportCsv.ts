import { Hono } from "hono";
import type { Snapshot } from "../../shared/types";
import type { AppBindings } from "../env";
import { buildCsv } from "../lib/csv";
import { listAllSnapshots } from "../lib/d1";
import { buildEstimatedDeltas } from "../lib/metrics";

export const exportCsvRoutes = new Hono<AppBindings>();

const snapshotColumns: Array<{
  key: keyof Snapshot;
  label: string;
  userControlled?: boolean;
}> = [
  { key: "id", label: "id" },
  { key: "observed_date", label: "observed_date" },
  { key: "observed_time", label: "observed_time" },
  { key: "timezone", label: "timezone" },
  { key: "observed_at_utc", label: "observed_at_utc" },
  { key: "game_mode", label: "game_mode" },
  { key: "player_name", label: "player_name", userControlled: true },
  { key: "rank_name", label: "rank_name", userControlled: true },
  { key: "rank_level", label: "rank_level" },
  { key: "rank_points", label: "rank_points" },
  { key: "rank_points_max", label: "rank_points_max" },
  { key: "matches", label: "matches" },
  { key: "avg_place", label: "avg_place" },
  { key: "first_rate", label: "first_rate" },
  { key: "second_rate", label: "second_rate" },
  { key: "third_rate", label: "third_rate" },
  { key: "fourth_rate", label: "fourth_rate" },
  { key: "win_rate", label: "win_rate" },
  { key: "deal_in_rate", label: "deal_in_rate" },
  { key: "call_rate", label: "call_rate" },
  { key: "riichi_rate", label: "riichi_rate" },
  { key: "note", label: "note", userControlled: true },
  { key: "source_image_sha256", label: "source_image_sha256" },
  { key: "file_name", label: "file_name", userControlled: true },
  { key: "image_width", label: "image_width" },
  { key: "image_height", label: "image_height" },
  { key: "created_at", label: "created_at" },
  { key: "updated_at", label: "updated_at" }
];

const deltaColumns = [
  { key: "from_snapshot_id", label: "from_snapshot_id" },
  { key: "to_snapshot_id", label: "to_snapshot_id" },
  { key: "from_observed_at_utc", label: "from_observed_at_utc" },
  { key: "to_observed_at_utc", label: "to_observed_at_utc" },
  { key: "matches_delta", label: "matches_delta" },
  { key: "estimated_first_delta", label: "estimated_first_delta" },
  { key: "estimated_second_delta", label: "estimated_second_delta" },
  { key: "estimated_third_delta", label: "estimated_third_delta" },
  { key: "estimated_fourth_delta", label: "estimated_fourth_delta" },
  { key: "estimated_win_delta", label: "estimated_win_delta" },
  { key: "estimated_deal_in_delta", label: "estimated_deal_in_delta" },
  { key: "estimated_call_delta", label: "estimated_call_delta" },
  { key: "estimated_riichi_delta", label: "estimated_riichi_delta" },
  { key: "period_first_rate", label: "period_first_rate" },
  { key: "period_second_rate", label: "period_second_rate" },
  { key: "period_third_rate", label: "period_third_rate" },
  { key: "period_fourth_rate", label: "period_fourth_rate" },
  { key: "period_win_rate", label: "period_win_rate" },
  { key: "period_deal_in_rate", label: "period_deal_in_rate" },
  { key: "period_call_rate", label: "period_call_rate" },
  { key: "period_riichi_rate", label: "period_riichi_rate" },
  { key: "quality", label: "quality" }
] as const;

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

exportCsvRoutes.get("/snapshots.csv", async (c) => {
  const snapshots = await listAllSnapshots(c.env.DB);
  return csvResponse(buildCsv(snapshots, snapshotColumns), "tilelog-snapshots.csv");
});

exportCsvRoutes.get("/deltas.csv", async (c) => {
  const snapshots = await listAllSnapshots(c.env.DB);
  const deltas = buildEstimatedDeltas(snapshots);
  return csvResponse(buildCsv(deltas, [...deltaColumns]), "tilelog-deltas.csv");
});
