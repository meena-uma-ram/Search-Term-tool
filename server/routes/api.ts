import { Router, type Request, type Response } from "express";
import type { SearchTermsResponse, StatusResponse } from "../../src/shared/api";
import type { ServerConfig } from "../config";
import { DemoProvider } from "../providers/demo/provider";
import { GoogleAdsClient } from "../providers/googleAds/client";
import { assertId, isValidDate } from "../providers/googleAds/gaql";
import { refreshTokens } from "../providers/googleAds/oauth";
import { GoogleAdsProvider } from "../providers/googleAds/provider";
import { ProviderError, type SearchTermsProvider } from "../providers/types";

const demo = new DemoProvider();

export function apiRouter(config: ServerConfig, fetchFn: typeof fetch = fetch): Router {
  const router = Router();

  const isConnected = (req: Request) => Boolean(config.googleAds && req.session.google);

  function providerFor(req: Request): SearchTermsProvider {
    const gads = config.googleAds;
    if (!gads || !req.session.google) return demo;

    const client = new GoogleAdsClient({
      developerToken: gads.developerToken,
      apiVersion: gads.apiVersion,
      fetch: fetchFn,
      getAccessToken: async () => {
        const tokens = req.session.google;
        if (!tokens) throw new ProviderError("Not connected to Google Ads", 401);
        if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
        try {
          req.session.google = await refreshTokens(gads, tokens, fetchFn);
        } catch (e) {
          delete req.session.google; // revoked / expired grant: force reconnect
          throw e;
        }
        return req.session.google.accessToken;
      },
    });
    req.session.accountAccess ??= {};
    return new GoogleAdsProvider(client, req.session.accountAccess, gads.loginCustomerId);
  }

  const handle =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try {
        await fn(req, res);
      } catch (e) {
        const status = e instanceof ProviderError ? e.status : 500;
        const message = e instanceof ProviderError ? e.message : "Unexpected server error";
        if (!(e instanceof ProviderError)) console.error(e);
        res.status(status).json({ error: message });
      }
    };

  /** Account ids are digits for Google Ads, "demo-<digits>" in demo mode. */
  const accountIdParam = (req: Request) => {
    const id = String(req.params.accountId ?? "");
    if (isConnected(req)) {
      try {
        return assertId(id, "account id");
      } catch {
        throw new ProviderError("Invalid account id", 400);
      }
    }
    if (!/^demo-\d+$/.test(id)) throw new ProviderError("Invalid account id", 400);
    return id;
  };

  router.get("/status", (req, res) => {
    const body: StatusResponse = {
      googleAdsConfigured: Boolean(config.googleAds),
      connected: isConnected(req),
      source: isConnected(req) ? "google-ads" : "demo",
    };
    res.json(body);
  });

  router.get(
    "/accounts",
    handle(async (req, res) => {
      res.json({ accounts: await providerFor(req).listAccounts() });
    }),
  );

  router.get(
    "/accounts/:accountId/campaigns",
    handle(async (req, res) => {
      res.json({ campaigns: await providerFor(req).listCampaigns(accountIdParam(req)) });
    }),
  );

  router.get(
    "/accounts/:accountId/search-terms",
    handle(async (req, res) => {
      const accountId = accountIdParam(req);
      const startDate = String(req.query.startDate ?? "");
      const endDate = String(req.query.endDate ?? "");
      if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
        throw new ProviderError("startDate and endDate must be valid YYYY-MM-DD dates with startDate <= endDate", 400);
      }
      const rawIds = String(req.query.campaignIds ?? "").trim();
      const campaignIds = rawIds === "" ? [] : rawIds.split(",").map((s) => s.trim());
      if (campaignIds.some((id) => !/^\d{1,20}$/.test(id))) throw new ProviderError("Invalid campaign id", 400);

      const result = await providerFor(req).getSearchTerms({ accountId, startDate, endDate, campaignIds });
      const body: SearchTermsResponse = {
        accountId,
        startDate,
        endDate,
        source: isConnected(req) ? "google-ads" : "demo",
        ...result,
      };
      res.json(body);
    }),
  );

  router.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return router;
}
