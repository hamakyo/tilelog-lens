import type {
  EstimatedDelta,
  ImportEvent,
  Snapshot,
  SnapshotCreateInput,
  SnapshotRevision,
  ValidationWarning
} from "../../shared/types";
import type {
  AnalysisExperiment,
  AnalysisViewDraft,
  SavedAnalysisView
} from "../../shared/analysisPreferences";

export type SnapshotListResponse = {
  items: Snapshot[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    next_cursor: string | null;
  };
};

type SnapshotResponse = {
  item: Snapshot;
  warnings?: ValidationWarning[];
};

export type HealthResponse = {
  ok: boolean;
  checked_at: string;
  environment: "development" | "preview" | "production";
  checks: {
    worker: "ok";
    d1: "ok" | "error";
  };
};

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      data != null &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function listSnapshotPage(
  options: {
    limit?: number;
    offset?: number;
    order?: "asc" | "desc";
    cursor?: string;
  } = {}
): Promise<SnapshotListResponse> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 100),
    order: options.order ?? "desc"
  });
  if (options.cursor) params.set("cursor", options.cursor);
  else if (options.offset != null) params.set("offset", String(options.offset));
  return apiJson<SnapshotListResponse>(`/api/snapshots?${params.toString()}`);
}

export async function listAllSnapshots(): Promise<SnapshotListResponse> {
  const items: Snapshot[] = [];
  const seenIds = new Set<number>();
  let cursor: string | undefined;
  let total = 0;

  do {
    const page = await listSnapshotPage({ limit: 500, order: "asc", cursor });
    total = page.pagination.total;
    for (const item of page.items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
    }
    cursor = page.pagination.next_cursor ?? undefined;
  } while (cursor);

  return {
    items: items.sort(
      (a, b) =>
        b.observed_at_utc.localeCompare(a.observed_at_utc) || b.id - a.id
    ),
    pagination: { limit: 500, offset: 0, total, next_cursor: null }
  };
}

export function getSnapshot(id: number): Promise<{ item: Snapshot }> {
  return apiJson<{ item: Snapshot }>(`/api/snapshots/${id}`);
}

export function listSnapshotRevisions(
  id: number
): Promise<{ items: SnapshotRevision[] }> {
  return apiJson<{ items: SnapshotRevision[] }>(`/api/snapshots/${id}/revisions`);
}

export function createSnapshot(
  input: SnapshotCreateInput
): Promise<SnapshotResponse> {
  return apiJson<SnapshotResponse>("/api/snapshots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function updateSnapshot(
  id: number,
  input: SnapshotCreateInput
): Promise<SnapshotResponse> {
  return apiJson<SnapshotResponse>(`/api/snapshots/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function deleteSnapshot(id: number): Promise<{ ok: true }> {
  return apiJson<{ ok: true }>(`/api/snapshots/${id}`, {
    method: "DELETE"
  });
}

export function listDeltas(): Promise<{ items: EstimatedDelta[] }> {
  return apiJson<{ items: EstimatedDelta[] }>("/api/analytics/deltas");
}

export function getHealth(): Promise<HealthResponse> {
  return apiJson<HealthResponse>("/api/health");
}

export function listImportEvents(): Promise<{ items: ImportEvent[] }> {
  return apiJson<{ items: ImportEvent[] }>("/api/import-events");
}

export function createImportEvent(
  input: Omit<ImportEvent, "id" | "created_at">
): Promise<{ ok: true }> {
  return apiJson<{ ok: true }>("/api/import-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function syncAnalysisPreferences(input: {
  views: SavedAnalysisView[];
  experiments: AnalysisExperiment[];
}): Promise<{ views: SavedAnalysisView[]; experiments: AnalysisExperiment[] }> {
  return apiJson("/api/analysis/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function listAnalysisPreferences(): Promise<{
  views: SavedAnalysisView[];
  experiments: AnalysisExperiment[];
}> {
  const [views, experiments] = await Promise.all([
    apiJson<{ items: SavedAnalysisView[] }>("/api/analysis/views"),
    apiJson<{ items: AnalysisExperiment[] }>("/api/analysis/experiments")
  ]);
  return { views: views.items, experiments: experiments.items };
}

export function saveAnalysisViewRemote(
  view: SavedAnalysisView
): Promise<{ item: SavedAnalysisView }> {
  const draft: AnalysisViewDraft = {
    name: view.name,
    game_mode: view.game_mode,
    filters: view.filters,
    tab: view.tab,
    chart_metrics: view.chart_metrics
  };
  return apiJson(`/api/analysis/views/${encodeURIComponent(view.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft)
  });
}

export function deleteAnalysisViewRemote(id: string): Promise<{ ok: true }> {
  return apiJson(`/api/analysis/views/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function saveAnalysisExperimentRemote(
  experiment: AnalysisExperiment
): Promise<{ item: AnalysisExperiment }> {
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...draft } = experiment;
  return apiJson(`/api/analysis/experiments/${encodeURIComponent(experiment.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft)
  });
}

export function deleteAnalysisExperimentRemote(id: string): Promise<{ ok: true }> {
  return apiJson(`/api/analysis/experiments/${encodeURIComponent(id)}`, { method: "DELETE" });
}
