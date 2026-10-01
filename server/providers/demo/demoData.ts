// Synthetic catalogue for demo mode. Rates are per day; the provider adds
// deterministic per-day noise so different date ranges give different but
// reproducible numbers.

export interface DemoTerm {
  term: string;
  campaign: string;
  adGroup: string;
  matchType: "EXACT" | "PHRASE" | "BROAD" | "NEAR_EXACT" | "NEAR_PHRASE";
  /** average clicks per day */
  clicks: number;
  /** average cost per click */
  cpc: number;
  /** conversion rate per click (0 = never converts) */
  cvr: number;
}

export interface DemoCampaign {
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED";
  channelType: string;
}

export interface DemoAccount {
  id: string;
  name: string;
  currencyCode: string;
  brandTerms: string[];
  competitorTerms: string[];
  campaigns: DemoCampaign[];
  terms: DemoTerm[];
}

const t = (
  term: string,
  campaign: string,
  adGroup: string,
  matchType: DemoTerm["matchType"],
  clicks: number,
  cpc: number,
  cvr: number,
): DemoTerm => ({ term, campaign, adGroup, matchType, clicks, cpc, cvr });

const RUN_BRAND = "Search | Brand";
const RUN_SHOES = "Search | Running Shoes";
const RUN_TRAIL = "Search | Trail Running";
const RUN_SHOP = "Shopping | All Products";

