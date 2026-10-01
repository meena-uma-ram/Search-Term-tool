import type { ClassificationTag, ClassifiedRow } from "../engine";

export type FilterKey = "ALL" | "POTENTIAL_NEGATIVE" | ClassificationTag;

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "POTENTIAL_NEGATIVE", label: "Potential negatives" },
  { key: "ZERO_CONVERSIONS", label: "Zero conversions" },
  { key: "HIGH_COST", label: "High cost" },
  { key: "BRAND", label: "Brand" },
  { key: "COMPETITOR", label: "Competitor" },
  { key: "INFORMATIONAL", label: "Informational" },
  { key: "LOCATION", label: "Location" },
  { key: "NEAR_DUPLICATE", label: "Near duplicate" },
];

export function matchesFilter(row: ClassifiedRow, filter: FilterKey): boolean {
  if (filter === "ALL") return true;
  if (filter === "POTENTIAL_NEGATIVE") return row.recommendation.kind === "POTENTIAL_NEGATIVE";
  return row.tags.includes(filter);
}
