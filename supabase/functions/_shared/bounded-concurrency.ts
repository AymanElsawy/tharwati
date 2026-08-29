/** Maps items with a fixed upper bound while returning results in input order. */
export async function mapWithConcurrency<Item, Result>(
  items: readonly Item[],
  limit: number,
  mapper: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Concurrency limit must be at least one")
  const results = new Array<Result>(items.length)
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export type CurrencyPair = { from: string; to: string }

/** Resolves each pair once and returns the same deterministic key mapping as sequential resolution. */
export async function resolveUniquePairsWithConcurrency<Result>(
  pairs: readonly CurrencyPair[],
  limit: number,
  resolve: (pair: CurrencyPair) => Promise<Result>,
): Promise<ReadonlyMap<string, Result>> {
  const uniquePairs = new Map<string, CurrencyPair>()
  for (const pair of pairs) uniquePairs.set(`${pair.from}/${pair.to}`, pair)
  const values = await mapWithConcurrency([...uniquePairs.values()], limit, resolve)
  return new Map([...uniquePairs.keys()].map((key, index) => [key, values[index]]))
}
