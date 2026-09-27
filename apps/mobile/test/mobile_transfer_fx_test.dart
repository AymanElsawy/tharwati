import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/records/record_form_sheet.dart';
import 'package:tharwati_mobile/accounts/records/records_controller.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';
import 'package:tharwati_mobile/accounts/records/records_repository.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/portfolio/portfolio_models.dart';
import 'package:tharwati_mobile/theme/tokens.dart';

class _CaptureController extends RecordsController {
  _CaptureController(RecordsRepository repository)
    : super(accountId: 'egp', repository: repository);

  AccountRecordFormValues? submitted;

  @override
  Future<bool> submit(
    AccountRecordFormValues values, {
    String? editingId,
    bool Function()? isCurrent,
    VoidCallback? onCommitted,
  }) async {
    submitted = values.copy();
    return false;
  }
}

Account _account(String id, String currency) => Account(
  id: id,
  type: AccountType.cash,
  name: id,
  currencyCode: currency,
  openingBalance: '0',
  isActive: true,
  notes: null,
  bankSubtype: null,
  creditCardLimit: null,
  dueDayOfMonth: null,
  investmentType: null,
  balanceGrams: null,
  propertyType: null,
  ownershipPercentage: null,
  businessType: null,
  industry: null,
  location: null,
  metalType: null,
  purity: null,
  purchaseDate: null,
  costPerUnit: null,
  closedReason: null,
  closedOn: null,
  createdAt: '',
  updatedAt: '',
);

PortfolioFxRate _rate(String from, String to, String value) => PortfolioFxRate(
  fromCurrencyCode: from,
  toCurrencyCode: to,
  rate: value,
  provider: 'test',
  effectiveAt: '2026-09-27T12:00:00Z',
  stale: false,
);

