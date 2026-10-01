import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { ServerConfig } from "../config";
import { buildAuthUrl, exchangeCode, revokeToken } from "../providers/googleAds/oauth";

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * OAuth 2.0 authorization-code flow, entirely server side. The client secret
 * and the resulting tokens never reach the browser.
 */
export function authRouter(config: ServerConfig, fetchFn: typeof fetch = fetch): Router {
  const router = Router();
  const back = (query: string) => `${config.appUrl.replace(/\/$/, "")}/?${query}`;

  router.get("/google/start", (req, res) => {
    if (!config.googleAds) {
      res.redirect(back("auth_error=" + encodeURIComponent("Google Ads is not configured on the server. Using demo data.")));
      return;
    }
    const state = randomBytes(24).toString("base64url");
    req.session.oauthState = state;
    res.redirect(buildAuthUrl(config.googleAds, state));
  });

  router.get("/google/callback", async (req, res) => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const expected = req.session.oauthState;
    delete req.session.oauthState;

    if (!config.googleAds) {
      res.redirect(back("auth_error=not_configured"));
      return;
    }
    if (error) {
      res.redirect(back("auth_error=" + encodeURIComponent(error)));
      return;
    }
    if (!code || !state || !expected || !safeEqual(state, expected)) {
      res.redirect(back("auth_error=" + encodeURIComponent("Invalid OAuth state. Please try connecting again.")));
      return;
    }
    try {
      const tokens = await exchangeCode(config.googleAds, code, fetchFn);
      req.regenerateSession();
      req.session.google = tokens;
      req.session.accountAccess = {};
      res.redirect(back("connected=1"));
    } catch (e) {
      res.redirect(back("auth_error=" + encodeURIComponent((e as Error).message)));
    }
  });

  router.post("/google/disconnect", async (req, res) => {
    const tokens = req.session.google;
    req.destroySession();
    if (tokens) await revokeToken(tokens.refreshToken, fetchFn);
    res.json({ ok: true });
  });

  return router;
}
