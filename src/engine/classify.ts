import { resolveConfig } from "./config";
import { formatMoney, formatNumber, plural } from "./format";
import { findNearDuplicates } from "./nearDuplicate";
import { findPhraseMatches, normalize } from "./normalize";
import { suggestNegative } from "./suggest";
import type {
  ClassificationTag,
  ClassifiedRow,
  Recommendation,
  RuleConfig,
  SearchTermRow,
  Summary,
} from "./types";

export interface ClassifyOptions {
  /** ISO 4217 code used to phrase reasons like "€14.00 spend". */
  currencyCode?: string;
}

/**
 * Deterministic, rule-based classification. No AI, no network, no Google Ads
 * dependency: works on any SearchTermRow[] (Google Ads, demo data, CSV).
 * Only produces recommendations; it never changes anything anywhere.
 */
export function classifyRows(
  rows: readonly SearchTermRow[],
  partialConfig?: Partial<RuleConfig> | null,
  options: ClassifyOptions = {},
): ClassifiedRow[] {
  const config = resolveConfig(partialConfig);
  const currency = options.currencyCode ?? "EUR";
  const dupes = findNearDuplicates(
    rows.map((r) => r.searchTerm),
    config.nearDuplicateThreshold,
  );

  return rows.map((row) => {
    const tags: ClassificationTag[] = [];
    const matches: ClassifiedRow["matches"] = {};
    const tag = (t: ClassificationTag, hits?: string[]) => {
      tags.push(t);
      if (hits && hits.length > 0) matches[t] = hits;
    };

    if (row.conversions === 0) tag("ZERO_CONVERSIONS");
    if (row.cost >= config.highCostThreshold) tag("HIGH_COST");

    const brand = findPhraseMatches(row.searchTerm, config.brandTerms);
    if (brand.length > 0) tag("BRAND", brand);

    const competitor = findPhraseMatches(row.searchTerm, config.competitorTerms);
    if (competitor.length > 0) tag("COMPETITOR", competitor);

    const informational = findPhraseMatches(row.searchTerm, config.informationalWords);
    if (informational.length > 0) tag("INFORMATIONAL", informational);

    const location = findPhraseMatches(row.searchTerm, config.locationTerms);
    if (location.length > 0) tag("LOCATION", location);

    const normalized = normalize(row.searchTerm);
    const groupId = dupes.groupOf.get(normalized);
    if (groupId !== undefined) {
      const others = (dupes.groups.get(groupId) ?? []).filter((t) => t !== normalized);
      tag("NEAR_DUPLICATE", others);
    }

    const recommendation = recommend(row, config, currency);
    return {
      ...row,
      costPerConversion: row.conversions > 0 ? row.cost / row.conversions : null,
      tags,
      matches,
      recommendation,
      suggestion: suggestNegative({ searchTerm: row.searchTerm, tags, matches, recommendation }),
    };
  });
}

/** Potential-negative rule. Default: conversions === 0 AND clicks >= 10. */
export function recommend(row: SearchTermRow, config: RuleConfig, currencyCode: string): Recommendation {
  const { minClicks, maxConversions } = config.potentialNegative;
  if (row.conversions <= maxConversions && row.clicks >= minClicks) {
    return {
      kind: "POTENTIAL_NEGATIVE",
      label: "Potential negative keyword",
      reasons: [
        plural(row.clicks, "click"),
        `${formatMoney(row.cost, currencyCode)} spend`,
        `${formatNumber(row.conversions)} conversions`,
      ],
    };
  }
  return { kind: "NONE", label: "", reasons: [] };
}

export function summarize(rows: readonly ClassifiedRow[]): Summary {
  let clicks = 0;
  let cost = 0;
  let conversions = 0;
  let zeroConversionTerms = 0;
  let potentialNegatives = 0;
  for (const r of rows) {
    clicks += r.clicks;
    cost += r.cost;
    conversions += r.conversions;
    if (r.conversions === 0) zeroConversionTerms++;
    if (r.recommendation.kind === "POTENTIAL_NEGATIVE") potentialNegatives++;
  }
  return { totalTerms: rows.length, clicks, cost, conversions, zeroConversionTerms, potentialNegatives };
}
