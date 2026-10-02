import { bounded, positiveDecimal } from "./market-reliability.ts";
import { ProviderBudgetError, reserveProviderCall } from "./provider-budget.ts";
import {
  parseMetalQuote,
  type MetalQuote,
  type MetalSymbol,
} from "./metal-quote.ts";

type CallerClient = Parameters<typeof reserveProviderCall>[0];
export type { MetalSymbol } from "./metal-quote.ts";

async function storedQuote(
  client: CallerClient,
  symbol: MetalSymbol,
): Promise<MetalQuote | null> {
  try {
    const { data, error } = await bounded(750, () =>
      client.rpc("read_metal_spot_quote", { p_symbol: symbol }),
    );
    return error ? null : parseMetalQuote(data, symbol);
  } catch {
    return null;
  }
}

/** Separate metal spot source. No securities cache, price/cost or FX substitution. */
export async function getGoldQuote(
  client: CallerClient,
  symbol: MetalSymbol,
  writer?: CallerClient | (() => CallerClient),
): Promise<MetalQuote> {
  const stored = await storedQuote(client, symbol);
  if (stored && !stored.stale) return stored;
  try {
    await reserveProviderCall(client, "metal");
    const quote = await bounded(2500, async (signal) => {
      const response = await fetch(`https://api.gold-api.com/price/${symbol}`, {
        signal,
      });
      if (!response.ok) throw new Error("metal_provider_unavailable");
      // Preserve the numeric JSON token before JS Number can round provider decimals.
      const raw = await response.text();
      const payload = JSON.parse(raw) as {
        price?: unknown;
        currency?: unknown;
        updatedAt?: unknown;
      };
      const tokens = [
        ...raw.matchAll(/"price"\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g),
      ];
      const price = positiveDecimal(
        typeof payload.price === "string"
          ? payload.price
          : typeof payload.price === "number" && tokens.length === 1
            ? tokens[0][1]
            : null,
      );
      const fetchedAt = new Date().toISOString();
      const effectiveAt =
        payload.updatedAt === undefined ? fetchedAt : payload.updatedAt;
      const result = parseMetalQuote(
        {
          symbol,
          price,
          currency: payload.currency,
          provider: "gold-api",
          effectiveAt,
          fetchedAt,
          timestampBasis:
            payload.updatedAt === undefined ? "observed" : "provider",
        },
        symbol,
      );
      if (!result) {
        throw new Error("metal_provider_unavailable");
      }
      return result;
    });
    if (writer) {
      try {
        const cacheWriter = typeof writer === "function" ? writer() : writer;
        const { error } = await bounded(750, () =>
          cacheWriter.rpc("store_metal_spot_quote", {
            p_symbol: symbol,
            p_price: quote.price,
            p_effective_at: quote.effectiveAt,
            p_fetched_at: quote.fetchedAt,
            p_timestamp_basis: quote.timestampBasis,
          }),
        );
        if (error) throw error;
      } catch {
        /* A persistence failure never discards a valid live/stored quote. */
      }
    }
    // A lagging live response must not replace a newer last-known observation.
    return stored &&
      Date.parse(stored.effectiveAt) > Date.parse(quote.effectiveAt)
      ? { ...stored, stale: true }
      : quote;
  } catch (error) {
    const fallback = stored ?? (await storedQuote(client, symbol));
    if (fallback)
      return {
        ...fallback,
        stale: true,
        refreshError:
          error instanceof ProviderBudgetError
            ? error.code
            : "metal_provider_unavailable",
      };
    throw error;
  }
}
