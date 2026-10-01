import { formatMoney, formatNegative, formatNumber, type NgramSuggestion } from "../../engine";

interface Props {
  suggestions: NgramSuggestion[];
  currency: string;
  selected: Set<string>;
  activeNgram: string | null;
  onShow: (ngram: string | null) => void;
  onSelectTerms: (rowIds: string[], on: boolean) => void;
}

/** Words shared by several non-converting search terms: candidates for one phrase negative. */
export function NgramPanel({ suggestions, currency, selected, activeNgram, onShow, onSelectTerms }: Props) {
  return (
    <details className="card ngrams" open>
      <summary>
        <strong>Suggested negative words</strong>
        <span className="muted small">
          {suggestions.length === 0
            ? "No shared words found in non-converting terms"
            : `${suggestions.length} words or phrases that appear in several search terms with no conversions`}
        </span>
      </summary>
      {suggestions.length > 0 && (
        <>
          <p className="muted small">
            One phrase negative can cover all of these terms at once. Check the terms first: a phrase negative blocks every search containing the
            word.
          </p>
          <div className="table-scroll ngram-scroll">
            <table className="results ngram-table">
              <thead>
                <tr>
                  <th>Negative</th>
                  <th className="num">Terms</th>
                  <th className="num">Clicks</th>
                  <th className="num">Spend</th>
                  <th className="num">Conv.</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => {
                  const allSelected = s.rowIds.every((id) => selected.has(id));
                  const active = activeNgram === s.ngram;
                  return (
                    <tr key={s.ngram} className={active ? "is-selected" : undefined}>
                      <td>
                        <code className="suggestion-kw">{formatNegative(s.ngram, "PHRASE")}</code>
                      </td>
                      <td className="num">{formatNumber(s.termCount)}</td>
                      <td className="num">{formatNumber(s.clicks)}</td>
                      <td className="num">{formatMoney(s.cost, currency)}</td>
                      <td className="num">{formatNumber(s.conversions)}</td>
                      <td className="ngram-actions">
                        <button className="btn btn-secondary btn-small" aria-pressed={active} onClick={() => onShow(active ? null : s.ngram)}>
                          {active ? "Show all" : "Show terms"}
                        </button>
                        <button className="btn btn-secondary btn-small" onClick={() => onSelectTerms(s.rowIds, !allSelected)}>
                          {allSelected ? "Unselect terms" : "Select terms"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}
