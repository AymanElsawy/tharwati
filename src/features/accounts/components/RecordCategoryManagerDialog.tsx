import { Dialog } from "@base-ui/react/dialog"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import {
  createCustomRecordCategory,
  getRecordCategoryCatalog,
  nextRecordCategorySortOrder,
  restoreDefaultRecordCategory,
  setDefaultRecordCategoryOverride,
  updateCustomRecordCategory,
} from "../services/record-categories.service"
import type { RecordCategory, RecordCategoryOverride } from "../types/record-category"

export function RecordCategoryManagerDialog({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<RecordCategory[]>([])
  const [overrides, setOverrides] = useState<RecordCategoryOverride[]>([])
  const [name, setName] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [error, setError] = useState(false)

  const load = async () => {
    try {
      const catalog = await getRecordCategoryCatalog()
      setCategories(catalog.categories)
      setOverrides(catalog.overrides)
      setError(false)
    } catch { setError(true) }
  }
  useEffect(() => { if (open) void load() }, [open])
  const overrideByCategory = useMemo(() => new Map(overrides.map((item) => [item.categoryId, item] as const)), [overrides])
  const mains = categories.filter((category) => category.level === "main").sort((a, b) => a.sortOrder - b.sortOrder)
  const ordered = mains.flatMap((main) => [main, ...categories.filter((category) => category.parentId === main.id).sort((a, b) => a.sortOrder - b.sortOrder)])
  const displayName = (category: RecordCategory) => overrideByCategory.get(category.id)?.name ?? category.name

  const perform = async (action: () => Promise<void>) => {
    try { await action(); await load(); onChanged() } catch { setError(true) }
  }
  const add = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    const selectedParent = parentId || null
    void perform(async () => {
      await createCustomRecordCategory({ parentId: selectedParent, level: selectedParent ? "subcategory" : "main", name: trimmedName, sortOrder: nextRecordCategorySortOrder(categories, selectedParent) })
      setName("")
    })
  }
  const saveRename = (category: RecordCategory) => {
    const trimmedName = editingName.trim()
    if (!trimmedName) return
    void perform(async () => {
      if (category.userId) await updateCustomRecordCategory(category.id, { name: trimmedName })
      else await setDefaultRecordCategoryOverride(category.id, { name: trimmedName, isHidden: overrideByCategory.get(category.id)?.isHidden ?? false })
      setEditingId(null)
    })
  }

  return <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/60" /><Dialog.Popup className="fixed top-1/2 left-1/2 z-[110] max-h-[calc(100vh-2rem)] w-[min(48rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"><header className="border-b border-[var(--color-border)] px-6 py-5"><Dialog.Title className="font-heading text-xl font-semibold">{t("accounts.categories.manage")}</Dialog.Title></header><div className="space-y-4 px-6 py-5">
    <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]"><input className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("accounts.categories.name")} /><select className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm" value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">{t("accounts.categories.addMain")}</option>{mains.map((main) => <option key={main.id} value={main.id}>{t("accounts.categories.addSub")}: {displayName(main)}</option>)}</select><Button type="button" onClick={add}>{t("accounts.categories.save")}</Button></div>
    {error && <p className="text-sm text-red-600">{t("accounts.categories.loadError")}</p>}
    <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">{ordered.map((category) => { const override = overrideByCategory.get(category.id); const isDefault = !category.userId; const hidden = Boolean(override?.isHidden) || category.isArchived; return <div key={category.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${category.level === "subcategory" ? "ps-8" : ""}`}><div className="min-w-36 flex-1 text-sm">{editingId === category.id ? <input className="w-full rounded border border-[var(--color-border)] px-2 py-1" value={editingName} onChange={(event) => setEditingName(event.target.value)} /> : <><span>{displayName(category)}</span>{hidden && <span className="ms-2 text-xs text-muted-foreground">({t("accounts.categories.hidden")})</span>}</>}</div>{editingId === category.id ? <Button type="button" size="sm" onClick={() => saveRename(category)}>{t("accounts.categories.save")}</Button> : <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingId(category.id); setEditingName(displayName(category)) }}>{t("accounts.categories.rename")}</Button>}{isDefault ? <>{!hidden && <Button type="button" size="sm" variant="ghost" onClick={() => void perform(() => setDefaultRecordCategoryOverride(category.id, { name: override?.name ?? null, isHidden: true }))}>{t("accounts.categories.hide")}</Button>}{override && <Button type="button" size="sm" variant="ghost" onClick={() => void perform(() => restoreDefaultRecordCategory(category.id))}>{t("accounts.categories.restore")}</Button>}</> : !category.isArchived && <Button type="button" size="sm" variant="ghost" onClick={() => void perform(() => updateCustomRecordCategory(category.id, { isArchived: true }))}>{t("accounts.categories.archive")}</Button>}</div> })}</div>
  </div><footer className="flex justify-end border-t border-[var(--color-border)] px-6 py-4"><Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button></footer></Dialog.Popup></Dialog.Portal></Dialog.Root>
}
