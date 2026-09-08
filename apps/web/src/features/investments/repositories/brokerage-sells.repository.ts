import { supabase, type TypedSupabaseClient } from "@/lib/supabase/client"
import { requireAuthenticatedUserId, requireQueryData } from "@/lib/supabase/repository"
import type { Database } from "@/lib/supabase/types"

export class BrokerageSellsRepository {
  private readonly client: TypedSupabaseClient
  constructor(client: TypedSupabaseClient = supabase) { this.client = client }
  async addBrokerageSell(input: Database["public"]["Functions"]["add_brokerage_sell"]["Args"]) {
    await requireAuthenticatedUserId(this.client, "brokerageSells.addBrokerageSell")
    const { data, error } = await this.client.rpc("add_brokerage_sell", input)
    return requireQueryData(data, error, "brokerageSells.addBrokerageSell")
  }
}
export const brokerageSellsRepository = new BrokerageSellsRepository()
