import 'package:supabase_flutter/supabase_flutter.dart';
import '../accounts/brokerage/brokerage_models.dart';
import '../portfolio/portfolio_models.dart';
import 'decimals.dart';
import 'read_deadline.dart';

/// Caller-RLS recovery when Edge transport fails. Never reads ledger FX/cost.
class StoredMarketData {
  StoredMarketData(this.client);
  final SupabaseClient client;

  Future<Map<String, MarketPrice>> prices(List<String> ids) async {
    final result = <String, MarketPrice>{};
    for (var start = 0; start < ids.length; start += 100) {
      try {
        final batch = ids.skip(start).take(100).toList();
        final assets = await readWithDeadline(
          const Duration(seconds: 2),
          (abort) => client
              .from('assets')
              .select('id,currency_code')
              .inFilter('id', batch)
              .eq('is_active', true)
              .abortSignal(abort),
        );
        for (var offset = 0; offset < assets.length; offset += 12) {
          await Future.wait(
            assets.skip(offset).take(12).map((asset) async {
              final candidates = await Future.wait(
                ['twelve_data', 'manual'].map((provider) async {
                  try {
                    final row = await readWithDeadline(
                      const Duration(seconds: 2),
                      (abort) => client
                          .from('market_prices')
                          .select(
                            'asset_id,provider,price::text,currency_code,as_of,fetched_at,price_type',
                          )
                          .eq('asset_id', asset['id'])
                          .eq('provider', provider)
                          .eq('currency_code', asset['currency_code'])
                          .gt('price', 0)
                          .lte(
                            'as_of',
                            DateTime.now().toUtc().toIso8601String(),
                          )
                          .order('fetched_at', ascending: false)
                          .order('as_of', ascending: false)
                          .order('id', ascending: false)
                          .limit(1)
                          .maybeSingle()
                          .abortSignal(abort),
                    );
                    if (row == null) return null;
                    final fetched = DateTime.tryParse('${row['fetched_at']}');
                    final type = row['price_type'];
                    final stale =
                        provider == 'manual' ||
                        type == 'previous_close' ||
                        type == 'stale' ||
                        fetched == null ||
                        DateTime.now().toUtc().difference(fetched).inMinutes >=
                            15;
                    return MarketPrice.fromRow({
                      'assetId': row['asset_id'],
                      'available': true,
                      'provider': provider,
                      'price': row['price'],
                      'currencyCode': row['currency_code'],
                      'effectiveAt': row['as_of'],
                      'fetchedAt': row['fetched_at'],
                      'priceType':
                          stale && type != 'manual' && type != 'previous_close'
                          ? 'stale'
                          : type,
                      'stale': stale,
                    });
                  } catch (_) {
                    return null;
                  }
                }),
              );
              for (final price in candidates) {
                if (price != null) {
                  result[price.assetId] = price;
                  break;
                }
              }
            }),
          );
        }
      } catch (_) {
        /* No usable authorized source remains. */
      }
    }
    return result;
  }

  Future<PortfolioFxRate?> fx(String from, String to) async {
    if (from == to) {
      return PortfolioFxRate(
        fromCurrencyCode: from,
        toCurrencyCode: to,
        rate: '1',
        provider: 'identity',
        effectiveAt: DateTime.now().toUtc().toIso8601String(),
        stale: false,
      );
    }
    final candidates = await Future.wait(
      [
        (from, to, 'provider', false),
        (to, from, 'provider', true),
        (from, to, 'manual', false),
        (to, from, 'manual', true),
      ].map((candidate) async {
        try {
          var query = client
              .from('exchange_rates')
              .select('rate::text,effective_at,fetched_at,source')
              .eq('base_currency_code', candidate.$1)
              .eq('quote_currency_code', candidate.$2)
              .lte('effective_at', DateTime.now().toUtc().toIso8601String());
          query = candidate.$3 == 'manual'
              ? query.isFilter('provider', null)
              : query.eq('provider', 'frankfurter').isFilter('user_id', null);
          final row = await readWithDeadline(
            const Duration(seconds: 2),
            (abort) => query
                .order('effective_at', ascending: false)
                .order('id', ascending: false)
                .limit(1)
                .maybeSingle()
                .abortSignal(abort),
          );
          if (row == null || !D.isPositive('${row['rate']}')) return null;
          final rate = candidate.$4
              ? D.divide('1', '${row['rate']}', scale: 18)
              : D.normalize('${row['rate']}');
          if (!D.isPositive(rate)) return null;
          return PortfolioFxRate(
            fromCurrencyCode: from,
            toCurrencyCode: to,
            rate: rate!,
            provider:
                '${row['source'] ?? (candidate.$3 == 'manual' ? 'manual' : 'frankfurter')}',
            effectiveAt: '${row['effective_at']}',
            stale: true,
            direction: candidate.$4 ? 'inverse' : 'direct',
            fetchedAt: row['fetched_at'] as String?,
          );
        } catch (_) {
          return null;
        }
      }),
    );
    for (final rate in candidates) {
      if (rate != null) return rate;
    }
    return null;
  }
}
