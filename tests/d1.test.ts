import { describe, expect, it, vi } from "vitest";
import {
  insertSnapshotWithImportEvent,
  listAllSnapshots,
  listSnapshots,
  updateSnapshotWithRevision
} from "../src/worker/lib/d1";
import { baseSnapshotInput, makeSnapshot } from "./fixtures";

describe("D1 snapshot queries", () => {
  it("loads every snapshot for export and analytics without the list page limit", async () => {
    const rows = Array.from({ length: 501 }, (_, index) =>
      makeSnapshot({
        id: index + 1,
        observed_date: "2026-06-03",
        observed_time: `${String(Math.floor(index / 60) % 24).padStart(2, "0")}:${String(
          index % 60
        ).padStart(2, "0")}`,
        observed_at_utc: `2026-06-03T${String(Math.floor(index / 60) % 24).padStart(
          2,
          "0"
        )}:${String(index % 60).padStart(2, "0")}:00.000Z`
      })
    );
    const preparedSql: string[] = [];

    const db = {
      prepare(sql: string) {
        preparedSql.push(sql);
        return {
          bind(..._values: unknown[]) {
            return this;
          },
          async all() {
            return {
              results: rows,
              success: true,
              meta: {}
            };
          }
        };
      }
    } as unknown as D1Database;

    const snapshots = await listAllSnapshots(db);

    expect(snapshots).toHaveLength(501);
    expect(preparedSql[0]).not.toMatch(/\bLIMIT\b/i);
    expect(preparedSql[0]).toContain("ORDER BY observed_at_utc ASC");
  });

  it("uses a stable cursor and reports the next page", async () => {
    const rows = [
      makeSnapshot({ id: 1, observed_at_utc: "2026-06-01T00:00:00.000Z" }),
      makeSnapshot({ id: 2, observed_at_utc: "2026-06-02T00:00:00.000Z" }),
      makeSnapshot({ id: 3, observed_at_utc: "2026-06-03T00:00:00.000Z" })
    ];
    const preparedSql: string[] = [];
    const db = {
      prepare(sql: string) {
        preparedSql.push(sql);
        const statement = {
          bind(..._values: unknown[]) {
            return statement;
          },
          async all() {
            return { results: rows, success: true, meta: {} };
          },
          async first() {
            return { total: 3 };
          }
        };
        return statement;
      }
    } as unknown as D1Database;

    const page = await listSnapshots(db, {
      limit: 2,
      order: "asc",
      cursor: { observedAtUtc: "2026-05-31T00:00:00.000Z", id: 9 }
    });

    expect(page.items.map((item) => item.id)).toEqual([1, 2]);
    expect(page.nextCursor).toEqual({
      observedAtUtc: "2026-06-02T00:00:00.000Z",
      id: 2
    });
    expect(preparedSql[0]).toContain("observed_at_utc > ?");
    expect(preparedSql[0]).toContain("ORDER BY observed_at_utc ASC, id ASC");
  });

  it("batches snapshot creation with its import event", async () => {
    const preparedSql: string[] = [];
    const batch = vi.fn(async (statements: D1PreparedStatement[]) => {
      expect(statements).toHaveLength(2);
      return [
        { success: true, results: [], meta: { last_row_id: 1 } },
        { success: true, results: [], meta: { changes: 1 } }
      ] as unknown as D1Result[];
    });
    const db = {
      prepare(sql: string) {
        preparedSql.push(sql);
        const statement = {
          bind(..._values: unknown[]) {
            return statement;
          },
          async first() {
            return makeSnapshot();
          }
        };
        return statement;
      },
      batch
    } as unknown as D1Database;

    await insertSnapshotWithImportEvent(
      db,
      baseSnapshotInput,
      "2026-06-03T14:59:00.000Z",
      "2026-06-03T15:00:00.000Z"
    );

    expect(batch).toHaveBeenCalledOnce();
    expect(preparedSql[0]).toContain("INSERT INTO stat_snapshots");
    expect(preparedSql[1]).toContain("INSERT INTO import_events");
    expect(preparedSql[1]).toContain("WHERE game_mode = ? AND observed_at_utc = ?");
  });

  it("batches snapshot updates with revision history and propagates batch failure", async () => {
    const previous = makeSnapshot();
    const batch = vi.fn(async (_statements: D1PreparedStatement[]) => {
      throw new Error("revision write failed");
    });
    const db = {
      prepare(_sql: string) {
        const statement = {
          bind(..._values: unknown[]) {
            return statement;
          }
        };
        return statement;
      },
      batch
    } as unknown as D1Database;

    await expect(
      updateSnapshotWithRevision(
        db,
        previous.id,
        { ...baseSnapshotInput, win_rate: 26 },
        previous.observed_at_utc,
        "2026-06-04T00:00:00.000Z",
        previous
      )
    ).rejects.toThrow("revision write failed");
    expect(batch.mock.calls[0][0]).toHaveLength(2);
  });
});
