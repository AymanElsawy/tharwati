import 'dart:async';

import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_models.dart';
import 'package:tharwati_mobile/portfolio/portfolio_models.dart';
import 'package:tharwati_mobile/portfolio/portfolio_repository.dart';

Account account(
  String id, {
  AccountType type = AccountType.brokerage,
  String currency = 'USD',
  bool active = true,
}) => Account(
  id: id,
  type: type,
  name: id,
  currencyCode: currency,
  openingBalance: '0',
  isActive: active,
  notes: null,
  bankSubtype: null,
  creditCardLimit: null,
  dueDayOfMonth: null,
  investmentType: null,
  balanceGrams: null,
  propertyType: null,
  ownershipPercentage: null,
  businessType: null,
  industry: null,
  location: null,
  metalType: null,
  purity: null,
  purchaseDate: null,
  costPerUnit: null,
  closedReason: null,
  closedOn: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
);

Holding holding(
  String id,
  String accountId, {
  String quantity = '2',
  String cost = '10',
  String costCurrency = 'USD',
  String assetCurrency = 'USD',
  String assetType = 'stock',
}) => Holding(
  id: id,
  accountId: accountId,
  assetId: 'asset-$id',
  quantity: quantity,
  averageCost: null,
  totalCostBasis: cost,
  costCurrencyCode: costCurrency,
  asset: Asset(
    id: 'asset-$id',
    name: id,
    symbol: id,
    exchange: 'X',
    assetTypeCode: assetType,
    currencyCode: assetCurrency,
    canonicalQuantityUnit: 'shares',
  ),
);

MarketPrice price(
  String id, {
  String value = '10',
  String currency = 'USD',
  bool stale = false,
}) => MarketPrice(
  assetId: 'asset-$id',
  price: value,
  currencyCode: currency,
  effectiveAt: '2026-09-18',
  provider: 'test',
  priceType: 'close',
  stale: stale,
);

PortfolioFxRate fx(
  String from,
  String to,
  String rate, {
  bool stale = false,
  String direction = 'direct',
}) => PortfolioFxRate(
  fromCurrencyCode: from,
  toCurrencyCode: to,
  rate: rate,
  provider: 'test',
  effectiveAt: '2026-09-18',
  stale: stale,
  direction: direction,
);

PortfolioSource source({
  String base = 'USD',
  List<Account>? accounts,
  List<Holding>? holdings,
  Map<String, String>? cash,
  Map<String, MarketPrice>? prices,
  Map<String, PortfolioFxRate>? rates,
}) => PortfolioSource(
  baseCurrencyCode: base,
  accounts: accounts ?? [account('broker')],
  holdings: holdings ?? [holding('one', 'broker')],
  availableCashByAccountId: cash ?? {'broker': '5'},
  pricesByAssetId: prices ?? {'asset-one': price('one')},
  fxRatesByPair: rates ?? const {},
);

class FakeSource implements PortfolioDataSource {
  String? base = 'USD';
  List<Account> accounts = [];
  List<Holding> holdings = [];
  Map<String, String> cash = {};
  Map<String, MarketPrice> prices = {};
  Map<String, PortfolioFxRate> rates = {};

  @override
  Future<String?> loadBaseCurrency() async => base;
  @override
  Future<List<Account>> loadAccounts() async => accounts;
  @override
  Future<List<Holding>> loadHoldings(List<String> accountIds) async => holdings;
  @override
  Future<Map<String, String>> loadAvailableCash(
    List<String> accountIds,
  ) async => cash;
  @override
  Future<Map<String, MarketPrice>> loadPrices(List<String> assetIds) async =>
      prices;
  @override
  Future<PortfolioFxRate?> loadFxRate(String from, String to) async =>
      rates['$from/$to'];
}

class QueueLoader implements PortfolioLoader {
  final List<Completer<PortfolioSource>> requests = [];
  @override
  Future<PortfolioSource> load() {
    final request = Completer<PortfolioSource>();
    requests.add(request);
    return request.future;
  }
}
