import { canonicalKey, normalize } from "./normalize";
import { levenshtein } from "./similarity";

export interface NearDuplicateResult {
  /** normalized term -> group id (only for terms that have at least one near duplicate) */
  groupOf: Map<string, number>;
  /** group id -> distinct normalized terms in the group */
  groups: Map<number, string[]>;
}

/**
 * Groups search terms that are textual variants of each other.
 *
 * Two distinct normalized terms are near duplicates when either
 *   1. their canonical keys are equal (word order, plurals, stop words), or
 *   2. the Levenshtein similarity of their canonical keys >= threshold
 *      (typos, small spelling variants).
 *
 * Identical terms appearing in several campaigns/ad groups are NOT near
 * duplicates of each other; a group needs at least two different spellings.
 * Fully deterministic: the same input always yields the same groups.
 */
export function findNearDuplicates(terms: readonly string[], threshold: number): NearDuplicateResult {
  const uniqueNormalized = [...new Set(terms.map(normalize))].filter((t) => t !== "").sort();
  const keys = uniqueNormalized.map(canonicalKey);

  // Union-find over indices of uniqueNormalized.
  const parent = uniqueNormalized.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // 1. exact canonical key match
  const byKey = new Map<string, number>();
  keys.forEach((key, i) => {
    const first = byKey.get(key);
    if (first === undefined) byKey.set(key, i);
    else union(first, i);
  });

  // 2. fuzzy match between distinct canonical keys. Sorting by length lets us
  //    stop comparing once the length gap alone makes the threshold unreachable.
  if (threshold < 1) {
    const distinctKeys = [...byKey.entries()].sort((a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1));
    for (let x = 0; x < distinctKeys.length; x++) {
      const [ka, ia] = distinctKeys[x]!;
      for (let y = x + 1; y < distinctKeys.length; y++) {
        const [kb, ib] = distinctKeys[y]!;
        const longest = kb.length; // kb.length >= ka.length
        const maxDistance = Math.floor((1 - threshold) * longest);
        if (kb.length - ka.length > maxDistance) break;
        if (find(ia) === find(ib)) continue;
        if (levenshtein(ka, kb, maxDistance) <= maxDistance) union(ia, ib);
      }
    }
  }

  const members = new Map<number, string[]>();
  uniqueNormalized.forEach((term, i) => {
    const root = find(i);
    const list = members.get(root);
    if (list) list.push(term);
    else members.set(root, [term]);
  });

  const groupOf = new Map<string, number>();
  const groups = new Map<number, string[]>();
  let nextId = 1;
  for (const list of members.values()) {
    if (list.length < 2) continue;
    const id = nextId++;
    groups.set(id, list);
    for (const term of list) groupOf.set(term, id);
  }
  return { groupOf, groups };
}
