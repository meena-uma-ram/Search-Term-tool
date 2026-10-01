import type { SearchTermRow } from "../../../src/engine/types";
import type { Account, Campaign } from "../../../src/shared/api";
import { ProviderError, type SearchTermQuery, type SearchTermsProvider } from "../types";
import type { GoogleAdsClient, GoogleAdsRow } from "./client";
import { CAMPAIGNS_QUERY, CUSTOMER_CLIENTS_QUERY, CUSTOMER_QUERY, searchTermsQuery } from "./gaql";

const MAX_DIRECT_CUSTOMERS = 50;

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Google Ads implementation of SearchTermsProvider. All Google Ads specifics
 * (GAQL, micros, manager accounts, login-customer-id) stay in this module.
 */
export class GoogleAdsProvider implements SearchTermsProvider {
  constructor(
    private readonly client: GoogleAdsClient,
    /**
     * accountId -> login-customer-id. Filled by listAccounts() and persisted
     * in the session so later calls use the right manager context.
     */
    private readonly access: Record<string, string | null>,
    private readonly configuredLoginCustomerId: string | null = null,
  ) {}

  async listAccounts(): Promise<Account[]> {
    const direct = await this.client.listAccessibleCustomers();
    if (this.configuredLoginCustomerId && !direct.includes(this.configuredLoginCustomerId)) {
      direct.push(this.configuredLoginCustomerId);
    }

    const accounts = new Map<string, Account>();
    const access: Record<string, string | null> = {};

    for (const id of direct.slice(0, MAX_DIRECT_CUSTOMERS)) {
      let row: GoogleAdsRow | undefined;
      try {
        [row] = await this.client.search(id, CUSTOMER_QUERY, id === this.configuredLoginCustomerId ? id : null);
      } catch {
        // Cancelled/suspended accounts and accounts without API access are skipped.
        continue;
      }
      const c = row?.customer;
      if (!c) continue;

      if (c.manager) {
        let children: GoogleAdsRow[] = [];
        try {
          children = await this.client.search(id, CUSTOMER_CLIENTS_QUERY, id);
        } catch {
          continue;
        }
        for (const child of children) {
          const cc = child.customerClient;
          const childId = str(cc?.id);
          if (!cc || !childId || accounts.has(childId)) continue;
          accounts.set(childId, {
            id: childId,
            name: str(cc.descriptiveName) || childId,
            currencyCode: str(cc.currencyCode) || "EUR",
            source: "google-ads",
          });
          access[childId] = id;
        }
      } else {
        // Direct access wins over access through a manager.
        accounts.set(id, {
          id,
          name: str(c.descriptiveName) || id,
          currencyCode: str(c.currencyCode) || "EUR",
          source: "google-ads",
        });
        access[id] = null;
      }
    }

    for (const key of Object.keys(this.access)) delete this.access[key];
    Object.assign(this.access, access);
    return [...accounts.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private loginFor(accountId: string): string | null {
    if (!(accountId in this.access)) {
      throw new ProviderError("Unknown account. Reload the account list.", 404);
    }
    return this.access[accountId] ?? null;
  }

  async listCampaigns(accountId: string): Promise<Campaign[]> {
    const rows = await this.client.search(accountId, CAMPAIGNS_QUERY, this.loginFor(accountId));
    return rows.map((r) => ({
      id: str(r.campaign?.id),
      name: str(r.campaign?.name),
      status: str(r.campaign?.status),
      channelType: str(r.campaign?.advertisingChannelType) || null,
    }));
  }

  async getSearchTerms(q: SearchTermQuery): Promise<{ currencyCode: string; rows: SearchTermRow[] }> {
    const login = this.loginFor(q.accountId);
    let query: string;
    try {
      query = searchTermsQuery(q.startDate, q.endDate, q.campaignIds);
    } catch (e) {
      throw new ProviderError((e as Error).message, 400);
    }
    const [customerRows, rows] = await Promise.all([
      this.client.search(q.accountId, CUSTOMER_QUERY, login),
      this.client.search(q.accountId, query, login),
    ]);
    const currencyCode = str(customerRows[0]?.customer?.currencyCode) || "EUR";
    return { currencyCode, rows: mapSearchTermRows(rows) };
  }
}

/** Converts searchStream rows to engine rows, merging any duplicate keys. */
export function mapSearchTermRows(rows: readonly GoogleAdsRow[]): SearchTermRow[] {
  const merged = new Map<string, SearchTermRow>();
  for (const r of rows) {
    const searchTerm = str(r.searchTermView?.searchTerm);
    if (!searchTerm) continue;
    const campaignId = str(r.campaign?.id);
    const adGroupId = str(r.adGroup?.id);
    const rawMatch = str(r.segments?.searchTermMatchType);
    const matchType = rawMatch && rawMatch !== "UNSPECIFIED" && rawMatch !== "UNKNOWN" ? rawMatch : null;
    const id = [campaignId, adGroupId, matchType ?? "-", searchTerm].join("|");
    const clicks = num(r.metrics?.clicks);
    const impressions = num(r.metrics?.impressions);
    const cost = num(r.metrics?.costMicros) / 1_000_000;
    const conversions = num(r.metrics?.conversions);

    const existing = merged.get(id);
    if (existing) {
      existing.clicks += clicks;
      existing.impressions += impressions;
      existing.cost += cost;
      existing.conversions += conversions;
      continue;
    }
    merged.set(id, {
      id,
      searchTerm,
      campaignId,
      campaignName: str(r.campaign?.name),
      adGroupId,
      adGroupName: str(r.adGroup?.name),
      matchType,
      impressions,
      clicks,
      cost,
      conversions,
    });
  }
  return [...merged.values()];
}
