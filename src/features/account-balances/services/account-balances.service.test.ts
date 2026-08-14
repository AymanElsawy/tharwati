import { describe, expect, it } from "vitest"

import { AccountBalancesService } from "@/features/account-balances/services/account-balances.service"
import type {
  AccountBalance,
  AccountBalanceRepository,
} from "@/features/account-balances/types/account-balance"

function balance(
  overrides: Partial<AccountBalance>,
): AccountBalance {
  return {
    accountId: "account-1",
    accountTypeCode: "cash",
    accountName: "Cash",
    currencyCode: "SAR",
    isActive: true,
    openingBalance: "0",
    ledgerEffect: "0",
    currentBalance: "0",
    ...overrides,
  }
}

describe("AccountBalancesService", () => {
  it("keeps currencies separate and aggregates projected balances exactly", async () => {
    const repository: AccountBalanceRepository = {
      getAccountBalances: async () => [
        balance({ accountId: "1", currentBalance: "79900.1" }),
        balance({ accountId: "2", currentBalance: "99.9" }),
        balance({
          accountId: "3",
          currencyCode: "USD",
          currentBalance: "10.25",
        }),
      ],
    }

    await expect(
      new AccountBalancesService(
        repository,
      ).getCashBalancesByCurrency(),
    ).resolves.toEqual([
      {
        currencyCode: "SAR",
        currentBalance: "80000",
        accountCount: 2,
      },
      {
        currencyCode: "USD",
        currentBalance: "10.25",
        accountCount: 1,
      },
    ])
  })

  it("excludes inactive cash and non-cash accounts", async () => {
    const repository: AccountBalanceRepository = {
      getAccountBalances: async () => [
        balance({ accountId: "active" }),
        balance({ accountId: "inactive", isActive: false }),
        balance({
          accountId: "brokerage",
          accountTypeCode: "brokerage",
        }),
      ],
    }

    const result =
      await new AccountBalancesService(repository).getCashAccountBalances()

    expect(result.map((item) => item.accountId)).toEqual(["active"])
  })

  it("includes active cash-bearing account types for wealth valuation", async () => {
    const repository: AccountBalanceRepository = {
      getAccountBalances: async () => [
        balance({ accountId: "cash" }),
        balance({ accountId: "bank", accountTypeCode: "bank" }),
        balance({
          accountId: "brokerage",
          accountTypeCode: "brokerage",
        }),
        balance({ accountId: "gold", accountTypeCode: "gold" }),
        balance({
          accountId: "real-estate",
          accountTypeCode: "real_estate",
        }),
        balance({
          accountId: "business",
          accountTypeCode: "business",
        }),
        balance({ accountId: "other", accountTypeCode: "other" }),
        balance({
          accountId: "inactive-brokerage",
          accountTypeCode: "brokerage",
          isActive: false,
        }),
      ],
    }

    const result = await new AccountBalancesService(
      repository,
    ).getEligibleWealthCashBalances()

    expect(result.map((item) => item.accountId)).toEqual([
      "cash",
      "bank",
      "brokerage",
    ])
  })
})