Future<({SupabaseClient client, _CaptureController controller})> _pump(
  WidgetTester tester, {
  required Future<PortfolioFxRate?> Function(String, String) loadFx,
  String from = 'EGP',
  String to = 'USD',
  String amount = '1000',
}) async {
  final client = SupabaseClient(
    'http://127.0.0.1:54321',
    'test-key',
    authOptions: const AuthClientOptions(autoRefreshToken: false),
  );
  final controller = _CaptureController(RecordsRepository(client));
  await tester.pumpWidget(
    AppLanguageScope(
      controller: AppLanguageController(),
      child: MaterialApp(
        theme: ThemeData(extensions: const [AppColors.light]),
        home: Scaffold(
          body: RecordFormSheet(
            controller: controller,
            recordAccounts: [
              _account('egp', 'EGP'),
              _account('usd', 'USD'),
              _account('usd2', 'USD'),
              _account('sar', 'SAR'),
            ],
            fxRateLoader: loadFx,
            editing: EditableAccountRecord(
              id: 'transfer',
              values: AccountRecordFormValues(
                type: AccountRecordType.transfer,
                accountId: from.toLowerCase(),
                toAccountId: to.toLowerCase(),
                amount: amount,
                occurredAt: '2026-09-27T12:00',
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  return (client: client, controller: controller);
}

String _received(WidgetTester tester) =>
    tester.widget<TextField>(find.byType(TextField).at(1)).controller!.text;

Future<void> _dispose(
  WidgetTester tester,
  ({SupabaseClient client, _CaptureController controller}) harness,
) async {
  await tester.pumpWidget(const SizedBox.shrink());
  harness.controller.dispose();
  harness.client.dispose();
}

Future<void> _save(WidgetTester tester) async {
  final save = find.text('Save record');
  await tester.ensureVisible(save);
  await tester.pump();
  await tester.tap(save);
  await tester.pump();
}

void main() {
  testWidgets('same-currency transfer makes no FX request', (tester) async {
    var calls = 0;
    final h = await _pump(
      tester,
      from: 'USD',
      to: 'USD2',
      loadFx: (_, _) async {
        calls++;
        return null;
      },
    );
    expect(calls, 0);
    expect(find.text('Expected / actual amount received'), findsNothing);
    await _save(tester);
    expect(h.controller.submitted?.amount, '1000');
    expect(h.controller.submitted?.receivedAmount, '1000');
    await _dispose(tester, h);
  });

  testWidgets('valid current FX prefills exact decimal estimate', (tester) async {
    final pairs = <String>[];
    final h = await _pump(tester, loadFx: (from, to) async {
      pairs.add('$from/$to');
      return _rate(from, to, '0.03125');
    });
    await tester.pump();
    expect(pairs, ['EGP/USD']);
    expect(_received(tester), '31.25');
    expect(find.textContaining('Current FX estimate'), findsOneWidget);
    await tester.enterText(find.byType(TextField).at(0), '1000.50');
    await tester.pump();
    expect(_received(tester), '31.27');
    await _dispose(tester, h);
  });

  testWidgets('manual override survives late FX and notes; submit uses it', (
    tester,
  ) async {
    final pending = Completer<PortfolioFxRate?>();
    final h = await _pump(tester, loadFx: (_, _) => pending.future);
    await tester.enterText(find.byType(TextField).at(1), '31.99');
    pending.complete(_rate('EGP', 'USD', '0.03125'));
    await tester.pump();
    expect(_received(tester), '31.99');
    await tester.enterText(find.byType(TextField).at(2), 'note');
    await _save(tester);
    expect(h.controller.submitted?.receivedAmount, '31.99');
    expect(h.controller.submitted?.amount, '1000');
    expect(h.controller.submitted?.notes, 'note');
    await _dispose(tester, h);
  });

  testWidgets('financial edits clear override and reject stale FX results', (
    tester,
  ) async {
    final requests = <Completer<PortfolioFxRate?>>[];
    final pairs = <String>[];
    final h = await _pump(tester, loadFx: (from, to) {
      pairs.add('$from/$to');
      final request = Completer<PortfolioFxRate?>();
      requests.add(request);
      return request.future;
    });
    await tester.enterText(find.byType(TextField).at(1), '35');
    await tester.enterText(find.byType(TextField).at(0), '2000');
    expect(_received(tester), isEmpty);
    expect(requests.length, 2);
    requests[0].complete(_rate('EGP', 'USD', '0.04'));
    await tester.pump();
    expect(_received(tester), isEmpty);
    requests[1].complete(_rate('EGP', 'USD', '0.03'));
    await tester.pump();
    expect(_received(tester), '60');
    tester.widget<DropdownButton<String>>(
      find.byType(DropdownButton<String>).at(1),
    ).onChanged!('sar');
    await tester.pump();
    expect(_received(tester), isEmpty);
    expect(pairs.last, 'EGP/SAR');
    requests[2].complete(_rate('EGP', 'SAR', '0.1'));
    await tester.pump();
    expect(_received(tester), '200');
    tester.widget<DropdownButton<String>>(
      find.byType(DropdownButton<String>).at(0),
    ).onChanged!('usd');
    await tester.pump();
    expect(_received(tester), isEmpty);
    expect(pairs.last, 'USD/SAR');
    requests[3].complete(_rate('USD', 'SAR', '3.75'));
    await tester.pump();
    expect(_received(tester), '7500');
    await _dispose(tester, h);
  });

  testWidgets('unavailable FX leaves blank; manual amount gates submission', (
    tester,
  ) async {
    final h = await _pump(tester, loadFx: (_, _) async => null);
    await tester.pump();
    expect(_received(tester), isEmpty);
    expect(find.textContaining('Automatic FX estimate unavailable'),
        findsOneWidget);
    await _save(tester);
    expect(h.controller.submitted, isNull);
    await tester.enterText(find.byType(TextField).at(1), '0');
    await _save(tester);
    expect(h.controller.submitted, isNull);
    await tester.enterText(find.byType(TextField).at(1), '31.50');
    await _save(tester);
    expect(h.controller.submitted?.receivedAmount, '31.50');
    expect(
      find.text('Enter a positive amount with up to 2 decimal places.'),
      findsNothing,
    );
    await _dispose(tester, h);
  });
}
