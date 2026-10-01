import { formatMoney, formatNumber, type Summary } from "../../engine";

interface Props {
  summary: Summary;
  currency: string;
  loading: boolean;
}

export function SummaryCards({ summary, currency, loading }: Props) {
  const items = [
    { label: "Total terms", value: formatNumber(summary.totalTerms) },
    { label: "Clicks", value: formatNumber(summary.clicks) },
    { label: "Spend", value: formatMoney(summary.cost, currency) },
    { label: "Conversions", value: formatNumber(summary.conversions) },
    { label: "Zero-conversion terms", value: formatNumber(summary.zeroConversionTerms) },
  ];
  return (
    <section className={`summary${loading ? " is-loading" : ""}`} aria-label="Summary">
      {items.map((i) => (
        <div key={i.label} className="card stat">
          <div className="stat-label">{i.label}</div>
          <div className="stat-value">{i.value}</div>
        </div>
      ))}
    </section>
  );
}
