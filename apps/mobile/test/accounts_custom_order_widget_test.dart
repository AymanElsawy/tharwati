import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/account_valuation.dart';
import 'package:tharwati_mobile/accounts/accounts_controller.dart';
import 'package:tharwati_mobile/accounts/accounts_page.dart';
import 'package:tharwati_mobile/accounts/accounts_repository.dart';
import 'package:tharwati_mobile/accounts/accounts_service.dart';
import 'package:tharwati_mobile/accounts/metal_purchases_repository.dart';
import 'package:tharwati_mobile/accounts/widgets/account_row_card.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_repository.dart';
import 'package:tharwati_mobile/i18n/accounts_copy.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

class _Service extends AccountsService {
  _Service(SupabaseClient client, this.items, this.order)
    : super(
        accounts: AccountsRepository(client),
        metal: MetalPurchasesRepository(client),
        dashboard: DashboardRepository(client),
      );

  final List<AccountItem> items;
  List<String> order;
  int writes = 0;

  @override
  Future<AccountsListModel> loadAccounts() async =>
      AccountsListModel(items: items, canonicalIds: order);

  @override
  Future<List<String>> reorderAccounts(
    List<String> expectedIds,
    List<String> orderedIds,
  ) async {
    writes++;
    order = orderedIds;
    return orderedIds;
  }
}

AccountItem _item(int index) => AccountItem(
  account: Account.fromRow({
    'id': 'account-$index',
    'account_type_code': index.isEven ? 'bank' : 'cash',
    'name': 'Account $index',
    'currency_code': 'USD',
    'opening_balance': '0',
    'is_active': true,
    'created_at': '2026-01-01T00:00:00Z',
  }),
  value: const ResolvedValue('10', CurrentValueSource.ledger),
  lifecycle: null,
);

class _MemoryLanguageStore implements LanguageStore {
  @override
  Future<String?> readLanguage() async => null;
  @override
  Future<void> writeLanguage(String code) async {}
}

