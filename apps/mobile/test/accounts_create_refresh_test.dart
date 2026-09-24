import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/accounts_controller.dart';
import 'package:tharwati_mobile/accounts/accounts_repository.dart';
import 'package:tharwati_mobile/accounts/accounts_service.dart';
import 'package:tharwati_mobile/accounts/metal_purchases_repository.dart';
import 'package:tharwati_mobile/dashboard/data/dashboard_repository.dart';

class _Service extends AccountsService {
  _Service(SupabaseClient client)
    : super(
        accounts: AccountsRepository(client),
        metal: MetalPurchasesRepository(client),
        dashboard: DashboardRepository(client),
      );
  bool failRefresh = false;
  int reads = 0;
  @override
  Future<AccountsListModel> loadAccounts() async {
    reads++;
    if (failRefresh) throw Exception('offline');
    return const AccountsListModel(items: []);
  }
}

void main() {
  test(
    'account and metal creates commit before refresh; retry only reads',
    () async {
      final client = SupabaseClient(
        'http://localhost:54321',
        'test-key',
        authOptions: const AuthClientOptions(autoRefreshToken: false),
      );
      final service = _Service(client);
      final controller = AccountsController(service: service);
      await Future<void>.delayed(Duration.zero);
      final knownModel = controller.model;
      service.failRefresh = true;
      var creates = 0;
      expect(
        await controller.runCreate((_) async {
          creates++;
        }),
        isTrue,
      );
      await Future<void>.delayed(Duration.zero);
      expect(controller.refreshStale, isTrue);
      expect(controller.model, same(knownModel));
      await controller.retryRefresh();
      expect(creates, 1);
      service.failRefresh = false;
      await controller.retryRefresh();
      expect(controller.refreshStale, isFalse);
      expect(creates, 1);
      controller.dispose();
      await client.dispose();
    },
  );
}
