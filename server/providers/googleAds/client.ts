import { ProviderError } from "../types";
import { assertId } from "./gaql";

type FetchFn = typeof fetch;

export interface GoogleAdsClientOptions {
  developerToken: string;
  apiVersion: string;
  /** Returns a valid OAuth access token (refreshing if needed). */
  getAccessToken: () => Promise<string>;
  fetch?: FetchFn;
}

/** A row from googleAds:searchStream in REST JSON form (camelCase fields). */
export type GoogleAdsRow = Record<string, Record<string, unknown> | undefined>;

interface GoogleAdsErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: { errors?: { message?: string; errorCode?: Record<string, string> }[] }[];
  };
}

/**
 * Thin, read-only Google Ads REST client. Only exposes listing accessible
 * customers and GAQL search; there is deliberately no mutate support.
 */
export class GoogleAdsClient {
  private readonly base: string;
  private readonly fetchFn: FetchFn;

  constructor(private readonly opts: GoogleAdsClientOptions) {
    this.base = `https://googleads.googleapis.com/${opts.apiVersion}`;
    this.fetchFn = opts.fetch ?? fetch;
  }

  private async headers(loginCustomerId?: string | null): Promise<Record<string, string>> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${await this.opts.getAccessToken()}`,
      "developer-token": this.opts.developerToken,
      "Content-Type": "application/json",
    };
    if (loginCustomerId) h["login-customer-id"] = assertId(loginCustomerId, "login customer id");
    return h;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const res = await this.fetchFn(url, init);
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    if (!res.ok) throw toProviderError(res.status, body);
    return body as T;
  }

  /** IDs of customers the authenticated user can access directly. */
  async listAccessibleCustomers(): Promise<string[]> {
    const body = await this.request<{ resourceNames?: string[] }>(`${this.base}/customers:listAccessibleCustomers`, {
      method: "GET",
      headers: await this.headers(),
    });
    return (body.resourceNames ?? []).map((r) => r.replace(/^customers\//, ""));
  }

  /** Runs a GAQL query via searchStream and returns all rows. */
  async search(customerId: string, query: string, loginCustomerId?: string | null): Promise<GoogleAdsRow[]> {
    const url = `${this.base}/customers/${assertId(customerId, "customer id")}/googleAds:searchStream`;
    const batches = await this.request<{ results?: GoogleAdsRow[] }[] | undefined>(url, {
      method: "POST",
      headers: await this.headers(loginCustomerId),
      body: JSON.stringify({ query }),
    });
    return (batches ?? []).flatMap((b) => b.results ?? []);
  }
}

function toProviderError(status: number, body: unknown): ProviderError {
  const err = (body as GoogleAdsErrorBody | undefined)?.error;
  // searchStream returns errors as an array of batches
  const streamErr = Array.isArray(body) ? (body[0] as GoogleAdsErrorBody | undefined)?.error : undefined;
  const e = err ?? streamErr;
  const detail = e?.details?.[0]?.errors?.[0];
  const code = detail?.errorCode ? Object.values(detail.errorCode)[0] : undefined;
  const message = detail?.message ?? e?.message ?? `Google Ads API request failed (${status})`;
  const mapped = status === 401 ? 401 : status === 403 ? 403 : status === 429 ? 429 : 502;
  return new ProviderError(code ? `${message} [${code}]` : message, mapped);
}
