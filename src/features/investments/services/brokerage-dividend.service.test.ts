import { describe, expect, it } from "vitest"
import { getBrokerageDividendPreview } from "./brokerage-dividend.service"
describe("cash dividend preview", () => {
  it("subtracts tax and fees with decimal-safe arithmetic", () => {
    expect(getBrokerageDividendPreview("100","10","2").net).toBe("88")
    expect(getBrokerageDividendPreview("0.3","0.1","0.1").net).toBe("0.1")
  })
  it("keeps zero deductions", () => expect(getBrokerageDividendPreview("10","0","0").net).toBe("10"))
})
