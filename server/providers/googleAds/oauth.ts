import type { GoogleAdsConfig } from "../../config";
import type { GoogleTokens } from "../../session";
import { ProviderError } from "../types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";

type FetchFn = typeof fetch;

/** URL the browser is redirected to in order to grant Google Ads access. */
export function buildAuthUrl(config: GoogleAdsConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: ADWORDS_SCOPE,
    access_type: "offline",
    // Always ask for consent so Google returns a refresh token.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function postToken(body: Record<string, string>, fetchFn: FetchFn): Promise<TokenResponse> {
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new ProviderError(`Google OAuth token request failed: ${json.error_description ?? json.error ?? res.status}`, 401);
  }
  return json as TokenResponse;
}

export async function exchangeCode(config: GoogleAdsConfig, code: string, fetchFn: FetchFn = fetch): Promise<GoogleTokens> {
  const t = await postToken(
    {
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    },
    fetchFn,
  );
  if (!t.refresh_token) {
    throw new ProviderError("Google did not return a refresh token. Remove the app's access in your Google account and connect again.", 401);
  }
  if (t.scope && !t.scope.split(" ").includes(ADWORDS_SCOPE)) {
    throw new ProviderError("Google Ads access was not granted.", 403);
  }
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
}

export async function refreshTokens(config: GoogleAdsConfig, tokens: GoogleTokens, fetchFn: FetchFn = fetch): Promise<GoogleTokens> {
  const t = await postToken(
    {
      refresh_token: tokens.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    },
    fetchFn,
  );
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + t.expires_in * 1000,
  };
}

/** Best effort; disconnecting locally must succeed even if revocation fails. */
export async function revokeToken(token: string, fetchFn: FetchFn = fetch): Promise<void> {
  try {
    await fetchFn(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // ignore
  }
}
