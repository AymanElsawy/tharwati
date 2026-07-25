import type { IncompleteNetWorthResult } from "@/features/net-worth/types/net-worth"

export function getMissingRateLinkState(result: IncompleteNetWorthResult) {
  return result.missingCurrencyPairs[0] ?? null
}