const runningShop: DemoAccount = {
  id: "demo-1001",
  name: "Demo: Stride Running Store (EUR)",
  currencyCode: "EUR",
  brandTerms: ["stride", "stride running"],
  competitorTerms: ["nike", "adidas", "asics", "brooks", "hoka", "decathlon"],
  campaigns: [
    { id: "9001", name: RUN_BRAND, status: "ENABLED", channelType: "SEARCH" },
    { id: "9002", name: RUN_SHOES, status: "ENABLED", channelType: "SEARCH" },
    { id: "9003", name: RUN_TRAIL, status: "ENABLED", channelType: "SEARCH" },
    { id: "9004", name: RUN_SHOP, status: "ENABLED", channelType: "SHOPPING" },
  ],
  terms: [
    // Brand
    t("stride running", RUN_BRAND, "Brand - Exact", "EXACT", 3.2, 0.25, 0.18),
    t("stride running store", RUN_BRAND, "Brand - Exact", "NEAR_EXACT", 1.4, 0.3, 0.15),
    t("stride running shoes", RUN_BRAND, "Brand - Phrase", "PHRASE", 1.1, 0.35, 0.12),
    t("stride running discount code", RUN_BRAND, "Brand - Phrase", "PHRASE", 0.8, 0.4, 0),
    t("stride running jobs", RUN_BRAND, "Brand - Phrase", "PHRASE", 0.5, 0.45, 0),
    t("stride running opening hours", RUN_BRAND, "Brand - Phrase", "PHRASE", 0.3, 0.3, 0.02),

    // Generic running shoes
    t("running shoes", RUN_SHOES, "Running Shoes - Generic", "PHRASE", 6.5, 0.85, 0.035),
    t("running shoes men", RUN_SHOES, "Running Shoes - Men", "PHRASE", 3.1, 0.8, 0.04),
    t("mens running shoes", RUN_SHOES, "Running Shoes - Men", "EXACT", 2.6, 0.82, 0.045),
    t("running shoe for men", RUN_SHOES, "Running Shoes - Men", "BROAD", 1.3, 0.78, 0.02),
    t("runing shoes men", RUN_SHOES, "Running Shoes - Men", "BROAD", 0.6, 0.7, 0),
    t("running shoes women", RUN_SHOES, "Running Shoes - Women", "PHRASE", 2.9, 0.8, 0.042),
    t("womens running shoes", RUN_SHOES, "Running Shoes - Women", "EXACT", 2.2, 0.83, 0.05),
    t("cheap running shoes", RUN_SHOES, "Running Shoes - Generic", "BROAD", 2.4, 0.6, 0),
    t("cheap trail running shoes", RUN_TRAIL, "Trail - Shoes", "BROAD", 0.8, 0.7, 0),
    t("free running shoes", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.9, 0.55, 0),
    t("how to choose running shoes", RUN_SHOES, "Running Shoes - Generic", "BROAD", 1.6, 0.7, 0),
    t("what are the best running shoes", RUN_SHOES, "Running Shoes - Generic", "BROAD", 1.2, 0.75, 0.005),
    t("running shoes vs walking shoes", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.7, 0.65, 0),
    t("running shoes near me", RUN_SHOES, "Running Shoes - Generic", "PHRASE", 1.8, 0.9, 0.01),
    t("running shoe store near me", RUN_SHOES, "Running Shoes - Generic", "BROAD", 1.1, 0.95, 0),
    t("running shoes berlin", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.9, 0.9, 0.03),
    t("running shop munich", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.7, 0.85, 0),
    t("nike pegasus", RUN_SHOES, "Running Shoes - Generic", "BROAD", 2.1, 0.95, 0.01),
    t("adidas ultraboost sale", RUN_SHOES, "Running Shoes - Generic", "BROAD", 1.4, 1.05, 0),
    t("brooks ghost 16", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.9, 1.1, 0.04),
    t("hoka clifton", RUN_SHOES, "Running Shoes - Generic", "BROAD", 1.0, 1.0, 0.03),
    t("running shoes size 46", RUN_SHOES, "Running Shoes - Men", "BROAD", 0.5, 0.7, 0.06),
    t("wide running shoes", RUN_SHOES, "Running Shoes - Generic", "PHRASE", 0.8, 0.8, 0.05),
    t("running shoes for flat feet", RUN_SHOES, "Running Shoes - Generic", "PHRASE", 1.0, 0.85, 0.03),
    t("running shoes flat feet", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.6, 0.85, 0),
    t("running shoe repair", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.5, 0.6, 0),
    t("trail shoe repair", RUN_TRAIL, "Trail - Shoes", "BROAD", 0.3, 0.6, 0),
    t("running shoes drawing", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.4, 0.5, 0),
    t("running coach salary", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.4, 0.55, 0),
    t("running shoes second hand", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.7, 0.6, 0),
    t("second hand trail shoes", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.4, 0.6, 0),
    t("free running plan", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.6, 0.5, 0),
    t("free running app", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.5, 0.5, 0),
    t("running shoes ebay", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.5, 0.65, 0),
    t("how to clean running shoes", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.6, 0.6, 0),
    t("how to lace running shoes", RUN_SHOES, "Running Shoes - Generic", "BROAD", 0.5, 0.6, 0),

    // Trail
    t("trail running shoes", RUN_TRAIL, "Trail - Shoes", "PHRASE", 3.0, 0.95, 0.04),
    t("trail runners", RUN_TRAIL, "Trail - Shoes", "BROAD", 1.2, 0.9, 0.02),
    t("trail running shoes waterproof", RUN_TRAIL, "Trail - Shoes", "PHRASE", 1.1, 1.0, 0.05),
    t("waterproof trail running shoe", RUN_TRAIL, "Trail - Shoes", "BROAD", 0.7, 1.0, 0.03),
    t("trail running tips", RUN_TRAIL, "Trail - Shoes", "BROAD", 0.9, 0.7, 0),
    t("trail running guide alps", RUN_TRAIL, "Trail - Shoes", "BROAD", 0.6, 0.75, 0),
    t("trail running races 2026", RUN_TRAIL, "Trail - Shoes", "BROAD", 0.8, 0.8, 0),
    t("salomon speedcross", RUN_TRAIL, "Trail - Shoes", "BROAD", 1.3, 1.1, 0.02),
    t("trail running backpack", RUN_TRAIL, "Trail - Gear", "BROAD", 0.9, 0.9, 0.03),
    t("trail running vest", RUN_TRAIL, "Trail - Gear", "PHRASE", 0.8, 0.95, 0.04),
    t("hiking boots", RUN_TRAIL, "Trail - Gear", "BROAD", 1.5, 0.85, 0),

    // Shopping
    t("gel running shoes", RUN_SHOP, "All Products", "BROAD", 1.4, 0.55, 0.03),
    t("running socks", RUN_SHOP, "All Products", "BROAD", 1.9, 0.35, 0.06),
    t("compression socks running", RUN_SHOP, "All Products", "BROAD", 0.9, 0.4, 0.04),
    t("running socks compression", RUN_SHOP, "All Products", "BROAD", 0.5, 0.4, 0),
    t("decathlon running shoes", RUN_SHOP, "All Products", "BROAD", 1.5, 0.45, 0),
    t("running shorts", RUN_SHOP, "All Products", "BROAD", 1.3, 0.4, 0.05),
    t("running watch", RUN_SHOP, "All Products", "BROAD", 1.7, 0.6, 0),
    t("garmin forerunner manual pdf", RUN_SHOP, "All Products", "BROAD", 0.6, 0.4, 0),
    t("running jacket", RUN_SHOP, "All Products", "BROAD", 1.1, 0.5, 0.04),
    t("kids football boots", RUN_SHOP, "All Products", "BROAD", 1.2, 0.45, 0),
    t("garmin watch manual", RUN_SHOP, "All Products", "BROAD", 0.4, 0.4, 0),
    t("running headlamp", RUN_SHOP, "All Products", "BROAD", 0.6, 0.5, 0.05),
  ],
};

