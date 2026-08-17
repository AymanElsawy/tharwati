import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import type { MetalPurchaseFormValues } from "../types/metal-purchase"

export class MetalPurchasesRepository {
  constructor(private readonly client: TypedSupabaseClient = supabase) {}

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
}

export const metalPurchasesRepository = new MetalPurchasesRepository()
