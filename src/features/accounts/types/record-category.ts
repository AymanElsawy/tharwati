import type { Decimal } from "@/lib/supabase/types"

export type RecordCategoryLevel = "main" | "subcategory"

export type RecordCategory = {
  id: string
  userId: string | null
  parentId: string | null
  systemCode: string | null
  level: RecordCategoryLevel
  name: string
  sortOrder: number
  isArchived: boolean
}

export type RecordCategoryOverride = {
  categoryId: string
  name: string | null
  isHidden: boolean
}

export type VisibleRecordSubcategory = {
  id: string
  name: string
  sortOrder: number
}

export type VisibleRecordMainCategory = {
  id: string
  name: string
  sortOrder: number
  subcategories: VisibleRecordSubcategory[]
}

export type AddCategorizedAccountRecordInput = {
  type: "income" | "expense"
  accountId: string
  amount: Decimal
  occurredAt: string
  mainCategoryId: string
  subcategoryId: string
  notes: string
}
