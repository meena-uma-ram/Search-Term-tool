import { describe, expect, it } from "vitest";
import {
  canonicalKey,
  classifiedRowsToCsv,
  classifyRows,
  csvCell,
  findNearDuplicates,
  findPhraseMatches,
  normalize,
  resolveConfig,
  suggestNegativeNgrams,
  summarize,
  type SearchTermRow,
} from "../src/engine";

let n = 0;
const row = (searchTerm: string, over: Partial<SearchTermRow> = {}): SearchTermRow => ({
  id: `r${n++}`,
  searchTerm,
  campaignId: "1",
  campaignName: "Campaign",
  adGroupId: "10",
  adGroupName: "Ad group",
  matchType: "BROAD",
  impressions: 100,
  clicks: 5,
  cost: 5,
  conversions: 1,
  ...over,
});

describe("normalize", () => {
  it("lowercases, strips accents and punctuation", () => {
    expect(normalize("  Café-Bar  NEAR me!! ")).toBe("cafe bar near me");
    expect(normalize("Zürich")).toBe("zurich");
  });

  it("matches whole words/phrases only", () => {
    expect(findPhraseMatches("smart watch", ["art"])).toEqual([]);
    expect(findPhraseMatches("plumber Near-Me now", ["near me"])).toEqual(["near me"]);
    expect(findPhraseMatches("Nike Pegasus", ["nike", "adidas"])).toEqual(["nike"]);
  });

  it("canonical key ignores order, plurals and stop words", () => {
    expect(canonicalKey("Running shoes for men")).toBe(canonicalKey("men running shoe"));
  });
});

describe("near duplicates", () => {
  it("groups word-order, plural and typo variants", () => {
    const { groupOf } = findNearDuplicates(["mens running shoes", "running shoes mens", "runing shoes mens", "trail running vest"], 0.85);
    const g = groupOf.get("mens running shoes");
    expect(g).toBeDefined();
    expect(groupOf.get("running shoes mens")).toBe(g);
    expect(groupOf.get("runing shoes mens")).toBe(g);
    expect(groupOf.has("trail running vest")).toBe(false);
  });

  it("does not flag the same term repeated across ad groups", () => {
    const { groupOf } = findNearDuplicates(["running shoes", "Running Shoes", "running shoes"], 0.85);
    expect(groupOf.size).toBe(0);
  });

  it("is deterministic", () => {
    const terms = ["a b c", "c b a", "x y", "abc shoes", "abc shoe", "zzz"];
    const a = findNearDuplicates(terms, 0.8);
    const b = findNearDuplicates([...terms].reverse(), 0.8);
    expect([...a.groups.values()]).toEqual([...b.groups.values()]);
  });
});

describe("classifyRows", () => {
  const config = resolveConfig({
    brandTerms: ["stride"],
    competitorTerms: ["nike"],
    highCostThreshold: 20,
  });

  it("tags each rule", () => {
    const rows = classifyRows(
      [
        row("stride shoes"),
        row("nike pegasus", { conversions: 0 }),
        row("how to clean shoes"),
        row("shoe shop near me"),
        row("shoe shop berlin"),
        row("expensive term", { cost: 20 }),
        row("cheap term", { cost: 19.99 }),
      ],
      config,
    );
    const tags = Object.fromEntries(rows.map((r) => [r.searchTerm, r.tags]));
    expect(tags["stride shoes"]).toEqual(["BRAND"]);
    expect(tags["nike pegasus"]).toEqual(["ZERO_CONVERSIONS", "COMPETITOR"]);
    expect(tags["how to clean shoes"]).toEqual(["INFORMATIONAL"]);
    expect(tags["shoe shop near me"]).toContain("LOCATION");
    expect(tags["shoe shop berlin"]).toContain("LOCATION");
    expect(tags["expensive term"]).toEqual(["HIGH_COST"]);
    expect(tags["cheap term"]).toEqual([]);
    expect(rows[1]!.matches.COMPETITOR).toEqual(["nike"]);
  });

  it("recommends potential negative at conversions 0 and clicks >= 10 with exact reasons", () => {
    const [hit, fewClicks, converted] = classifyRows(
      [row("waste", { clicks: 18, cost: 14, conversions: 0 }), row("low", { clicks: 9, conversions: 0 }), row("good", { clicks: 30, conversions: 1 })],
      undefined,
      { currencyCode: "EUR" },
    );
    expect(hit!.recommendation).toEqual({
      kind: "POTENTIAL_NEGATIVE",
      label: "Potential negative keyword",
      reasons: ["18 clicks", "€14.00 spend", "0 conversions"],
    });
    expect(fewClicks!.recommendation.kind).toBe("NONE");
    expect(converted!.recommendation.kind).toBe("NONE");
  });

  it("respects a configured min-clicks threshold", () => {
    const [r] = classifyRows([row("x", { clicks: 5, conversions: 0 })], { potentialNegative: { minClicks: 5, maxConversions: 0 } });
    expect(r!.recommendation.kind).toBe("POTENTIAL_NEGATIVE");
  });

  it("computes cost per conversion and summary", () => {
    const rows = classifyRows([row("a", { cost: 10, conversions: 4, clicks: 3 }), row("b", { cost: 5, conversions: 0, clicks: 12 })]);
    expect(rows[0]!.costPerConversion).toBe(2.5);
    expect(rows[1]!.costPerConversion).toBeNull();
    expect(summarize(rows)).toEqual({ totalTerms: 2, clicks: 15, cost: 15, conversions: 4, zeroConversionTerms: 1, potentialNegatives: 1 });
  });
});

