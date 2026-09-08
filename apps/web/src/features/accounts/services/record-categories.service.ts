import type {
  RecordCategory,
  RecordCategoryOverride,
  VisibleRecordMainCategory,
} from "../types/record-category"
import { recordCategoriesRepository } from "../repositories/record-categories.repository"

export function buildVisibleRecordCategoryTree(
  categories: readonly RecordCategory[],
  overrides: readonly RecordCategoryOverride[]
): VisibleRecordMainCategory[] {
  const overrideByCategory = new Map(
    overrides.map((override) => [override.categoryId, override] as const)
  )
  const visible = categories.filter((category) => {
    const override = overrideByCategory.get(category.id)
    return !category.isArchived && !override?.isHidden
  })

  return visible
    .filter((category) => category.level === "main")
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((main) => ({
      id: main.id,
      name: overrideByCategory.get(main.id)?.name ?? main.name,
      sortOrder: main.sortOrder,
      subcategories: visible
        .filter(
          (subcategory) =>
            subcategory.level === "subcategory" &&
            subcategory.parentId === main.id
        )
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((subcategory) => ({
          id: subcategory.id,
          name:
            overrideByCategory.get(subcategory.id)?.name ?? subcategory.name,
          sortOrder: subcategory.sortOrder,
        })),
    }))
}

export async function getVisibleRecordCategoryTree() {
  const [categories, overrides] = await Promise.all([
    recordCategoriesRepository.getCategories(),
    recordCategoriesRepository.getOverrides(),
  ])
  return buildVisibleRecordCategoryTree(categories, overrides)
}

export type RecordCategorySearchResult = {
  mainCategoryId: string
  mainCategoryName: string
  subcategoryId: string
  subcategoryName: string
}

/** Returns matching selectable pairs in their configured catalog order. */
export function searchVisibleRecordCategories(
  categories: readonly VisibleRecordMainCategory[],
  query: string
): RecordCategorySearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return categories.flatMap((main) =>
    main.subcategories
      .filter((subcategory) =>
        !normalizedQuery ||
        main.name.toLocaleLowerCase().includes(normalizedQuery) ||
        subcategory.name.toLocaleLowerCase().includes(normalizedQuery)
      )
      .map((subcategory) => ({
        mainCategoryId: main.id,
        mainCategoryName: main.name,
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
      }))
  )
}

export async function getRecordCategoryCatalog() {
  const [categories, overrides] = await Promise.all([
    recordCategoriesRepository.getCategories(),
    recordCategoriesRepository.getOverrides(),
  ])
  return { categories, overrides }
}

export function nextRecordCategorySortOrder(
  categories: readonly RecordCategory[],
  parentId: string | null
) {
  return Math.max(
    0,
    ...categories
      .filter((category) => category.parentId === parentId)
      .map((category) => category.sortOrder)
  ) + 1
}

export const createCustomRecordCategory = recordCategoriesRepository.createCustomCategory.bind(recordCategoriesRepository)
export const updateCustomRecordCategory = recordCategoriesRepository.updateCustomCategory.bind(recordCategoriesRepository)
export const setDefaultRecordCategoryOverride = recordCategoriesRepository.setDefaultOverride.bind(recordCategoriesRepository)
export const restoreDefaultRecordCategory = recordCategoriesRepository.restoreDefault.bind(recordCategoriesRepository)
