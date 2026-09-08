import { Bus, Car, Check, ChevronDown, ChevronRight, CircleArrowDown, Ellipsis, GraduationCap, HeartPulse, House, MessageCircle, Plane, ReceiptText, Repeat2, Search, Settings, ShoppingBag, Sparkles, TrendingUp, Users, Utensils } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import { getVisibleRecordCategoryTree, searchVisibleRecordCategories } from "../services/record-categories.service"
import type { VisibleRecordMainCategory } from "../types/record-category"
import { RecordCategoryManagerDialog } from "./RecordCategoryManagerDialog"

type Selection = { mainCategoryId: string; subcategoryId: string }
type PopoverPosition = { left: number; width: number; side: "top" | "bottom"; offset: number; maxHeight: number }

const accentStyles = ["bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", "bg-sky-500/10 text-sky-700 dark:text-sky-300", "bg-violet-500/10 text-violet-700 dark:text-violet-300", "bg-amber-500/10 text-amber-700 dark:text-amber-300", "bg-rose-500/10 text-rose-700 dark:text-rose-300"]
const viewportMargin = 16
const popoverGap = 8
const preferredPopoverHeight = 384

export function RecordCategoryPicker({ value, onChange, error }: { value: Selection; onChange: (value: Selection) => void; error?: string }) {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [categories, setCategories] = useState<VisibleRecordMainCategory[]>([])
  const [query, setQuery] = useState("")
  const [expandedMainIds, setExpandedMainIds] = useState<Set<string>>(new Set())
  const [isOpen, setIsOpen] = useState(false)
  const [isManaging, setIsManaging] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [position, setPosition] = useState<PopoverPosition | null>(null)
  const load = async () => { try { setCategories(await getVisibleRecordCategoryTree()); setLoadError(false) } catch { setLoadError(true) } }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    if (!isOpen) return
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom - viewportMargin - popoverGap
      const above = rect.top - viewportMargin - popoverGap
      const side = below >= preferredPopoverHeight || below >= above ? "bottom" : "top"
      const availableHeight = Math.max(0, side === "bottom" ? below : above)
      setPosition({
        left: Math.max(viewportMargin, Math.min(rect.left, window.innerWidth - 336)),
        width: Math.min(Math.max(rect.width, 320), window.innerWidth - viewportMargin * 2),
        side,
        offset: side === "bottom" ? rect.bottom + popoverGap : window.innerHeight - rect.top + popoverGap,
        maxHeight: Math.min(preferredPopoverHeight, availableHeight),
      })
    }
    updatePosition(); window.addEventListener("resize", updatePosition); window.addEventListener("scroll", updatePosition, true)
    return () => { window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true) }
  }, [isOpen])

  const selectedMain = categories.find((category) => category.id === value.mainCategoryId)
  const selectedSubcategory = selectedMain?.subcategories.find((subcategory) => subcategory.id === value.subcategoryId)
  const selectedLabel = selectedMain && selectedSubcategory ? `${selectedMain.name} → ${selectedSubcategory.name}` : t("accounts.categories.choose")
  const matches = useMemo(() => searchVisibleRecordCategories(categories, query), [categories, query])
  const choose = (selection: Selection) => { onChange(selection); setIsOpen(false); setQuery("") }
  const toggleMain = (mainId: string) => setExpandedMainIds((current) => { const next = new Set(current); if (next.has(mainId)) next.delete(mainId); else next.add(mainId); return next })

  return <section>
    <div className="flex items-center justify-between gap-3"><label className="text-sm font-semibold">{t("accounts.records.category")}</label><Button type="button" variant="ghost" size="sm" className="h-11 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-[var(--color-text)] sm:h-7 sm:px-1.5" onClick={() => setIsManaging(true)}><Settings size={14}/>{t("accounts.categories.manage")}</Button></div>
    <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => { setQuery(""); setExpandedMainIds(new Set(value.mainCategoryId ? [value.mainCategoryId] : [])); setIsOpen(true) }} className="mt-1.5 flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-start text-sm transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"><span className={selectedMain ? "truncate" : "text-muted-foreground"}>{selectedLabel}</span><ChevronDown size={16} className="shrink-0 text-muted-foreground" /></button>
    {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    {isOpen && createPortal(<div className="fixed inset-0 z-[120]" onMouseDown={() => setIsOpen(false)}><section role="dialog" aria-label={t("accounts.records.category")} onMouseDown={(event) => event.stopPropagation()} className="fixed flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xl" style={{ left: position?.left ?? viewportMargin, [position?.side === "top" ? "bottom" : "top"]: position?.offset ?? viewportMargin, width: position?.width ?? 320, maxHeight: position?.maxHeight ?? preferredPopoverHeight }}><div className="relative shrink-0"><Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("accounts.categories.search")} className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] ps-8 pe-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] sm:h-9" /></div><div className="mt-2 min-h-0 flex-1 overflow-y-auto pe-1">{loadError ? <p className="px-3 py-2 text-sm text-red-600">{t("accounts.categories.loadError")}</p> : query.trim() ? <SearchResults matches={matches} selectedSubcategoryId={value.subcategoryId} onChoose={choose} emptyLabel={t("accounts.categories.empty")} /> : categories.map((main, index) => <CategorySection key={main.id} main={main} accentClassName={accentStyles[index % accentStyles.length]} expanded={expandedMainIds.has(main.id)} selectedSubcategoryId={value.subcategoryId} onToggle={() => toggleMain(main.id)} onChoose={choose} />)}</div></section></div>, document.body)}
    <RecordCategoryManagerDialog open={isManaging} onClose={() => setIsManaging(false)} onChanged={() => void load()} />
  </section>
}

