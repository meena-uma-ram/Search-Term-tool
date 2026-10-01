import type { ClassifiedRow } from "../../engine";
import { FILTERS, matchesFilter, type FilterKey } from "../filters";

interface Props {
  rows: ClassifiedRow[];
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  search: string;
  onSearchChange: (s: string) => void;
}

export function FilterBar({ rows, filter, onFilterChange, search, onSearchChange }: Props) {
  return (
    <section className="filterbar">
      <div className="chips" role="tablist" aria-label="Filters">
        {FILTERS.map((f) => {
          const count = rows.filter((r) => matchesFilter(r, f.key)).length;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={`chip${filter === f.key ? " is-active" : ""}`}
              onClick={() => onFilterChange(f.key)}
            >
              {f.label} <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>
      <input
        type="search"
        className="search"
        placeholder="Search terms, campaigns, ad groups…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </section>
  );
}
