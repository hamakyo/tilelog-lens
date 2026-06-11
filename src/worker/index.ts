import { Hono } from "hono";
import type { AppBindings } from "./env";
import { accessAuth } from "./middleware/accessAuth";
import { analyticsRoutes } from "./routes/analytics";
import { exportCsvRoutes } from "./routes/exportCsv";
import { exportJsonRoutes } from "./routes/exportJson";
import { importEventRoutes } from "./routes/importEvents";
import { logWorkerError } from "./lib/logger";
import { snapshotRoutes } from "./routes/snapshots";

const app = new Hono<AppBindings>();

app.use("*", accessAuth);

app.get("/api/health", (c) =>
  c.json({
    ok: true
  })
);

app.get("/api/auth/me", (c) =>
  c.json({
    email: c.get("userEmail")
  })
);

app.route("/api/snapshots", snapshotRoutes);
app.route("/api/analytics", analyticsRoutes);
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
