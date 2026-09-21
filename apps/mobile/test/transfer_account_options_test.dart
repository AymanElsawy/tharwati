import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/records/record_form_sheet.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';

Account account(String id) => Account(
  id: id,
  type: AccountType.cash,
  name: id,
  currencyCode: 'SAR',
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
}
