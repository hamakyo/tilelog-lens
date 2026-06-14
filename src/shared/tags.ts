import type { Snapshot } from "./types";

export type TagAnalysis = {
  tag: string;
  snapshot_count: number;
  avg_place: number;
  win_rate: number;
  deal_in_rate: number;
  fourth_rate: number;
};

export function extractNoteTags(note: string | null | undefined): string[] {
  if (!note) return [];
  const tags = note.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return Array.from(new Set(tags.map((tag) => tag.slice(1).toLowerCase())));
}

export function buildTagAnalyses(snapshots: Snapshot[]): TagAnalysis[] {
  const grouped = new Map<string, Snapshot[]>();
  for (const snapshot of snapshots) {
    for (const tag of extractNoteTags(snapshot.note)) {
      grouped.set(tag, [...(grouped.get(tag) ?? []), snapshot]);
    }
  }

  return Array.from(grouped.entries())
    .map(([tag, taggedSnapshots]) => ({
      tag,
      snapshot_count: taggedSnapshots.length,
      avg_place: average(taggedSnapshots.map((snapshot) => snapshot.avg_place)),
      win_rate: average(taggedSnapshots.map((snapshot) => snapshot.win_rate)),
      deal_in_rate: average(taggedSnapshots.map((snapshot) => snapshot.deal_in_rate)),
      fourth_rate: average(taggedSnapshots.map((snapshot) => snapshot.fourth_rate))
    }))
    .sort((a, b) => b.snapshot_count - a.snapshot_count || a.tag.localeCompare(b.tag));
}

function average(values: number[]): number {
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
