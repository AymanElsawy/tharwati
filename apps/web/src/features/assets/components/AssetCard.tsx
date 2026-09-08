import { Archive, Box, LockKeyhole, Pencil, Trash2 } from "lucide-react"

import { useTranslation } from "../../../i18n/useTranslation"
import type { AssetSummary } from "../../../lib/supabase/types"
import { getAssetTypeLabel } from "../types/asset-form"

type Props = {
  asset: AssetSummary
  canDelete: boolean
  onArchive: (asset: AssetSummary) => void
  onDelete: (asset: AssetSummary) => void
  onEdit: (asset: AssetSummary) => void
}

export function AssetCard({
  asset,
  canDelete,
  onArchive,
  onDelete,
  onEdit,
}: Props) {
  const { t } = useTranslation()
  const editable = asset.is_custom && asset.user_id !== null

  return (
    <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Box size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold">{asset.name}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]" dir="ltr">
              {asset.symbol ?? t("assets.card.noSymbol")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-primary)]">
            {t(asset.is_custom ? "assets.card.custom" : "assets.card.global")}
          </span>
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            {t(asset.is_active ? "assets.card.active" : "assets.card.archived")}
          </span>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-[var(--color-border)] pt-5">
        <div>
          <dt className="text-xs text-[var(--color-text-secondary)]">
            {t("assets.card.assetType")}
          </dt>
          <dd className="mt-1 font-semibold">
            {getAssetTypeLabel(asset.asset_type_code, t)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-text-secondary)]">
            {t("assets.card.currency")}
          </dt>
          <dd className="mt-1 font-semibold" dir="ltr">
            {asset.currency_code}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--color-text-secondary)]">
            {t("assets.card.exchange")}
          </dt>
          <dd className="mt-1 truncate font-semibold">
            {asset.exchange ?? t("assets.card.noExchange")}
          </dd>
        </div>
      </dl>
      {editable ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onEdit(asset)}
            className="tharwati-button-secondary flex items-center gap-2"
          >
            <Pencil size={16} />
            {t("assets.actions.edit")}
          </button>
          {asset.is_active ? (
            <button
              type="button"
              onClick={() => onArchive(asset)}
              className="flex items-center gap-2 rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-700"
            >
              <Archive size={16} />
              {t("assets.actions.archive")}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              aria-label={t("assets.card.deleteLabel", {
                name: asset.name,
              })}
              onClick={() => onDelete(asset)}
              className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700"
            >
              <Trash2 size={16} />
              {t("assets.actions.delete")}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <LockKeyhole size={15} />
          {t("assets.card.readOnly")}
        </p>
      )}
    </article>
  )
}
