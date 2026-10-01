import { describe, expect, it, vi } from "vitest";
import { GoogleAdsClient } from "../server/providers/googleAds/client";
import { searchTermsQuery } from "../server/providers/googleAds/gaql";
import { buildAuthUrl } from "../server/providers/googleAds/oauth";
import { GoogleAdsProvider, mapSearchTermRows } from "../server/providers/googleAds/provider";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("gaql", () => {
  it("builds a search term query with validated input", () => {
    const q = searchTermsQuery("2026-09-01", "2026-09-30", ["123", "456"]);
    expect(q).toContain("FROM search_term_view");
    expect(q).toContain("segments.date BETWEEN '2026-09-01' AND '2026-09-30'");
    expect(q).toContain("campaign.id IN (123, 456)");
    expect(searchTermsQuery("2026-09-01", "2026-09-30", [])).not.toContain("campaign.id IN");
  });

  it("rejects injection attempts", () => {
    expect(() => searchTermsQuery("2026-09-01' OR 1=1 --", "2026-09-30", [])).toThrow();
    expect(() => searchTermsQuery("2026-09-01", "2026-09-30", ["1) OR (1=1"])).toThrow();
    expect(() => searchTermsQuery("2026-02-30", "2026-03-01", [])).toThrow();
    expect(() => searchTermsQuery("2026-09-30", "2026-09-01", [])).toThrow();
  });
});

describe("oauth", () => {
  it("requests offline access to the adwords scope with state", () => {
    const url = new URL(
      buildAuthUrl(
        { clientId: "cid", clientSecret: "secret", redirectUri: "http://localhost/cb", developerToken: "dt", loginCustomerId: null, apiVersion: "v25" },
        "xyz",
      ),
    );
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/adwords");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.toString()).not.toContain("secret");
  });
});

describe("mapSearchTermRows", () => {
  it("maps REST rows, converts micros and merges duplicate keys", () => {
    const rows = mapSearchTermRows([
      {
        searchTermView: { searchTerm: "red shoes" },
        segments: { searchTermMatchType: "PHRASE" },
        campaign: { id: "1", name: "C" },
        adGroup: { id: "2", name: "AG" },
        metrics: { clicks: "10", impressions: "100", costMicros: "12500000", conversions: 0 },
      },
      {
        searchTermView: { searchTerm: "red shoes" },
        segments: { searchTermMatchType: "PHRASE" },
        campaign: { id: "1", name: "C" },
        adGroup: { id: "2", name: "AG" },
        metrics: { clicks: "2", impressions: "5", costMicros: "500000", conversions: 1.5 },
      },
      {
        searchTermView: { searchTerm: "blue shoes" },
        campaign: { id: "1", name: "C" },
        adGroup: { id: "2", name: "AG" },
        metrics: {},
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ searchTerm: "red shoes", matchType: "PHRASE", clicks: 12, impressions: 105, cost: 13, conversions: 1.5 });
    expect(rows[1]).toMatchObject({ searchTerm: "blue shoes", matchType: null, clicks: 0, cost: 0 });
  });
});

describe("GoogleAdsProvider", () => {
  it("lists direct and manager-child accounts and sends required headers", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer at");
      expect(headers["developer-token"]).toBe("dev-token");
      if (u.endsWith("customers:listAccessibleCustomers")) return json({ resourceNames: ["customers/111", "customers/999"] });
      const body = JSON.parse(String(init?.body)) as { query: string };
      if (u.includes("/customers/111/") && body.query.includes("FROM customer ")) {
        return json([{ results: [{ customer: { id: "111", descriptiveName: "Direct", currencyCode: "EUR" } }] }]);
      }
      if (u.includes("/customers/999/") && body.query.includes("FROM customer ")) {
        return json([{ results: [{ customer: { id: "999", descriptiveName: "MCC", currencyCode: "EUR", manager: true } }] }]);
      }
      if (u.includes("/customers/999/") && body.query.includes("FROM customer_client")) {
        expect(headers["login-customer-id"]).toBe("999");
        return json([{ results: [{ customerClient: { id: "222", descriptiveName: "Child", currencyCode: "USD" } }] }]);
      }
      if (u.includes("/customers/222/")) {
        expect(headers["login-customer-id"]).toBe("999");
        return json([{ results: [{ campaign: { id: "5", name: "Camp", status: "ENABLED", advertisingChannelType: "SEARCH" } }] }]);
      }
      throw new Error(`unexpected ${u}`);
    });
    const client = new GoogleAdsClient({ developerToken: "dev-token", apiVersion: "v25", getAccessToken: async () => "at", fetch: fetchMock as typeof fetch });
    const access: Record<string, string | null> = {};
    const provider = new GoogleAdsProvider(client, access);

    const accounts = await provider.listAccounts();
    expect(accounts.map((a) => [a.id, a.name, a.currencyCode])).toEqual([
      ["222", "Child", "USD"],
      ["111", "Direct", "EUR"],
    ]);
    expect(access).toEqual({ "111": null, "222": "999" });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://googleads.googleapis.com/v25/customers:listAccessibleCustomers");

    const campaigns = await provider.listCampaigns("222");
    expect(campaigns).toEqual([{ id: "5", name: "Camp", status: "ENABLED", channelType: "SEARCH" }]);
    await expect(provider.listCampaigns("333")).rejects.toThrow(/Unknown account/);
  });

  it("surfaces Google Ads API errors", async () => {
    const fetchMock = vi.fn(async () =>
      json(
        { error: { code: 403, message: "denied", details: [{ errors: [{ message: "The developer token is not approved.", errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" } }] }] } },
        403,
      ),
    );
    const client = new GoogleAdsClient({ developerToken: "d", apiVersion: "v25", getAccessToken: async () => "at", fetch: fetchMock as typeof fetch });
    await expect(client.listAccessibleCustomers()).rejects.toMatchObject({
      status: 403,
      message: "The developer token is not approved. [DEVELOPER_TOKEN_NOT_APPROVED]",
    });
  });
});
