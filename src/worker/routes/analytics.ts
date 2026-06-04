import { Hono } from "hono";
import { buildDerivedMetrics, buildEstimatedDeltas } from "../../shared/metrics";
import type { AppBindings } from "../env";
import { listAllSnapshots } from "../lib/d1";

export const analyticsRoutes = new Hono<AppBindings>();

analyticsRoutes.get("/deltas", async (c) => {
  const gameMode = c.req.query("game_mode");
  const snapshots = await listAllSnapshots(
    c.env.DB,
    gameMode === "east" ||
      gameMode === "south" ||
      gameMode === "three_player" ||
      gameMode === "other"
      ? gameMode
      : undefined
  );

  return c.json({
    items: buildEstimatedDeltas(snapshots)
  });
});

analyticsRoutes.get("/derived", async (c) => {
  const snapshots = await listAllSnapshots(c.env.DB);
  return c.json({
    items: buildDerivedMetrics(snapshots)
  });
});
