import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import { requireAuthenticatedUserId, requireQueryData } from "@/lib/supabase/repository"
import type { Database } from "@/lib/supabase/types"

export type AddBrokerageBuyInput = Database["public"]["Functions"]["add_brokerage_buy_v2"]["Args"]

export class BrokerageBuysRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async addBrokerageBuy(input: AddBrokerageBuyInput): Promise<unknown> {
    const operation = "brokerageBuys.addBrokerageBuy"
    await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client.rpc("add_brokerage_buy_v2", input)
    return requireQueryData(data, error, operation)
  }
}

export const brokerageBuysRepository = new BrokerageBuysRepository()
