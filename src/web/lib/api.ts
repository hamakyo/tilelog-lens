import type {
  EstimatedDelta,
  ImportEvent,
  Snapshot,
  SnapshotCreateInput,
  SnapshotRevision,
  ValidationWarning
} from "../../shared/types";

type SnapshotListResponse = {
  items: Snapshot[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
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

export function listSnapshots(): Promise<SnapshotListResponse> {
  return apiJson<SnapshotListResponse>("/api/snapshots?limit=500&order=desc");
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
