/**
 * Deterministic text normalization shared by all rules:
 * lowercase, strip diacritics, treat punctuation as whitespace, collapse spaces.
 * "Café-Bar  NEAR me!" -> "cafe bar near me"
 */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const n = normalize(text);
  return n === "" ? [] : n.split(" ");
}

/**
 * Whole-word / whole-phrase match on normalized text, so "art" does not match
 * "smart" but "near me" matches "plumber near me now".
 * Returns the list entries (as given by the user) that matched.
 */
export function findPhraseMatches(text: string, phrases: readonly string[]): string[] {
  const haystack = ` ${normalize(text)} `;
  const hits: string[] = [];
  for (const phrase of phrases) {
    const needle = normalize(phrase);
    if (needle !== "" && haystack.includes(` ${needle} `)) hits.push(phrase);
  }
  return hits;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "with", "by", "from",
]);

/** Very light, deterministic singularization: "shoes" -> "shoe", "boxes" -> "box". */
function singular(token: string): string {
  if (token.length <= 3 || /\d/.test(token)) return token;
  if (token.endsWith("ies") && token.length > 4) return token.slice(0, -3) + "y";
  if (/(ches|shes|sses|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us")) return token.slice(0, -1);
  return token;
}

/**
 * Canonical key used for near-duplicate detection: normalized, stop words
 * removed, singularized, de-duplicated and sorted, so word order, plurals and
 * filler words do not matter. "Running shoes for men" == "men running shoe".
 */
export function canonicalKey(text: string): string {
  const tokens = tokenize(text).filter((t) => !STOP_WORDS.has(t)).map(singular);
  const base = tokens.length > 0 ? tokens : tokenize(text);
  return [...new Set(base)].sort().join(" ");
}
