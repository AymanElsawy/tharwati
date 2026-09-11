// Holding market value and unrealised P&L — port of the web
// `lib/financial-calculations/valuation.ts` (`calculateHoldingMarketValue`,
// `calculateHoldingPerformance`) plus the account-level rollup the web
// `BrokerageAccountDetailsPage` computes inline.
//
// The web throws a `FinancialCalculationError` on a missing price, a currency
// mismatch, or a zero cost basis. Mobile returns null for those instead: on a
// phone one unpriced asset must not blank the whole screen, so an unavailable
// figure is rendered as "—" and the account total is marked incomplete. That is
// the same information the web surfaces through `missingPriceHoldings` /
// `completenessStatus`, just carried differently.

import '../../core/decimals.dart';
import 'brokerage_models.dart';

/// One holding valued at the current market price.
class HoldingValuation {
  const HoldingValuation({
    required this.holding,
    required this.marketPrice,
    required this.marketValue,
    required this.unrealizedGainLoss,
    required this.unrealizedReturnPercent,
  });

  final Holding holding;

  /// Null when no usable price came back, or when the price is quoted in a
  /// currency other than the holding's cost currency.
  final MarketPrice? marketPrice;

  /// `quantity × price`, in the holding's cost currency. Null = unavailable.
  final String? marketValue;

  /// `marketValue − totalCostBasis`. Null = unavailable.
  final String? unrealizedGainLoss;

  /// `unrealizedGainLoss ÷ totalCostBasis × 100`. Null when unavailable or when
  /// the cost basis is zero (the web raises `zero_cost_basis` here).
  final String? unrealizedReturnPercent;

  bool get isPriced => marketValue != null;
}

/// Values one holding. Returns an entry with null figures rather than throwing,
/// so a single unpriced asset degrades to "—" instead of failing the page.
HoldingValuation valueHolding(Holding holding, MarketPrice? price) {
  // The web raises `currency_mismatch` here. Converting would need an FX rate
  // the account page does not load, so a mismatch reads as unavailable.
  final usable =
      price != null &&
          price.currencyCode == holding.costCurrencyCode.toUpperCase()
      ? price
      : null;
  if (usable == null) {
    return HoldingValuation(
      holding: holding,
      marketPrice: null,
      marketValue: null,
      unrealizedGainLoss: null,
      unrealizedReturnPercent: null,
    );
  }

  final marketValue = D.multiply(holding.quantity, usable.price);
  final gain = marketValue == null
      ? null
      : D.subtract(marketValue, holding.totalCostBasis);
  final zeroCost = (D.compare(holding.totalCostBasis, '0') ?? 0) == 0;
  final ratio = gain == null || zeroCost
      ? null
      : D.divide(gain, holding.totalCostBasis, scale: 10);

  return HoldingValuation(
    holding: holding,
    marketPrice: usable,
    marketValue: marketValue,
    unrealizedGainLoss: gain,
    unrealizedReturnPercent: ratio == null ? null : D.multiply(ratio, '100'),
  );
}

/// The account-level rollup behind the brokerage header.
class BrokerageValuation {
  const BrokerageValuation({
    required this.holdings,
    required this.cashBalance,
    required this.totalCostBasis,
    required this.totalMarketValue,
    required this.totalUnrealizedGainLoss,
    required this.totalUnrealizedReturnPercent,
    required this.currentValue,
    required this.unpricedCount,
  });

  final List<HoldingValuation> holdings;

  /// The account's own cash leg — always known.
  final String cashBalance;

  /// Cost basis of every open holding. Always known (it is stored, not priced).
  final String totalCostBasis;

  /// Null when any holding is unpriced — a partial sum would understate the
  /// portfolio and read as a loss.
  final String? totalMarketValue;
  final String? totalUnrealizedGainLoss;
  final String? totalUnrealizedReturnPercent;

  /// `cash + holdings market value`. Null when the market value is.
  final String? currentValue;

  final int unpricedCount;

  bool get isComplete => unpricedCount == 0;
  bool get isEmpty => holdings.isEmpty;
}

