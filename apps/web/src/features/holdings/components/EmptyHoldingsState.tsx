import { Layers3 } from "lucide-react"

import { useTranslation } from "../../../i18n/useTranslation"

export function EmptyHoldingsState() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
      <Layers3 size={38} className="text-[var(--color-primary)]" />
      <h2 className="mt-4 text-xl font-bold">{t("holdings.empty.title")}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
        {t("holdings.empty.description")}
      </p>
    </div>
  )
}
