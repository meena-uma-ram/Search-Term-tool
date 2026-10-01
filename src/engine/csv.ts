import type { ClassificationTag, ClassifiedRow } from "./types";

export const TAG_LABELS: Record<ClassificationTag, string> = {
  ZERO_CONVERSIONS: "Zero conversions",
  HIGH_COST: "High cost",
  BRAND: "Brand",
  COMPETITOR: "Competitor",
  INFORMATIONAL: "Informational",
  LOCATION: "Location",
  NEAR_DUPLICATE: "Near duplicate",
};

/**
 * Escape one CSV cell (RFC 4180). Cells that a spreadsheet would treat as a
 * formula (=, +, -, @, tab, CR) are prefixed with an apostrophe to prevent
 * CSV/formula injection from user-generated search terms.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value) : value;
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** CSV of classified rows, suitable for review or bulk upload preparation. */
export function classifiedRowsToCsv(rows: readonly ClassifiedRow[], currencyCode: string): string {
  return toCsv(
    [
      "Search term",
      "Campaign",
      "Ad group",
      "Match type",
      "Clicks",
      `Cost (${currencyCode})`,
      "Conversions",
      `Cost per conversion (${currencyCode})`,
      "Classification tags",
      "Recommendation",
      "Reason",
    ],
    rows.map((r) => [
      r.searchTerm,
      r.campaignName,
      r.adGroupName,
      r.matchType ?? "",
      r.clicks,
      round2(r.cost),
      round2(r.conversions),
      r.costPerConversion === null ? "" : round2(r.costPerConversion),
      r.tags.map((t) => TAG_LABELS[t]).join("; "),
      r.recommendation.label,
      r.recommendation.reasons.join(", "),
    ]),
  );
}
