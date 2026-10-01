// GAQL query builders. All interpolated values are validated first so user
// input can never alter the query structure.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^\d{1,20}$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function assertId(value: string, what = "id"): string {
  if (!ID_RE.test(value)) throw new Error(`Invalid ${what}: ${value}`);
  return value;
}

export const CUSTOMER_QUERY =
  "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.test_account FROM customer LIMIT 1";

/** Non-manager accounts below a manager account (any depth). */
export const CUSTOMER_CLIENTS_QUERY = [
  "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,",
  "customer_client.manager, customer_client.status, customer_client.level",
  "FROM customer_client",
  "WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED' AND customer_client.level >= 1",
  "LIMIT 1000",
].join(" ");

export const CAMPAIGNS_QUERY = [
  "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type",
  "FROM campaign",
  "WHERE campaign.status != 'REMOVED'",
  "ORDER BY campaign.name",
].join(" ");

export function searchTermsQuery(startDate: string, endDate: string, campaignIds: readonly string[]): string {
  if (!isValidDate(startDate) || !isValidDate(endDate)) throw new Error("Invalid date range");
  if (startDate > endDate) throw new Error("Start date must be on or before end date");
  const where = [`segments.date BETWEEN '${startDate}' AND '${endDate}'`];
  if (campaignIds.length > 0) {
    where.push(`campaign.id IN (${campaignIds.map((id) => assertId(id, "campaign id")).join(", ")})`);
  }
  return [
    "SELECT search_term_view.search_term, segments.search_term_match_type,",
    "campaign.id, campaign.name, ad_group.id, ad_group.name,",
    "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions",
    "FROM search_term_view",
    `WHERE ${where.join(" AND ")}`,
  ].join(" ");
}
