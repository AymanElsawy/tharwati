import { Badge } from "@/components/ui/badge"
import type { AssetInventoryItem } from "@/features/assets/types/asset-workspace"
import { useTranslation } from "@/i18n/useTranslation"

export function AssetOwnershipStatus({ item }: { item: AssetInventoryItem }) {
  const { t } = useTranslation()
  return (
    <Badge variant={item.ownership === "owned" ? "secondary" : "outline"}>
      {t(`assets.workspace.ownership.${item.ownership}`)}
    </Badge>
  )
}

export function AssetDataStatus({ item }: { item: AssetInventoryItem }) {
  const { t } = useTranslation()
  return (
    <span className={`text-xs font-medium ${item.dataStatus === "complete" || item.dataStatus === "not_applicable" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}>
      {t(`assets.workspace.data.${item.dataStatus}`)}
    </span>
  )
}
