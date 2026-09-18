import '../accounts/account_models.dart';
import '../accounts/brokerage/brokerage_models.dart';
import '../core/securities_allocation.dart';

const allBrokerageAccountsScope = 'all';

class PortfolioFxRate {
  const PortfolioFxRate({
    required this.fromCurrencyCode,
    required this.toCurrencyCode,
    required this.rate,
    required this.provider,
    required this.effectiveAt,
    required this.stale,
    this.direction,
  });
  final String fromCurrencyCode;
  final String toCurrencyCode;
  final String rate;
  final String provider;
  final String effectiveAt;
  final bool stale;
  final String? direction;
  String get pair => '$fromCurrencyCode/$toCurrencyCode';
}

class PortfolioSource {
  const PortfolioSource({
    required this.baseCurrencyCode,
    required this.accounts,
    required this.holdings,
    required this.availableCashByAccountId,
    required this.pricesByAssetId,
    required this.fxRatesByPair,
  });
  final String baseCurrencyCode;
  final List<Account> accounts;
  final List<Holding> holdings;
  final Map<String, String> availableCashByAccountId;
  final Map<String, MarketPrice> pricesByAssetId;
  final Map<String, PortfolioFxRate> fxRatesByPair;
}

enum PortfolioCoverage {
  noBrokerageAccounts,
  empty,
  complete,
  partial,
  unavailable,
}

class PortfolioHoldingValue {
  const PortfolioHoldingValue({
    required this.holding,
    required this.price,
    required this.marketValueBase,
    required this.costBasisBase,
    required this.unrealizedGainLossBase,
    required this.unrealizedReturnPercent,
    required this.priceStale,
    required this.fxStale,
  });
  final Holding holding;
  final MarketPrice? price;
  final String? marketValueBase;
  final String? costBasisBase;
  final String? unrealizedGainLossBase;
  final String? unrealizedReturnPercent;
  final bool priceStale;
  final bool fxStale;
  bool get isComplete => marketValueBase != null && costBasisBase != null;
}

class PortfolioAccountGroup {
  const PortfolioAccountGroup({
    required this.account,
    required this.holdings,
    required this.availableCashBase,
    required this.investedMarketValueBase,
    required this.currentValueBase,
  });
  final Account account;
  final List<PortfolioHoldingValue> holdings;
  final String? availableCashBase;
  final String? investedMarketValueBase;
  final String? currentValueBase;
}

class PortfolioAnalysis {
  const PortfolioAnalysis({
    required this.baseCurrencyCode,
    required this.scopeId,
    required this.accounts,
    required this.accountGroups,
    required this.holdings,
    required this.coverage,
    required this.validHoldingCount,
    required this.totalHoldingCount,
    required this.investedMarketValueBase,
    required this.costBasisBase,
    required this.unrealizedGainLossBase,
    required this.unrealizedReturnPercent,
    required this.availableCashBase,
    required this.currentValueBase,
    required this.allocation,
    required this.hasStalePrice,
    required this.hasStaleFx,
    required this.unavailablePriceAssetIds,
    required this.unavailableFxPairs,
    required this.fxRatesByPair,
  });
  final String baseCurrencyCode;
  final String scopeId;
  final List<Account> accounts;
  final List<PortfolioAccountGroup> accountGroups;
  final List<PortfolioHoldingValue> holdings;
  final PortfolioCoverage coverage;
  final int validHoldingCount;
  final int totalHoldingCount;
  final String? investedMarketValueBase;
  final String? costBasisBase;
  final String? unrealizedGainLossBase;
  final String? unrealizedReturnPercent;
  final String? availableCashBase;
  final String? currentValueBase;
  final List<SecuritiesAllocationItem> allocation;
  final bool hasStalePrice;
  final bool hasStaleFx;
  final Set<String> unavailablePriceAssetIds;
  final Set<String> unavailableFxPairs;
  final Map<String, PortfolioFxRate> fxRatesByPair;
}
