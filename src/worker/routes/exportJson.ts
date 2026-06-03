import { Hono } from "hono";
import { buildAiContext } from "../../shared/aiExport";
import type { AppBindings } from "../env";
import { listAllSnapshots } from "../lib/d1";

export const exportJsonRoutes = new Hono<AppBindings>();

exportJsonRoutes.get("/ai-context.json", async (c) => {
  const anonymize = c.req.query("anonymize") !== "false";
  const snapshots = await listAllSnapshots(c.env.DB);
  const body = JSON.stringify(buildAiContext(snapshots, { anonymize }), null, 2);

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tilelog-ai-context.json"'
    }
  });
});
