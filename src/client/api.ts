// Browser-side API client. Talks only to our backend; never to Google directly.
import type { Account, Campaign, SearchTermsResponse, StatusResponse } from "../shared/api";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError((body as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

/** Hosting facts the UI adapts to. The standalone preview build swaps this module out. */
export const runtime = {
  /** True when running without a backend (synthetic data in the browser). */
  standalone: false,
  /** Whether the page may start a file download. */
  canDownload: true,
};

export const api = {
  status: () => request<StatusResponse>("/api/status"),
  accounts: () => request<{ accounts: Account[] }>("/api/accounts").then((r) => r.accounts),
  campaigns: (accountId: string) =>
    request<{ campaigns: Campaign[] }>(`/api/accounts/${encodeURIComponent(accountId)}/campaigns`).then((r) => r.campaigns),
  searchTerms: (accountId: string, startDate: string, endDate: string, campaignIds: string[]) => {
    const q = new URLSearchParams({ startDate, endDate });
    if (campaignIds.length > 0) q.set("campaignIds", campaignIds.join(","));
    return request<SearchTermsResponse>(`/api/accounts/${encodeURIComponent(accountId)}/search-terms?${q}`);
  },
  disconnect: () => request<{ ok: true }>("/auth/google/disconnect", { method: "POST" }),
  /** Full-page navigation: the backend redirects to Google's consent screen. */
  connectUrl: "/auth/google/start",
};
