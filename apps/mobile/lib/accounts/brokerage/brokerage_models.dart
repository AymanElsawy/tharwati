// Brokerage holdings + market prices — port of the web `features/holdings`
// types and `services/market-data` price shape. Decimal-safe throughout: every
// numeric column arrives as a `::text` cast so precision survives the wire.

/// The asset a holding is in (`assets` row, trimmed to what the UI needs).
class Asset {
  const Asset({
    required this.id,
    required this.name,
    required this.symbol,
    required this.exchange,
    required this.assetTypeCode,
    required this.currencyCode,
    required this.canonicalQuantityUnit,
  });

  final String id;
  final String name;
  final String? symbol;
  final String? exchange;
  final String assetTypeCode;
  final String currencyCode;
  final String? canonicalQuantityUnit;

  factory Asset.fromRow(Map<String, dynamic> row) => Asset(
    id: '${row['id']}',
    name: '${row['name']}',
    symbol: row['symbol'] as String?,
    exchange: row['exchange'] as String?,
    assetTypeCode: '${row['asset_type_code']}',
    currencyCode: '${row['currency_code']}',
    canonicalQuantityUnit: row['canonical_quantity_unit'] as String?,
  );

  /// Web `getHoldingUnit` — the unit a quantity is expressed in.
  String get quantityUnit {
    final canonical = canonicalQuantityUnit;
    if (canonical != null && canonical.isNotEmpty) return canonical;
    if (const ['stock', 'etf', 'mutual_fund', 'bond'].contains(assetTypeCode)) {
      return 'shares';
    }
    if (assetTypeCode == 'commodity' &&
        const ['XAU', 'XAG'].contains(symbol ?? '')) {
      return 'troy_ounces';
    }
    if (assetTypeCode == 'cryptocurrency') return 'coins';
    if (assetTypeCode == 'real_estate') return 'property';
    if (assetTypeCode == 'business') return 'ownership_units';
    if (assetTypeCode == 'cash_equivalent') return 'currency_amount';
    return 'units';
  }

  /// Decimal places a quantity of this unit is shown to (web
  /// `quantityPrecision`).
  int get quantityPrecision => switch (quantityUnit) {
    'coins' => 8,
    'currency_amount' => 2,
    'grams' || 'kilograms' || 'troy_ounces' => 4,
    'shares' => 6,
    _ => 4,
  };
}

/// An open position: how much of an asset an account holds and what it cost.
class Holding {
  const Holding({
    required this.id,
    required this.accountId,
    required this.assetId,
    required this.quantity,
    required this.averageCost,
    required this.totalCostBasis,
    required this.costCurrencyCode,
    required this.asset,
  });

  final String id;
  final String accountId;
  final String assetId;
  final String quantity; // decimal string
  final String? averageCost; // decimal string
  final String totalCostBasis; // decimal string
  final String costCurrencyCode;
  final Asset asset;

  factory Holding.fromRow(Map<String, dynamic> row) => Holding(
    id: '${row['id']}',
    accountId: '${row['account_id']}',
    assetId: '${row['asset_id']}',
    quantity: '${row['quantity'] ?? '0'}',
    averageCost: row['average_cost'] == null ? null : '${row['average_cost']}',
    totalCostBasis: '${row['total_cost_basis'] ?? '0'}',
    costCurrencyCode: '${row['cost_currency_code']}',
    asset: Asset.fromRow((row['asset'] as Map).cast<String, dynamic>()),
  );

  String get displayName =>
      asset.symbol?.isNotEmpty == true ? '${asset.symbol}' : asset.name;
}

/// A resolved price from the `market-prices` Edge Function.
class MarketPrice {
  const MarketPrice({
    required this.assetId,
    required this.price,
    required this.currencyCode,
    required this.effectiveAt,
    required this.provider,
    required this.priceType,
    required this.stale,
  });

  final String assetId;
  final String price; // positive decimal string
  final String currencyCode;
  final String effectiveAt;
  final String provider;
  final String? priceType;
  final bool stale;

  /// Mirrors the web `parseMarketPricesResponse` validity rules — an entry that
  /// is unavailable, unpriced, non-positive, or missing its provider /
  /// currency / timestamp is dropped rather than shown as zero.
  static MarketPrice? fromRow(Map<String, dynamic> row) {
    if (row['available'] != true) return null;
    final provider = row['provider'];
    final rawPrice = row['price'];
    if (provider is! String || provider.isEmpty || rawPrice == null) {
      return null;
    }
    final price = '$rawPrice';
    if (!RegExp(r'^\d+(\.\d+)?$').hasMatch(price) || double.parse(price) <= 0) {
      return null;
    }
    final currency = '${row['currencyCode'] ?? ''}'.trim().toUpperCase();
    if (!RegExp(r'^[A-Z]{3}$').hasMatch(currency)) return null;
    final effectiveAt = row['effectiveAt'];
    if (effectiveAt is! String || effectiveAt.isEmpty) return null;
    return MarketPrice(
      assetId: '${row['assetId']}',
      price: price,
      currencyCode: currency,
      effectiveAt: effectiveAt,
      provider: provider,
      priceType: row['priceType'] as String?,
      stale: row['stale'] == true,
    );
  }
}

/// An external search hit (`asset-search` Edge Function), before it is resolved
/// into a real `assets` row.
class AssetSearchResult {
  const AssetSearchResult({
    required this.symbol,
    required this.name,
    required this.micCode,
    required this.exchange,
    required this.country,
    required this.currencyCode,
    required this.instrumentType,
  });

  final String symbol;
  final String name;
  final String micCode;
  final String exchange;
  final String country;
  final String currencyCode;
  final String instrumentType;

  /// Every field must be a non-empty string and the provider must be the one
  /// the resolve RPC understands, else the hit is dropped (web
  /// `normalizeResult`).
  static AssetSearchResult? fromRow(Map<String, dynamic> row) {
    if (row['provider'] != 'twelve_data') return null;
    String? str(String key) {
      final value = row[key];
      if (value is! String || value.trim().isEmpty) return null;
      return value.trim();
    }

    final symbol = str('symbol');
    final name = str('name');
    final micCode = str('micCode');
    final exchange = str('exchange');
    final country = str('country');
    final instrumentType = str('instrumentType');
    final currency = str('currencyCode')?.toUpperCase();
    if (symbol == null ||
        name == null ||
        micCode == null ||
        exchange == null ||
        country == null ||
        instrumentType == null ||
        currency == null ||
        !RegExp(r'^[A-Z]{3}$').hasMatch(currency)) {
      return null;
    }
    return AssetSearchResult(
      symbol: symbol,
      name: name,
      micCode: micCode.toUpperCase(),
      exchange: exchange,
      country: country,
      currencyCode: currency,
      instrumentType: instrumentType,
    );
  }
}

/// Buy / sell form state.
enum TradeSide { buy, sell }

class TradeFormValues {
  TradeFormValues({
    required this.side,
    this.assetId = '',
    this.quantity = '',
    this.unitPrice = '',
    this.fees = '',
    String? occurredAt,
    this.notes = '',
    this.accountFxRate,
  }) : occurredAt = occurredAt ?? DateTime.now().toIso8601String();

  TradeSide side;
  String assetId;
  String quantity;
  String unitPrice;
  String fees;
  String occurredAt;
  String notes;

  /// Only sent when the asset's currency differs from the account's.
  String? accountFxRate;
}
