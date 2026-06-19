import { describe, expect, it, vi } from "vitest";
import app from "../src/worker/index";
import type { Env } from "../src/worker/env";

function makeEnv(db: D1Database): Env {
  return {
    DB: db,
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 })
    } as unknown as Fetcher,
    ENVIRONMENT: "development",
    DEV_AUTH_BYPASS: "true",
    OWNER_EMAIL: "dev@example.com",
    ACCESS_AUD: "local",
    ACCESS_ISSUER: "https://example.cloudflareaccess.com",
    ACCESS_JWKS_URL: "https://example.cloudflareaccess.com/cdn-cgi/access/certs"
  } as Env;
}

function makeDb(shouldFail = false): D1Database {
  return {
    prepare() {
      return {
        async first() {
          if (shouldFail) throw new Error("d1 unavailable");
          return { ok: 1 };
        }
      };
    }
  } as unknown as D1Database;
}

describe("health route", () => {
  it("reports Worker and D1 as healthy", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/health"),
      makeEnv(makeDb())
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      ok: true,
      environment: "development",
      checks: {
        worker: "ok",
        d1: "ok"
      }
    });
  });

  it("returns 503 when D1 check fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await app.fetch(
        new Request("http://localhost/api/health"),
        makeEnv(makeDb(true))
      );
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toMatchObject({
        ok: false,
        checks: {
          worker: "ok",
          d1: "error"
        }
      });
    } finally {
      errorSpy.mockRestore();
    }
  });
});
