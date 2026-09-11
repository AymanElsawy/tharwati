import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/accounts_controller.dart';
import 'package:tharwati_mobile/accounts/accounts_page.dart';
import 'package:tharwati_mobile/accounts/accounts_repository.dart';
import 'package:tharwati_mobile/accounts/accounts_service.dart';
import 'package:tharwati_mobile/accounts/metal_purchases_repository.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_repository.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

void main() {
  // iPhone 15 logical size from the design canvas.
  const phone = Size(393, 852);

  /// A client that is never reachable — `loadAccounts()` fails and the
  /// controller settles into its error state, which is layout branch enough.
  /// `autoRefreshToken: false` matters: the refresh timer is periodic, and the
  /// binding fails any test that leaves a pending timer behind.
  SupabaseClient offlineClient() => SupabaseClient(
    'https://offline.invalid',
    'anon-key',
    authOptions: const AuthClientOptions(autoRefreshToken: false),
  );

  AccountsController controller() => AccountsController(
    service: AccountsService(
      accounts: AccountsRepository(offlineClient()),
      metal: MetalPurchasesRepository(offlineClient()),
      dashboard: DashboardRepository(offlineClient()),
    ),
  );

  Future<void> pumpIn(WidgetTester tester, Widget child) async {
    tester.view.physicalSize = phone * tester.view.devicePixelRatio;
    tester.view.devicePixelRatio = 1.0;
    tester.view.physicalSize = phone;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(theme: AppTheme.light(), home: child));
  }

  testWidgets('AccountsPage lays out standalone on a phone viewport', (
    tester,
  ) async {
    await pumpIn(tester, AccountsPage(controller: controller()));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  // A route being sized offstage lays its subtree out with `BoxConstraints()`
  // — fully unconstrained. Any button carrying the theme's full-width
  // `minimumSize` (width == infinity) resolves to a tight infinity there and
  // throws, aborting layout for the whole page. Inline buttons must hug.
  testWidgets('AccountsPage survives an unconstrained layout pass', (
    tester,
  ) async {
    await pumpIn(
      tester,
      Offstage(child: AccountsPage(controller: controller())),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('AccountsPage lays out offstage inside HomePage IndexedStack', (
    tester,
  ) async {
    await pumpIn(
      tester,
      Scaffold(
        body: IndexedStack(
          index: 0,
          children: [
            const Center(child: Text('Dashboard')),
            AccountsPage(controller: controller()),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: 0,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.grid_view), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.wallet), label: 'Accounts'),
          ],
        ),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
