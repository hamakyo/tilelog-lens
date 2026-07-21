import { Hono } from "hono";
import type { AppBindings } from "./env";
import { accessAuth } from "./middleware/accessAuth";
import { analyticsRoutes } from "./routes/analytics";
import { exportCsvRoutes } from "./routes/exportCsv";
import { exportJsonRoutes } from "./routes/exportJson";
import { importEventRoutes } from "./routes/importEvents";
import { logWorkerError } from "./lib/logger";
import { snapshotRoutes } from "./routes/snapshots";
import { analysisPreferenceRoutes } from "./routes/analysisPreferences";

const app = new Hono<AppBindings>();

app.use("*", accessAuth);

app.get("/api/health", async (c) => {
  const checkedAt = new Date().toISOString();

  try {
    await c.env.DB.prepare("SELECT 1 AS ok").first();
    c.header("Cache-Control", "no-store");
    return c.json({
      ok: true,
      checked_at: checkedAt,
      environment: c.env.ENVIRONMENT,
      checks: {
        worker: "ok",
        d1: "ok"
      }
    });
  } catch (error) {
    logWorkerError(c, "health_check_failed", error);
    c.header("Cache-Control", "no-store");
    return c.json(
      {
        ok: false,
        checked_at: checkedAt,
        environment: c.env.ENVIRONMENT,
        checks: {
          worker: "ok",
          d1: "error"
        }
      },
      503
    );
  }
});

app.get("/api/auth/me", (c) =>
  c.json({
    email: c.get("userEmail")
  })
);

app.route("/api/snapshots", snapshotRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/analysis", analysisPreferenceRoutes);
app.route("/api/import-events", importEventRoutes);
app.route("/api/export", exportCsvRoutes);
app.route("/api/export", exportJsonRoutes);

app.onError((error, c) => {
  logWorkerError(c, "unhandled_worker_error", error);
  return c.json({ error: "internal_server_error" }, 500);
});

app.notFound((c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return c.text("Not found", 404);
});

export default app;
