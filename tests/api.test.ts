import { afterEach, describe, expect, it, vi } from "vitest";
import { listAllSnapshots } from "../src/web/lib/api";
import { makeSnapshot } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web snapshot API", () => {
  it("loads more than 500 snapshots through cursor pages", async () => {
    const snapshots = Array.from({ length: 501 }, (_, index) =>
      makeSnapshot({
        id: index + 1,
        observed_at_utc: `2026-06-${String((index % 28) + 1).padStart(2, "0")}T${String(
          Math.floor(index / 60) % 24
        ).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00.000Z`
      })
    );
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: snapshots.slice(0, 500),
            pagination: { limit: 500, offset: 0, total: 501, next_cursor: "next" }
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: snapshots.slice(500),
            pagination: { limit: 500, offset: 0, total: 501, next_cursor: null }
          })
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listAllSnapshots();

    expect(result.items).toHaveLength(501);
    expect(new Set(result.items.map((item) => item.id))).toHaveLength(501);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=next");
  });
});
