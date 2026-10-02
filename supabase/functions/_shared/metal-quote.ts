import { positiveDecimal } from "./market-reliability.ts";

export const metalQuoteFreshMs = 6 * 60 * 60 * 1000;
export type MetalSymbol = "XAU" | "XAG";
export type MetalQuote = {
  symbol: MetalSymbol;
  price: string;
  currency: "USD";
  provider: "gold-api";
  effectiveAt: string;
  fetchedAt: string;
  timestampBasis: "provider" | "observed";
  stale: boolean;
  refreshError?: string;
};

/** Shared transport validation; never replaces quote time with response time. */
export function parseMetalQuote(
  value: unknown,
  symbol: MetalSymbol,
  now = Date.now(),
): MetalQuote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const price = positiveDecimal(row.price);
  const effective =
    typeof row.effectiveAt === "string" ? Date.parse(row.effectiveAt) : NaN;
  const fetched =
    typeof row.fetchedAt === "string" ? Date.parse(row.fetchedAt) : NaN;
  if (
    !price ||
    price.length > 128 ||
    row.symbol !== symbol ||
    row.currency !== "USD" ||
    row.provider !== "gold-api" ||
    !Number.isFinite(effective) ||
    !Number.isFinite(fetched) ||
    effective > fetched ||
    fetched > now ||
    (row.timestampBasis !== "provider" && row.timestampBasis !== "observed")
  )
    return null;
  return {
    symbol,
    price,
    currency: "USD",
    provider: "gold-api",
    effectiveAt: row.effectiveAt as string,
    fetchedAt: row.fetchedAt as string,
    timestampBasis: row.timestampBasis,
    stale:
      row.stale === true ||
      now - effective >= metalQuoteFreshMs ||
      now - fetched >= metalQuoteFreshMs,
  };
}
