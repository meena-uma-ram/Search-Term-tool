interface Props {
  selectedCount: number;
  hiddenSelectedCount: number;
  onExport: () => void;
  onClear: () => void;
}

export function SelectionBar({ selectedCount, hiddenSelectedCount, onExport, onClear }: Props) {
  return (
    <footer className="selection-bar">
      <div className="selection-count">
        <strong>
          {selectedCount} {selectedCount === 1 ? "term" : "terms"} selected
        </strong>
        {hiddenSelectedCount > 0 && <span className="muted small"> ({hiddenSelectedCount} hidden by current filter)</span>}
        {selectedCount > 0 && (
          <button className="link" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div className="selection-actions">
        <button
          className="btn btn-secondary"
          disabled
          title="Coming in a future version. This MVP never changes your Google Ads account."
        >
          Apply selected negatives to Google Ads
          <span className="soon">Coming soon</span>
        </button>
        <button className="btn btn-primary" disabled={selectedCount === 0} onClick={onExport}>
          Export selected CSV
        </button>
      </div>
    </footer>
  );
}
