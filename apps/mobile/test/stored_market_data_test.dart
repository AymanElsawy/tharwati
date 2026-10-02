import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_repository.dart';
import 'package:tharwati_mobile/core/stored_market_data.dart';
import 'package:tharwati_mobile/portfolio/portfolio_repository.dart';

void main() {
  late SupabaseClient client;
  late List<Map<String, dynamic>> prices;
  late List<Map<String, dynamic>> rates;
  final old = DateTime.now()
      .toUtc()
      .subtract(const Duration(days: 10))
      .toIso8601String();
  setUp(() {
    prices = [];
    rates = [];
    client = SupabaseClient(
      'http://127.0.0.1:58321',
      'fixture-only',
      httpClient: MockClient((request) async {
        if (request.url.path.startsWith('/functions/')) {
          return http.Response(
            '{"error":"fixture service unavailable"}',
            503,
            request: request,
          );
        }
        final query = request.url.queryParameters;
        List<Map<String, dynamic>> rows;
        if (request.url.path.endsWith('/assets')) {
          rows = [
            {'id': 'asset', 'currency_code': 'USD'},
          ];
        } else if (request.url.path.endsWith('/market_prices')) {
          rows = prices
              .where((row) => query['provider'] == 'eq.${row['provider']}')
              .toList();
        } else if (request.url.path.endsWith('/exchange_rates')) {
          rows = rates
              .where(
                (row) =>
                    query['base_currency_code'] ==
                        'eq.${row['base_currency_code']}' &&
                    query['quote_currency_code'] ==
                        'eq.${row['quote_currency_code']}' &&
                    query['provider'] ==
                        (row['provider'] == null
                            ? 'is.null'
                            : 'eq.${row['provider']}'),
              )
              .toList();
        } else {
          throw StateError('Unexpected fixture request ${request.url.path}');
        }
        return http.Response(
          jsonEncode(rows),
          200,
          request: request,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
  });
  tearDown(() => client.dispose());

  Map<String, dynamic> price(String provider) => {
    'asset_id': 'asset',
    'provider': provider,
    'price': '123.1234567890',
    'currency_code': 'USD',
    'as_of': old,
    'fetched_at': old,
    'price_type': provider == 'manual' ? 'manual' : 'realtime',
  };
  Map<String, dynamic> rate(String? provider, {bool inverse = false}) => {
    'base_currency_code': inverse ? 'SAR' : 'USD',
    'quote_currency_code': inverse ? 'USD' : 'SAR',
    'provider': provider,
    'rate': inverse ? '0.25' : '3.750000000001',
    'source': provider ?? 'manual',
    'effective_at': old,
    'fetched_at': provider == null ? null : old,
  };

  test(
    'Brokerage recovers exact stale provider price after Edge 503',
    () async {
      prices = [price('twelve_data'), price('manual')];
      final result = await BrokerageRepository(client).getPrices(['asset']);
      expect(result['asset']!.price, '123.1234567890');
      expect(result['asset']!.provider, 'twelve_data');
      expect(result['asset']!.stale, isTrue);
      expect(result['asset']!.fetchedAt, old);
    },
  );
  test('Portfolio recovers manual provenance after Edge 503', () async {
    prices = [price('manual')];
    final result = await SupabasePortfolioDataSource(
      client,
    ).loadPrices(['asset']);
    expect(result['asset']!.priceType, 'manual');
    expect(result['asset']!.stale, isTrue);
  });
  test('no stored price remains absent, never zero', () async {
    expect(await BrokerageRepository(client).getPrices(['asset']), isEmpty);
  });
  test(
    'Portfolio recovers stale FX before manual and retains timestamps',
    () async {
      rates = [rate('frankfurter'), rate(null)];
      final result = await SupabasePortfolioDataSource(
        client,
      ).loadFxRate('USD', 'SAR');
      expect(result!.rate, '3.750000000001');
      expect(result.provider, 'frankfurter');
      expect(result.stale, isTrue);
      expect(result.fetchedAt, old);
    },
  );
  test('manual FX is usable and conservatively stale', () async {
    rates = [rate(null)];
    final result = await StoredMarketData(client).fx('USD', 'SAR');
    expect(result!.provider, 'manual');
    expect(result.stale, isTrue);
    expect(result.fetchedAt, isNull);
  });
  test('inverse FX uses decimal arithmetic', () async {
    rates = [rate('frankfurter', inverse: true)];
    final result = await StoredMarketData(client).fx('USD', 'SAR');
    expect(result!.rate, '4');
    expect(result.direction, 'inverse');
  });
  test('no usable FX stays unavailable; identity remains 1', () async {
    expect(await StoredMarketData(client).fx('USD', 'SAR'), isNull);
    final identity = await StoredMarketData(client).fx('SAR', 'SAR');
    expect(identity!.rate, '1');
    expect(identity.stale, isFalse);
  });
}
