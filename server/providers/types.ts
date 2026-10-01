import type { SearchTermRow } from "../../src/engine/types";
import type { Account, Campaign } from "../../src/shared/api";

export interface DateRange {
  /** YYYY-MM-DD, inclusive */
  startDate: string;
  /** YYYY-MM-DD, inclusive */
  endDate: string;
}

export interface SearchTermQuery extends DateRange {
  accountId: string;
  /** Empty = all campaigns. */
  campaignIds: string[];
}

/**
 * Read-only data source for search-term reporting. Implemented by the Google
 * Ads provider and the synthetic demo provider. There are intentionally no
 * write/mutate methods: this MVP never changes anything in Google Ads.
 */
export interface SearchTermsProvider {
  listAccounts(): Promise<Account[]>;
  listCampaigns(accountId: string): Promise<Campaign[]>;
  getSearchTerms(query: SearchTermQuery): Promise<{ currencyCode: string; rows: SearchTermRow[] }>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
