import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import {
  getVisibleRecordCategoryTree,
  searchVisibleRecordCategories,
} from "../services/record-categories.service"
import type { VisibleRecordMainCategory } from "../types/record-category"
import { RecordCategoryManagerDialog } from "./RecordCategoryManagerDialog"

type Selection = { mainCategoryId: string; subcategoryId: string }

export function RecordCategoryPicker({ value, onChange, error }: {
  value: Selection
  onChange: (value: Selection) => void
  error?: string
}) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<VisibleRecordMainCategory[]>([])
  const [query, setQuery] = useState("")
  const [selectedMainId, setSelectedMainId] = useState(value.mainCategoryId)
  const [isManaging, setIsManaging] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const load = async () => {
    try {
      setCategories(await getVisibleRecordCategoryTree())
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { setSelectedMainId(value.mainCategoryId) }, [value.mainCategoryId])

  const selectedMain = categories.find((category) => category.id === selectedMainId)
  const selectedSubcategory = selectedMain?.subcategories.find((subcategory) => subcategory.id === value.subcategoryId)
  const selectedLabel = selectedMain && selectedSubcategory
    ? `${selectedMain.name} → ${selectedSubcategory.name}`
    : t("accounts.categories.choose")
  const matches = useMemo(() => searchVisibleRecordCategories(categories, query), [categories, query])

  return <section>
    <div className="flex items-center justify-between gap-3"><label className="text-sm font-semibold">{t("accounts.records.category")}</label><Button type="button" variant="ghost" size="sm" onClick={() => setIsManaging(true)}>{t("accounts.categories.manage")}</Button></div>
    <p className="mt-1 text-sm text-muted-foreground">{selectedLabel}</p>
    <input className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("accounts.categories.search")} />
    {loadError ? <p className="mt-2 text-sm text-red-600">{t("accounts.categories.loadError")}</p> : query.trim() ? <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border)] p-1">
      {matches.map((match) => <button key={match.subcategoryId} type="button" className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-[var(--color-surface-muted)]" onClick={() => onChange({ mainCategoryId: match.mainCategoryId, subcategoryId: match.subcategoryId })}>{match.mainCategoryName} <span className="text-muted-foreground">→</span> {match.subcategoryName}</button>)}
      {matches.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">{t("accounts.categories.empty")}</p>}
    </div> : <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border)] p-1">{categories.map((category) => <button key={category.id} type="button" className={`block w-full rounded-lg px-3 py-2 text-start text-sm ${selectedMainId === category.id ? "bg-[var(--color-surface-muted)] font-semibold" : "hover:bg-[var(--color-surface-muted)]"}`} onClick={() => { setSelectedMainId(category.id); onChange({ mainCategoryId: category.id, subcategoryId: "" }) }}>{category.name}</button>)}</div>
      <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border)] p-1">{selectedMain ? selectedMain.subcategories.map((subcategory) => <button key={subcategory.id} type="button" className={`block w-full rounded-lg px-3 py-2 text-start text-sm ${value.subcategoryId === subcategory.id ? "bg-[var(--color-surface-muted)] font-semibold" : "hover:bg-[var(--color-surface-muted)]"}`} onClick={() => onChange({ mainCategoryId: selectedMain.id, subcategoryId: subcategory.id })}>{subcategory.name}</button>) : <p className="px-3 py-2 text-sm text-muted-foreground">{t("accounts.categories.chooseMain")}</p>}</div>
    </div>}
    {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    <RecordCategoryManagerDialog open={isManaging} onClose={() => setIsManaging(false)} onChanged={() => void load()} />
  </section>
}
