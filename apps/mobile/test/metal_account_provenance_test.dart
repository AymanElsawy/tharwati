import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/account_detail_page.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/account_valuation.dart';
import 'package:tharwati_mobile/accounts/accounts_controller.dart';
import 'package:tharwati_mobile/accounts/accounts_repository.dart';
import 'package:tharwati_mobile/accounts/accounts_service.dart';
import 'package:tharwati_mobile/accounts/metal/metal_price_freshness.dart';
import 'package:tharwati_mobile/accounts/metal_purchases_repository.dart';
import 'package:tharwati_mobile/core/local_datetime.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_repository.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_snapshot.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/tokens.dart';

class _Service extends AccountsService {
  _Service(SupabaseClient client, this.item, {this.failDetail = false})
    : super(
        accounts: AccountsRepository(client),
        metal: MetalPurchasesRepository(client),
        dashboard: DashboardRepository(client),
      );
  final AccountItem item;
  final bool failDetail;
  @override
  Future<AccountsListModel> loadAccounts() async =>
      AccountsListModel(items: [item]);
  @override
  Future<GoldAccountDetail> loadGoldDetail(String accountId) async {
    if (failDetail) throw Exception('detail read unavailable');
    return GoldAccountDetail(
      account: item.account,
      purchases: [
        MetalPurchase.fromRow({
          'id': 'purchase',
          'account_id': accountId,
          'purity': item.account.metalType == 'gold' ? '24k' : '925',
          'quantity_grams': item.account.metalType == 'gold' ? '2' : '3',
          'cost_per_unit': '5',
          'fees': '0',
          'funding_mode': 'external',
          'purchased_at': '2026-09-01T00:00:00Z',
          'created_at': '2026-09-01T00:00:00Z',
        }),
      ],
      currentValue: item.value,
      pricePerGram: item.account.metalType == 'gold' ? '100' : '1',
      // The list snapshot already supplies provenance: detail metadata may be absent.
    );
  }
}

void main() {
  for (final colors in [AppColors.light, AppColors.dark]) {
    for (final metal in ['gold', 'silver']) {
      for (final stale in [false, true]) {
        testWidgets(
          '$metal ${colors.isDark ? 'Dark' : 'Light'} ${stale ? 'stale' : 'fresh'} account caption',
          (tester) async {
            await _pump(tester, colors, metal, stale);
            final caption = find.byType(MetalPriceCaption);
            final text = find.descendant(
              of: caption,
              matching: find.text(
                stale
                    ? 'Last-known metal spot price · Stale'
                    : 'Weight × the $metal spot price',
              ),
            );
            expect(text, findsOneWidget);
            expect(
              tester
                  .getRect(text)
                  .overlaps(tester.getRect(find.byType(Scaffold))),
              true,
            );
            expect(
              tester.widget<Text>(text).style!.color,
              stale ? colors.warningFg : colors.inkMuted,
            );
            expect(
              find.textContaining(RegExp(r'\blive\b', caseSensitive: false)),
              findsNothing,
            );
            if (stale) {
              final time = formatLocalDateTime('2026-09-01T00:00:00Z');
              expect(find.text('${time.date} ${time.time}'), findsOneWidget);
            } else {
              expect(
                find.text('Last-known metal spot price · Stale'),
                findsNothing,
              );
            }
            expect(
              find.text(metal == 'gold' ? '200.00 USD' : '2.78 USD'),
              findsWidgets,
            );
            final gain = find.textContaining(
              metal == 'gold' ? '+190.00 USD' : '-12.23 USD',
            );
            expect(gain, findsOneWidget);
            expect(
              tester.widget<Text>(gain).style!.color,
              metal == 'gold' ? colors.positive : colors.negative,
            );
          },
        );
      }
      testWidgets(
        '$metal ${colors.isDark ? 'Dark' : 'Light'} stale provenance survives secondary detail failure',
        (tester) async {
          await _pump(tester, colors, metal, true, failDetail: true);
          expect(
            find.text('Last-known metal spot price · Stale'),
            findsOneWidget,
          );
          expect(
            find.text(metal == 'gold' ? '200.00 USD' : '2.78 USD'),
            findsOneWidget,
          );
          expect(
            find.textContaining(RegExp(r'\blive\b', caseSensitive: false)),
            findsNothing,
          );
        },
      );
    }
  }
}

Future<void> _pump(
  WidgetTester tester,
  AppColors colors,
  String metal,
  bool stale, {
  bool failDetail = false,
}) async {
  // Keep unrelated pre-existing purchase/gain row wrapping out of these copy tests.
  tester.view.physicalSize = const Size(800, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final client = (await tester.runAsync(
    () async => SupabaseClient(
      'http://127.0.0.1:58321',
      'test-key',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    ),
  ))!;
  addTearDown(() => tester.runAsync(client.dispose));
  final when = stale ? DateTime.utc(2026, 9, 1) : DateTime.now();
  final item = AccountItem(
    account: Account.fromRow({
      'id': 'metal',
      'account_type_code': 'gold',
      'name': metal,
      'metal_type': metal,
      'currency_code': 'USD',
      'opening_balance': '0',
      'is_active': true,
      'created_at': '2026-09-01T00:00:00Z',
    }),
    value: ResolvedValue(
      metal == 'gold' ? '200' : '2.775',
      CurrentValueSource.snapshot,
    ),
    lifecycle: null,
    spotQuote: MetalSpotQuote(
      price: '1',
      effectiveAt: when,
      fetchedAt: when,
      providerStale: stale,
    ),
  );
  final controller = AccountsController(
    service: _Service(client, item, failDetail: failDetail),
  );
  final language = AppLanguageController();
  addTearDown(controller.dispose);
  addTearDown(language.dispose);
  await tester.pumpWidget(
    AppLanguageScope(
      controller: language,
      child: MaterialApp(
        theme: ThemeData(brightness: colors.brightness, extensions: [colors]),
        home: AccountDetailPage(controller: controller, accountId: 'metal'),
      ),
    ),
  );
  // Failed detail reads intentionally leave the existing purchase loader active.
  // Advance the list/detail futures without waiting for that spinner to settle.
  for (var frame = 0; frame < 3; frame++) {
    await tester.pump(const Duration(milliseconds: 20));
  }
  expect(tester.takeException(), isNull);
}
