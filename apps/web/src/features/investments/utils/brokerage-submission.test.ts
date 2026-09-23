import { describe, expect, it } from "vitest"
import { brokerageAttempt, brokerageDividendFingerprint, brokerageTradeFingerprint } from "./brokerage-submission"

describe("Brokerage submission fingerprints", () => {
  it("reuses equivalent trade payloads and rotates changed payload or side", () => {
    const base={side:"buy" as const,accountId:"a",assetId:"s",quantity:"1.00",unitPrice:"10.0",occurredAt:"2026-09-24T10:00:00Z",notes:" note ",fees:"0.00",accountFxRate:null}
    const first=brokerageAttempt(null,brokerageTradeFingerprint(base))
    expect(brokerageAttempt(first,brokerageTradeFingerprint({...base,quantity:"1",notes:"note",fees:""}))).toBe(first)
    expect(brokerageAttempt(first,brokerageTradeFingerprint({...base,quantity:"2"})).idempotencyKey).not.toBe(first.idempotencyKey)
    expect(brokerageAttempt(first,brokerageTradeFingerprint({...base,side:"sell"})).idempotencyKey).not.toBe(first.idempotencyKey)
  })
  it("rotates dividend mode and ignores fields ineffective for cash", () => {
    const base={mode:"cash" as const,accountId:"a",assetId:"s",gross:"10",tax:"0",fees:"0",occurredAt:"2026-09-24T10:00:00Z",notes:"",unitPrice:"5",reinvestedAmount:"4"}
    const first=brokerageAttempt(null,brokerageDividendFingerprint(base))
    expect(brokerageAttempt(first,brokerageDividendFingerprint({...base,unitPrice:"9",reinvestedAmount:"8"}))).toBe(first)
    expect(brokerageAttempt(first,brokerageDividendFingerprint({...base,mode:"full"})).idempotencyKey).not.toBe(first.idempotencyKey)
  })
})
