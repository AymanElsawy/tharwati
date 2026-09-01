import { Dialog } from "@base-ui/react/dialog"
import { MoreHorizontal } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "@/i18n/useTranslation"
import {
  createCustomRecordCategory,
  getRecordCategoryCatalog,
  nextRecordCategorySortOrder,
  restoreDefaultRecordCategory,
  setDefaultRecordCategoryOverride,
  updateCustomRecordCategory,
} from "../services/record-categories.service"
import type {
  RecordCategory,
  RecordCategoryOverride,
} from "../types/record-category"

export function RecordCategoryManagerDialog({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
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
    } catch {
      setError(true)
    }
  }
  useEffect(() => {
    if (!open) return
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [open])
  const overrideByCategory = useMemo(
    () => new Map(overrides.map((item) => [item.categoryId, item] as const)),
    [overrides]
  )
  const mains = categories
    .filter((category) => category.level === "main")
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const ordered = mains.flatMap((main) => [
    main,
    ...categories
      .filter((category) => category.parentId === main.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  ])
  const displayName = (category: RecordCategory) =>
    overrideByCategory.get(category.id)?.name ?? category.name

  const perform = async (action: () => Promise<void>) => {
    try {
      await action()
      await load()
      onChanged()
    } catch {
      setError(true)
    }
  }
  const add = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    const selectedParent = parentId || null
    void perform(async () => {
      await createCustomRecordCategory({
        parentId: selectedParent,
        level: selectedParent ? "subcategory" : "main",
        name: trimmedName,
        sortOrder: nextRecordCategorySortOrder(categories, selectedParent),
      })
      setName("")
    })
  }
  const saveRename = (category: RecordCategory) => {
    const trimmedName = editingName.trim()
    if (!trimmedName) return
    void perform(async () => {
      if (category.userId)
        await updateCustomRecordCategory(category.id, { name: trimmedName })
      else
        await setDefaultRecordCategoryOverride(category.id, {
          name: trimmedName,
          isHidden: overrideByCategory.get(category.id)?.isHidden ?? false,
        })
      setEditingId(null)
    })
  }

  const mobileActionClass = "h-11 w-full sm:h-7 sm:w-auto"

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[110] flex max-h-[calc(100dvh-1rem)] w-[min(48rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:w-[min(48rem,calc(100vw-2rem))]">
          <header className="shrink-0 border-b border-[var(--color-border)] px-4 py-4 sm:px-6 sm:py-5">
            <Dialog.Title className="font-heading text-xl font-semibold">
              {t("accounts.categories.manage")}
            </Dialog.Title>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
              <input
                className="min-h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("accounts.categories.name")}
              />
              <select
                className="min-h-10 min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">{t("accounts.categories.addMain")}</option>
                {mains.map((main) => (
                  <option key={main.id} value={main.id}>
                    {t("accounts.categories.addSub")}: {displayName(main)}
                  </option>
                ))}
              </select>
              <Button type="button" className="h-11 sm:h-8" onClick={add}>
                {t("accounts.categories.save")}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600">
                {t("accounts.categories.loadError")}
              </p>
            )}
            <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
              {ordered.map((category) => {
                const override = overrideByCategory.get(category.id)
                const isDefault = !category.userId
                const hidden =
                  Boolean(override?.isHidden) || category.isArchived
                return (
                  <div
                    key={category.id}
                    className={`flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center ${category.level === "main" ? "bg-[var(--color-surface-muted)]/70" : "ms-3 border-s border-[var(--color-border)] ps-4 sm:ms-0 sm:border-s-0 sm:ps-8"}`}
                  >
                    <div className={`w-full min-w-0 flex-1 break-words ${category.level === "main" ? "font-semibold text-[var(--color-text-primary)]" : "text-sm text-[var(--color-text-secondary)]"}`}>
                      {editingId === category.id ? (
                        <input
                          className="min-h-11 w-full rounded border border-[var(--color-border)] px-2 py-1 sm:min-h-0"
                          value={editingName}
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                        />
                      ) : (
                        <>
                          <span>{displayName(category)}</span>
                          {hidden && (
                            <span className="ms-2 text-xs text-muted-foreground">
                              ({t("accounts.categories.hidden")})
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="w-full sm:hidden">
                      {editingId === category.id ? (
                        <Button type="button" className="h-11 w-full sm:h-8" onClick={() => saveRename(category)}>{t("accounts.categories.save")}</Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger aria-label={t("accounts.categories.actions")} className="ms-auto flex size-11 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] sm:size-10">
                            <MoreHorizontal size={18} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" positionerClassName="z-[120]" className="min-w-40 [&_[data-slot=dropdown-menu-item]]:min-h-11">
                            <DropdownMenuItem onClick={() => { setEditingId(category.id); setEditingName(displayName(category)) }}>{t("accounts.categories.rename")}</DropdownMenuItem>
                            {isDefault && !hidden ? <DropdownMenuItem onClick={() => void perform(() => setDefaultRecordCategoryOverride(category.id, { name: override?.name ?? null, isHidden: true }))}>{t("accounts.categories.hide")}</DropdownMenuItem> : null}
                            {isDefault && override ? <DropdownMenuItem onClick={() => void perform(() => restoreDefaultRecordCategory(category.id))}>{t("accounts.categories.restore")}</DropdownMenuItem> : null}
                            {!isDefault && !category.isArchived ? <DropdownMenuItem onClick={() => void perform(() => updateCustomRecordCategory(category.id, { isArchived: true }))}>{t("accounts.categories.archive")}</DropdownMenuItem> : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="hidden sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2">
                      {editingId === category.id ? (
                        <Button
                          type="button"
                          size="sm"
                          className={mobileActionClass}
                          onClick={() => saveRename(category)}
                        >
                          {t("accounts.categories.save")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={mobileActionClass}
                          onClick={() => {
                            setEditingId(category.id)
                            setEditingName(displayName(category))
                          }}
                        >
                          {t("accounts.categories.rename")}
                        </Button>
                      )}
                      {isDefault ? (
                        <>
                          {!hidden && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className={mobileActionClass}
                              onClick={() =>
                                void perform(() =>
                                  setDefaultRecordCategoryOverride(
                                    category.id,
                                    {
                                      name: override?.name ?? null,
                                      isHidden: true,
                                    }
                                  )
                                )
                              }
                            >
                              {t("accounts.categories.hide")}
                            </Button>
                          )}
                          {override && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className={mobileActionClass}
                              onClick={() =>
                                void perform(() =>
                                  restoreDefaultRecordCategory(category.id)
                                )
                              }
                            >
                              {t("accounts.categories.restore")}
                            </Button>
                          )}
                        </>
                      ) : (
                        !category.isArchived && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={mobileActionClass}
                            onClick={() =>
                              void perform(() =>
                                updateCustomRecordCategory(category.id, {
                                  isArchived: true,
                                })
                              )
                            }
                          >
                            {t("accounts.categories.archive")}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <footer className="flex shrink-0 justify-end border-t border-[var(--color-border)] px-4 py-3 sm:px-6 sm:py-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-24 sm:h-8"
              onClick={onClose}
            >
              {t("common.cancel")}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
