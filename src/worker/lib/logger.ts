import type { Context } from "hono";
import type { AppBindings } from "../env";

type LogMetadata = Record<string, string | number | boolean | null | undefined>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

export function logWorkerError(
  c: Context<AppBindings>,
  event: string,
  error: unknown,
  metadata: LogMetadata = {}
): void {
  const request = c.req.raw;
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );

  console.error(
    JSON.stringify({
      level: "error",
      event,
      method: request.method,
      path: new URL(request.url).pathname,
      error: errorMessage(error),
      ...safeMetadata
    })
  );
}
