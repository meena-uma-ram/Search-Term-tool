// Server-only configuration. Secrets are read from the environment and must
// never be serialized into API responses or bundled into the frontend.
try {
  process.loadEnvFile?.(".env");
} catch {
  // No .env file: fine, fall back to the real environment (or demo mode).
}

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  developerToken: string;
  loginCustomerId: string | null;
  apiVersion: string;
}

export interface ServerConfig {
  port: number;
  appUrl: string;
  sessionSecret: string;
  production: boolean;
  /** Null when Google Ads is not configured: the app runs on demo data only. */
  googleAds: GoogleAdsConfig | null;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): ServerConfig {
  const get = (key: string) => source[key]?.trim() || "";
  const production = get("NODE_ENV") === "production";
  const sessionSecret = get("SESSION_SECRET");
  if (production && (sessionSecret === "" || sessionSecret === "change-me")) {
    throw new Error("SESSION_SECRET must be set to a long random value in production");
  }

  const clientId = get("GOOGLE_ADS_CLIENT_ID");
  const clientSecret = get("GOOGLE_ADS_CLIENT_SECRET");
  const developerToken = get("GOOGLE_ADS_DEVELOPER_TOKEN");
  const appUrl = get("APP_URL") || "http://localhost:5173";
  const googleAds =
    clientId && clientSecret && developerToken
      ? {
          clientId,
          clientSecret,
          developerToken,
          redirectUri: get("GOOGLE_ADS_REDIRECT_URI") || `${appUrl}/auth/google/callback`,
          loginCustomerId: get("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/-/g, "") || null,
          apiVersion: get("GOOGLE_ADS_API_VERSION") || "v25",
        }
      : null;

  return {
    port: Number(get("PORT")) || 3001,
    appUrl,
    sessionSecret: sessionSecret || "dev-only-insecure-session-secret",
    production,
    googleAds,
  };
}