/// Values a whole brokerage account.
///
/// The totals go null the moment any holding is unpriced. That is deliberate:
/// summing only the priced ones would silently report a smaller portfolio, and
/// against a full cost basis that looks like a loss the user does not have.
/// [BrokerageValuation.unpricedCount] says how many are missing so the UI can
/// explain the gap instead of showing a wrong number.
BrokerageValuation valueBrokerageAccount({
  required List<Holding> holdings,
  required Map<String, MarketPrice> pricesByAssetId,
  required String cashBalance,
}) {
  final valued = [
    for (final holding in holdings)
      valueHolding(holding, pricesByAssetId[holding.assetId]),
  ];

  var totalCost = '0';
  var marketValue = '0';
  var unpriced = 0;
  for (final entry in valued) {
    totalCost = D.add(totalCost, entry.holding.totalCostBasis) ?? totalCost;
    if (entry.marketValue == null) {
      unpriced += 1;
    } else {
      marketValue = D.add(marketValue, entry.marketValue!) ?? marketValue;
    }
  }

  final totalMarketValue = unpriced > 0 ? null : marketValue;
  final gain = totalMarketValue == null
      ? null
      : D.subtract(totalMarketValue, totalCost);
  final zeroCost = (D.compare(totalCost, '0') ?? 0) == 0;
  final ratio = gain == null || zeroCost
      ? null
      : D.divide(gain, totalCost, scale: 10);

  return BrokerageValuation(
    holdings: valued,
    cashBalance: cashBalance,
    totalCostBasis: totalCost,
    totalMarketValue: totalMarketValue,
    totalUnrealizedGainLoss: gain,
    totalUnrealizedReturnPercent: ratio == null
        ? null
        : D.multiply(ratio, '100'),
    currentValue: totalMarketValue == null
        ? null
        : D.add(cashBalance, totalMarketValue),
    unpricedCount: unpriced,
  );
}

/// Web `getBrokerageBuyPreview`.
class TradePreview {
  const TradePreview({
    required this.grossAmount,
    required this.fees,
    required this.assetTotal,
    required this.accountTotal,
  });

  /// `quantity × unitPrice`, in the asset's currency.
  final String? grossAmount;
  final String fees;

  /// Buy: gross + fees. Sell: gross − fees. In the asset's currency.
  final String? assetTotal;

  /// [assetTotal] converted to the account's currency, when they differ.
  final String? accountTotal;
}

/// How a dividend is settled — web `DividendMode`.
enum DividendMode {
  /// Paid out as cash into the account.
  cash,

  /// The whole net amount buys more of the same asset.
  full,

  /// Part buys more of the asset, the rest stays as cash.
  partial,
}

/// Web `getBrokerageDividendPreview` + the two reinvestment variants.
class DividendPreview {
  const DividendPreview({
    required this.gross,
    required this.tax,
    required this.fees,
    required this.net,
    required this.reinvestedAmount,
    required this.cashRemainder,
    required this.quantityAdded,
  });

  final String gross;
  final String tax;
  final String fees;

  /// `gross − tax − fees`.
  final String? net;

  /// Partial mode only: how much of [net] is reinvested.
  final String? reinvestedAmount;

  /// Partial mode only: `net − reinvestedAmount`.
  final String? cashRemainder;

  /// Units bought — `net ÷ unitPrice` (full) or
  /// `reinvestedAmount ÷ unitPrice` (partial).
  final String? quantityAdded;
}

DividendPreview previewDividend({
  required DividendMode mode,
  required String gross,
  required String tax,
  required String fees,
  String unitPrice = '',
  String reinvestedAmount = '',
}) {
  String orZero(String v) => v.trim().isEmpty ? '0' : v.trim();
  final g = orZero(gross);
  final t = orZero(tax);
  final f = orZero(fees);
  final afterTax = D.subtract(g, t);
  final net = afterTax == null ? null : D.subtract(afterTax, f);
  final price = unitPrice.trim();

  if (mode == DividendMode.partial) {
    final reinvested = orZero(reinvestedAmount);
    return DividendPreview(
      gross: g,
      tax: t,
      fees: f,
      net: net,
      reinvestedAmount: reinvested,
      cashRemainder: net == null ? null : D.subtract(net, reinvested),
      quantityAdded: price.isEmpty
          ? null
          : D.divide(reinvested, price, scale: 10),
    );
  }

  return DividendPreview(
    gross: g,
    tax: t,
    fees: f,
    net: net,
    reinvestedAmount: null,
    cashRemainder: null,
    quantityAdded: mode == DividendMode.full && net != null && price.isNotEmpty
        ? D.divide(net, price, scale: 10)
        : null,
  );
}

