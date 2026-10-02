import { expect, it } from "vitest";
import { parseMetalQuote, metalQuoteFreshMs } from "./metal-quote.ts";

const now = Date.parse("2026-10-02T15:00:00Z");
const quote = {
  symbol: "XAU",
  price: "4340.123456789012345678",
  currency: "USD",
  provider: "gold-api",
  timestampBasis: "provider",
  effectiveAt: "2026-10-02T14:59:00Z",
  fetchedAt: "2026-10-02T15:00:00Z",
};
it("quote age follows original timestamps, not response time", () => {
  expect(parseMetalQuote(quote, "XAU", now)?.stale).toBe(false);
  expect(parseMetalQuote(quote, "XAU", now + metalQuoteFreshMs)?.stale).toBe(
    true,
  );
  expect(parseMetalQuote({ ...quote, stale: true }, "XAU", now)?.stale).toBe(
    true,
  );
});
it.each([
  { price: "0" },
  { price: "NaN" },
  { currency: "SAR" },
  { symbol: "XAG" },
  { effectiveAt: "2099-01-01T00:00:00Z" },
  { fetchedAt: "2099-01-01T00:00:00Z" },
  { fetchedAt: "2026-10-02T14:00:00Z" },
  { timestampBasis: "unknown" },
])("rejects invalid/future quote metadata: %j", (patch) => {
  expect(parseMetalQuote({ ...quote, ...patch }, "XAU", now)).toBeNull();
});
