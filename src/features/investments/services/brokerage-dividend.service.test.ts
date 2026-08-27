import { describe, expect, it } from "vitest"
import { getBrokerageDividendPreview, getBrokerageDividendReinvestmentPreview } from "./brokerage-dividend.service"
describe("cash dividend preview", () => {
  it("subtracts tax and fees with decimal-safe arithmetic", () => {
    expect(getBrokerageDividendPreview("100","10","2").net).toBe("88")
    expect(getBrokerageDividendPreview("0.3","0.1","0.1").net).toBe("0.1")
  })
  it("keeps zero deductions", () => expect(getBrokerageDividendPreview("10","0","0").net).toBe("10"))

  it("calculates full reinvestment quantity with decimal-safe arithmetic", () => {
    expect(getBrokerageDividendReinvestmentPreview("100", "10", "2", "11")).toMatchObject({ net: "88", quantityAdded: "8" })
    expect(getBrokerageDividendReinvestmentPreview("0.3", "0.1", "0.1", "0.1")).toMatchObject({ net: "0.1", quantityAdded: "1" })
  })
})