void main() {
  void expectSortLabelsSingleLine(
    WidgetTester tester,
    List<String> labels,
    double viewportWidth,
  ) {
    for (final label in labels) {
      final finder = find.text(label);
      expect(finder, findsOneWidget);
      final bounds = tester.getRect(finder);
      expect(bounds.left, greaterThanOrEqualTo(0));
      expect(bounds.right, lessThanOrEqualTo(viewportWidth));
      final text = tester.widget<Text>(finder);
      expect(text.maxLines, 1);
      expect(text.softWrap, isFalse);
      expect(text.data, label);
      expect(text.overflow, isNot(TextOverflow.ellipsis));
    }
  }

  Future<AccountsController> pumpSortControls(
    WidgetTester tester,
    AppLanguage appLanguage,
    double width,
  ) async {
    tester.view.physicalSize = Size(width, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final client = SupabaseClient(
      'http://localhost:54321',
      'test-key',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    final service = _Service(client, [], []);
    final controller = AccountsController(service: service);
    addTearDown(controller.dispose);
    final language = AppLanguageController(store: _MemoryLanguageStore());
    await language.setLanguage(appLanguage);
    await tester.pumpWidget(
      AppLanguageScope(
        controller: language,
        child: MaterialApp(
          theme: AppTheme.light(),
          locale: appLanguage.locale,
          home: Directionality(
            textDirection: appLanguage.direction,
            child: AccountsPage(controller: controller),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return controller;
  }

  testWidgets('360px English sort row keeps all four labels on one line', (
    tester,
  ) async {
    final controller = await pumpSortControls(tester, AppLanguage.en, 360);
    final copy = AccountsCopy.of(AppLanguage.en);
    expect(controller.sort, AccountSort.custom);
    final labels = [
      copy.sortCustom,
      copy.sortAccountName,
      copy.sortType,
      copy.sortCurrentValue,
    ];
    expectSortLabelsSingleLine(tester, labels, 360);
    expect(
      tester.getRect(find.text(copy.sort)).bottom,
      lessThan(tester.getRect(find.text(copy.sortCustom)).top),
    );
    expect(
      find.ancestor(
        of: find.text(copy.sortCustom),
        matching: find.byType(SingleChildScrollView),
      ),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
    for (final entry in [
      (copy.sortAccountName, AccountSort.name),
      (copy.sortType, AccountSort.type),
      (copy.sortCurrentValue, AccountSort.balance),
      (copy.sortCustom, AccountSort.custom),
    ]) {
      await tester.tap(find.text(entry.$1));
      await tester.pump();
      expect(controller.sort, entry.$2);
      expectSortLabelsSingleLine(tester, labels, 360);
      if (entry.$2 == AccountSort.type) {
        final labelCenter = tester.getRect(find.text(copy.sortType)).center;
        final arrowCenter = tester
            .getRect(find.byIcon(Icons.arrow_upward))
            .center;
        expect((labelCenter.dy - arrowCenter.dy).abs(), lessThan(8));
      }
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('360px Arabic RTL sort row keeps all labels on one line', (
    tester,
  ) async {
    final controller = await pumpSortControls(tester, AppLanguage.ar, 360);
    final copy = AccountsCopy.of(AppLanguage.ar);
    expect(controller.sort, AccountSort.custom);
    final labels = [
      copy.sortCustom,
      copy.sortAccountName,
      copy.sortType,
      copy.sortCurrentValue,
    ];
    final centers = <double>[];
    expectSortLabelsSingleLine(tester, labels, 360);
    for (final label in labels) {
      centers.add(tester.getRect(find.text(label)).center.dx);
    }
    expect(centers[0], greaterThan(centers[1]));
    expect(centers[1], greaterThan(centers[2]));
    expect(centers[2], greaterThan(centers[3]));
    expect(
      find.ancestor(
        of: find.text(copy.sortCustom),
        matching: find.byType(SingleChildScrollView),
      ),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
    for (final entry in [
      (copy.sortAccountName, AccountSort.name),
      (copy.sortType, AccountSort.type),
      (copy.sortCurrentValue, AccountSort.balance),
      (copy.sortCustom, AccountSort.custom),
    ]) {
      await tester.tap(find.text(entry.$1));
      await tester.pump();
      expect(controller.sort, entry.$2);
      expectSortLabelsSingleLine(tester, labels, 360);
      if (entry.$2 == AccountSort.type) {
        final labelCenter = tester.getRect(find.text(copy.sortType)).center;
        final arrowCenter = tester
            .getRect(find.byIcon(Icons.arrow_upward))
            .center;
        expect((labelCenter.dy - arrowCenter.dy).abs(), lessThan(8));
      }
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('Custom renders canonical cards and filters disable drag', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(393, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final client = SupabaseClient(
      'http://localhost:54321',
      'test-key',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    final service = _Service(
      client,
      [_item(2), _item(0), _item(1)],
      ['account-0', 'account-1', 'account-2'],
    );
    final controller = AccountsController(service: service);
    addTearDown(controller.dispose);
    final language = AppLanguageController(store: _MemoryLanguageStore());
    await tester.pumpWidget(
      AppLanguageScope(
        controller: language,
        child: MaterialApp(
          theme: AppTheme.light(),
          home: AccountsPage(controller: controller),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(controller.sort, AccountSort.custom);
    expect(
      tester
          .widgetList<AccountRowCard>(find.byType(AccountRowCard))
          .map((card) => card.item.account.id)
          .toList(),
      ['account-0', 'account-1', 'account-2'],
    );
    expect(find.byType(SliverReorderableList), findsOneWidget);
    expect(find.byIcon(Icons.drag_handle), findsNWidgets(3));
    controller.setSearch('Account 0');
    await tester.pump();
    expect(
      find.text(AccountsCopy.of(AppLanguage.en).clearFiltersToReorder),
      findsOneWidget,
    );
    expect(find.byType(SliverReorderableList), findsNothing);
    expect(service.writes, 0);
    controller.setSearch('');
    controller.toggleSort(AccountSort.name);
    await tester.pump();
    expect(find.byIcon(Icons.drag_handle), findsNothing);
    controller.toggleSort(AccountSort.custom);
    await tester.pump();
    expect(find.byIcon(Icons.drag_handle), findsNWidgets(3));
  });

  testWidgets('card tap still invokes account navigation callback', (
    tester,
  ) async {
    var opened = false;
    final language = AppLanguageController(store: _MemoryLanguageStore());
    await language.setLanguage(AppLanguage.ar);
    await tester.pumpWidget(
      AppLanguageScope(
        controller: language,
        child: MaterialApp(
          theme: AppTheme.light(),
          locale: AppLanguage.ar.locale,
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: AccountRowCard(
                item: _item(0),
                onTap: () => opened = true,
                reorderHandle: const Icon(Icons.drag_handle),
              ),
            ),
          ),
        ),
      ),
    );
    expect(
      tester.getCenter(find.byIcon(Icons.drag_handle)).dx,
      greaterThan(tester.getCenter(find.byIcon(AccountType.bank.icon)).dx),
    );
    await tester.tap(find.text('Account 0'));
    expect(opened, isTrue);
  });

  testWidgets('native card proxy drags and auto-scrolls a long page', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(393, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final client = SupabaseClient(
      'http://localhost:54321',
      'test-key',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    final items = [for (var i = 0; i < 30; i++) _item(i)];
    final service = _Service(client, items, [
      for (var i = 0; i < 30; i++) 'account-$i',
    ]);
    final controller = AccountsController(service: service);
    addTearDown(controller.dispose);
    final language = AppLanguageController(store: _MemoryLanguageStore());
    await tester.pumpWidget(
      AppLanguageScope(
        controller: language,
        child: MaterialApp(
          theme: AppTheme.light(),
          home: AccountsPage(controller: controller),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final handle = find.byIcon(Icons.drag_handle).first;
    final gesture = await tester.startGesture(tester.getCenter(handle));
    await tester.pump();
    await gesture.moveBy(const Offset(0, 120));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byType(SliverReorderableList), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Transform && widget.transform.getMaxScaleOnAxis() > 1.005,
        skipOffstage: false,
      ),
      findsWidgets,
    );
    final scrollable = tester.state<ScrollableState>(
      find
          .descendant(
            of: find.byType(CustomScrollView),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await gesture.moveTo(const Offset(40, 820));
    for (var frame = 0; frame < 30; frame++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(scrollable.position.pixels, greaterThan(0));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(service.writes, 1);
    expect(controller.hasCompleteOrder, isTrue);
  });
}
