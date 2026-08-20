import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import { toRepositoryError } from "@/lib/supabase/types"
import { localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import type {
  AddCategorizedAccountRecordInput,
  RecordCategory,
  RecordCategoryOverride,
  RecordCategoryLevel,
} from "../types/record-category"

const categorySelect = "id,user_id,parent_id,system_code,level,name,sort_order,is_archived" as const
const overrideSelect = "category_id,name,is_hidden" as const

function mapCategory(row: Record<string, unknown>): RecordCategory {
  return {
    id: String(row.id), userId: row.user_id as string | null,
    parentId: row.parent_id as string | null, systemCode: row.system_code as string | null,
    level: row.level as RecordCategoryLevel, name: String(row.name),
    sortOrder: Number(row.sort_order), isArchived: Boolean(row.is_archived),
  }
}

export class RecordCategoriesRepository {
  constructor(private readonly client: TypedSupabaseClient = supabase) {}

  async getCategories(): Promise<RecordCategory[]> {
    const operation = "recordCategories.getCategories"
    const { data, error } = await this.client.from("record_categories").select(categorySelect).order("sort_order")
    return requireQueryData(data, error, operation).map((row) => mapCategory(row as Record<string, unknown>))
  }

  async getOverrides(): Promise<RecordCategoryOverride[]> {
    const operation = "recordCategories.getOverrides"
    const { data, error } = await this.client.from("record_category_overrides").select(overrideSelect)
    return requireQueryData(data, error, operation).map((row) => ({ categoryId: row.category_id, name: row.name, isHidden: row.is_hidden }))
  }

  async createCustomCategory(input: { parentId: string | null; level: RecordCategoryLevel; name: string; sortOrder: number }): Promise<void> {
    const operation = "recordCategories.createCustomCategory"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { error } = await this.client.from("record_categories").insert({ user_id: userId, parent_id: input.parentId, level: input.level, name: input.name.trim(), sort_order: input.sortOrder })
    if (error) throw toRepositoryError(error, operation)
  }

  async updateCustomCategory(id: string, input: { name?: string; isArchived?: boolean }): Promise<void> {
    const operation = "recordCategories.updateCustomCategory"
    const { error } = await this.client.from("record_categories").update({ ...(input.name === undefined ? {} : { name: input.name.trim() }), ...(input.isArchived === undefined ? {} : { is_archived: input.isArchived }) }).eq("id", id)
    if (error) throw toRepositoryError(error, operation)
  }

  async setDefaultOverride(categoryId: string, input: { name?: string | null; isHidden: boolean }): Promise<void> {
    const operation = "recordCategories.setDefaultOverride"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { error } = await this.client.from("record_category_overrides").upsert({ user_id: userId, category_id: categoryId, name: input.name?.trim() || null, is_hidden: input.isHidden }, { onConflict: "user_id,category_id" })
    if (error) throw toRepositoryError(error, operation)
  }

  async restoreDefault(categoryId: string): Promise<void> {
    const operation = "recordCategories.restoreDefault"
    const { error } = await this.client.from("record_category_overrides").delete().eq("category_id", categoryId)
    if (error) throw toRepositoryError(error, operation)
  }

  async addCategorizedAccountRecord(input: AddCategorizedAccountRecordInput): Promise<void> {
    const operation = "recordCategories.addCategorizedAccountRecord"
    const { error } = await this.client.rpc("add_account_record", {
      p_record_type: input.type, p_account_id: input.accountId,
      p_counterparty_account_id: null, p_amount: input.amount,
      p_received_amount: null, p_occurred_at: localDateTimeInputToIso(input.occurredAt),
      p_category: null, p_notes: input.notes.trim() || null,
      p_main_category_id: input.mainCategoryId, p_subcategory_id: input.subcategoryId,
    })
    if (error) throw toRepositoryError(error, operation)
  }
}

export const recordCategoriesRepository = new RecordCategoriesRepository()
