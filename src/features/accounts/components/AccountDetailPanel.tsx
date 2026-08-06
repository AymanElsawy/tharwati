import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  AccountActivityEvidence,
  AccountAssetEvidence,
  AccountDetailEvidence,
  AccountHoldingEvidence,
} from "@/features/accounts/types/account-workspace"
import { getAccountTypeLabel } from "@/features/accounts/types/account-form"
import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  )
}

export function AccountDetailPanel({
  detail,
  open,
  canDelete,
  onOpenChange,
  onScope,
  onHolding,
  onAsset,
  onActivity,
  onQuality,
  onEdit,
  onArchive,
  onDelete,
}: {
  detail: AccountDetailEvidence | null
  open: boolean
  canDelete: boolean
  onOpenChange: (open: boolean) => void
  onScope: (id: string) => void
  onHolding: (id: string) => void
  onAsset: (id: string) => void
  onActivity: (id: string) => void
  onQuality: () => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {detail ? (
          <>
            <SheetHeader className="border-b border-[var(--border-subtle)] px-6 py-6">
              <SheetTitle>{detail.item.account.name}</SheetTitle>
              <SheetDescription>
                {getAccountTypeLabel(detail.item.account.account_type_code, t)}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-8 p-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {t("accounts.workspace.userOwned")}
                </Badge>
                <Badge variant="ghost">
                  {t(
                    detail.item.account.is_active
                      ? "assets.card.active"
                      : "assets.card.archived"
                  )}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-5">
                <Field label={t("accounts.card.type")}>
                  {getAccountTypeLabel(
                    detail.item.account.account_type_code,
                    t
                  )}
                </Field>
                <Field label={t("accounts.card.currency")}>
                  <span dir="ltr">{detail.item.account.currency_code}</span>
                </Field>
                <Field label={t("accounts.form.openingBalance")}>
                  <span dir="ltr">
                    {formatPortfolioAmount(
                      detail.item.account.opening_balance,
                      detail.item.account.currency_code,
                      locale
                    )}
                  </span>
                </Field>
                <Field label={t("accounts.workspace.currentBalance")}>
                  <span dir="ltr">
                    {formatPortfolioAmount(
                      detail.item.currentBalance,
                      detail.item.account.currency_code,
                      locale
                    )}
                  </span>
                </Field>
                <Field label={t("accounts.detail.investmentValue")}>
                  {detail.investmentMarketValue === null
                    ? t("accounts.detail.unavailable")
                    : formatPortfolioAmount(
                        detail.investmentMarketValue,
                        detail.investmentMarketValueCurrency ??
                          detail.item.account.currency_code,
                        locale
                      )}
                </Field>
              </dl>
              <section>
                <h3 className="text-sm font-semibold">
                  {t("accounts.detail.cashInvested")}
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-4 border-y border-[var(--border-subtle)] py-4">
                  <Field label={t("accounts.workspace.projectedCash")}>
                    <span dir="ltr">
                      {formatPortfolioAmount(
                        detail.item.projectedCash,
                        detail.item.account.currency_code,
                        locale
                      )}
                    </span>
                  </Field>
                  <Field label={t("accounts.detail.invested")}>
                    {t("accounts.detail.unavailable")}
                  </Field>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold">
                  {t("accounts.detail.linkedEvidence")}
                </h3>
                <div className="mt-3 divide-y divide-[var(--border-subtle)]">
                  {detail.holdings.map((holding) => (
                    <button
                      key={holding.holdingId}
                      type="button"
                      onClick={() => onHolding(holding.holdingId)}
                      className="flex w-full justify-between gap-4 py-3 text-start focus-visible:ring-2"
                    >
                      <span>
                        {holding.assetName}
                        <small className="text-muted-foreground block">
                          {holding.assetSymbol}
                        </small>
                      </span>
                      <span dir="ltr" className="tabular-nums">
                        {formatPortfolioDecimal(holding.quantity, locale, 10)}
                      </span>
                    </button>
                  ))}
                  {detail.assets.map((asset) => (
                    <button
                      key={asset.assetId}
                      type="button"
                      onClick={() => onAsset(asset.assetId)}
                      className="flex w-full justify-between gap-4 py-3 text-start focus-visible:ring-2"
                    >
                      <span>{asset.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {t("accounts.detail.openAsset")}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold">
                  {t("accounts.activity.title")}
                </h3>
                <div className="mt-3 divide-y divide-[var(--border-subtle)]">
                  {detail.activity.slice(0, 6).map((item) => (
                    <button
                      key={item.transactionId}
                      type="button"
                      onClick={() => onActivity(item.transactionId)}
                      className="flex w-full justify-between gap-4 py-3 text-start focus-visible:ring-2"
                    >
                      <span>
                        {item.description}
                        <small className="text-muted-foreground block">
                          {item.type}
                        </small>
                      </span>
                      <time
                        className="text-muted-foreground text-xs"
                        dateTime={item.postedAt}
                      >
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(item.postedAt))}
                      </time>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold">
                  {t("accounts.detail.limitations")}
                </h3>
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 ps-5 text-sm">
                  {detail.limitations.map((item) => (
                    <li key={item}>
                      {t(`accounts.detail.limitation.${item}`)}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={onQuality}
                  className="text-primary mt-3 text-sm font-semibold focus-visible:ring-2"
                >
                  {t("accounts.detail.reviewQuality")}
                </button>
              </section>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onScope(detail.item.account.id)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t("accounts.detail.openWorkspace")}
                </button>
                <Link
                  to={`/portfolio?accountId=${encodeURIComponent(detail.item.account.id)}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t("accounts.detail.openPortfolio")}
                </Link>
                <Button variant="outline" onClick={onEdit}>
                  {t("accounts.actions.edit")}
                </Button>
                {detail.item.account.is_active ? (
                  <Button variant="outline" onClick={onArchive}>
                    {t("accounts.actions.archive")}
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button variant="destructive" onClick={onDelete}>
                    {t("accounts.actions.delete")}
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function AccountEvidencePanels({
  holding,
  asset,
  activity,
  onCloseHolding,
  onCloseAsset,
  onCloseActivity,
}: {
  holding: AccountHoldingEvidence | null
  asset: AccountAssetEvidence | null
  activity: AccountActivityEvidence | null
  onCloseHolding: () => void
  onCloseAsset: () => void
  onCloseActivity: () => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <>
      <Sheet
        open={holding !== null}
        onOpenChange={(open) => {
          if (!open) onCloseHolding()
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {holding ? (
            <>
              <SheetHeader>
                <SheetTitle>{holding.assetName}</SheetTitle>
                <SheetDescription>
                  {t("accounts.detail.holdingEvidence")}
                </SheetDescription>
              </SheetHeader>
              <dl className="grid grid-cols-2 gap-5 p-6">
                <Field label={t("holdings.table.quantity")}>
                  {formatPortfolioDecimal(holding.quantity, locale, 10)}
                </Field>
                <Field label={t("holdings.table.averageCost")}>
                  {formatPortfolioAmount(
                    holding.averageCost,
                    holding.costCurrency,
                    locale
                  )}
                </Field>
                <Field label={t("holdings.table.totalCost")}>
                  {formatPortfolioAmount(
                    holding.totalCostBasis,
                    holding.costCurrency,
                    locale
                  )}
                </Field>
              </dl>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <Sheet
        open={asset !== null}
        onOpenChange={(open) => {
          if (!open) onCloseAsset()
        }}
      >
        <SheetContent className="w-full sm:max-w-lg">
          {asset ? (
            <>
              <SheetHeader>
                <SheetTitle>{asset.name}</SheetTitle>
                <SheetDescription>
                  {asset.symbol ?? t("assets.card.noSymbol")}
                </SheetDescription>
              </SheetHeader>
              <div className="p-6">
                <Link
                  to={`/assets?assetId=${encodeURIComponent(asset.assetId)}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {t("accounts.detail.openAsset")}
                </Link>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <Sheet
        open={activity !== null}
        onOpenChange={(open) => {
          if (!open) onCloseActivity()
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {activity ? (
            <>
              <SheetHeader>
                <SheetTitle>{activity.description}</SheetTitle>
                <SheetDescription>
                  {activity.type} · {t("portfolio.activity.posted")}
                </SheetDescription>
              </SheetHeader>
              <div className="p-6">
                <Field label={t("accounts.detail.transactionId")}>
                  <span className="break-all" dir="ltr">
                    {activity.transactionId}
                  </span>
                </Field>
                <Field label={t("accounts.activity.originalCurrency")}>
                  <span dir="ltr">{activity.originalCurrency}</span>
                </Field>
                <ul className="mt-6 divide-y divide-[var(--border-subtle)]">
                  {activity.entries.map((entry) => (
                    <li
                      key={entry.entryId}
                      className="flex justify-between gap-4 py-3"
                    >
                      <span>
                        {entry.assetName ??
                          entry.memo ??
                          t("accounts.activity.accountEntry")}
                        <small
                          className="text-muted-foreground block"
                          dir="ltr"
                        >
                          {formatPortfolioAmount(
                            entry.transactionAmount,
                            activity.originalCurrency,
                            locale
                          )}
                        </small>
                      </span>
                      <span dir="ltr" className="tabular-nums">
                        {formatPortfolioAmount(
                          entry.accountAmount,
                          entry.accountCurrency,
                          locale
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
