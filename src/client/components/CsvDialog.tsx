import { useRef, useState } from "react";

interface Props {
  csv: string;
  fileName: string;
  onClose: () => void;
}

/** Fallback when the page cannot start a download: show the CSV to copy. */
export function CsvDialog({ csv, fileName, onClose }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "select">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied("copied");
    } catch {
      area.current?.select();
      setCopied("select");
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby="csv-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="csv-title">Export selected CSV</h2>
        <p className="muted small">
          Downloads are blocked in this preview. Copy the CSV and paste it into a file named <code>{fileName}</code> or into a spreadsheet.
        </p>
        <textarea id="csv-output" ref={area} readOnly rows={12} value={csv} />
        <div className="dialog-actions">
          <span className="muted small" aria-live="polite">
            {copied === "copied" ? "Copied to clipboard." : copied === "select" ? "Text selected. Press Ctrl+C to copy." : ""}
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={copy}>
            Copy CSV
          </button>
        </div>
      </div>
    </div>
  );
}
