import type { RuleConfig } from "./types";

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  highCostThreshold: 50,
  brandTerms: [],
  competitorTerms: [],
  informationalWords: [
    "how", "how to", "what", "what is", "why", "when", "who", "guide", "tutorial",
    "tips", "ideas", "examples", "definition", "meaning", "diy", "free", "jobs",
    "salary", "career", "course", "learn", "review", "reviews", "vs", "versus",
    "wiki", "pdf", "template",
  ],
  locationTerms: [
    "near me", "nearby", "near by", "close to me", "around me", "in my area", "local",
    "london", "manchester", "berlin", "munich", "hamburg", "paris", "madrid", "barcelona",
    "rome", "milan", "amsterdam", "rotterdam", "brussels", "vienna", "zurich", "dublin",
    "new york", "los angeles", "chicago", "san francisco", "toronto", "sydney",
  ],
  potentialNegative: {
    minClicks: 10,
    maxConversions: 0,
  },
  nearDuplicateThreshold: 0.85,
};

/** Merge a partial (e.g. user-saved) config over defaults, dropping invalid values. */
export function resolveConfig(partial?: Partial<RuleConfig> | null): RuleConfig {
  const d = DEFAULT_RULE_CONFIG;
  if (!partial) return { ...d, potentialNegative: { ...d.potentialNegative } };
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  const list = (v: unknown, fallback: string[]) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : fallback;
  return {
    highCostThreshold: num(partial.highCostThreshold, d.highCostThreshold),
    brandTerms: list(partial.brandTerms, d.brandTerms),
    competitorTerms: list(partial.competitorTerms, d.competitorTerms),
    informationalWords: list(partial.informationalWords, d.informationalWords),
    locationTerms: list(partial.locationTerms, d.locationTerms),
    potentialNegative: {
      minClicks: num(partial.potentialNegative?.minClicks, d.potentialNegative.minClicks),
      maxConversions: num(partial.potentialNegative?.maxConversions, d.potentialNegative.maxConversions),
    },
    nearDuplicateThreshold: Math.min(1, num(partial.nearDuplicateThreshold, d.nearDuplicateThreshold)),
  };
}
