import { Archive, LockKeyhole, Pencil, Trash2 } from "lucide-react"

import { useTranslation } from "../../../i18n/useTranslation"
import type { AssetSummary } from "../../../lib/supabase/types"
import { getAssetTypeLabel } from "../types/asset-form"

type Props = {
  assets: AssetSummary[]
  canDeleteAsset: (assetId: string) => boolean
  onArchive: (asset: AssetSummary) => void
  onDelete: (asset: AssetSummary) => void
  onEdit: (asset: AssetSummary) => void
}

function AssetActions({
  asset,
  canDelete,
  onArchive,
  onDelete,
  onEdit,
}: {
  asset: AssetSummary
  canDelete: boolean
  onArchive: (asset: AssetSummary) => void
  onDelete: (asset: AssetSummary) => void
  onEdit: (asset: AssetSummary) => void
}) {
  const { t } = useTranslation()
  const editable = asset.is_custom && asset.user_id !== null

  if (!editable) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
        <LockKeyhole size={14} />
        {t("assets.table.readOnly")}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button
        type="button"
        aria-label={t("assets.table.editLabel", { name: asset.name })}
        title={t("assets.actions.edit")}
        onClick={() => onEdit(asset)}
        className="rounded-lg p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
      >
        <Pencil size={16} />
      </button>
      {asset.is_active ? (
        <button
          type="button"
          aria-label={t("assets.table.archiveLabel", {
            name: asset.name,
          })}
          title={t("assets.actions.archive")}
          onClick={() => onArchive(asset)}
          className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"
        >
          <Archive size={16} />
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          aria-label={t("assets.card.deleteLabel", {
            name: asset.name,
          })}
          title={t("assets.actions.delete")}
          onClick={() => onDelete(asset)}
          className="rounded-lg p-2 text-red-700 hover:bg-red-50"
        >
          <Trash2 size={16} />
        </button>
      ) : null}
    </div>
  )
}

export function AssetTable({
  assets,
  canDeleteAsset,
  onArchive,
  onDelete,
  onEdit,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[850px] border-collapse text-start">
          <thead className="bg-[var(--color-surface-hover)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
            <tr>
              <th className="px-4 py-3 text-start">
                {t("assets.table.name")}
              </th>
              <th className="px-4 py-3 text-start">
                {t("assets.table.symbol")}
              </th>
              <th className="px-4 py-3 text-start">
                {t("assets.table.type")}
              </th>
              <th className="px-4 py-3 text-start">
                {t("assets.table.currency")}
              </th>
              <th className="px-4 py-3 text-start">
                {t("assets.table.exchange")}
              </th>
              <th className="px-4 py-3 text-start">
                {t("assets.table.status")}
              </th>
              <th className="px-4 py-3 text-end">
                {t("assets.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {assets.map((asset) => (
              <tr
                key={asset.id}
                className="hover:bg-[var(--color-surface-hover)]"
              >
                <td className="px-4 py-3 font-semibold">{asset.name}</td>
                <td className="px-4 py-3" dir="ltr">
                  {asset.symbol ?? t("assets.card.noSymbol")}
                </td>
                <td className="px-4 py-3">
                  {getAssetTypeLabel(asset.asset_type_code, t)}
                </td>
                <td className="px-4 py-3" dir="ltr">
                  {asset.currency_code}
                </td>
                <td className="px-4 py-3">
                  {asset.exchange ?? t("assets.card.noExchange")}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
                    {t(
                      asset.is_active
                        ? "assets.card.active"
                        : "assets.card.archived",
                    )}
                  </span>
                </td>
                <td className="px-4 py-2 text-end">
                  <AssetActions
                    asset={asset}
                    canDelete={canDeleteAsset(asset.id)}
                    onArchive={onArchive}
                    onDelete={onDelete}
                    onEdit={onEdit}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[var(--color-border)] md:hidden">
        {assets.map((asset) => (
          <article key={asset.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold">{asset.name}</h3>
                <p
                  className="mt-1 text-sm text-[var(--color-text-secondary)]"
                  dir="ltr"
                >
                  {asset.symbol ?? t("assets.card.noSymbol")}
                </p>
              </div>
              <AssetActions
                asset={asset}
                canDelete={canDeleteAsset(asset.id)}
                onArchive={onArchive}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-[var(--color-text-secondary)]">
                  {t("assets.table.type")}
                </dt>
                <dd>{getAssetTypeLabel(asset.asset_type_code, t)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-secondary)]">
                  {t("assets.table.currency")}
                </dt>
                <dd dir="ltr">{asset.currency_code}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-secondary)]">
                  {t("assets.table.exchange")}
                </dt>
                <dd>{asset.exchange ?? t("assets.card.noExchange")}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--color-text-secondary)]">
                  {t("assets.table.status")}
                </dt>
                <dd>
                  {t(
                    asset.is_active
                      ? "assets.card.active"
                      : "assets.card.archived",
                  )}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
