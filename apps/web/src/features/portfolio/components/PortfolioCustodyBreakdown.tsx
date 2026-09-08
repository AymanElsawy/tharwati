import type { PortfolioCustodyAccount } from "@/features/portfolio/types/portfolio-evidence"
import {
  formatPortfolioAmount,
  formatPortfolioPercent,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { PortfolioSectionHeading } from "@/features/portfolio/components/PortfolioSectionHeading"

export function PortfolioCustodyBreakdown({
  accounts,
  baseCurrency,
  activeScopeId,
  onSelect,
}: {
  accounts: PortfolioCustodyAccount[]
  baseCurrency: string
  activeScopeId: string | null
  onSelect: (id: string | null) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <section
      aria-labelledby="portfolio-custody-title"
      className="border-t border-[var(--border-subtle)] pt-10"
    >
      <PortfolioSectionHeading
        eyebrow={t("portfolio.custody.eyebrow")}
        title={t("portfolio.custody.title")}
        titleId="portfolio-custody-title"
      />
      {accounts.length === 0 ? (
        <p className="text-muted-foreground py-12 text-sm">
          {t("portfolio.custody.empty")}
        </p>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-y border-[var(--border-subtle)] text-start text-xs tracking-[0.1em] uppercase">
                  <th className="px-3 py-3 text-start">
                    {t("portfolio.custody.account")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("portfolio.custody.investments")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("portfolio.custody.cash")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("portfolio.custody.total")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("portfolio.custody.share")}
                  </th>
                  <th className="px-3 py-3 text-end">
                    {t("portfolio.custody.holdings")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.accountId}
                    className="border-b border-[var(--border-subtle)]"
                  >
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        aria-pressed={activeScopeId === account.accountId}
                        onClick={() =>
                          onSelect(
                            activeScopeId === account.accountId
                              ? null
                              : account.accountId
                          )
                        }
                        className="text-start font-medium focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {account.accountName}
                        <span className="text-muted-foreground block text-xs font-normal">
                          {account.accountType} ·{" "}
                          {account.accountCurrency}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-4 text-end tabular-nums">
                      <span dir="ltr">
                        {formatPortfolioAmount(
                          account.investmentValueBase,
                          baseCurrency,
                          locale
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-end tabular-nums">
                      <span className="block" dir="ltr">
                        {formatPortfolioAmount(
                          account.projectedCashOriginal,
                          account.accountCurrency,
                          locale
                        )}
                      </span>
                      {account.accountCurrency !== baseCurrency ? (
                        <span
                          className="text-muted-foreground text-xs"
                          dir="ltr"
                        >
                          {formatPortfolioAmount(
                            account.projectedCashBase,
                            baseCurrency,
                            locale
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-end font-medium tabular-nums">
                      <span dir="ltr">
                        {formatPortfolioAmount(
                          account.totalContributionBase,
                          baseCurrency,
                          locale
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-end tabular-nums">
                      <span dir="ltr">
                        {formatPortfolioPercent(account.percentage, locale)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-end tabular-nums">
                      {account.holdingCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-3 md:hidden">
            {accounts.map((account) => (
              <button
                key={account.accountId}
                type="button"
                onClick={() =>
                  onSelect(
                    activeScopeId === account.accountId
                      ? null
                      : account.accountId
                  )
                }
                className="border-y border-[var(--border-subtle)] px-1 py-5 text-start focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="flex items-start justify-between gap-4">
                  <span>
                    <strong className="block">{account.accountName}</strong>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {account.accountType} ·{" "}
                      {account.accountCurrency}
                    </span>
                  </span>
                  <strong className="tabular-nums">
                    {formatPortfolioAmount(
                      account.totalContributionBase,
                      baseCurrency,
                      locale
                    )}
                  </strong>
                </span>
                <span className="text-muted-foreground mt-4 grid grid-cols-2 gap-3 text-xs">
                  <span>
                    {t("portfolio.custody.investments")}
                    <strong className="text-foreground mt-1 block">
                      {formatPortfolioAmount(
                        account.investmentValueBase,
                        baseCurrency,
                        locale
                      )}
                    </strong>
                  </span>
                  <span>
                    {t("portfolio.custody.cash")}
                    <strong className="text-foreground mt-1 block">
                      {formatPortfolioAmount(
                        account.projectedCashOriginal,
                        account.accountCurrency,
                        locale
                      )}
                    </strong>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
