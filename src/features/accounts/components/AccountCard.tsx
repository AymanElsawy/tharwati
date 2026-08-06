import {
  Archive,
  Pencil,
  Trash2,
  WalletCards,
} from "lucide-react"

import type { AccountSummary } from "../../../lib/supabase/types"
import { useTranslation } from "../../../i18n/useTranslation"
import { getAccountTypeLabel } from "../types/account-form"

type AccountCardProps = {
  account: AccountSummary
  canDelete: boolean
  onArchive: (account: AccountSummary) => void
  onDelete: (account: AccountSummary) => void
  onEdit: (account: AccountSummary) => void
}

export function AccountCard({
  account,
  canDelete,
  onArchive,
  onDelete,
  onEdit,
}: AccountCardProps) {
  const { t } = useTranslation()
  return (
    <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <WalletCards size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-[var(--color-text-primary)]">
              {account.name}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[var(--color-text-secondary)]">
              {getAccountTypeLabel(account.account_type_code, t)}
            </p>
          </div>
        </div>

        <span
          className={[
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
            account.is_active
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {account.is_active
            ? t("accounts.card.active")
            : t("accounts.card.archived")}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-5">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            {t("accounts.card.accountType")}
          </dt>
          <dd className="mt-1 font-semibold capitalize text-[var(--color-text-primary)]">
            {getAccountTypeLabel(account.account_type_code, t)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            {t("accounts.card.currency")}
          </dt>
          <dd className="mt-1 font-semibold text-[var(--color-text-primary)]">
            {account.currency_code}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(account)}
          className="tharwati-button-secondary flex flex-1 items-center justify-center gap-2"
        >
          <Pencil size={16} />
          {t("accounts.actions.edit")}
        </button>
        {account.is_active ? (
          <button
            type="button"
            onClick={() => onArchive(account)}
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            <Archive size={16} />
            {t("accounts.actions.archive")}
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            aria-label={t("accounts.card.deleteLabel", {
              name: account.name,
            })}
            onClick={() => onDelete(account)}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            <Trash2 size={16} />
            {t("accounts.actions.delete")}
          </button>
        ) : null}
      </div>
    </article>
  )
}
