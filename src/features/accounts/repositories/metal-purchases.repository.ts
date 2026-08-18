import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import type { MetalPurchaseRecord } from "@/lib/supabase/types"
import type { MetalPurchaseFormValues } from "../types/metal-purchase"

const metalPurchaseSelect =
  "id,user_id,account_id,purity,purchased_at,quantity_grams::text,cost_per_unit::text,fees::text,funding_mode,funding_account_id,created_at" as const

export class MetalPurchasesRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async addPurchase(
    accountId: string,
    values: MetalPurchaseFormValues
  ): Promise<void> {
    const operation = "metalPurchases.addPurchase"
    await requireAuthenticatedUserId(this.client, operation)

    const { data, error } = await this.client.rpc("add_metal_purchase", {
      p_account_id: accountId,
      p_purity: values.purity,
      p_occurred_at: `${values.purchaseDate}T12:00:00.000Z`,
      p_quantity_grams: values.unitsGrams,
      p_cost_per_unit: values.costPerUnit,
      p_funding_mode: values.paidFromAccount ? "cash_account" : "external",
      p_funding_account_id: values.paidFromAccount
        ? values.fundingAccountId
        : null,
      p_fees: "0",
    })

    requireQueryData(data, error, operation)
  }

  async getPurchases(accountId: string): Promise<MetalPurchaseRecord[]> {
    const operation = "metalPurchases.getPurchases"
    const userId = await requireAuthenticatedUserId(this.client, operation)

    const { data, error } = await this.client
      .from("metal_purchases")
      .select(metalPurchaseSelect)
      .eq("account_id", accountId)
      .eq("user_id", userId)
      .order("purchased_at", { ascending: false })
      .order("created_at", { ascending: false })

    return requireQueryData(data, error, operation)
  }
}

export const metalPurchasesRepository = new MetalPurchasesRepository()
