import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/records/record_form_sheet.dart';
import 'package:tharwati_mobile/accounts/records/record_schema.dart';
import 'package:tharwati_mobile/accounts/records/records_controller.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';
import 'package:tharwati_mobile/accounts/records/records_repository.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/tokens.dart';

Account account(String id, {String currency = 'SAR'}) => Account(
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

void main() {
  final accounts = [account('cash'), account('bank'), account('other')];

  test('same account never appears in the opposite transfer selector', () {
    expect(
      transferAccountOptions(
        accounts,
        oppositeAccountId: 'cash',
      ).map((account) => account.id),
      ['bank', 'other'],
    );
  });

  test('switching either side updates options and keeps valid transfers', () {
    expect(
      transferAccountOptions(
        accounts,
        oppositeAccountId: 'bank',
      ).map((account) => account.id),
      ['cash', 'other'],
    );
    expect(
      transferAccountOptions(
        accounts,
        oppositeAccountId: '',
      ).map((account) => account.id),
      ['cash', 'bank', 'other'],
    );
  });

  test('normalizes a stale duplicate transfer destination', () {
    final values = normalizeTransferValues(
      AccountRecordFormValues(
        type: AccountRecordType.transfer,
        accountId: 'cash',
        toAccountId: 'cash',
      ),
    );

    expect(values.accountId, 'cash');
    expect(values.toAccountId, isEmpty);
    expect(hasValidTransferAccountSelection(values), isFalse);
  });

  test('requires two different transfer accounts before Save is enabled', () {
    final values = AccountRecordFormValues(
      type: AccountRecordType.transfer,
      accountId: 'cash',
    );

    expect(
      transferAccountOptions(
        accounts.take(1).toList(),
        oppositeAccountId: values.accountId,
      ),
      isEmpty,
    );
    expect(hasValidTransferAccountSelection(values), isFalse);

    values.toAccountId = 'bank';
    expect(hasValidTransferAccountSelection(values), isTrue);

    values.accountId = 'bank';
    expect(hasValidTransferAccountSelection(values), isFalse);
  });

  test('cross-currency received amount must be entered and remain positive', () {
    final values = AccountRecordFormValues(
      type: AccountRecordType.transfer,
      accountId: 'usd',
      toAccountId: 'sar',
      amount: '100',
      occurredAt: '2026-09-27T12:00',
    );
    expect(validateAccountRecordForm(values), contains('receivedAmount'));
    values.receivedAmount = '0.00';
    expect(validateAccountRecordForm(values), contains('receivedAmount'));
    values.receivedAmount = '375.50';
    expect(validateAccountRecordForm(values), isEmpty);
    expect(values.receivedAmount, '375.50');
  });

  testWidgets('cross-currency form shows no false zero received amount', (
    tester,
  ) async {
    final client = SupabaseClient(
      'http://127.0.0.1:54321',
      'test-key',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );
    final controller = RecordsController(
      accountId: 'usd',
      repository: RecordsRepository(client),
    );
    final usd = account('usd', currency: 'USD');
    final sar = account('sar');
    await tester.pumpWidget(
      AppLanguageScope(
        controller: AppLanguageController(),
        child: MaterialApp(
          theme: ThemeData(extensions: const [AppColors.light]),
          home: Scaffold(
            body: RecordFormSheet(
              controller: controller,
              recordAccounts: [usd, sar],
              fxRateLoader: (_, _) async => null,
              editing: EditableAccountRecord(
                id: 'transfer',
                values: AccountRecordFormValues(
                  type: AccountRecordType.transfer,
                  accountId: 'usd',
                  toAccountId: 'sar',
                  amount: '100',
                  occurredAt: '2026-09-27T12:00',
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    final received = tester.widget<TextField>(find.byType(TextField).at(1));
    expect(received.controller?.text, isEmpty);
    expect(received.decoration?.hintText, '—');
    expect(find.text('0.00 SAR'), findsNothing);
    expect(
      find.textContaining('Automatic FX estimate unavailable'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
    client.dispose();
  });
}
