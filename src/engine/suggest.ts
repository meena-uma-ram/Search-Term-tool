import { normalize, tokenize } from "./normalize";
import type { ClassifiedRow, NegativeMatchType, NegativeSuggestion, Recommendation, RuleConfig } from "./types";

/** Google Ads keyword notation: [exact], "phrase". */
export function formatNegative(keyword: string, matchType: NegativeMatchType): string {
  return matchType === "EXACT" ? `[${keyword}]` : `"${keyword}"`;
}

type RowForSuggestion = Pick<ClassifiedRow, "searchTerm" | "tags" | "matches"> & { recommendation: Recommendation };

/**
 * Deterministic negative-keyword suggestion for one potential negative:
 * 1. a matched informational word -> phrase negative of that word
 *    (blocks every search containing it, e.g. "free", "jobs", "how to")
 * 2. a matched competitor -> phrase negative of the competitor name
 * 3. otherwise -> exact negative of the whole search term (the narrowest option)
 * Terms that contain a brand term only ever get an exact negative, with a caution.
 */
export function suggestNegative(row: RowForSuggestion): NegativeSuggestion | null {
  if (row.recommendation.kind !== "POTENTIAL_NEGATIVE") return null;
  const term = normalize(row.searchTerm);
  const brand = row.matches.BRAND;

  if (brand && brand.length > 0) {
    return {
      keyword: term,
      matchType: "EXACT",
      reason: "Exact match only, because the term contains your brand",
      caution: `Contains brand term "${brand[0]}". Check it is really irrelevant before excluding.`,
    };
  }

  const longest = (list: string[] | undefined) =>
    list && list.length > 0 ? [...list].sort((a, b) => normalize(b).length - normalize(a).length)[0]! : null;

  const info = longest(row.matches.INFORMATIONAL);
  if (info) {
    return {
      keyword: normalize(info),
      matchType: "PHRASE",
      reason: `Informational word "${info}" signals research intent, not buying intent`,
      caution: "A phrase negative blocks every search containing this word. Check it is never relevant to your offer.",
    };
  }

  const competitor = longest(row.matches.COMPETITOR);
  if (competitor) {
    return {
      keyword: normalize(competitor),
      matchType: "PHRASE",
      reason: `Competitor name "${competitor}" with no conversions`,
    };
  }

  return { keyword: term, matchType: "EXACT", reason: "Excludes only this exact search term" };
}

export interface NgramSuggestion {
  /** Normalized word or phrase. */
  ngram: string;
  words: 1 | 2;
  /** Ids of the rows whose search term contains the n-gram. */
  rowIds: string[];
  termCount: number;
  clicks: number;
  cost: number;
  conversions: number;
}

const NGRAM_STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "with", "by", "from", "is", "are", "my", "me", "i",
]);

export interface NgramOptions {
  /** Minimum number of different search terms that must share the n-gram. Default 2. */
  minTerms?: number;
  /** Maximum number of suggestions returned. Default 30. */
  limit?: number;
}

/**
 * Words and 2-word phrases shared by several search terms that together never
 * convert (conversions <= the potential-negative max) and reach the
 * potential-negative click threshold. Brand words are never suggested.
 * If a phrase covers exactly the same terms as one of its words, only the
 * phrase is kept: it is the narrower negative ("near me" rather than "near").
 * Sorted by spend, then clicks, then text.
 */
export function suggestNegativeNgrams(rows: readonly ClassifiedRow[], config: RuleConfig, options: NgramOptions = {}): NgramSuggestion[] {
  const minTerms = options.minTerms ?? 2;
  const limit = options.limit ?? 30;
  const brandTokens = new Set(config.brandTerms.flatMap(tokenize));

  const stats = new Map<string, NgramSuggestion & { terms: Set<string> }>();
  for (const row of rows) {
    const tokens = tokenize(row.searchTerm);
    const grams = new Set<string>();
    tokens.forEach((t, i) => {
      if (!NGRAM_STOP_WORDS.has(t) && t.length > 1) grams.add(t);
      const next = tokens[i + 1];
      if (next !== undefined && !(NGRAM_STOP_WORDS.has(t) && NGRAM_STOP_WORDS.has(next))) grams.add(`${t} ${next}`);
    });
    for (const g of grams) {
      if (g.split(" ").some((w) => brandTokens.has(w))) continue;
      let s = stats.get(g);
      if (!s) {
        s = { ngram: g, words: g.includes(" ") ? 2 : 1, rowIds: [], termCount: 0, clicks: 0, cost: 0, conversions: 0, terms: new Set() };
        stats.set(g, s);
      }
      s.rowIds.push(row.id);
      s.terms.add(normalize(row.searchTerm));
      s.clicks += row.clicks;
      s.cost += row.cost;
      s.conversions += row.conversions;
    }
  }

  const { minClicks, maxConversions } = config.potentialNegative;
  const candidates = [...stats.values()]
    .map((s) => ({ ...s, termCount: s.terms.size }))
    .filter((s) => s.termCount >= minTerms && s.conversions <= maxConversions && s.clicks >= minClicks);

  const key = (s: { rowIds: string[] }) => [...s.rowIds].sort().join(",");
  const byGram = new Map(candidates.map((c) => [c.ngram, c]));
  const covered = new Set<string>();
  for (const c of candidates) {
    if (c.words !== 2) continue;
    for (const w of c.ngram.split(" ")) {
      const word = byGram.get(w);
      if (word && key(word) === key(c)) covered.add(w);
    }
  }
  return candidates
    .filter((s) => !covered.has(s.ngram))
    .sort((a, b) => b.cost - a.cost || b.clicks - a.clicks || a.ngram.localeCompare(b.ngram))
    .slice(0, limit)
    .map(({ terms: _terms, ...rest }) => rest);
}
