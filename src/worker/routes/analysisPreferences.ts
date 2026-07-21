import { Hono } from "hono";
import {
  ANALYSIS_EXPERIMENT_LIMIT,
  ANALYSIS_VIEW_LIMIT,
  analysisExperimentDraftSchema,
  analysisPreferencesSyncSchema,
  analysisViewDraftSchema,
  type AnalysisExperiment,
  type SavedAnalysisView
} from "../../shared/analysisPreferences";
import type { AppBindings } from "../env";
import {
  deleteAnalysisExperiment,
  deleteAnalysisView,
  getAnalysisExperiment,
  getAnalysisView,
  listAnalysisExperiments,
  listAnalysisViews,
  syncAnalysisPreferences,
  upsertAnalysisExperiment,
  upsertAnalysisView
} from "../lib/analysisPreferences";
import { nowIso } from "../lib/time";
import { readGuardedJsonRequest } from "../middleware/requestGuards";

export const analysisPreferenceRoutes = new Hono<AppBindings>();

function validId(id: string): boolean {
  return id.length > 0 && id.length <= 100;
}

analysisPreferenceRoutes.post("/sync", async (c) => {
  const guarded = await readGuardedJsonRequest(c.req.raw);
  if (!guarded.ok) return c.json({ error: guarded.error }, guarded.status);
  const parsed = analysisPreferencesSyncSchema.safeParse(guarded.data);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: parsed.error.format() }, 400);
  }
  return c.json(await syncAnalysisPreferences(c.env.DB, parsed.data.views, parsed.data.experiments));
});

analysisPreferenceRoutes.get("/views", async (c) =>
  c.json({ items: await listAnalysisViews(c.env.DB) })
);

analysisPreferenceRoutes.post("/views", async (c) => {
  const guarded = await readGuardedJsonRequest(c.req.raw);
  if (!guarded.ok) return c.json({ error: guarded.error }, guarded.status);
  const parsed = analysisViewDraftSchema.safeParse(guarded.data);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: parsed.error.format() }, 400);
  }
  if ((await listAnalysisViews(c.env.DB)).length >= ANALYSIS_VIEW_LIMIT) {
    return c.json({ error: "analysis_view_limit_reached" }, 409);
  }
  const timestamp = nowIso();
  const item: SavedAnalysisView = {
    ...parsed.data,
    id: crypto.randomUUID(),
    created_at: timestamp,
    updated_at: timestamp
  };
  return c.json({ item: await upsertAnalysisView(c.env.DB, item) }, 201);
});

analysisPreferenceRoutes.put("/views/:id", async (c) => {
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "invalid_analysis_view_id" }, 400);
  const guarded = await readGuardedJsonRequest(c.req.raw);
  if (!guarded.ok) return c.json({ error: guarded.error }, guarded.status);
  const parsed = analysisViewDraftSchema.safeParse(guarded.data);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: parsed.error.format() }, 400);
  }
  const existing = await getAnalysisView(c.env.DB, id);
  if (!existing && (await listAnalysisViews(c.env.DB)).length >= ANALYSIS_VIEW_LIMIT) {
    return c.json({ error: "analysis_view_limit_reached" }, 409);
  }
  const timestamp = nowIso();
  const item: SavedAnalysisView = {
    ...parsed.data,
    id,
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp
  };
  return c.json({ item: await upsertAnalysisView(c.env.DB, item) });
});

analysisPreferenceRoutes.delete("/views/:id", async (c) => {
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "invalid_analysis_view_id" }, 400);
  return (await deleteAnalysisView(c.env.DB, id))
    ? c.json({ ok: true })
    : c.json({ error: "not_found" }, 404);
});

analysisPreferenceRoutes.get("/experiments", async (c) =>
  c.json({ items: await listAnalysisExperiments(c.env.DB) })
);

analysisPreferenceRoutes.post("/experiments", async (c) => {
  const guarded = await readGuardedJsonRequest(c.req.raw);
  if (!guarded.ok) return c.json({ error: guarded.error }, guarded.status);
  const parsed = analysisExperimentDraftSchema.safeParse(guarded.data);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: parsed.error.format() }, 400);
  }
  if ((await listAnalysisExperiments(c.env.DB)).length >= ANALYSIS_EXPERIMENT_LIMIT) {
    return c.json({ error: "analysis_experiment_limit_reached" }, 409);
  }
  const timestamp = nowIso();
  const item: AnalysisExperiment = {
    ...parsed.data,
    id: crypto.randomUUID(),
    created_at: timestamp,
    updated_at: timestamp
  };
  return c.json({ item: await upsertAnalysisExperiment(c.env.DB, item) }, 201);
});

analysisPreferenceRoutes.put("/experiments/:id", async (c) => {
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "invalid_analysis_experiment_id" }, 400);
  const guarded = await readGuardedJsonRequest(c.req.raw);
  if (!guarded.ok) return c.json({ error: guarded.error }, guarded.status);
  const parsed = analysisExperimentDraftSchema.safeParse(guarded.data);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: parsed.error.format() }, 400);
  }
  const existing = await getAnalysisExperiment(c.env.DB, id);
  if (!existing && (await listAnalysisExperiments(c.env.DB)).length >= ANALYSIS_EXPERIMENT_LIMIT) {
    return c.json({ error: "analysis_experiment_limit_reached" }, 409);
  }
  const timestamp = nowIso();
  const item: AnalysisExperiment = {
    ...parsed.data,
    id,
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp
  };
  return c.json({ item: await upsertAnalysisExperiment(c.env.DB, item) });
});

analysisPreferenceRoutes.delete("/experiments/:id", async (c) => {
  const id = c.req.param("id");
  if (!validId(id)) return c.json({ error: "invalid_analysis_experiment_id" }, 400);
  return (await deleteAnalysisExperiment(c.env.DB, id))
    ? c.json({ ok: true })
    : c.json({ error: "not_found" }, 404);
});
