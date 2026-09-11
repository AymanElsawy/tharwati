import 'package:supabase_flutter/supabase_flutter.dart';

import '../accounts_repository.dart' show AccountsException;
import 'brokerage_activity.dart';
import 'brokerage_models.dart';
import 'brokerage_valuation.dart';

/// Holdings, market prices, asset search, and the buy/sell RPCs — port of the
/// web `holdings.repository`, `services/market-data`, `services/asset-search`
/// and the `brokerage-buys` / `brokerage-sells` repositories.
///
/// Every decimal column is `::text` cast so exact precision survives the wire
/// (docs/accounts.md §2.4).
class BrokerageRepository {
  BrokerageRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  static const _holdingSelect =
      'id,account_id,asset_id,quantity::text,average_cost::text,'
      'total_cost_basis::text,cost_currency_code,'
      'asset:assets!holdings_asset_id_fkey('
      'id,name,symbol,exchange,asset_type_code,currency_code,'
      'canonical_quantity_unit)';

  /// Open positions only (`quantity > 0`), newest first — matches the web
  /// `getFilteredHoldings`.
  Future<List<Holding>> getHoldingsForAccount(String accountId) async {
    final rows = await _client
        .from('holdings')
        .select(_holdingSelect)
        .eq('account_id', accountId)
        .gt('quantity', 0)
        .order('updated_at', ascending: false);
    return [
      for (final row in rows as List)
        Holding.fromRow((row as Map).cast<String, dynamic>()),
    ];
  }

  /// The account's uninvested cash leg (`get_account_balances`).
  Future<String> getCashBalance(String accountId) async {
    final rows = await _client.rpc(
      'get_account_balances',
      params: {
        'p_account_ids': [accountId],
      },
    );
    for (final row in rows as List) {
      if ('${(row as Map)['account_id']}' == accountId) {
        return '${row['current_balance'] ?? '0'}';
      }
    }
    return '0';
  }

  /// Current prices from the `market-prices` Edge Function. Unusable quotes are
  /// dropped (see [MarketPrice.fromRow]), so a missing key means "no price"
  /// rather than "price of zero". A provider outage yields an empty map — the
  /// page still renders, with values marked unavailable.
  Future<Map<String, MarketPrice>> getPrices(List<String> assetIds) async {
    final unique = assetIds.toSet().toList();
    if (unique.isEmpty) return const {};
    try {
      final response = await _client.functions.invoke(
        'market-prices',
        body: {'assetIds': unique},
      );
      final data = response.data;
      if (data is! Map) return const {};
      final prices = data['prices'];
      if (prices is! List) return const {};
      final result = <String, MarketPrice>{};
      for (final row in prices) {
        if (row is! Map) continue;
        final price = MarketPrice.fromRow(row.cast<String, dynamic>());
        if (price != null && unique.contains(price.assetId)) {
          result[price.assetId] = price;
        }
      }
      return result;
    } catch (_) {
      // A price outage must not fail the page (web swallows
      // `market_price_unavailable` / `provider_error` the same way).
      return const {};
    }
  }

  /// External instrument search. Returns an empty list for short queries and
  /// throws only when the service itself is unreachable.
  Future<List<AssetSearchResult>> searchAssets(
    String query, {
    String? country,
  }) async {
    final normalized = query.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (normalized.length < 2) return const [];
    try {
      final response = await _client.functions.invoke(
        'asset-search',
        body: {
          'query': normalized,
          if (country != null && country.trim().isNotEmpty)
            'country': country.trim(),
        },
      );
      final data = response.data;
      if (data is! Map || data['available'] != true) {
        throw AccountsException(_searchUnavailable);
      }
      final results = data['results'];
      if (results is! List) throw AccountsException(_searchUnavailable);
      final parsed = <AssetSearchResult>[];
      for (final row in results) {
        if (row is! Map) continue;
        final item = AssetSearchResult.fromRow(row.cast<String, dynamic>());
        if (item != null) parsed.add(item);
      }
      return _rank(parsed, normalized);
    } on AccountsException {
      rethrow;
    } catch (_) {
      throw AccountsException(_searchUnavailable);
    }
  }

