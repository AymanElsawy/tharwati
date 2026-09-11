// Per-purity metal valuation — port of the web `metal-purchases.service`
// purity functions (`getMetalPurityFactor`, `getPurityAdjustedMetalPricePerGram`,
// `getMetalCurrentValue`, `valueMetalPurchases`,
// `aggregateValuedMetalPurchasesByPurity`). See docs/accounts.md §10.2.
//
// The one deviation is where the spot price comes from: the web fetches
// api.gold-api.com from the browser and converts with its own FX service, while
// mobile derives it from the `dashboard-valuation` snapshot the app already
// loads (see [derivePricePerGram]). Same number, one fewer network dependency,
// and the gold figure can never disagree with the dashboard's.

import '../../core/decimals.dart';
import '../account_models.dart';

/// Fraction of pure metal in one gram of the given purity, as a decimal string.
///
/// Gold is karat over 24 (`21k` → 21/24). Silver is a millesimal table. Returns
/// null for anything else — including the `other` purity the account form
/// allows — which propagates as an unavailable value rather than a wrong one.
String? metalPurityFactor(String purity) {
  final karat = RegExp(r'^([0-9]+)k$').firstMatch(purity)?.group(1);
  if (karat != null &&
      const ['24', '22', '21', '18', '14', '10', '9'].contains(karat)) {
    return D.divide(karat, '24', scale: 18);
  }
  return const {
    '999': '0.999',
    '958': '0.958',
    '950': '0.950',
    '925': '0.925',
    '900': '0.900',
    '835': '0.835',
    '800': '0.800',
  }[purity];
}

/// Spot price per gram scaled down to what one gram of this purity is worth.
String? purityAdjustedPricePerGram(String? pricePerGram, String purity) {
  if (pricePerGram == null) return null;
  final factor = metalPurityFactor(purity);
  if (factor == null) return null;
  return D.multiply(pricePerGram, factor);
}

/// `grams × purity-adjusted price`.
String? metalCurrentValue(String grams, String? adjustedPricePerGram) {
  if (adjustedPricePerGram == null) return null;
  return D.multiply(grams, adjustedPricePerGram);
}

/// Recovers the pure-metal spot price per gram (in the account's own currency)
/// from the account total the `dashboard-valuation` snapshot already computed.
///
/// The Edge Function values a gold account as
/// `Σ(gramsᵢ × price × factorᵢ)`, which factors to
/// `price × Σ(gramsᵢ × factorᵢ)`. Every `gramsᵢ` and `factorᵢ` is known here, so
/// the price falls out by division — no metal-price API call from the device,
/// and the breakdown always sums back to the headline value.
///
/// Null when the snapshot has no value for the account, when any purchase has
/// an unknown purity, or when the weighted gram total is zero.
String? derivePricePerGram({
  required String? accountCurrentValue,
  required List<MetalPurchase> purchases,
}) {
  if (accountCurrentValue == null || purchases.isEmpty) return null;
  var weightedGrams = '0';
  for (final p in purchases) {
    final factor = metalPurityFactor(p.purity);
    if (factor == null) return null;
    final contribution = D.multiply(p.quantityGrams, factor);
    if (contribution == null) return null;
    weightedGrams = D.add(weightedGrams, contribution) ?? weightedGrams;
  }
  if ((D.compare(weightedGrams, '0') ?? 0) <= 0) return null;
  return D.divide(accountCurrentValue, weightedGrams, scale: 18);
}

/// One purity's slice of a metal account.
class MetalPurityAggregate {
  const MetalPurityAggregate({
    required this.purity,
    required this.transactionCount,
    required this.totalUnitsGrams,
    required this.totalAmount,
    required this.currentPricePerGram,
    required this.currentValue,
  });

  final String purity;
  final int transactionCount;

  /// Grams held at this purity.
  final String totalUnitsGrams;

  /// What was paid for them: `Σ(grams × costPerUnit + fees)`.
  final String totalAmount;

  /// Spot price scaled by this purity's factor; null = unavailable.
  final String? currentPricePerGram;

  /// `totalUnitsGrams × currentPricePerGram`; null = unavailable.
  final String? currentValue;

  /// Current value minus what was paid. Null when the value is unavailable.
  String? get unrealizedGain =>
      currentValue == null ? null : D.subtract(currentValue!, totalAmount);
}

/// Historical cost of one purchase: `grams × costPerUnit + fees`.
String metalPurchaseCost(MetalPurchase p) {
  final subtotal = D.multiply(p.quantityGrams, p.costPerUnit) ?? '0';
  return D.add(subtotal, p.fees) ?? subtotal;
}

/// Groups purchases by purity and values each group, sorted by purity code —
/// the web `aggregateValuedMetalPurchasesByPurity`.
List<MetalPurityAggregate> aggregateByPurity(
  List<MetalPurchase> purchases,
  String? pricePerGram,
) {
  final counts = <String, int>{};
  final grams = <String, String>{};
  final amounts = <String, String>{};

  for (final p in purchases) {
    counts[p.purity] = (counts[p.purity] ?? 0) + 1;
    grams[p.purity] = D.add(grams[p.purity] ?? '0', p.quantityGrams) ?? '0';
    amounts[p.purity] =
        D.add(amounts[p.purity] ?? '0', metalPurchaseCost(p)) ?? '0';
  }

  final purities = counts.keys.toList()..sort();
  return [
    for (final purity in purities)
      () {
        final adjusted = purityAdjustedPricePerGram(pricePerGram, purity);
        return MetalPurityAggregate(
          purity: purity,
          transactionCount: counts[purity]!,
          totalUnitsGrams: grams[purity]!,
          totalAmount: amounts[purity]!,
          currentPricePerGram: adjusted,
          currentValue: metalCurrentValue(grams[purity]!, adjusted),
        );
      }(),
  ];
}
