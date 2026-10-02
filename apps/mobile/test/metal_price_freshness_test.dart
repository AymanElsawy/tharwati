import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/metal/metal_price_freshness.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_snapshot.dart';
import 'package:tharwati_mobile/i18n/accounts_copy.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/tokens.dart';

void main() {
  final old = DateTime.utc(2026, 9, 1);
  test('metal transport preserves decimal and both timestamps', () {
    final quote = MetalSpotQuote.parse({
      'symbol': 'XAU',
      'currency': 'USD',
      'provider': 'gold-api',
      'price': '4340.123456789012345678',
      'effectiveAt': old.toIso8601String(),
      'fetchedAt': old.add(const Duration(minutes: 1)).toIso8601String(),
      'timestampBasis': 'provider',
      'stale': true,
    })!;
    expect(quote.price, '4340.123456789012345678');
    expect(quote.effectiveAt, old);
    expect(quote.fetchedAt, old.add(const Duration(minutes: 1)));
    expect(quote.isStale, true);
  });
  test('stale caption never calls a stored value live', () {
    expect(
      AccountsCopy.of(AppLanguage.en).staleMetalPrice,
      'Last-known metal spot price · Stale',
    );
    expect(
      AccountsCopy.of(AppLanguage.en).liveMetalPriceCaption('gold'),
      isNot(contains('live')),
    );
    expect(AccountsCopy.of(AppLanguage.ar).staleMetalPrice, contains('قديم'));
  });
  test(
    'Dashboard transports optional metal provenance without changing values',
    () {
      final snapshot = DashboardSnapshot.parse({
        'asOf': old.toIso8601String(),
        'expiresAt': old.add(const Duration(minutes: 15)).toIso8601String(),
        'freshness': 'stale',
        'currentValues': {'gold': '200'},
        'accountBalances': {},
        'rates': {},
        'unavailableSources': [],
        'metalQuotes': {
          'XAU': {
            'symbol': 'XAU',
            'price': '3110.347680000000000001',
            'currency': 'USD',
            'provider': 'gold-api',
            'effectiveAt': old.toIso8601String(),
            'fetchedAt': old.toIso8601String(),
            'timestampBasis': 'provider',
            'stale': true,
          },
        },
      });
      expect(snapshot.currentValues['gold'], '200');
      expect(snapshot.metalQuotes['XAU']!.price, '3110.347680000000000001');
      expect(snapshot.metalQuotes['XAU']!.isStale, true);
    },
  );
  testWidgets(
    'stale warning uses semantic warning color, preserving metal styling',
    (tester) async {
      final quote = MetalSpotQuote(
        price: '4340',
        effectiveAt: old,
        fetchedAt: old,
        providerStale: true,
      );
      final language = AppLanguageController();
      addTearDown(language.dispose);
      await tester.pumpWidget(
        AppLanguageScope(
          controller: language,
          child: MaterialApp(
            theme: ThemeData(extensions: [AppColors.light]),
            home: Scaffold(body: MetalPriceFreshness(quote: quote)),
          ),
        ),
      );
      final label = find.textContaining('Last-known metal spot price · Stale');
      expect(label, findsOneWidget);
      expect(
        tester.widget<Text>(label).style!.color,
        AppColors.light.warningFg,
      );
      expect(
        tester.widget<Text>(label).style!.color,
        isNot(AppColors.light.metal),
      );
    },
  );
  testWidgets('fresh quote has no stale warning', (tester) async {
    final now = DateTime.now();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MetalPriceFreshness(
            quote: MetalSpotQuote(
              price: '4340',
              effectiveAt: now,
              fetchedAt: now,
              providerStale: false,
            ),
          ),
        ),
      ),
    );
    expect(find.textContaining('Stale'), findsNothing);
  });
}
