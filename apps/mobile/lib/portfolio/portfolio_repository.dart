import 'package:supabase_flutter/supabase_flutter.dart';

import '../accounts/account_models.dart';
import '../accounts/brokerage/brokerage_models.dart';
import '../core/decimals.dart';
import '../core/read_deadline.dart';
import 'portfolio_models.dart';

abstract interface class PortfolioDataSource {
  Future<String?> loadBaseCurrency();
  Future<List<Account>> loadAccounts();
  Future<List<Holding>> loadHoldings(List<String> accountIds);
  Future<Map<String, String>> loadAvailableCash(List<String> accountIds);
  Future<Map<String, MarketPrice>> loadPrices(List<String> assetIds);
  Future<PortfolioFxRate?> loadFxRate(String from, String to);
}

abstract interface class PortfolioLoader {
  Future<PortfolioSource> load();
}

class PortfolioRepository implements PortfolioLoader {
  PortfolioRepository([PortfolioDataSource? source])
    : _source = source ?? SupabasePortfolioDataSource();
  final PortfolioDataSource _source;

  @override
  Future<PortfolioSource> load() async {
    final results = await Future.wait([
      _source.loadBaseCurrency(),
      _source.loadAccounts(),
    ]);
    final base = results[0] as String?;
    if (base == null || base.isEmpty) {
      throw StateError('Portfolio requires a base currency');
    }
    final accounts = (results[1] as List<Account>)
        .where(
          (account) =>
              account.isActive && account.type == AccountType.brokerage,
        )
        .toList();
    final ids = accounts.map((account) => account.id).toList();
    if (ids.isEmpty) {
      return PortfolioSource(
        baseCurrencyCode: base,
        accounts: const [],
        holdings: const [],
        availableCashByAccountId: const {},
        pricesByAssetId: const {},
        fxRatesByPair: const {},
      );
    }
    final loaded = await Future.wait([
      _source.loadHoldings(ids),
      _source.loadAvailableCash(ids),
    ]);
    final idSet = ids.toSet();
    final holdings = (loaded[0] as List<Holding>)
        .where(
          (holding) =>
              idSet.contains(holding.accountId) &&
              D.isPositive(holding.quantity),
        )
        .toList();
    final cash = loaded[1] as Map<String, String>;
    final prices = await _source.loadPrices(
      holdings.map((holding) => holding.assetId).toSet().toList(),
    );
    final currencies = <String>{
      for (final account in accounts) account.currencyCode,
      for (final holding in holdings) holding.costCurrencyCode,
      for (final holding in holdings)
        if (prices[holding.assetId] != null)
          prices[holding.assetId]!.currencyCode,
    }..remove(base);
    final fx = await Future.wait(
      currencies.map((currency) => _source.loadFxRate(currency, base)),
    );
    final fxByPair = <String, PortfolioFxRate>{};
    for (final rate in fx) {
      if (rate != null) fxByPair[rate.pair] = rate;
    }
    return PortfolioSource(
      baseCurrencyCode: base,
      accounts: accounts,
      holdings: holdings,
      availableCashByAccountId: {
        for (final entry in cash.entries)
          if (idSet.contains(entry.key) && D.normalize(entry.value) != null)
            entry.key: D.normalize(entry.value)!,
      },
      pricesByAssetId: prices,
      fxRatesByPair: fxByPair,
    );
  }
}

class SupabasePortfolioDataSource implements PortfolioDataSource {
  SupabasePortfolioDataSource([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;
  final SupabaseClient _client;

  static const _holdingSelect =
      'id,account_id,asset_id,quantity::text,average_cost::text,'
      'total_cost_basis::text,cost_currency_code,'
      'asset:assets!holdings_asset_id_fkey('
      'id,name,symbol,exchange,asset_type_code,currency_code,'
      'canonical_quantity_unit)';

  @override
  Future<String?> loadBaseCurrency() async {
    final user = _client.auth.currentUser;
    if (user == null) return null;
    final row = await _client
        .from('profiles')
        .select('base_currency_code')
        .eq('id', user.id)
        .single();
    final code = '${row['base_currency_code'] ?? ''}'.trim().toUpperCase();
    return code.isEmpty ? null : code;
  }

  @override
  Future<List<Account>> loadAccounts() async {
    final rows = await _client
        .from('financial_accounts')
        .select()
        .eq('is_active', true);
    return [
      for (final row in rows as List)
        Account.fromRow((row as Map).cast<String, dynamic>()),
    ];
  }

  @override
  Future<List<Holding>> loadHoldings(List<String> accountIds) async {
    if (accountIds.isEmpty) return const [];
    final rows = await _client
        .from('holdings')
        .select(_holdingSelect)
        .inFilter('account_id', accountIds)
        .gt('quantity', 0);
    return [
      for (final row in rows as List)
        Holding.fromRow((row as Map).cast<String, dynamic>()),
    ];
  }

  @override
  Future<Map<String, String>> loadAvailableCash(List<String> accountIds) async {
    if (accountIds.isEmpty) return const {};
    final rows = await _client.rpc(
      'get_account_balances',
      params: {'p_account_ids': accountIds},
    );
    return {
      for (final row in rows as List)
        if (D.normalize('${(row as Map)['current_balance']}') != null)
          '${row['account_id']}': D.normalize('${row['current_balance']}')!,
    };
  }

  @override
  Future<Map<String, MarketPrice>> loadPrices(List<String> assetIds) async {
    if (assetIds.isEmpty) return const {};
    try {
      final response = await readWithDeadline(
        marketReadDeadline,
        (abort) => _client.functions.invoke(
          'market-prices',
          body: {'assetIds': assetIds},
          abortSignal: abort,
        ),
      );
      final data = response.data;
      if (data is! Map || data['prices'] is! List) return const {};
      final result = <String, MarketPrice>{};
      for (final row in data['prices'] as List) {
        if (row is! Map) continue;
        final price = MarketPrice.fromRow(row.cast<String, dynamic>());
        if (price != null && assetIds.contains(price.assetId)) {
          result[price.assetId] = price;
        }
      }
      return result;
    } on ReadTimeoutException {
      rethrow;
    } on ReadAbortedException {
      rethrow;
    } catch (_) {
      return const {};
    }
  }

  @override
  Future<PortfolioFxRate?> loadFxRate(String from, String to) async {
    try {
      final response = await readWithDeadline(
        marketReadDeadline,
        (abort) => _client.functions.invoke(
          'fx-rates',
          body: {
            'fromCurrencyCode': from,
            'toCurrencyCode': to,
            'mode': 'current',
          },
          abortSignal: abort,
        ),
      );
      final data = response.data;
      if (data is! Map || data['available'] != true) return null;
      final rate = D.normalize('${data['rate']}');
      final provider = data['provider'];
      final effectiveAt = data['effectiveAt'];
      if (!D.isPositive(rate) ||
          provider is! String ||
          effectiveAt is! String) {
        return null;
      }
      return PortfolioFxRate(
        fromCurrencyCode: from,
        toCurrencyCode: to,
        rate: rate!,
        provider: provider,
        effectiveAt: effectiveAt,
        stale: data['stale'] == true,
        direction: data['direction'] as String?,
      );
    } on ReadTimeoutException {
      rethrow;
    } on ReadAbortedException {
      rethrow;
    } catch (_) {
      return null;
    }
  }
}
