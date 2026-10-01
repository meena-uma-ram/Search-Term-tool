import { useCallback, useEffect, useMemo, useState } from "react";
import { classifiedRowsToCsv, classifyRows, summarize } from "../engine";
import type { Account, Campaign, SearchTermsResponse, StatusResponse } from "../shared/api";
import { api, runtime } from "./api";
import { CsvDialog } from "./components/CsvDialog";
import { Controls } from "./components/Controls";
import { FilterBar } from "./components/FilterBar";
import { Header } from "./components/Header";
import { ResultsTable } from "./components/ResultsTable";
import { RulesPanel } from "./components/RulesPanel";
import { SelectionBar } from "./components/SelectionBar";
import { SummaryCards } from "./components/SummaryCards";
import { presetRange, type DateRangeValue } from "./dates";
import { matchesFilter, type FilterKey } from "./filters";
import { useRuleConfig } from "./useRuleConfig";

function readAuthMessage(): string | null {
  const params = new URLSearchParams(window.location.search);
  const err = params.get("auth_error");
  if (params.has("auth_error") || params.has("connected")) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  return err;
}

export function App() {
  const [authError, setAuthError] = useState<string | null>(readAuthMessage);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [range, setRange] = useState<DateRangeValue>(() => ({ preset: "30", ...presetRange(30) }));
  const [data, setData] = useState<SearchTermsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [csvPreview, setCsvPreview] = useState<{ csv: string; fileName: string } | null>(null);

  const account = useMemo(() => accounts.find((a) => a.id === accountId) ?? null, [accounts, accountId]);
  const rules = useRuleConfig(account);

  const loadAccounts = useCallback(async () => {
    setError(null);
    try {
      const s = await api.status();
      setStatus(s);
      const list = await api.accounts();
      setAccounts(list);
      setAccountId((current) => (list.some((a) => a.id === current) ? current : (list[0]?.id ?? "")));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // Campaigns for the selected account
  useEffect(() => {
    setCampaigns([]);
    setCampaignIds([]);
    if (!accountId) return;
    let cancelled = false;
    api
      .campaigns(accountId)
      .then((c) => !cancelled && setCampaigns(c))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  // Search terms for account + date range + campaign selection
  useEffect(() => {
    if (!accountId || range.startDate > range.endDate) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .searchTerms(accountId, range.startDate, range.endDate, campaignIds)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setSelected(new Set());
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accountId, range.startDate, range.endDate, campaignIds]);

  const currency = data?.currencyCode ?? account?.currencyCode ?? "EUR";

  // Classification runs locally and re-runs instantly when rules are edited.
  const classified = useMemo(
    () => (data ? classifyRows(data.rows, rules.config, { currencyCode: currency }) : []),
    [data, rules.config, currency],
  );
  const summary = useMemo(() => summarize(classified), [classified]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classified;
    return classified.filter(
      (r) =>
        r.searchTerm.toLowerCase().includes(q) ||
        r.campaignName.toLowerCase().includes(q) ||
        r.adGroupName.toLowerCase().includes(q),
    );
  }, [classified, search]);

  const visible = useMemo(() => searched.filter((r) => matchesFilter(r, filter)), [searched, filter]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const selectedRows = useMemo(() => classified.filter((r) => selected.has(r.id)), [classified, selected]);
  const visibleIds = useMemo(() => new Set(visible.map((r) => r.id)), [visible]);

  const exportCsv = () => {
    if (selectedRows.length === 0) return;
    const csv = classifiedRowsToCsv(selectedRows, currency);
    const fileName = `search-terms-${data?.accountId ?? "export"}-${range.startDate}_${range.endDate}.csv`;
    if (!runtime.canDownload) {
      setCsvPreview({ csv, fileName });
      return;
    }
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const disconnect = async () => {
    await api.disconnect().catch(() => undefined);
    setData(null);
    await loadAccounts();
  };

  return (
    <div className="app">
      <Header status={status} onDisconnect={disconnect} />

      {authError && (
        <div className="notice notice-error" role="alert">
          <span>Google Ads connection failed: {authError}</span>
          <button className="link" onClick={() => setAuthError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {status && status.source === "demo" && (
        <div className="notice notice-info">
          <span>
            Showing <strong>synthetic demo data</strong>.{" "}
            {runtime.standalone
              ? "This is an interactive preview. Run the app locally to connect your Google Ads account."
              : status.googleAdsConfigured
              ? "Connect Google Ads to load your real search terms."
              : "Google Ads credentials are not configured on the server (see README)."}
          </span>
        </div>
      )}
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <Controls
        accounts={accounts}
        accountId={accountId}
        onAccountChange={setAccountId}
        range={range}
        onRangeChange={setRange}
        campaigns={campaigns}
        campaignIds={campaignIds}
        onCampaignIdsChange={setCampaignIds}
      />

      <SummaryCards summary={summary} currency={currency} loading={loading} />

      <RulesPanel config={rules.config} currency={currency} onChange={rules.update} onReset={rules.reset} />

      <FilterBar rows={searched} filter={filter} onFilterChange={setFilter} search={search} onSearchChange={setSearch} />

      <ResultsTable
        rows={visible}
        currency={currency}
        loading={loading}
        selected={selected}
        onToggle={toggle}
        onSetMany={setMany}
      />

      <SelectionBar
        selectedCount={selectedRows.length}
        hiddenSelectedCount={selectedRows.filter((r) => !visibleIds.has(r.id)).length}
        onExport={exportCsv}
        onClear={() => setSelected(new Set())}
      />

      {csvPreview && <CsvDialog csv={csvPreview.csv} fileName={csvPreview.fileName} onClose={() => setCsvPreview(null)} />}
    </div>
  );
}