const plumbing: DemoAccount = {
  id: "demo-2002",
  name: "Demo: QuickFix Plumbing (USD)",
  currencyCode: "USD",
  brandTerms: ["quickfix", "quick fix plumbing"],
  competitorTerms: ["roto rooter", "mr rooter", "benjamin franklin plumbing"],
  campaigns: [
    { id: "8001", name: "Search | Emergency Plumbing", status: "ENABLED", channelType: "SEARCH" },
    { id: "8002", name: "Search | Water Heaters", status: "ENABLED", channelType: "SEARCH" },
    { id: "8003", name: "Search | Brand", status: "PAUSED", channelType: "SEARCH" },
  ],
  terms: [
    t("emergency plumber", "Search | Emergency Plumbing", "Emergency", "PHRASE", 4.5, 6.5, 0.12),
    t("emergency plumber near me", "Search | Emergency Plumbing", "Emergency", "PHRASE", 3.8, 7.2, 0.14),
    t("24 hour plumber near me", "Search | Emergency Plumbing", "Emergency", "BROAD", 2.1, 6.8, 0.1),
    t("plumber near me", "Search | Emergency Plumbing", "Emergency", "BROAD", 3.2, 5.9, 0.08),
    t("plumbers near me", "Search | Emergency Plumbing", "Emergency", "BROAD", 1.5, 5.8, 0.07),
    t("plumber chicago", "Search | Emergency Plumbing", "Emergency", "BROAD", 1.2, 6.1, 0.09),
    t("plumber salary", "Search | Emergency Plumbing", "Emergency", "BROAD", 0.9, 3.2, 0),
    t("plumber jobs", "Search | Emergency Plumbing", "Emergency", "BROAD", 0.8, 3.0, 0),
    t("how to unclog a drain", "Search | Emergency Plumbing", "Drains", "BROAD", 1.9, 2.5, 0),
    t("how to unclog drain", "Search | Emergency Plumbing", "Drains", "BROAD", 0.7, 2.4, 0),
    t("drain cleaning", "Search | Emergency Plumbing", "Drains", "PHRASE", 1.4, 4.2, 0.09),
    t("roto rooter prices", "Search | Emergency Plumbing", "Drains", "BROAD", 0.9, 4.8, 0),
    t("diy toilet repair", "Search | Emergency Plumbing", "Toilets", "BROAD", 0.8, 2.2, 0),
    t("toilet repair", "Search | Emergency Plumbing", "Toilets", "PHRASE", 1.1, 4.4, 0.08),
    t("water heater installation", "Search | Water Heaters", "Install", "PHRASE", 1.6, 8.5, 0.07),
    t("water heater replacement cost", "Search | Water Heaters", "Install", "BROAD", 1.3, 7.9, 0.02),
    t("tankless water heater", "Search | Water Heaters", "Tankless", "BROAD", 1.4, 6.6, 0.03),
    t("tankless water heaters", "Search | Water Heaters", "Tankless", "BROAD", 0.6, 6.5, 0),
    t("water heater making noise", "Search | Water Heaters", "Repair", "BROAD", 0.9, 4.1, 0),
    t("quickfix plumbing", "Search | Brand", "Brand", "EXACT", 0.6, 1.2, 0.25),
    t("quickfix plumbing reviews", "Search | Brand", "Brand", "PHRASE", 0.3, 1.4, 0.05),
  ],
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [runningShop, plumbing];
