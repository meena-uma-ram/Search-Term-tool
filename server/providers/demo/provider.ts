import type { SearchTermRow } from "../../../src/engine/types";
import type { Account, Campaign } from "../../../src/shared/api";
import { isValidDate } from "../googleAds/gaql";
import { ProviderError, type SearchTermQuery, type SearchTermsProvider } from "../types";
import { DEMO_ACCOUNTS, type DemoAccount } from "./demoData";

const MAX_DAYS = 400;

/** FNV-1a 32-bit hash -> [0, 1). Deterministic noise without Math.random. */
function hash01(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // murmur3 finalizer: spreads small input differences over all bits
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

function* days(start: string, end: string): Generator<string> {
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  for (; d <= last; d.setUTCDate(d.getUTCDate() + 1)) yield d.toISOString().slice(0, 10);
}

/** Synthetic data source so the app works without a Google Ads account. */
export class DemoProvider implements SearchTermsProvider {
  constructor(private readonly accounts: readonly DemoAccount[] = DEMO_ACCOUNTS) {}

  private account(id: string): DemoAccount {
    const a = this.accounts.find((x) => x.id === id);
    if (!a) throw new ProviderError("Unknown demo account", 404);
    return a;
  }

  async listAccounts(): Promise<Account[]> {
    return this.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      currencyCode: a.currencyCode,
      source: "demo" as const,
      suggestedConfig: { brandTerms: a.brandTerms, competitorTerms: a.competitorTerms },
    }));
  }

  async listCampaigns(accountId: string): Promise<Campaign[]> {
    return this.account(accountId).campaigns.map((c) => ({ ...c }));
  }

  async getSearchTerms(q: SearchTermQuery): Promise<{ currencyCode: string; rows: SearchTermRow[] }> {
    if (!isValidDate(q.startDate) || !isValidDate(q.endDate) || q.startDate > q.endDate) {
      throw new ProviderError("Invalid date range", 400);
    }
    const account = this.account(q.accountId);
    const campaignByName = new Map(account.campaigns.map((c) => [c.name, c]));
    const wanted = new Set(q.campaignIds);
    const dates = [...days(q.startDate, q.endDate)].slice(0, MAX_DAYS);

    const rows: SearchTermRow[] = [];
    for (const term of account.terms) {
      const campaign = campaignByName.get(term.campaign)!;
      if (wanted.size > 0 && !wanted.has(campaign.id)) continue;

      let impressions = 0;
      let clicks = 0;
      let cost = 0;
      let conversions = 0;
      for (const date of dates) {
        const seed = `${account.id}|${term.term}|${term.adGroup}|${date}`;
        // Poisson-ish integer clicks around the daily average.
        const dayClicks = Math.floor(term.clicks * (0.4 + 1.2 * hash01(seed + "c")) + hash01(seed + "r"));
        clicks += dayClicks;
        impressions += Math.round(dayClicks * (8 + 20 * hash01(seed + "i"))) + Math.floor(3 * hash01(seed + "j"));
        cost += dayClicks * term.cpc * (0.8 + 0.4 * hash01(seed + "p"));
        if (term.cvr > 0) {
          for (let k = 0; k < dayClicks; k++) if (hash01(`${seed}|v${k}`) < term.cvr) conversions++;
        }
      }
      if (impressions === 0) continue;

      const adGroupId = String(1000 + (Math.floor(hash01(term.adGroup) * 9000) | 0));
      rows.push({
        id: [campaign.id, adGroupId, term.matchType, term.term].join("|"),
        searchTerm: term.term,
        campaignId: campaign.id,
        campaignName: campaign.name,
        adGroupId,
        adGroupName: term.adGroup,
        matchType: term.matchType,
        impressions,
        clicks,
        cost: Math.round(cost * 100) / 100,
        conversions,
      });
    }
    return { currencyCode: account.currencyCode, rows };
  }
}
