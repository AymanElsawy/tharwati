import '../core/decimals.dart';
import '../core/securities_allocation.dart';
import 'portfolio_models.dart';

PortfolioAnalysis valuePortfolio(
  PortfolioSource source, {
  String scopeId = allBrokerageAccountsScope,
}) {
  final accounts = scopeId == allBrokerageAccountsScope
      ? source.accounts
      : source.accounts.where((account) => account.id == scopeId).toList();
  if (scopeId != allBrokerageAccountsScope && accounts.isEmpty) {
    throw ArgumentError.value(scopeId, 'scopeId', 'Unknown Brokerage account');
  }
  final accountIds = accounts.map((account) => account.id).toSet();
  final holdings = source.holdings
      .where((holding) => accountIds.contains(holding.accountId))
      .toList();
  final unavailablePrices = <String>{};
  final unavailableFx = <String>{};
  var stalePrice = false;
  var staleFx = false;

  String? convert(String amount, String from) {
    if (from == source.baseCurrencyCode) return D.normalize(amount);
    final pair = '$from/${source.baseCurrencyCode}';
    final fx = source.fxRatesByPair[pair];
    if (fx == null) {
      unavailableFx.add(pair);
      return null;
    }
    staleFx |= fx.stale;
    return D.multiply(amount, fx.rate);
  }

  final values = <PortfolioHoldingValue>[];
  for (final holding in holdings) {
    final price = source.pricesByAssetId[holding.assetId];
    if (price == null) unavailablePrices.add(holding.assetId);
    stalePrice |= price?.stale ?? false;
    final nativeMarket = price == null
        ? null
        : D.multiply(holding.quantity, price.price);
    final market = nativeMarket == null
        ? null
        : convert(nativeMarket, price!.currencyCode);
    final cost = convert(holding.totalCostBasis, holding.costCurrencyCode);
    final gain = market == null || cost == null
        ? null
        : D.subtract(market, cost);
    final returnPercent = gain == null || !D.isPositive(cost)
        ? null
        : D.multiply(D.divide(gain, cost, scale: 10), '100');
    values.add(
      PortfolioHoldingValue(
        holding: holding,
        price: price,
        marketValueBase: market,
        costBasisBase: cost,
        unrealizedGainLossBase: gain,
        unrealizedReturnPercent: returnPercent,
        priceStale: price?.stale ?? false,
        fxStale:
            (price != null &&
                price.currencyCode != source.baseCurrencyCode &&
                (source
                        .fxRatesByPair['${price.currencyCode}/${source.baseCurrencyCode}']
                        ?.stale ??
                    false)) ||
            (holding.costCurrencyCode != source.baseCurrencyCode &&
                (source
                        .fxRatesByPair['${holding.costCurrencyCode}/${source.baseCurrencyCode}']
                        ?.stale ??
                    false)),
      ),
    );
  }
  final allHoldingsValid = values.every((value) => value.isComplete);
  final invested = allHoldingsValid
      ? D.sum(values.map((value) => value.marketValueBase))
      : null;
  final cost = allHoldingsValid
      ? D.sum(values.map((value) => value.costBasisBase))
      : null;
  final gain = invested == null || cost == null
      ? null
      : D.subtract(invested, cost);
  final returnPercent = gain == null || !D.isPositive(cost)
      ? null
      : D.multiply(D.divide(gain, cost, scale: 10), '100');

  String? cashFor(Iterable<dynamic> scopedAccounts) {
    final converted = <String?>[];
    for (final account in scopedAccounts) {
      final cash = source.availableCashByAccountId[account.id];
      if (cash == null) return null;
      converted.add(convert(cash, account.currencyCode));
    }
    return D.sum(converted);
  }

  final cash = cashFor(accounts);
  final current = invested == null || cash == null
      ? null
      : D.add(invested, cash);
  final groups = <PortfolioAccountGroup>[];
  for (final account in accounts) {
    final accountValues = values
        .where((value) => value.holding.accountId == account.id)
        .toList();
    final complete = accountValues.every((value) => value.isComplete);
    final accountInvested = complete
        ? D.sum(accountValues.map((value) => value.marketValueBase))
        : null;
    final accountCash = cashFor([account]);
    groups.add(
      PortfolioAccountGroup(
        account: account,
        holdings: accountValues,
        availableCashBase: accountCash,
        investedMarketValueBase: accountInvested,
        currentValueBase: accountInvested == null || accountCash == null
            ? null
            : D.add(accountInvested, accountCash),
      ),
    );
  }
  final valid = values.where((value) => value.isComplete).length;
  final coverage = accounts.isEmpty
      ? PortfolioCoverage.noBrokerageAccounts
      : values.isEmpty
      ? PortfolioCoverage.empty
      : valid == values.length
      ? PortfolioCoverage.complete
      : valid == 0
      ? PortfolioCoverage.unavailable
      : PortfolioCoverage.partial;
  return PortfolioAnalysis(
    baseCurrencyCode: source.baseCurrencyCode,
    scopeId: scopeId,
    accounts: source.accounts,
    accountGroups: groups,
    holdings: values,
    coverage: coverage,
    validHoldingCount: valid,
    totalHoldingCount: values.length,
    investedMarketValueBase: invested,
    costBasisBase: cost,
    unrealizedGainLossBase: gain,
    unrealizedReturnPercent: returnPercent,
    availableCashBase: cash,
    currentValueBase: current,
    allocation: allHoldingsValid
        ? calculateSecuritiesAllocation(
            values.map(
              (value) => SecuritiesAllocationValue(
                value.holding.asset.assetTypeCode,
                value.marketValueBase!,
              ),
            ),
          )
        : const [],
    hasStalePrice: stalePrice,
    hasStaleFx: staleFx,
    unavailablePriceAssetIds: unavailablePrices,
    unavailableFxPairs: unavailableFx,
    fxRatesByPair: Map.unmodifiable(source.fxRatesByPair),
  );
}
