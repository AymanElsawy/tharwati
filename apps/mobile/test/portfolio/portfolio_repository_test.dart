import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/core/read_deadline.dart';
import 'package:tharwati_mobile/portfolio/portfolio_repository.dart';

import 'portfolio_test_support.dart';

class _PendingAccountsSource extends FakeSource {
  final accountsRequest = Completer<List<Account>>();

  @override
  Future<List<Account>> loadAccounts() => accountsRequest.future;
}

void main() {
  testWidgets('Portfolio composite timeout ignores a late source result', (
    tester,
  ) async {
    final source = _PendingAccountsSource();
    final request = PortfolioRepository(source).load();
    final failure = expectLater(request, throwsA(isA<ReadTimeoutException>()));
    await tester.pump(const Duration(seconds: 45));
    await failure;
    source.accountsRequest.complete([account('late')]);
    await tester.pump();
  });
  test(
    'repository keeps only active Brokerage accounts and positive holdings',
    () async {
      final source = FakeSource()
        ..accounts = [
          account('broker'),
          account('cash', type: AccountType.cash),
          account('closed', active: false),
        ]
        ..holdings = [
          holding('positive', 'broker'),
          holding('zero', 'broker', quantity: '0'),
          holding('foreign', 'cash'),
        ]
        ..cash = {'broker': '12'}
        ..prices = {'asset-positive': price('positive')};
      final result = await PortfolioRepository(source).load();
      expect(result.accounts.map((item) => item.id), ['broker']);
      expect(result.holdings.map((item) => item.id), ['positive']);
    },
  );

  test('cash-only Brokerage account remains selectable', () async {
    final source = FakeSource()
      ..accounts = [account('broker')]
      ..cash = {'broker': '42'};
    final result = await PortfolioRepository(source).load();
    expect(result.accounts.single.id, 'broker');
    expect(result.holdings, isEmpty);
    expect(result.availableCashByAccountId['broker'], '42');
  });
}
