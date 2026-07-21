import { describe, expect, it } from "vitest";
import app from "../src/worker/index";
import type { Env } from "../src/worker/env";

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
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

describe("snapshot list route", () => {
  it("rejects an invalid cursor", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/snapshots?cursor=not-a-cursor&order=asc"),
      makeEnv()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_cursor" });
  });
});
