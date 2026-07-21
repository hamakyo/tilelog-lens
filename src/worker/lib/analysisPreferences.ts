import {
  ANALYSIS_EXPERIMENT_LIMIT,
  ANALYSIS_VIEW_LIMIT,
  type AnalysisExperiment,
  type SavedAnalysisView
} from "../../shared/analysisPreferences";
import type { GameMode } from "../../shared/types";

type PreferenceRow = Record<string, string | number | null>;
type TimestampedPreference = { id: string; updated_at: string };

export function mergeAnalysisPreferences<T extends TimestampedPreference>(
  stored: T[],
  incoming: T[],
  limit: number
): T[] {
  const merged = new Map(stored.map((item) => [item.id, item]));
  for (const item of incoming) {
    const current = merged.get(item.id);
    if (!current || item.updated_at > current.updated_at) merged.set(item.id, item);
  }
  return [...merged.values()]
    .sort(
      (left, right) =>
        right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
    )
    .slice(0, limit);
}

function viewFromRow(row: PreferenceRow): SavedAnalysisView {
  return {
    id: String(row.id),
    name: String(row.name),
    game_mode: String(row.game_mode) as GameMode,
    filters: JSON.parse(String(row.filters_json)) as SavedAnalysisView["filters"],
    tab: String(row.tab) as SavedAnalysisView["tab"],
    chart_metrics: JSON.parse(String(row.chart_metrics_json)) as SavedAnalysisView["chart_metrics"],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function experimentFromRow(row: PreferenceRow): AnalysisExperiment {
  return {
    id: String(row.id),
    title: String(row.title),
    game_mode: String(row.game_mode) as GameMode,
    metric: String(row.metric) as AnalysisExperiment["metric"],
    target_value: Number(row.target_value),
    target_matches: Number(row.target_matches),
    baseline_snapshot_id:
      row.baseline_snapshot_id == null ? null : Number(row.baseline_snapshot_id),
    baseline_value: Number(row.baseline_value),
    baseline_matches: Number(row.baseline_matches),
    baseline_observed_at_utc: String(row.baseline_observed_at_utc),
    status: String(row.status) as AnalysisExperiment["status"],
    created_at: String(row.created_at),
    completed_at: row.completed_at == null ? null : String(row.completed_at),
    updated_at: String(row.updated_at)
  };
}

export async function listAnalysisViews(db: D1Database): Promise<SavedAnalysisView[]> {
  const result = await db
    .prepare(
      `SELECT id, name, game_mode, filters_json, tab, chart_metrics_json, created_at, updated_at
       FROM analysis_saved_views
       ORDER BY updated_at DESC, id ASC`
    )
    .all<PreferenceRow>();
  return (result.results ?? []).map(viewFromRow);
}

export async function getAnalysisView(
  db: D1Database,
  id: string
): Promise<SavedAnalysisView | null> {
  const row = await db
    .prepare(
      `SELECT id, name, game_mode, filters_json, tab, chart_metrics_json, created_at, updated_at
       FROM analysis_saved_views WHERE id = ?`
    )
    .bind(id)
    .first<PreferenceRow>();
  return row ? viewFromRow(row) : null;
}

export function analysisViewUpsertStatement(
  db: D1Database,
  view: SavedAnalysisView
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO analysis_saved_views (
        id, name, game_mode, filters_json, tab, chart_metrics_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        game_mode = excluded.game_mode,
        filters_json = excluded.filters_json,
        tab = excluded.tab,
        chart_metrics_json = excluded.chart_metrics_json,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at > analysis_saved_views.updated_at`
    )
    .bind(
      view.id,
      view.name,
      view.game_mode,
      JSON.stringify(view.filters),
      view.tab,
      JSON.stringify(view.chart_metrics),
      view.created_at,
      view.updated_at
    );
}

export async function upsertAnalysisView(
  db: D1Database,
  view: SavedAnalysisView
): Promise<SavedAnalysisView> {
  await analysisViewUpsertStatement(db, view).run();
  const stored = await getAnalysisView(db, view.id);
  if (!stored) throw new Error("Saved analysis view could not be loaded.");
  return stored;
}

export async function deleteAnalysisView(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM analysis_saved_views WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

export async function listAnalysisExperiments(
  db: D1Database
): Promise<AnalysisExperiment[]> {
  const result = await db
    .prepare(
      `SELECT id, title, game_mode, metric, target_value, target_matches,
        baseline_snapshot_id, baseline_value, baseline_matches, baseline_observed_at_utc,
        status, created_at, completed_at, updated_at
       FROM analysis_experiments
       ORDER BY updated_at DESC, id ASC`
    )
    .all<PreferenceRow>();
  return (result.results ?? []).map(experimentFromRow);
}

export async function getAnalysisExperiment(
  db: D1Database,
  id: string
): Promise<AnalysisExperiment | null> {
  const row = await db
    .prepare(
      `SELECT id, title, game_mode, metric, target_value, target_matches,
        baseline_snapshot_id, baseline_value, baseline_matches, baseline_observed_at_utc,
        status, created_at, completed_at, updated_at
       FROM analysis_experiments WHERE id = ?`
    )
    .bind(id)
    .first<PreferenceRow>();
  return row ? experimentFromRow(row) : null;
}

export function analysisExperimentUpsertStatement(
  db: D1Database,
  experiment: AnalysisExperiment
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO analysis_experiments (
        id, title, game_mode, metric, target_value, target_matches,
        baseline_snapshot_id, baseline_value, baseline_matches, baseline_observed_at_utc,
        status, created_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        game_mode = excluded.game_mode,
        metric = excluded.metric,
        target_value = excluded.target_value,
        target_matches = excluded.target_matches,
        baseline_snapshot_id = excluded.baseline_snapshot_id,
        baseline_value = excluded.baseline_value,
        baseline_matches = excluded.baseline_matches,
        baseline_observed_at_utc = excluded.baseline_observed_at_utc,
        status = excluded.status,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at > analysis_experiments.updated_at`
    )
    .bind(
      experiment.id,
      experiment.title,
      experiment.game_mode,
      experiment.metric,
      experiment.target_value,
      experiment.target_matches,
      experiment.baseline_snapshot_id,
      experiment.baseline_value,
      experiment.baseline_matches,
      experiment.baseline_observed_at_utc,
      experiment.status,
      experiment.created_at,
      experiment.completed_at,
      experiment.updated_at
    );
}

export async function upsertAnalysisExperiment(
  db: D1Database,
  experiment: AnalysisExperiment
): Promise<AnalysisExperiment> {
  await analysisExperimentUpsertStatement(db, experiment).run();
  const stored = await getAnalysisExperiment(db, experiment.id);
  if (!stored) throw new Error("Analysis experiment could not be loaded.");
  return stored;
}

export async function deleteAnalysisExperiment(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM analysis_experiments WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

export async function syncAnalysisPreferences(
  db: D1Database,
  views: SavedAnalysisView[],
  experiments: AnalysisExperiment[]
): Promise<{ views: SavedAnalysisView[]; experiments: AnalysisExperiment[] }> {
  const storedViews = await listAnalysisViews(db);
  const storedExperiments = await listAnalysisExperiments(db);
  const mergedViews = mergeAnalysisPreferences(storedViews, views, ANALYSIS_VIEW_LIMIT);
  const mergedExperiments = mergeAnalysisPreferences(
    storedExperiments,
    experiments,
    ANALYSIS_EXPERIMENT_LIMIT
  );
  const retainedViewIds = new Set(mergedViews.map((view) => view.id));
  const retainedExperimentIds = new Set(
    mergedExperiments.map((experiment) => experiment.id)
  );
  const statements = [
    ...mergedViews.map((view) => analysisViewUpsertStatement(db, view)),
    ...mergedExperiments.map((experiment) => analysisExperimentUpsertStatement(db, experiment)),
    ...storedViews
      .filter((view) => !retainedViewIds.has(view.id))
      .map((view) => db.prepare("DELETE FROM analysis_saved_views WHERE id = ?").bind(view.id)),
    ...storedExperiments
      .filter((experiment) => !retainedExperimentIds.has(experiment.id))
      .map((experiment) =>
        db.prepare("DELETE FROM analysis_experiments WHERE id = ?").bind(experiment.id)
      )
  ];
  if (statements.length > 0) await db.batch(statements);
  return {
    views: await listAnalysisViews(db),
    experiments: await listAnalysisExperiments(db)
  };
}
