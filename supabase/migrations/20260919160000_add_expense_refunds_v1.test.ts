import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL("./20260919160000_add_expense_refunds_v1.sql", import.meta.url),
  "utf8",
)
const historyMigration = readFileSync(
  new URL("./20260821070000_add_account_record_history_filters.sql", import.meta.url),
  "utf8",
)

const addRefund =
  migration.match(/create function public\.add_expense_refund\([\s\S]*?\n\$\$;/)?.[0] ?? ""
const cancelRefund =
  migration.match(/create function public\.cancel_expense_refund\([\s\S]*?\n\$\$;/)?.[0] ?? ""

describe("Refund V1 migration", () => {
  it("models Refund separately from Income and links many Refunds to one Expense", () => {
    expect(migration).toContain("('refund', 'Refund', true)")
    expect(migration).toContain("refunds_transaction_id uuid")
    expect(migration).toContain("financial_transactions_refunds_transaction_id_idx")
    expect(addRefund).toContain("v_user_id, 'refund'")
    expect(addRefund).not.toContain("v_user_id, 'income'")
    expect(addRefund).toContain("v_expense.main_category_id, v_expense.subcategory_id")
  })

  it("supports partial, full, and multiple Refunds while rejecting over-refunds", () => {
    expect(addRefund).toContain("select coalesce(sum(refund_entry.account_amount), 0)")
    expect(addRefund).toContain("v_effective_refunded + p_amount > v_original_amount")
    expect(addRefund).toContain("refund total would exceed original expense amount")
    expect(addRefund).not.toContain("v_effective_refunded + p_amount >= v_original_amount")
  })

  it("serializes concurrent Refunds on the original Expense", () => {
    expect(addRefund).toMatch(
      /where id = p_expense_transaction_id[\s\S]*?for update;/,
    )
    expect(addRefund.indexOf("for update;")).toBeLessThan(
      addRefund.indexOf("v_effective_refunded + p_amount"),
    )
  })

  it("makes retries idempotent and rejects changed payloads", () => {
    expect(migration).toContain("financial_transactions_user_refund_idempotency_key_idx")
    expect(addRefund).toContain("pg_catalog.pg_advisory_xact_lock")
    expect(addRefund).toContain("'idempotent', true")
    expect(addRefund).toContain(
      "refund idempotency key was already used with different refund data",
    )
    expect(cancelRefund).toContain("pg_catalog.pg_advisory_xact_lock")
  })

  it("defaults to original account and validates alternate account ownership, activity, and currency", () => {
    expect(addRefund).toContain(
      "coalesce(p_destination_account_id, v_original_account.id)",
    )
    expect(addRefund).toContain("and user_id = v_user_id")
    expect(addRefund).toContain("and is_active")
    expect(addRefund).toContain("and account_type_code in ('cash', 'bank')")
    expect(addRefund).toContain(
      "v_destination.currency_code <> v_expense.transaction_currency_code",
    )
    expect(addRefund).not.toContain("exchange_rate")
  })

  it("enforces Bank Credit limits", () => {
    expect(addRefund).toContain("v_destination.bank_subtype = 'credit'")
    expect(addRefund).toContain(
      "v_destination_balance + p_amount > v_destination.credit_card_limit",
    )
  })

  it("cancels Refunds with an exact balanced audit transaction", () => {
    expect(cancelRefund).toContain("'refund_cancellation'")
    expect(cancelRefund).toContain("v_refund.id, p_idempotency_key")
    expect(cancelRefund).toContain("'expense_refund_cancellation'")
    expect(cancelRefund).toContain("'expense_refund_cancellation_sent'")
    expect(cancelRefund).toContain("insufficient available balance to cancel refund")
    expect(cancelRefund).toContain("public.post_transaction(v_transaction.id)")
  })

  it("hides cancellation and cancelled Refund from normal effective history", () => {
    expect(historyMigration).toContain("and t.reverses_transaction_id is null")
    expect(historyMigration).toContain("reversal.reverses_transaction_id = t.id")
    expect(migration).toContain(
      "p_record_type not in (''income'', ''expense'', ''transfer'', ''refund'')",
    )
  })

  it("blocks generic Expense correction and reversal while effective Refunds exist", () => {
    expect(migration).toContain("financial_transactions_block_refunded_expense_mutation")
    expect(migration).toContain("original.transaction_type_code = 'expense'")
    expect(migration).toContain(
      "expense with effective refunds cannot be reversed or corrected",
    )
  })

  it("exposes reliable effective and remaining Refund totals for future Budget use", () => {
    expect(migration).toContain("create function public.get_expense_refund_summary")
    expect(migration).toContain("effective_refunded_amount text")
    expect(migration).toContain("remaining_refundable_amount text")
    expect(migration).toContain("(v_original_amount - v_refunded)::text")
  })

  it("archives legacy Income Refunds without deleting historical category rows", () => {
    expect(migration).toContain("set is_archived = true")
    expect(migration).toContain("where system_code = 'income.refunds'")
    expect(migration).not.toContain("delete from public.record_categories")
  })

  it("keeps ledger writes RPC-only and preserves existing record types", () => {
    expect(migration).toContain(
      "revoke all on function public.add_expense_refund(uuid, numeric, timestamptz, uuid, uuid, text) from public, anon",
    )
    expect(migration).toContain(
      "revoke all on function public.cancel_expense_refund(uuid, uuid) from public, anon",
    )
    expect(migration).not.toContain("grant insert on table public.financial_transactions")
    expect(migration).not.toContain("grant insert on table public.transaction_entries")
    expect(migration).toContain("'income', 'expense', 'transfer', 'refund'")
  })
})
