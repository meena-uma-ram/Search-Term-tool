/**
 * Source-agnostic search-term row. Google Ads, the demo provider and (later)
 * CSV imports all map into this shape before classification.
 */
export interface SearchTermRow {
  /** Stable unique id for the row (term + campaign + ad group + match type). */
  id: string;
  searchTerm: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  /** e.g. EXACT, PHRASE, BROAD, NEAR_EXACT, NEAR_PHRASE. Null when not available. */
  matchType: string | null;
  impressions: number;
  clicks: number;
  /** Cost in account currency units (not micros). */
  cost: number;
  conversions: number;
}

export type ClassificationTag =
  | "ZERO_CONVERSIONS"
  | "HIGH_COST"
  | "BRAND"
  | "COMPETITOR"
  | "INFORMATIONAL"
  | "LOCATION"
  | "NEAR_DUPLICATE";

export const CLASSIFICATION_TAGS: readonly ClassificationTag[] = [
  "ZERO_CONVERSIONS",
  "HIGH_COST",
  "BRAND",
  "COMPETITOR",
  "INFORMATIONAL",
  "LOCATION",
  "NEAR_DUPLICATE",
];

export interface RuleConfig {
  /** HIGH_COST when cost >= this value (account currency). */
  highCostThreshold: number;
  brandTerms: string[];
  competitorTerms: string[];
  informationalWords: string[];
  /** Phrases ("near me") and place names ("berlin") that mark local intent. */
  locationTerms: string[];
  /** Potential negative: conversions <= maxConversions AND clicks >= minClicks. */
  potentialNegative: {
    minClicks: number;
    maxConversions: number;
  };
  /** 0..1 similarity required between two normalized terms to be NEAR_DUPLICATE. */
  nearDuplicateThreshold: number;
}

export interface Recommendation {
  kind: "POTENTIAL_NEGATIVE" | "NONE";
  label: string;
  /** Exact, human-readable reasons, e.g. ["18 clicks", "€14.00 spend", "0 conversions"]. */
  reasons: string[];
}

export interface ClassifiedRow extends SearchTermRow {
  /** cost / conversions, or null when there are no conversions. */
  costPerConversion: number | null;
  tags: ClassificationTag[];
  /** Which list entries matched, keyed by tag (for tooltips / explanations). */
  matches: Partial<Record<ClassificationTag, string[]>>;
  recommendation: Recommendation;
}

export interface Summary {
  totalTerms: number;
  clicks: number;
  cost: number;
  conversions: number;
  zeroConversionTerms: number;
  potentialNegatives: number;
}
