import { afterEach, expect, it, vi } from "vitest";
import { getGoldQuote } from "./gold-provider.ts";

const old = "2026-09-01T00:00:00.000Z";
const quote = {
  symbol: "XAU",
  price: "4340.123456789012345678",
  currency: "USD",
  provider: "gold-api",
  effectiveAt: old,
  fetchedAt: old,
  timestampBasis: "provider",
};
function client(stored: unknown = null, code?: string) {
  return {
    rpc: vi.fn(
      async (name: string): Promise<{ data: unknown; error: unknown }> => ({
        data:
          name === "read_metal_spot_quote"
            ? stored
            : code
              ? { allowed: false, code }
              : { allowed: true },
        error: null,
      }),
    ),
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("protects separate Gold and persists a provider decimal without Number rounding", async () => {
  const caller = client(),
    writer = client();
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response('{"price":4340.123456789012345678,"currency":"USD"}'),
    );
  expect(await getGoldQuote(caller, "XAU", writer)).toMatchObject({
    price: quote.price,
    currency: "USD",
    stale: false,
    timestampBasis: "observed",
  });
  expect(caller.rpc).toHaveBeenCalledWith("reserve_provider_budget", {
    p_provider: "gold_api",
    p_operation: "metal",
    p_units: 1,
  });
  expect(writer.rpc).toHaveBeenCalledWith(
    "store_metal_spot_quote",
    expect.objectContaining({ p_price: quote.price }),
  );
  expect(String(fetcher.mock.calls[0][0])).toBe(
    "https://api.gold-api.com/price/XAU",
  );
});
it("fresh cache uses neither provider nor budget", async () => {
  const now = new Date().toISOString(),
    caller = client({ ...quote, effectiveAt: now, fetchedAt: now });
  const fetcher = vi.spyOn(globalThis, "fetch");
  expect(await getGoldQuote(caller, "XAU")).toMatchObject({
    price: quote.price,
    stale: false,
  });
  expect(caller.rpc).toHaveBeenCalledTimes(1);
  expect(fetcher).not.toHaveBeenCalled();
});
it("stored quotes do not require privileged write configuration", async () => {
  const now = new Date().toISOString();
  const writer = vi.fn(() => {
    throw new Error("write service unavailable");
  });
  expect(
    await getGoldQuote(
      client({ ...quote, effectiveAt: now, fetchedAt: now }),
      "XAU",
      writer,
    ),
  ).toMatchObject({ stale: false });
  expect(
    await getGoldQuote(client(quote, "provider_refresh_paused"), "XAU", writer),
  ).toMatchObject({ stale: true });
  expect(writer).not.toHaveBeenCalled();
});
it.each([
  "provider_capacity_unconfigured",
  "provider_refresh_paused",
  "provider_refresh_rate_limited",
])(
  "%s skips refresh and preserves exact stored timestamps/price",
  async (code) => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    expect(await getGoldQuote(client(quote, code), "XAU")).toEqual({
      ...quote,
      stale: true,
      refreshError: code,
    });
    await expect(getGoldQuote(client(null, code), "XAG")).rejects.toMatchObject(
      { code },
    );
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it("provider failure retains already loaded fallback even if later database reads fail", async () => {
  const caller = client(quote);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("private provider details"),
  );
  expect(await getGoldQuote(caller, "XAU")).toMatchObject({
    price: quote.price,
    stale: true,
    refreshError: "metal_provider_unavailable",
  });
  expect(caller.rpc).toHaveBeenCalledTimes(2);
});
it("hung refresh returns stored fallback within 2.5s provider deadline", async () => {
  vi.useFakeTimers();
  vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
  const pending = getGoldQuote(client(quote), "XAU");
  await vi.advanceTimersByTimeAsync(2500);
  expect(await pending).toMatchObject({ price: quote.price, stale: true });
});
it.each([0, -1, "NaN"])(
  "no cache plus invalid %s never fabricates a price",
  async (price) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ price, currency: "USD" })),
    );
    await expect(getGoldQuote(client(), "XAU")).rejects.toThrow(
      "metal_provider_unavailable",
    );
  },
);
it("future provider time cannot overwrite a valid stored quote", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        price: 999,
        currency: "USD",
        updatedAt: "2099-01-01T00:00:00Z",
      }),
    ),
  );
  const writer = client();
  expect(await getGoldQuote(client(quote), "XAU", writer)).toMatchObject({
    price: quote.price,
    stale: true,
  });
  expect(writer.rpc).not.toHaveBeenCalled();
});
it("write failure preserves successful live price", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ price: 10, currency: "USD" })),
  );
  expect(
    await getGoldQuote(client(quote), "XAU", {
      rpc: async () => ({ data: null, error: "offline" }),
    }),
  ).toMatchObject({ price: "10", stale: false });
});
it("failed first lookup can recover on a second bounded read after provider failure", async () => {
  const caller = client();
  caller.rpc
    .mockResolvedValueOnce({ data: null, error: "read unavailable" })
    .mockResolvedValueOnce({ data: { allowed: true }, error: null })
    .mockResolvedValueOnce({ data: quote, error: null });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("provider offline"),
  );
  expect(await getGoldQuote(caller, "XAU")).toMatchObject({
    price: quote.price,
    stale: true,
  });
});
