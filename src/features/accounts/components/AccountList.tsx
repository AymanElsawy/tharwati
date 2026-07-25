import type { AccountSummary } from "../../../lib/supabase/types"
import { AccountCard } from "./AccountCard"

type AccountListProps = {
  accounts: AccountSummary[]
  canDeleteAccount: (accountId: string) => boolean
  onArchive: (account: AccountSummary) => void
  onDelete: (account: AccountSummary) => void
  onEdit: (account: AccountSummary) => void
}

export function AccountList({
  accounts,
  canDeleteAccount,
  onArchive,
  onDelete,
  onEdit,
}: AccountListProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          canDelete={canDeleteAccount(account.id)}
          onArchive={onArchive}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}
