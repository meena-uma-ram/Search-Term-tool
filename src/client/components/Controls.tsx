import type { Account, Campaign } from "../../shared/api";
import { DATE_PRESETS, presetRange, type DateRangeValue } from "../dates";

interface Props {
  accounts: Account[];
  accountId: string;
  onAccountChange: (id: string) => void;
  range: DateRangeValue;
  onRangeChange: (r: DateRangeValue) => void;
  campaigns: Campaign[];
  campaignIds: string[];
  onCampaignIdsChange: (ids: string[]) => void;
}

export function Controls(p: Props) {
  const allCampaigns = p.campaignIds.length === 0;
  const campaignLabel = allCampaigns
    ? "All campaigns"
    : p.campaignIds.length === 1
      ? (p.campaigns.find((c) => c.id === p.campaignIds[0])?.name ?? "1 campaign")
      : `${p.campaignIds.length} campaigns`;

  const toggleCampaign = (id: string) => {
    const next = p.campaignIds.includes(id) ? p.campaignIds.filter((x) => x !== id) : [...p.campaignIds, id];
    // Selecting every campaign is the same as "all".
    p.onCampaignIdsChange(next.length === p.campaigns.length ? [] : next);
  };

  return (
    <section className="controls card">
      <label className="field">
        <span className="field-label">Account</span>
        <select value={p.accountId} onChange={(e) => p.onAccountChange(e.target.value)} disabled={p.accounts.length === 0}>
          {p.accounts.length === 0 && <option value="">No accounts</option>}
          {p.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} {a.source === "google-ads" ? `(${a.id.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3")})` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field-label">Date range</span>
        <div className="date-row">
          <select
            value={p.range.preset}
            onChange={(e) => {
              const preset = e.target.value as DateRangeValue["preset"];
              const def = DATE_PRESETS.find((d) => d.value === preset);
              p.onRangeChange(def?.days ? { preset, ...presetRange(def.days) } : { ...p.range, preset });
            }}
          >
            {DATE_PRESETS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="Start date"
            value={p.range.startDate}
            max={p.range.endDate}
            onChange={(e) => e.target.value && p.onRangeChange({ ...p.range, preset: "custom", startDate: e.target.value })}
          />
          <span className="muted">–</span>
          <input
            type="date"
            aria-label="End date"
            value={p.range.endDate}
            min={p.range.startDate}
            onChange={(e) => e.target.value && p.onRangeChange({ ...p.range, preset: "custom", endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <span className="field-label">Campaigns</span>
        <details className="dropdown">
          <summary>{campaignLabel}</summary>
          <div className="dropdown-menu">
            <label className="check-row">
              <input type="checkbox" checked={allCampaigns} onChange={() => p.onCampaignIdsChange([])} />
              <strong>All campaigns</strong>
            </label>
            {p.campaigns.map((c) => (
              <label key={c.id} className="check-row">
                <input type="checkbox" checked={!allCampaigns && p.campaignIds.includes(c.id)} onChange={() => toggleCampaign(c.id)} />
                <span>{c.name}</span>
                {c.status !== "ENABLED" && <span className="muted small">{c.status.toLowerCase()}</span>}
              </label>
            ))}
            {p.campaigns.length === 0 && <div className="muted small">No campaigns</div>}
          </div>
        </details>
      </div>
    </section>
  );
}
