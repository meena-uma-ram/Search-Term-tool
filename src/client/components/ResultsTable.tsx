import { useEffect, useMemo, useRef, useState } from "react";
import { TAG_LABELS, formatMoney, formatNegative, formatNumber, type ClassifiedRow } from "../../engine";

interface Props {
  rows: ClassifiedRow[];
  currency: string;
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
}

type SortKey = "searchTerm" | "campaignName" | "adGroupName" | "clicks" | "cost" | "conversions" | "costPerConversion" | "matchType";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "searchTerm", label: "Search term" },
  { key: "campaignName", label: "Campaign" },
  { key: "adGroupName", label: "Ad group" },
  { key: "matchType", label: "Match type" },
  { key: "clicks", label: "Clicks", numeric: true },
  { key: "cost", label: "Cost", numeric: true },
  { key: "conversions", label: "Conv.", numeric: true },
  { key: "costPerConversion", label: "Cost / conv.", numeric: true },
];

const PAGE = 200;

function compare(a: ClassifiedRow, b: ClassifiedRow, key: SortKey): number {
  const x = a[key];
  const y = b[key];
  // nulls (e.g. cost/conv with 0 conversions) always last
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x).localeCompare(String(y));
}

const formatMatchType = (m: string | null) => (m ? m.toLowerCase().replace(/_/g, " ") : "—");

export function ResultsTable({ rows, currency, loading, selected, onToggle, onSetMany }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "cost", dir: -1 });
  const [limit, setLimit] = useState(PAGE);
  const headerBox = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const c = compare(a, b, sort.key);
      const nullOrder = (a[sort.key] === null) !== (b[sort.key] === null);
      return (nullOrder ? c : c * sort.dir) || a.searchTerm.localeCompare(b.searchTerm);
    });
    return copy;
  }, [rows, sort]);

  useEffect(() => setLimit(PAGE), [rows]);

  const shown = sorted.slice(0, limit);
  const selectedVisible = rows.filter((r) => selected.has(r.id)).length;
  const allChecked = rows.length > 0 && selectedVisible === rows.length;

  useEffect(() => {
    if (headerBox.current) headerBox.current.indeterminate = selectedVisible > 0 && !allChecked;
  }, [selectedVisible, allChecked]);

  const clickSort = (key: SortKey, numeric?: boolean) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: numeric ? -1 : 1 }));

  return (
    <section className="card table-card">
      <div className="table-scroll">
        <table className="results">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  ref={headerBox}
                  type="checkbox"
                  aria-label="Select all terms in this view"
                  checked={allChecked}
                  disabled={rows.length === 0}
                  onChange={() => onSetMany(rows.map((r) => r.id), !allChecked)}
                />
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={c.numeric ? "num" : undefined}
                  aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                >
                  <button className="sort" onClick={() => clickSort(c.key, c.numeric)}>
                    {c.label}
                    <span className="sort-indicator">{sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
                  </button>
                </th>
              ))}
              <th>Classification</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <tr key={r.id} className={isSel ? "is-selected" : undefined} onClick={() => onToggle(r.id)}>
                  <td className="col-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${r.searchTerm}`} checked={isSel} onChange={() => onToggle(r.id)} />
                  </td>
                  <td className="term">{r.searchTerm}</td>
                  <td>{r.campaignName}</td>
                  <td>{r.adGroupName}</td>
                  <td className="muted">{formatMatchType(r.matchType)}</td>
                  <td className="num">{formatNumber(r.clicks)}</td>
                  <td className="num">{formatMoney(r.cost, currency)}</td>
                  <td className="num">{formatNumber(r.conversions)}</td>
                  <td className="num">{r.costPerConversion === null ? "—" : formatMoney(r.costPerConversion, currency)}</td>
                  <td>
                    <div className="tags">
                      {r.tags.map((t) => {
                        const hits = r.matches[t];
                        const title = hits ? `${t === "NEAR_DUPLICATE" ? "Similar to" : "Matched"}: ${hits.join(", ")}` : undefined;
                        return (
                          <span key={t} className={`tag tag-${t.toLowerCase()}`} title={title}>
                            {TAG_LABELS[t]}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    {r.recommendation.kind === "POTENTIAL_NEGATIVE" ? (
                      <div className="rec">
                        <span className="rec-label">{r.recommendation.label}</span>
                        <ul className="rec-reasons">
                          {r.recommendation.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                        {r.suggestion && (
                          <div className="suggestion" title={[r.suggestion.reason, r.suggestion.caution].filter(Boolean).join(". ")}>
                            <span className="suggestion-label">Suggested negative</span>
                            <code className="suggestion-kw">{formatNegative(r.suggestion.keyword, r.suggestion.matchType)}</code>
                            <span className="suggestion-mt">{r.suggestion.matchType === "EXACT" ? "exact" : "phrase"}</span>
                            {r.suggestion.caution && <span className="suggestion-caution" aria-label="Caution">!</span>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">{loading ? "Loading search terms…" : "No search terms match this view."}</div>}
      </div>
      {sorted.length > limit && (
        <div className="table-more">
          Showing {formatNumber(limit)} of {formatNumber(sorted.length)} terms.{" "}
          <button className="link" onClick={() => setLimit((l) => l + PAGE * 5)}>
            Show more
          </button>
        </div>
      )}
    </section>
  );
}