  /// Web `rankAssetSearchResults` — an exact symbol match floats to the top,
  /// everything else keeps the provider's order.
  static List<AssetSearchResult> _rank(
    List<AssetSearchResult> results,
    String query,
  ) {
    final upper = query.toUpperCase();
    final indexed = [
      for (var i = 0; i < results.length; i += 1) (results[i], i),
    ];
    indexed.sort((a, b) {
      final aExact = a.$1.symbol.toUpperCase() == upper;
      final bExact = b.$1.symbol.toUpperCase() == upper;
      if (aExact != bExact) return aExact ? -1 : 1;
      return a.$2.compareTo(b.$2);
    });
    return [for (final entry in indexed) entry.$1];
  }

  /// Turns a search hit into a real `assets` row, returning its id.
  Future<String> resolveAsset(AssetSearchResult result) async {
    try {
      final data = await _client.rpc(
        'resolve_external_brokerage_asset',
        params: {
          'p_symbol': result.symbol,
          'p_name': result.name,
          'p_mic_code': result.micCode,
          'p_display_exchange': result.exchange,
          'p_country': result.country,
          'p_currency_code': result.currencyCode,
          'p_instrument_type': result.instrumentType,
        },
      );
      final row = data is List ? data.firstOrNull : data;
      if (row is! Map || row['id'] == null) {
        throw AccountsException('Couldn’t add that instrument. Try again.');
      }
      return '${row['id']}';
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  Future<void> addBuy(String accountId, TradeFormValues v) =>
      _rpc('add_brokerage_buy', {
        'p_account_id': accountId,
        'p_asset_id': v.assetId,
        'p_quantity': v.quantity.trim(),
        'p_unit_price': v.unitPrice.trim(),
        'p_occurred_at': _utc(v.occurredAt),
        'p_notes': v.notes.trim().isEmpty ? null : v.notes.trim(),
        'p_fees': v.fees.trim().isEmpty ? '0' : v.fees.trim(),
        'p_account_fx_rate': _rate(v.accountFxRate),
      });

  Future<void> addSell(String accountId, TradeFormValues v) =>
      _rpc('add_brokerage_sell', {
        'p_account_id': accountId,
        'p_asset_id': v.assetId,
        'p_quantity': v.quantity.trim(),
        'p_unit_sale_price': v.unitPrice.trim(),
        'p_occurred_at': _utc(v.occurredAt),
        'p_notes': v.notes.trim().isEmpty ? null : v.notes.trim(),
        'p_fees': v.fees.trim().isEmpty ? '0' : v.fees.trim(),
        'p_account_fx_rate': _rate(v.accountFxRate),
      });

  // ---- activity ------------------------------------------------------

  static const _activitySelect =
      'id,occurred_at,transaction_type_code,transaction_currency_code,notes,'
      'reverses_transaction_id,corrects_transaction_id,'
      'account_entries:transaction_entries!inner(account_id),'
      'transaction_entries(account_id,asset_id,quantity_delta::text,'
      'cost_basis_delta::text,account_cost_basis_delta::text,'
      'account_fx_rate::text,unit_price::text,memo,'
      'transaction_amount::text,account_amount::text,entry_side)';

  static const _activityTypes = [
    'transfer',
    'opening_position',
    'opening_position_reversal',
    'buy',
    'sell',
    'dividend',
  ];

  /// Every posted transaction touching this account, newest first. The asset
  /// rows are fetched separately and joined in memory — the same two-step the
  /// web repository does, because the entry→asset relation is not exposed as an
  /// embeddable join here.
  Future<List<ActivityItem>> getActivity(String accountId) async {
    final rows = await _client
        .from('financial_transactions')
        .select(_activitySelect)
        .eq('status', 'posted')
        .inFilter('transaction_type_code', _activityTypes)
        .eq('account_entries.account_id', accountId)
        .order('occurred_at', ascending: false)
        .order('id', ascending: false);

    final list = rows as List;
    final assetIds = <String>{
      for (final row in list)
        for (final entry
            in ((row as Map)['transaction_entries'] as List? ?? const []))
          if ((entry as Map)['asset_id'] != null) '${entry['asset_id']}',
    };

    final assetsById = <String, ActivityAsset>{};
    if (assetIds.isNotEmpty) {
      final assets = await _client
          .from('assets')
          .select('id,name,symbol,exchange,currency_code')
          .inFilter('id', assetIds.toList());
      for (final asset in assets as List) {
        final parsed = ActivityAsset.fromRow(
          (asset as Map).cast<String, dynamic>(),
        );
        assetsById[parsed.id] = parsed;
      }
    }

    return [
      for (final row in list)
        ActivityItem.fromRow((row as Map).cast<String, dynamic>(), assetsById),
    ];
  }

  /// The buy / sell / opening-position history for one position.
  Future<List<ActivityItem>> getHoldingHistory(
    String accountId,
    String assetId,
  ) async {
    final all = await getActivity(accountId);
    return [
      for (final item in all)
        if (item.transactionTypeCode != 'transfer' &&
            item.entries.any((e) => e.assetId == assetId))
          item,
    ];
  }

  // ---- dividends -----------------------------------------------------

  /// Cash, fully-reinvested, or partially-reinvested — three RPCs sharing one
  /// payload (web `BrokerageDividendDialog.save`).
  Future<void> addDividend({
    required String accountId,
    required String assetId,
    required DividendMode mode,
    required String gross,
    required String tax,
    required String fees,
    required String occurredAt,
    String? notes,
    String? unitPrice,
    String? reinvestedAmount,
  }) {
    final base = {
      'p_account_id': accountId,
      'p_asset_id': assetId,
      'p_gross_dividend': gross.trim(),
      'p_withholding_tax': tax.trim().isEmpty ? '0' : tax.trim(),
      'p_fees': fees.trim().isEmpty ? '0' : fees.trim(),
      'p_occurred_at': _utc(occurredAt),
      'p_notes': notes == null || notes.trim().isEmpty ? null : notes.trim(),
    };
    return switch (mode) {
      DividendMode.cash => _rpc('add_brokerage_cash_dividend', base),
      DividendMode.full => _rpc('add_brokerage_dividend_reinvestment', {
        ...base,
        'p_unit_price': unitPrice?.trim(),
      }),
      DividendMode.partial =>
        _rpc('add_brokerage_partial_dividend_reinvestment', {
          ...base,
          'p_reinvested_amount': reinvestedAmount?.trim(),
          'p_unit_price': unitPrice?.trim(),
        }),
    };
  }

  // ---- existing-holding corrections -----------------------------------

  Future<void> reverseExistingHolding(String transactionId) =>
      _rpc('reverse_existing_holding', {'p_transaction_id': transactionId});

  Future<void> correctExistingHolding({
    required String originalTransactionId,
    required String quantity,
    required String averageCost,
    required String occurredAt,
    String? notes,
    String? accountFxRate,
  }) => _rpc('correct_existing_holding', {
    'p_original_transaction_id': originalTransactionId,
    'p_quantity': quantity.trim(),
    'p_average_cost': averageCost.trim(),
    'p_occurred_at': _utc(occurredAt),
    'p_notes': notes == null || notes.trim().isEmpty ? null : notes.trim(),
    'p_account_fx_rate': _rate(accountFxRate),
  });

  static String? _rate(String? value) =>
      value == null || value.trim().isEmpty ? null : value.trim();

  static String _utc(String local) =>
      DateTime.parse(local).toUtc().toIso8601String();

  Future<void> _rpc(String fn, Map<String, dynamic> params) async {
    try {
      await _client.rpc(fn, params: params);
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  static const _searchUnavailable =
      'Instrument search is temporarily unavailable. Please try again.';

  static String _friendly(PostgrestException e) {
    final m = e.message.toLowerCase();
    if (m.contains('insufficient') && m.contains('quantity')) {
      return 'You don’t hold enough of this asset to sell that quantity.';
    }
    if (m.contains('insufficient')) {
      return 'This account doesn’t have enough available cash.';
    }
    if (m.contains('currency') && m.contains('rate')) {
      return 'This trade is in a different currency — enter the exchange rate '
          'to continue.';
    }
    if (m.contains('quantity must be positive')) {
      return 'Enter a quantity greater than zero.';
    }
    if (m.contains('does not exist') || m.contains('not found')) {
      return 'That asset or account is no longer available.';
    }
    if (e.code == '42501') return 'You don’t have permission to do that.';
    return 'Couldn’t record the trade. Please try again.';
  }
}
