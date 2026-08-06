import type { AccountTypeOption } from "@/features/accounts/types/account-workspace"
import { getAccountTypeLabel } from "@/features/accounts/types/account-form"
import { useTranslation } from "@/i18n/useTranslation"

export function AccountTypeNavigator({ options, selected, total, onSelect }: { options: AccountTypeOption[]; selected: string | null; total: number; onSelect: (id: string | null) => void }) {
  const { t } = useTranslation()
  return <nav aria-label={t("accounts.workspace.types")} className="mt-7 overflow-x-auto"><div className="flex min-w-max gap-2"><button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)} className="rounded-full border px-4 py-2 text-sm focus-visible:ring-2 aria-pressed:border-primary aria-pressed:text-primary">{t("accounts.workspace.allTypes")} · {total}</button>{options.map((option) => <button key={option.id} type="button" aria-pressed={selected === option.id} onClick={() => onSelect(selected === option.id ? null : option.id)} className="rounded-full border px-4 py-2 text-sm focus-visible:ring-2 aria-pressed:border-primary aria-pressed:text-primary">{getAccountTypeLabel(option.id, t)} · {option.count}</button>)}</div></nav>
}
