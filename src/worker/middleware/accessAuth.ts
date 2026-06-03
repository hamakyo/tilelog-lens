import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppBindings } from "../env";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksCache.get(url);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(url));
  jwksCache.set(url, jwks);
  return jwks;
}

export async function accessAuth(c: Context<AppBindings>, next: Next) {
  const env = c.env;

  if (env.ENVIRONMENT === "development" && env.DEV_AUTH_BYPASS === "true") {
    c.set("userEmail", env.OWNER_EMAIL || "dev@example.com");
    await next();
    return;
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) {
    return c.json({ error: "forbidden" }, 403);
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(env.ACCESS_JWKS_URL), {
      issuer: env.ACCESS_ISSUER,
      audience: env.ACCESS_AUD
    });
    const email = String(payload.email ?? "").toLowerCase();
    const ownerEmail = env.OWNER_EMAIL.toLowerCase();

    if (!email || email !== ownerEmail) {
      return c.json({ error: "forbidden" }, 403);
    }

    c.set("userEmail", email);
    await next();
  } catch {
    return c.json({ error: "forbidden" }, 403);
  }
}
