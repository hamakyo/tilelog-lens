import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../env";
import { insertImportEvent, listImportEvents } from "../lib/d1";
import { nowIso } from "../lib/time";
import { readGuardedJsonRequest } from "../middleware/requestGuards";

const importEventSchema = z.object({
  snapshot_id: z.number().int().positive().nullable().optional(),
  status: z.enum(["saved", "failed"]),
  source_image_sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  file_name: z.string().max(255).nullable().optional(),
  image_width: z.number().int().positive().nullable().optional(),
  image_height: z.number().int().positive().nullable().optional(),
  parser_version: z.string().max(40).nullable().optional(),
  extracted_field_count: z.number().int().min(0).nullable().optional(),
  message: z.string().max(200).nullable().optional()
});

export const importEventRoutes = new Hono<AppBindings>();

importEventRoutes.get("/", async (c) => {
  return c.json({ items: await listImportEvents(c.env.DB) });
});

importEventRoutes.post("/", async (c) => {
  const guarded = await readGuardedJsonRequest(c.req.raw);
  if (!guarded.ok) {
    return c.json({ error: guarded.error }, guarded.status);
  }

  const parsed = importEventSchema.safeParse(guarded.data);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: parsed.error.format() }, 400);
  }

  const input = parsed.data;
  await insertImportEvent(
    c.env.DB,
    {
      snapshotId: input.snapshot_id ?? null,
      status: input.status,
      sourceImageSha256: input.source_image_sha256 ?? null,
      fileName: input.file_name ?? null,
      imageWidth: input.image_width ?? null,
      imageHeight: input.image_height ?? null,
      parserVersion: input.parser_version ?? null,
      extractedFieldCount: input.extracted_field_count ?? null,
      message: input.message ?? null
    },
    nowIso()
  );

  return c.json({ ok: true }, 201);
});
