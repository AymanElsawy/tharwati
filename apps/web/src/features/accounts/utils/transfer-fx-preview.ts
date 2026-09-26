import { isPositiveMoneyInput } from "@/lib/formatting/money-input"

const transferAmountPattern = /^\d{1,18}(?:\.\d{1,2})?$/

export function isValidTransferSentAmount(amount: string): boolean {
  return transferAmountPattern.test(amount) && isPositiveMoneyInput(amount)
}

/** A changed input or account invalidates every outstanding FX result. */
export function createTransferFxRequestGate() {
  let currentRequest = 0
  return {
    invalidate: () => ++currentRequest,
    isCurrent: (request: number) => request === currentRequest,
  }
}

export function invalidateTransferFxPreview(
  gate: ReturnType<typeof createTransferFxRequestGate>,
  clearReceived: () => void
) {
  gate.invalidate()
  clearReceived()
}

export function requestTransferFxPreview({
  amount,
  gate,
  estimate,
  onReceived,
  onUnavailable,
}: {
  amount: string
  gate: ReturnType<typeof createTransferFxRequestGate>
  estimate: (amount: string) => Promise<string>
  onReceived: (received: string) => void
  onUnavailable: () => void
}): () => void {
  if (!isValidTransferSentAmount(amount)) return () => undefined
  const request = gate.invalidate()
  let active = true
  void estimate(amount)
    .then((received) => {
      if (active && gate.isCurrent(request)) onReceived(received)
    })
    .catch(() => {
      if (active && gate.isCurrent(request)) onUnavailable()
    })
  return () => { active = false }
}
