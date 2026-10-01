// JSON contract between the backend and the browser. Contains no secrets.
import type { RuleConfig, SearchTermRow } from "../engine/types";

export type DataSource = "google-ads" | "demo";

export interface StatusResponse {
  /** Server has OAuth client + developer token configured. */
  googleAdsConfigured: boolean;
  /** This browser session holds a Google Ads authorization. */
  connected: boolean;
  /** Where account/campaign/search-term data comes from right now. */
  source: DataSource;
}

export interface Account {
  id: string;
  name: string;
  currencyCode: string;
  source: DataSource;
  /** Optional starter rule lists (used by demo accounts). */
  suggestedConfig?: Partial<RuleConfig>;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  channelType: string | null;
}

export interface SearchTermsResponse {
  accountId: string;
  currencyCode: string;
  startDate: string;
  endDate: string;
  source: DataSource;
  rows: SearchTermRow[];
}

export interface ApiError {
  error: string;
}
