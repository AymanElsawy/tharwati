import { supabase } from "@/lib/supabase/client"
import { requireAuthenticatedUserId, requireQueryData } from "@/lib/supabase/repository"
import type { Database } from "@/lib/supabase/types"
export type AddBrokerageDividendInput = Database["public"]["Functions"]["add_brokerage_cash_dividend"]["Args"]
export async function addBrokerageCashDividend(input: AddBrokerageDividendInput) { await requireAuthenticatedUserId(supabase, "brokerageDividends.add"); const { data,error }=await supabase.rpc("add_brokerage_cash_dividend",input); return requireQueryData(data,error,"brokerageDividends.add") }
