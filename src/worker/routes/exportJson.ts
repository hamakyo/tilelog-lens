import { Hono } from "hono";
import { buildAiContext } from "../../shared/aiExport";
import type { AppBindings } from "../env";
import { listAllSnapshots } from "../lib/d1";

export const exportJsonRoutes = new Hono<AppBindings>();

exportJsonRoutes.get("/ai-context.json", async (c) => {
  const anonymize = c.req.query("anonymize") !== "false";
  const goal = sanitizeAnalysisRequestText(c.req.query("goal"), 300);
  const focus = sanitizeAnalysisFocus(c.req.query("focus"));
  const snapshots = await listAllSnapshots(c.env.DB);
  const body = JSON.stringify(
    buildAiContext(snapshots, {
      anonymize,
      analysisRequest: {
        goal,
        focus
      }
    }),
    null,
    2
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tilelog-ai-context.json"'
    }
  });
});

function sanitizeAnalysisRequestText(
  value: string | undefined,
  maxLength: number
): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function sanitizeAnalysisFocus(value: string | undefined): string[] | undefined {
  const items = value
    ?.split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item !== "")
    .slice(0, 20)
    .map((item) => item.slice(0, 80));

  return items != null && items.length > 0 ? items : undefined;
}