/// The web dialog's `canSave` gate, as field errors.
///
/// The rules that carry real meaning: the net must be **positive** (a dividend
/// that costs more in tax and fees than it pays is not a dividend), and for a
/// partial reinvestment the reinvested amount must be strictly **less than**
/// the net — at or above it, it is a full reinvestment and the other RPC
/// applies.
Map<String, String> validateDividend({
  required DividendMode mode,
  required String assetId,
  required String gross,
  required String tax,
  required String fees,
  required String occurredAt,
  String unitPrice = '',
  String reinvestedAmount = '',
  bool currencyMatches = true,
}) {
  final errors = <String, String>{};
  final decimal = RegExp(r'^\d+(?:\.\d+)?$');
  bool ok(String v) => decimal.hasMatch(v.trim());

  if (assetId.trim().isEmpty) {
    errors['assetId'] = 'Choose the instrument that paid the dividend.';
  } else if (!currencyMatches) {
    errors['assetId'] =
        'This instrument is priced in a different currency than the account. '
        'Dividends must be recorded in the account currency.';
  }
  if (!ok(gross)) errors['gross'] = 'Enter the gross dividend.';
  if (!ok(tax)) errors['tax'] = 'Withholding tax must be zero or more.';
  if (!ok(fees)) errors['fees'] = 'Fees must be zero or more.';

  final preview = previewDividend(
    mode: mode,
    gross: gross,
    tax: tax,
    fees: fees,
    unitPrice: unitPrice,
    reinvestedAmount: reinvestedAmount,
  );
  final net = preview.net;
  if (errors.isEmpty && (net == null || (D.compare(net, '0') ?? 0) <= 0)) {
    errors['gross'] = 'Tax and fees leave nothing to record.';
  }
  if (DateTime.tryParse(occurredAt) == null) {
    errors['occurredAt'] = 'Date and time are required.';
  }

  if (mode != DividendMode.cash) {
    if (!ok(unitPrice) || (D.compare(unitPrice.trim(), '0') ?? 0) <= 0) {
      errors['unitPrice'] = 'Enter the reinvestment price per unit.';
    }
    if (mode == DividendMode.partial) {
      final amount = reinvestedAmount.trim();
      if (!ok(amount) || (D.compare(amount, '0') ?? 0) <= 0) {
        errors['reinvestedAmount'] = 'Enter the amount being reinvested.';
      } else if (net != null && (D.compare(amount, net) ?? 0) >= 0) {
        errors['reinvestedAmount'] =
            'Must be less than the net dividend. Reinvest all of it with '
            '“Reinvest all” instead.';
      }
    }
  }
  return errors;
}

TradePreview previewTrade({
  required TradeSide side,
  required String quantity,
  required String unitPrice,
  required String fees,
  String? accountFxRate,
}) {
  final normalizedFees = fees.trim().isEmpty ? '0' : fees.trim();
  final gross = D.multiply(quantity.trim(), unitPrice.trim());
  // A buy adds fees to what you pay; a sell takes them out of what you receive.
  final assetTotal = gross == null
      ? null
      : side == TradeSide.buy
      ? D.add(gross, normalizedFees)
      : D.subtract(gross, normalizedFees);
  final accountTotal = assetTotal == null
      ? null
      : accountFxRate == null || accountFxRate.trim().isEmpty
      ? assetTotal
      : D.multiply(assetTotal, accountFxRate.trim());
  return TradePreview(
    grossAmount: gross,
    fees: normalizedFees,
    assetTotal: assetTotal,
    accountTotal: accountTotal,
  );
}
