import { describe, expect, it } from "vitest"

import brokerageAccountDetailsPage from "@/features/accounts/pages/BrokerageAccountDetailsPage.tsx?raw"
import assetEvidencePanels from "@/features/assets/components/AssetEvidencePanels.tsx?raw"
import assetIntentDialog from "@/features/assets/components/AssetIntentDialog.tsx?raw"
import assetInventory from "@/features/assets/components/AssetInventory.tsx?raw"
import assetWorkspaceStates from "@/features/assets/components/AssetWorkspaceStates.tsx?raw"
import assetsPage from "@/features/assets/pages/AssetsPage.tsx?raw"
import emptyHoldingsState from "@/features/holdings/components/EmptyHoldingsState.tsx?raw"
import portfolioHeader from "@/features/portfolio/components/PortfolioHeader.tsx?raw"
import portfolioValuePerformance from "@/features/portfolio/components/PortfolioValuePerformance.tsx?raw"

describe("legacy investment UI cleanup", () => {
  it("removes every unreachable Add Investment CTA and event dispatch", () => {
    for (const source of [portfolioHeader, portfolioValuePerformance, emptyHoldingsState, assetIntentDialog, assetWorkspaceStates, assetInventory, assetEvidencePanels, assetsPage]) {
      expect(source).not.toContain("tharwati:add-investment")
      expect(source).not.toContain('t("investment.primaryAction")')
    }
  })

  it("keeps Assets activity details read-only for Buy transactions", () => {
    expect(assetEvidencePanels).not.toContain("investment.edit.action")
    expect(assetEvidencePanels).not.toContain("onEditInvestment")
    expect(assetsPage).not.toContain("EditInvestmentDialog")
  })

  it("preserves supported Brokerage mutation actions", () => {
    for (const key of ['t("brokerage.addExistingHolding")', 't("brokerage.buy")', 't("brokerage.sell")', 't("brokerage.dividend")']) {
      expect(brokerageAccountDetailsPage).toContain(key)
    }
  })
})