describe("csv", () => {
  it("escapes quotes, commas and formula injection", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-shoes")).toBe("'-shoes");
    expect(csvCell(-3)).toBe("-3");
  });

  it("exports classified rows", () => {
    const rows = classifyRows([row("free shoes, cheap", { clicks: 18, cost: 14, conversions: 0 })], undefined, { currencyCode: "EUR" });
    const csv = classifiedRowsToCsv(rows, "EUR");
    const [header, line] = csv.trim().split("\r\n");
    expect(header).toBe(
      "Search term,Campaign,Ad group,Match type,Clicks,Cost (EUR),Conversions,Cost per conversion (EUR),Classification tags,Recommendation,Reason,Suggested negative keyword,Suggested match type,Suggestion note",
    );
    expect(line).toBe(
      '"free shoes, cheap",Campaign,Ad group,BROAD,18,14,0,,Zero conversions; Informational,Potential negative keyword,"18 clicks, €14.00 spend, 0 conversions",' +
        '"""free""",Phrase,"Informational word ""free"" signals research intent, not buying intent. A phrase negative blocks every search containing this word. Check it is never relevant to your offer."',
    );
  });
});

describe("negative keyword suggestions", () => {
  const config = { brandTerms: ["stride"], competitorTerms: ["nike"] };
  const bad = { clicks: 20, cost: 15, conversions: 0 };

  it("suggests phrase / exact negatives by rule", () => {
    const rows = classifyRows(
      [row("free running shoes", bad), row("nike pegasus 40", bad), row("blue suede shoes", bad), row("stride running jobs", bad), row("good term", { clicks: 20, conversions: 2 })],
      config,
    );
    const s = Object.fromEntries(rows.map((r) => [r.searchTerm, r.suggestion]));
    expect(s["free running shoes"]).toMatchObject({ keyword: "free", matchType: "PHRASE" });
    expect(s["nike pegasus 40"]).toMatchObject({ keyword: "nike", matchType: "PHRASE" });
    expect(s["blue suede shoes"]).toMatchObject({ keyword: "blue suede shoes", matchType: "EXACT" });
    // brand terms are never phrase-negated, even with an informational word
    expect(s["stride running jobs"]).toMatchObject({ keyword: "stride running jobs", matchType: "EXACT" });
    expect(s["stride running jobs"]!.caution).toMatch(/brand/);
    expect(s["good term"]).toBeNull();
  });

  it("prefers the longest informational phrase", () => {
    const [r] = classifyRows([row("how to fix a leak", bad)], { informationalWords: ["how", "how to"] });
    expect(r!.suggestion).toMatchObject({ keyword: "how to", matchType: "PHRASE" });
  });

  it("finds words shared by non-converting terms", () => {
    const cfg = resolveConfig({ brandTerms: ["acme"] });
    const rows = classifyRows(
      [
        row("cheap running shoes", { clicks: 6, cost: 4, conversions: 0 }),
        row("cheap trail shoes", { clicks: 5, cost: 3, conversions: 0 }),
        row("running shoes", { clicks: 50, cost: 40, conversions: 5 }),
        row("acme cheap", { clicks: 30, cost: 9, conversions: 0 }),
        row("acme sale", { clicks: 30, cost: 9, conversions: 0 }),
        row("repair kit", { clicks: 40, cost: 30, conversions: 0 }),
      ],
      cfg,
    );
    const grams = suggestNegativeNgrams(rows, cfg);
    const cheap = grams.find((g) => g.ngram === "cheap");
    expect(cheap).toMatchObject({ termCount: 3, clicks: 41, conversions: 0 });
    // "running"/"shoes" also appear in a converting term
    expect(grams.some((g) => g.ngram === "running" || g.ngram === "shoes")).toBe(false);
    // brand words are never suggested; single-term words need minTerms
    expect(grams.some((g) => g.ngram.includes("acme") || g.ngram === "repair")).toBe(false);
  });

  it("keeps the narrower phrase when it covers exactly the same terms as one of its words", () => {
    const cfg = resolveConfig({});
    const rows = classifyRows([row("water heater noise", { clicks: 6, conversions: 0 }), row("loud water heater noise", { clicks: 6, conversions: 0 })], cfg);
    const grams = suggestNegativeNgrams(rows, cfg).map((g) => g.ngram);
    expect(grams).toContain("heater noise");
    expect(grams).not.toContain("noise");
    expect(grams).not.toContain("heater");
  });
});
