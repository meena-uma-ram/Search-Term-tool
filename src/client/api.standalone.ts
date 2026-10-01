// Drop-in replacement for ./api used by the standalone preview build
// (npm run build:preview). No backend: the demo provider runs in the browser.
import { DemoProvider } from "../../server/providers/demo/provider";
import type { Account, Campaign, SearchTermsResponse, StatusResponse } from "../shared/api";

export { ApiRequestError } from "./api";

export const runtime = {
  standalone: true,
  canDownload: false,
};

const demo = new DemoProvider();
const tick = <T>(value: Promise<T>) => new Promise<T>((r) => setTimeout(() => r(value), 120));

export const api = {
  status: (): Promise<StatusResponse> => Promise.resolve({ googleAdsConfigured: false, connected: false, source: "demo" }),
  accounts: (): Promise<Account[]> => tick(demo.listAccounts()),
  campaigns: (accountId: string): Promise<Campaign[]> => tick(demo.listCampaigns(accountId)),
  searchTerms: async (accountId: string, startDate: string, endDate: string, campaignIds: string[]): Promise<SearchTermsResponse> => {
    const result = await tick(demo.getSearchTerms({ accountId, startDate, endDate, campaignIds }));
    return { accountId, startDate, endDate, source: "demo", ...result };
  },
  disconnect: () => Promise.resolve({ ok: true as const }),
  connectUrl: "#",
};
