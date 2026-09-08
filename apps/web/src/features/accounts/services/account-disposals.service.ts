import { normalizeDecimal } from "@/lib/financial-calculations/decimal"
import { supabase } from "@/lib/supabase"
import { requireQueryData } from "@/lib/supabase/repository"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import type {
  AccountDisposal,
  AddAccountDisposalInput,
  AccountDisposalInput,
  AccountOwnershipProjection,
} from "../types/account-disposal"

type DisposalRow = {
  id: string; account_id: string; disposed_on: string; sale_amount: Decimal
  sale_currency_code: string; ownership_percentage_sold: Decimal; notes: string | null
  corrects_disposal_id: string | null; idempotency_key: string | null; proceeds_account_id: string | null
  proceeds_transaction_id: string | null; created_at: string; is_effective?: boolean
}

function decimal(value: Decimal, field: string): Decimal {
  const normalized = normalizeDecimal(String(value))
  if (normalized === null) throw new Error(`Invalid account disposal ${field}`)
  return normalized
}

function mapDisposal(row: DisposalRow): AccountDisposal {
  return {
    id: row.id, accountId: row.account_id, disposedOn: row.disposed_on,
    saleAmount: decimal(row.sale_amount, "sale amount"), saleCurrencyCode: row.sale_currency_code,
    ownershipPercentageSold: decimal(row.ownership_percentage_sold, "ownership percentage"),
    notes: row.notes, correctsDisposalId: row.corrects_disposal_id,
    idempotencyKey: row.idempotency_key, createdAt: row.created_at,
    proceedsAccountId: row.proceeds_account_id, proceedsTransactionId: row.proceeds_transaction_id,
    isEffective: row.is_effective ?? true,
  }
}

export async function getAccountCurrentOwnership(accountIds: readonly string[]): Promise<AccountOwnershipProjection[]> {
  if (accountIds.length === 0) return []
  const { data, error } = await supabase.rpc("get_account_current_ownership", { p_account_ids: [...accountIds] })
  return requireQueryData(data, error, "accountDisposals.getCurrentOwnership").map((row) => ({
    accountId: row.account_id,
    ownershipPercentage: row.ownership_percentage === null ? null : decimal(row.ownership_percentage, "ownership percentage"),
    isSold: row.is_sold,
  }))
}

export async function getAccountDisposals(accountIds: readonly string[]): Promise<AccountDisposal[]> {
  if (accountIds.length === 0) return []
  const { data, error } = await supabase.rpc("get_account_disposals", { p_account_ids: [...accountIds] })
  return requireQueryData(data, error, "accountDisposals.get").map(mapDisposal)
}

export async function addAccountDisposal(accountId: string, input: AddAccountDisposalInput): Promise<AccountDisposal> {
  const { data, error } = await supabase.rpc("add_account_disposal", {
    p_account_id: accountId, p_disposed_on: input.disposedOn, p_sale_amount: input.saleAmount,
    p_sale_currency_code: input.saleCurrencyCode, p_ownership_percentage_sold: input.ownershipPercentageSold,
    p_idempotency_key: input.idempotencyKey,
    p_notes: input.notes ?? null, p_destination_account_id: input.destinationAccountId ?? null,
  })
  return mapDisposal(requireQueryData(data, error, "accountDisposals.add"))
}

export async function correctAccountDisposal(disposalId: string, input: AccountDisposalInput): Promise<AccountDisposal> {
  const { data, error } = await supabase.rpc("correct_account_disposal", {
    p_disposal_id: disposalId, p_disposed_on: input.disposedOn, p_sale_amount: input.saleAmount,
    p_sale_currency_code: input.saleCurrencyCode, p_ownership_percentage_sold: input.ownershipPercentageSold,
    p_notes: input.notes ?? null, p_destination_account_id: input.destinationAccountId ?? null,
  })
  return mapDisposal(requireQueryData(data, error, "accountDisposals.correct"))
}

export function getEligibleDisposalDestinationAccounts(
  accounts: readonly AccountSummary[], currencyCode: string,
): AccountSummary[] {
  return accounts.filter((account) => account.is_active &&
    (account.account_type_code === "cash" || account.account_type_code === "bank") &&
    account.currency_code === currencyCode)
}
