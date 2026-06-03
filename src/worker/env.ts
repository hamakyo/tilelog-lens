export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: "development" | "preview" | "production";
  DEV_AUTH_BYPASS?: string;
  OWNER_EMAIL: string;
  ACCESS_AUD: string;
  ACCESS_ISSUER: string;
  ACCESS_JWKS_URL: string;
}

export type AppBindings = {
  Bindings: Env;
  Variables: {
    userEmail: string;
  };
};
