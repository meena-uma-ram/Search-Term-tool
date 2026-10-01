import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { loadConfig } from "../server/config";
import type { SearchTermsResponse } from "../src/shared/api";

let server: Server | undefined;

async function start(env: Record<string, string>, fetchMock?: typeof fetch) {
  const config = loadConfig({ SESSION_SECRET: "test-secret", APP_URL: "http://app.test", ...env });
  server = createApp(config, { fetch: fetchMock, staticDir: "/nonexistent" }).listen(0);
  await new Promise((r) => server!.once("listening", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(() => {
  server?.close();
  server = undefined;
});

const GOOGLE_ENV = {
  GOOGLE_ADS_CLIENT_ID: "client-id",
  GOOGLE_ADS_CLIENT_SECRET: "super-secret",
  GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token-secret",
  GOOGLE_ADS_REDIRECT_URI: "http://app.test/auth/google/callback",
};

describe("demo mode", () => {
  it("serves demo accounts, campaigns and deterministic search terms", async () => {
    const base = await start({});
    const status = await (await fetch(`${base}/api/status`)).json();
    expect(status).toEqual({ googleAdsConfigured: false, connected: false, source: "demo" });

    const { accounts } = await (await fetch(`${base}/api/accounts`)).json();
    expect(accounts.length).toBeGreaterThan(0);
    const id = accounts[0].id as string;

    const { campaigns } = await (await fetch(`${base}/api/accounts/${id}/campaigns`)).json();
    expect(campaigns.length).toBeGreaterThan(0);

    const url = `${base}/api/accounts/${id}/search-terms?startDate=2026-09-01&endDate=2026-09-30`;
    const a = (await (await fetch(url)).json()) as SearchTermsResponse;
    const b = (await (await fetch(url)).json()) as SearchTermsResponse;
    expect(a.rows.length).toBeGreaterThan(20);
    expect(a.rows).toEqual(b.rows);
    expect(a.source).toBe("demo");

    const one = (await (await fetch(`${url}&campaignIds=${campaigns[0].id}`)).json()) as SearchTermsResponse;
    expect(one.rows.every((r) => r.campaignId === campaigns[0].id)).toBe(true);
  });

  it("validates input", async () => {
    const base = await start({});
    expect((await fetch(`${base}/api/accounts/demo-1001/search-terms?startDate=2026-09-30&endDate=2026-09-01`)).status).toBe(400);
    expect((await fetch(`${base}/api/accounts/demo-1001/search-terms?startDate=x&endDate=2026-09-01`)).status).toBe(400);
    expect((await fetch(`${base}/api/accounts/demo-1001/search-terms?startDate=2026-09-01&endDate=2026-09-02&campaignIds=1%20OR%201`)).status).toBe(400);
    expect((await fetch(`${base}/api/accounts/demo-9/campaigns`)).status).toBe(404);
  });
});

describe("Google OAuth flow", () => {
  it("never leaks secrets and completes the code flow with state check", async () => {
    const calls: string[] = [];
    const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push(u);
      if (u === "https://oauth2.googleapis.com/token") {
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("client_secret")).toBe("super-secret");
        expect(body.get("code")).toBe("auth-code");
        return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "https://www.googleapis.com/auth/adwords" }));
      }
      if (u.endsWith("customers:listAccessibleCustomers")) return new Response(JSON.stringify({ resourceNames: ["customers/111"] }));
      if (u.includes("/customers/111/googleAds:searchStream")) {
        return new Response(JSON.stringify([{ results: [{ customer: { id: "111", descriptiveName: "Real", currencyCode: "EUR" } }] }]));
      }
      if (u === "https://oauth2.googleapis.com/revoke") return new Response("{}");
      throw new Error(`unexpected ${u}`);
    }) as typeof fetch;

    const base = await start(GOOGLE_ENV, fetchMock);

    const start1 = await fetch(`${base}/auth/google/start`, { redirect: "manual" });
    expect(start1.status).toBe(302);
    const location = new URL(start1.headers.get("location")!);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.toString()).not.toContain("super-secret");
    const state = location.searchParams.get("state")!;
    const cookie = start1.headers.get("set-cookie")!.split(";")[0]!;
    expect(start1.headers.get("set-cookie")).toMatch(/HttpOnly/i);

    // wrong state is rejected
    const bad = await fetch(`${base}/auth/google/callback?code=auth-code&state=nope`, { redirect: "manual", headers: { cookie } });
    expect(bad.headers.get("location")).toContain("auth_error=");

    // state was consumed: restart and use the right one
    const start2 = await fetch(`${base}/auth/google/start`, { redirect: "manual", headers: { cookie } });
    const state2 = new URL(start2.headers.get("location")!).searchParams.get("state")!;
    expect(state2).not.toBe(state);
    const cb = await fetch(`${base}/auth/google/callback?code=auth-code&state=${state2}`, { redirect: "manual", headers: { cookie } });
    expect(cb.headers.get("location")).toBe("http://app.test/?connected=1");
    // session id is rotated on login
    const authed = cb.headers.get("set-cookie")!.split(";")[0]!;
    expect(authed).not.toBe(cookie);

    const statusRes = await fetch(`${base}/api/status`, { headers: { cookie: authed } });
    const statusText = await statusRes.text();
    expect(JSON.parse(statusText)).toEqual({ googleAdsConfigured: true, connected: true, source: "google-ads" });

    const accountsText = await (await fetch(`${base}/api/accounts`, { headers: { cookie: authed } })).text();
    expect(JSON.parse(accountsText).accounts).toEqual([{ id: "111", name: "Real", currencyCode: "EUR", source: "google-ads" }]);
    for (const text of [statusText, accountsText]) {
      expect(text).not.toMatch(/super-secret|dev-token-secret|"at"|"rt"/);
    }

    // the old pre-login cookie is not authenticated
    expect((await (await fetch(`${base}/api/status`, { headers: { cookie } })).json()).connected).toBe(false);

    const dc = await fetch(`${base}/auth/google/disconnect`, { method: "POST", headers: { cookie: authed } });
    expect(dc.status).toBe(200);
    expect(calls).toContain("https://oauth2.googleapis.com/revoke");
    expect((await (await fetch(`${base}/api/status`, { headers: { cookie: authed } })).json()).connected).toBe(false);
  });
});
