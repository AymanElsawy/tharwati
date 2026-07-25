import { Plus, WalletCards } from "lucide-react"
import { useTranslation } from "../../../i18n/useTranslation"

type EmptyAccountsStateProps = {
  onCreate: () => void
}

export function EmptyAccountsState({
  onCreate,
}: EmptyAccountsStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
        <WalletCards size={30} />
      </div>
      <h2 className="mt-5 text-xl font-bold text-[var(--color-text-primary)]">
        {t("accounts.empty.title")}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">
        {t("accounts.empty.description")}
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="tharwati-button-primary mt-6 flex items-center gap-2"
      >
        <Plus size={18} />
        {t("accounts.actions.create")}
      </button>
    </div>
  )
}
