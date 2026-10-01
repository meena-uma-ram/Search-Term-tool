import { useEffect, useState } from "react";
import type { RuleConfig } from "../../engine";

interface Props {
  config: RuleConfig;
  currency: string;
  onChange: (c: RuleConfig) => void;
  onReset: () => void;
}

const toText = (list: string[]) => list.join("\n");
const toList = (text: string) =>
  [...new Set(text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];

function ListField({ label, hint, value, onCommit }: { label: string; hint: string; value: string[]; onCommit: (v: string[]) => void }) {
  const [text, setText] = useState(toText(value));
  useEffect(() => setText(toText(value)), [value]);
  return (
    <label className="field">
      <span className="field-label">
        {label} <span className="muted small">({value.length})</span>
      </span>
      <textarea rows={5} value={text} placeholder={hint} onChange={(e) => setText(e.target.value)} onBlur={() => onCommit(toList(text))} />
    </label>
  );
}

function NumberField({ label, value, step, min, max, onCommit }: { label: string; value: number; step: number; min: number; max?: number; onCommit: (v: number) => void }) {
  return (
    <label className="field field-number">
      <span className="field-label">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onCommit(n);
        }}
      />
    </label>
  );
}

export function RulesPanel({ config, currency, onChange, onReset }: Props) {
  const set = <K extends keyof RuleConfig>(key: K, value: RuleConfig[K]) => onChange({ ...config, [key]: value });
  const pn = config.potentialNegative;

  return (
    <details className="card rules">
      <summary>
        <strong>Rules</strong>
        <span className="muted small">
          Potential negative = conversions ≤ {pn.maxConversions} and clicks ≥ {pn.minClicks} · High cost ≥ {config.highCostThreshold} {currency} ·{" "}
          {config.brandTerms.length} brand / {config.competitorTerms.length} competitor terms
        </span>
      </summary>
      <p className="muted small">
        All rules are deterministic and run in your browser. Settings are saved per account in this browser. Lists match whole words or phrases,
        ignoring case, accents and punctuation. One entry per line.
      </p>
      <div className="rules-numbers">
        <NumberField label="Potential negative: min. clicks" value={pn.minClicks} step={1} min={0} onCommit={(v) => set("potentialNegative", { ...pn, minClicks: v })} />
        <NumberField label="Potential negative: max. conversions" value={pn.maxConversions} step={1} min={0} onCommit={(v) => set("potentialNegative", { ...pn, maxConversions: v })} />
        <NumberField label={`High cost threshold (${currency})`} value={config.highCostThreshold} step={1} min={0} onCommit={(v) => set("highCostThreshold", v)} />
        <NumberField label="Near-duplicate similarity (0–1)" value={config.nearDuplicateThreshold} step={0.01} min={0} max={1} onCommit={(v) => set("nearDuplicateThreshold", v)} />
      </div>
      <div className="rules-lists">
        <ListField label="Brand terms" hint="your brand, product names…" value={config.brandTerms} onCommit={(v) => set("brandTerms", v)} />
        <ListField label="Competitor terms" hint="competitor brands…" value={config.competitorTerms} onCommit={(v) => set("competitorTerms", v)} />
        <ListField label="Informational words" hint="how to, what is, free…" value={config.informationalWords} onCommit={(v) => set("informationalWords", v)} />
        <ListField label="Location terms" hint="near me, city names…" value={config.locationTerms} onCommit={(v) => set("locationTerms", v)} />
      </div>
      <div className="rules-actions">
        <button className="btn btn-secondary" onClick={onReset}>
          Reset to defaults
        </button>
      </div>
    </details>
  );
}
