import { useTranslation } from "@/i18n/useTranslation"
import { getAccountPickerOptions } from "@/features/accounts/utils/account-display-label"
import { transferAccountOptions } from "@/features/accounts/utils/transfer-account-options"
import type { AccountSummary } from "@/lib/supabase/types"

const field =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm"

export function TransferAccountSelectors({
  accounts,
  fromAccountId,
  toAccountId,
  fromError,
  toError,
  onFromAccountChange,
  onToAccountChange,
}: {
  accounts: AccountSummary[]
  fromAccountId: string
  toAccountId: string
  fromError?: string
  toError?: string
  onFromAccountChange: (accountId: string) => void
  onToAccountChange: (accountId: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <TransferAccountSelect
        label={t("accounts.records.fromAccount")}
        name="accountId"
        accounts={transferAccountOptions(accounts, toAccountId)}
        value={fromAccountId}
        onValueChange={onFromAccountChange}
        error={fromError}
      />
      <TransferAccountSelect
        label={t("accounts.records.toAccount")}
        name="toAccountId"
        accounts={transferAccountOptions(accounts, fromAccountId)}
        value={toAccountId}
        onValueChange={onToAccountChange}
        error={toError}
      />
    </>
  )
}

function TransferAccountSelect({
  label,
  name,
  accounts,
  value,
  onValueChange,
  error,
}: {
  label: string
  name: "accountId" | "toAccountId"
  accounts: AccountSummary[]
  value: string
  onValueChange: (accountId: string) => void
  error?: string
}) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <select
        className={field}
        name={name}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        <option value="">—</option>
        {getAccountPickerOptions(accounts, t).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
