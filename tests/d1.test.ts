import { describe, expect, it } from "vitest";
import { listAllSnapshots } from "../src/worker/lib/d1";
import { makeSnapshot } from "./fixtures";

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
});
