import type { AssetClassOption } from "@/features/assets/types/asset-workspace"
import { getAssetTypeLabel } from "@/features/assets/types/asset-form"
import { useTranslation } from "@/i18n/useTranslation"

export function AssetClassNavigator({
  options,
  selectedId,
  totalCount,
  onSelect,
}: {
  options: AssetClassOption[]
  selectedId: string | null
  totalCount: number
  onSelect: (id: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t("assets.workspace.classes")} className="overflow-x-auto border-b border-[var(--border-subtle)]">
      <div className="flex min-w-max gap-6">
        <button type="button" aria-pressed={selectedId === null} onClick={() => onSelect(null)} className={`border-b-2 py-4 text-sm font-semibold outline-none focus-visible:ring-2 ${selectedId === null ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
          {t("assets.workspace.allClasses")} <span className="ms-1 tabular-nums">{totalCount}</span>
        </button>
        {options.map((option) => (
          <button key={option.id} type="button" aria-pressed={selectedId === option.id} onClick={() => onSelect(option.id)} className={`border-b-2 py-4 text-sm font-semibold outline-none focus-visible:ring-2 ${selectedId === option.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            {getAssetTypeLabel(option.id, t)} <span className="ms-1 tabular-nums">{option.count}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
