// Account current-value resolution + the gold/silver weighted-average cost
// formula (docs/accounts.md §2.3 step 5, §6.2). Decimal-safe throughout.

import '../core/decimals.dart';
import 'account_models.dart';

/// The weighted-average cost update `add_metal_purchase` applies (step 5). Fees
/// are part of acquisition cost, so `costBasis = subtotal + fees` and the
/// weighted-average includes them:
///
/// ```
/// newBalanceGrams  = oldBalanceGrams + quantityGrams
/// newCostPerUnit   = (oldBalanceGrams*oldCostPerUnit + costBasis) / newBalanceGrams
/// ```
class MetalWeightedAverage {
  const MetalWeightedAverage({
    required this.balanceGrams,
    required this.costPerUnit,
  });

  final String balanceGrams;
  final String costPerUnit;
}

MetalWeightedAverage? applyMetalPurchase({
  required String oldBalanceGrams,
  required String oldCostPerUnit,
  required String quantityGrams,
  required String costPerUnit,
  String fees = '0',
}) {
  final subtotal = D.multiply(quantityGrams, costPerUnit);
  if (subtotal == null) return null;
  final costBasis = D.add(subtotal, fees);
  final newBalance = D.add(oldBalanceGrams, quantityGrams);
  if (costBasis == null || newBalance == null) return null;
  if ((D.compare(newBalance, '0') ?? 0) <= 0) {
    return MetalWeightedAverage(balanceGrams: '0', costPerUnit: '0');
  }
  final priorCost = D.multiply(oldBalanceGrams, oldCostPerUnit);
  if (priorCost == null) return null;
  final totalCost = D.add(priorCost, costBasis);
  final newCost = D.divide(totalCost, newBalance, scale: 10);
  if (newCost == null) return null;
  return MetalWeightedAverage(balanceGrams: newBalance, costPerUnit: newCost);
}

/// Fold the effective purchase set into a running balance/weighted-average cost
/// (used by the gold detail page as the source of truth, not the RPC's
/// account-row response — §9.8). Purchases must be in chronological order.
MetalWeightedAverage foldMetalPurchases(List<MetalPurchase> chronological) {
  var balance = '0';
  var cost = '0';
  for (final p in chronological) {
    final next = applyMetalPurchase(
      oldBalanceGrams: balance,
      oldCostPerUnit: cost,
      quantityGrams: p.quantityGrams,
      costPerUnit: p.costPerUnit,
      fees: p.fees,
    );
    if (next == null) continue;
    balance = next.balanceGrams;
    cost = next.costPerUnit;
  }
  return MetalWeightedAverage(balanceGrams: balance, costPerUnit: cost);
}

/// Sum of each purchase's historical `quantity * costPerUnit + fees`.
String totalMetalCost(List<MetalPurchase> purchases) {
  var total = '0';
  for (final p in purchases) {
    final sub = D.multiply(p.quantityGrams, p.costPerUnit);
    final line = D.add(sub ?? '0', p.fees);
    total = D.add(total, line ?? '0') ?? total;
  }
  return total;
}

/// How the list / detail "Current Value" resolves per type (§6.2). Returned
/// value is a decimal string in the account's own currency, or null =
/// "unavailable" (shown as such, never a stored-balance fallback for the async
/// types).
enum CurrentValueSource { ledger, snapshot, valuation, openingBalance }

class ResolvedValue {
  const ResolvedValue(this.amount, this.source);
  final String? amount;
  final CurrentValueSource source;

  bool get isUnavailable => amount == null;
}

ResolvedValue resolveCurrentValue({
  required Account account,
  String? ledgerBalance, // get_account_balances.current_balance
  String? snapshotValue, // dashboard-valuation currentValues[id] (gold)
  AccountValuation? latestValuation, // effective valuation for RE/business
}) {
  switch (account.type) {
    case AccountType.cash:
    case AccountType.bank:
      return ResolvedValue(
        ledgerBalance ?? account.openingBalance,
        CurrentValueSource.ledger,
      );
    case AccountType.gold:
      return ResolvedValue(snapshotValue, CurrentValueSource.snapshot);
    case AccountType.realEstate:
    case AccountType.business:
      if (latestValuation == null) {
        return const ResolvedValue(null, CurrentValueSource.valuation);
      }
      final owned = D.divide(
        D.multiply(latestValuation.amount, account.ownershipPercentage ?? '0'),
        '100',
        scale: 2,
      );
      return ResolvedValue(owned, CurrentValueSource.valuation);
    case AccountType.brokerage:
      // Cash + holdings marked to market, as computed by the shared
      // `dashboard-valuation` Edge Function (§9.5). Unavailable rather than a
      // cost-basis fallback: showing the opening balance for an account whose
      // holdings have moved would understate or overstate it silently.
      return ResolvedValue(snapshotValue, CurrentValueSource.snapshot);
    case AccountType.other:
      return ResolvedValue(
        account.openingBalance,
        CurrentValueSource.openingBalance,
      );
  }
}
