const maxJsonBytes = 64 * 1024;
const maxStringBytes = 6000;
const forbiddenKeys = new Set([
  "image",
  "screenshot",
  "file",
  "blob",
  "base64",
  "dataurl"
]);

type GuardedJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function findForbiddenPayloadReason(
  value: unknown,
  path = "$",
  depth = 0
): string | null {
  if (depth > 24) {
    return `${path} is nested too deeply`;
  }

  if (typeof value === "string") {
    if (value.includes("data:image/")) {
      return `${path} contains an inline image payload`;
    }
    if (byteLength(value) > maxStringBytes) {
      return `${path} is too large`;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const reason = findForbiddenPayloadReason(
        value[index],
        `${path}[${index}]`,
        depth + 1
      );
      if (reason) return reason;
    }
    return null;
  }

  if (value != null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key.toLowerCase())) {
        return `${path}.${key} is not allowed`;
      }
      const reason = findForbiddenPayloadReason(child, `${path}.${key}`, depth + 1);
      if (reason) return reason;
    }
  }

  return null;
}

export async function readGuardedJsonRequest(
  request: Request
): Promise<GuardedJsonResult> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      status: 415,
      error: "Content-Type must be application/json"
    };
  }

  const contentLength = request.headers.get("Content-Length");
  if (contentLength && Number(contentLength) > maxJsonBytes) {
    return {
      ok: false,
      status: 413,
      error: "Request body is too large"
    };
  }

  const text = await request.text();
  if (byteLength(text) > maxJsonBytes) {
    return {
      ok: false,
      status: 413,
      error: "Request body is too large"
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Request body must be valid JSON"
    };
  }

  const reason = findForbiddenPayloadReason(data);
  if (reason) {
    return {
      ok: false,
      status: 400,
      error: reason
    };
  }

  return { ok: true, data };
}