function CategorySection({ main, accentClassName, expanded, selectedSubcategoryId, onToggle, onChoose }: { main: VisibleRecordMainCategory; accentClassName: string; expanded: boolean; selectedSubcategoryId: string; onToggle: () => void; onChoose: (selection: Selection) => void }) {
  const Icon = mainCategoryIcon(main.sortOrder)
  return <div className="mb-1 last:mb-0"><button type="button" aria-expanded={expanded} onClick={onToggle} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm font-semibold hover:bg-[var(--color-surface-muted)]"><span className={`grid size-7 place-items-center rounded-lg ${accentClassName}`}><Icon size={15} /></span><span className="min-w-0 flex-1 truncate">{main.name}</span>{expanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}</button>{expanded && <div className="ms-5 border-s border-[var(--color-border)] py-1 ps-2">{main.subcategories.map((subcategory) => <SubcategoryOption key={subcategory.id} label={subcategory.name} selected={subcategory.id === selectedSubcategoryId} onClick={() => onChoose({ mainCategoryId: main.id, subcategoryId: subcategory.id })} />)}</div>}</div>
}

function mainCategoryIcon(sortOrder: number) {
  return [Utensils, ShoppingBag, House, Bus, Plane, Car, HeartPulse, GraduationCap, Sparkles, MessageCircle, Repeat2, Users, ReceiptText, TrendingUp, CircleArrowDown, Ellipsis][sortOrder - 1] ?? Ellipsis
}

function SearchResults({ matches, selectedSubcategoryId, onChoose, emptyLabel }: { matches: ReturnType<typeof searchVisibleRecordCategories>; selectedSubcategoryId: string; onChoose: (selection: Selection) => void; emptyLabel: string }) {
  return matches.length ? matches.map((match) => <SubcategoryOption key={match.subcategoryId} label={`${match.mainCategoryName} → ${match.subcategoryName}`} selected={match.subcategoryId === selectedSubcategoryId} onClick={() => onChoose({ mainCategoryId: match.mainCategoryId, subcategoryId: match.subcategoryId })} />) : <p className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
}

function SubcategoryOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors sm:min-h-0 ${selected ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "hover:bg-[var(--color-surface-muted)]"}`}><span className="min-w-0 flex-1 truncate">{label}</span>{selected && <Check size={16} className="shrink-0" />}</button>
}
