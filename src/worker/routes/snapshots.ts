import { Hono } from "hono";
import { getConsistencyWarnings, snapshotCreateSchema } from "../../shared/schema";
import type { ValidationWarning } from "../../shared/types";
import type { AppBindings } from "../env";
import {
  deleteSnapshot,
  getSnapshotById,
  hasDuplicateImageHash,
  hasDuplicateObservedAt,
  insertSnapshot,
  latestSnapshotBefore,
  listSnapshots,
  updateSnapshot
} from "../lib/d1";
import { nowIso, observedAtUtc } from "../lib/time";
import { readGuardedJsonRequest } from "../middleware/requestGuards";

export const snapshotRoutes = new Hono<AppBindings>();

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function buildDbWarnings(
  db: D1Database,
  input: ReturnType<typeof snapshotCreateSchema.parse>,
  observedAt: string,
  excludeId?: number
): Promise<ValidationWarning[]> {
  const warnings = getConsistencyWarnings(input);

  if (await hasDuplicateObservedAt(db, input.game_mode, observedAt, excludeId)) {
    warnings.push({
      code: "DUPLICATE_OBSERVED_AT",
      message: "同じモードと観測日時の記録がすでに存在します。",
      severity: "warning"
    });
  }

  if (await hasDuplicateImageHash(db, input.source_image_sha256 ?? null, excludeId)) {
    warnings.push({
      code: "DUPLICATE_IMAGE_HASH",
      message: "この画像ハッシュはすでにインポート済みです。",
      severity: "warning"
    });
  }

  const previous = await latestSnapshotBefore(
    db,
    input.game_mode,
    observedAt,
    excludeId
  );
  if (previous && input.matches < previous.matches) {
    warnings.push({
      code: "MATCHES_DECREASED",
      message: "同じモードの前回記録より対戦数が減っています。",
      severity: "warning"
    });
  }

  return warnings;
}

snapshotRoutes.get("/", async (c) => {
  const gameMode = c.req.query("game_mode");
  const limit = Number(c.req.query("limit") ?? 100);
  const offset = Number(c.req.query("offset") ?? 0);
  const order = c.req.query("order") === "asc" ? "asc" : "desc";
  const result = await listSnapshots(c.env.DB, {
    gameMode:
      gameMode === "east" ||
      gameMode === "south" ||
      gameMode === "three_player" ||
      gameMode === "other"
        ? gameMode
        : undefined,
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
    order
  });

  return c.json({
    items: result.items,
    pagination: {
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100,
      offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
      total: result.total
    }
  });
});

snapshotRoutes.post("/", async (c) => {
  const guarded = await readGuardedJsonRequest(c.req.raw);
  if (!guarded.ok) {
    return c.json({ error: guarded.error }, guarded.status);
  }

  const parsed = snapshotCreateSchema.safeParse(guarded.data);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: parsed.error.format() }, 400);
  }

  const input = parsed.data;
  const observedAt = observedAtUtc(
    input.observed_date,
    input.observed_time,
    input.timezone
  );
  const warnings = await buildDbWarnings(c.env.DB, input, observedAt);

  if (warnings.some((warning) => warning.code === "DUPLICATE_OBSERVED_AT")) {
    return c.json(
      {
        error: "duplicate_observation_time",
        details: "同じモードと観測日時の記録がすでに存在します。",
        warnings
      },
      409
    );
  }

  try {
    const item = await insertSnapshot(c.env.DB, input, observedAt, nowIso());
    return c.json({ item, warnings }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.includes("UNIQUE")) {
      return c.json({ error: "duplicate_observation_time" }, 409);
    }
    return c.json({ error: "snapshot_create_failed" }, 500);
  }
});

snapshotRoutes.get("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id == null) return c.json({ error: "invalid_snapshot_id" }, 400);

  const item = await getSnapshotById(c.env.DB, id);
  if (!item) return c.json({ error: "not_found" }, 404);
  return c.json({ item });
});

snapshotRoutes.put("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id == null) return c.json({ error: "invalid_snapshot_id" }, 400);

  const guarded = await readGuardedJsonRequest(c.req.raw);
  if (!guarded.ok) {
    return c.json({ error: guarded.error }, guarded.status);
  }

  const parsed = snapshotCreateSchema.safeParse(guarded.data);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: parsed.error.format() }, 400);
  }

  const input = parsed.data;
  const observedAt = observedAtUtc(
    input.observed_date,
    input.observed_time,
    input.timezone
  );
  const warnings = await buildDbWarnings(c.env.DB, input, observedAt, id);

  if (warnings.some((warning) => warning.code === "DUPLICATE_OBSERVED_AT")) {
    return c.json(
      {
        error: "duplicate_observation_time",
        details: "同じモードと観測日時の記録がすでに存在します。",
        warnings
      },
      409
    );
  }

  try {
    const item = await updateSnapshot(c.env.DB, id, input, observedAt, nowIso());
    if (!item) return c.json({ error: "not_found" }, 404);
    return c.json({ item, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.includes("UNIQUE")) {
      return c.json({ error: "duplicate_observation_time" }, 409);
    }
    return c.json({ error: "snapshot_update_failed" }, 500);
  }
});

snapshotRoutes.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id == null) return c.json({ error: "invalid_snapshot_id" }, 400);

  const deleted = await deleteSnapshot(c.env.DB, id);
  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});
