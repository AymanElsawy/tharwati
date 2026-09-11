import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/account_form.dart';
import 'package:tharwati_mobile/accounts/account_schema.dart';

AccountFormValues v({
  String type = 'cash',
  String name = 'Wallet',
  String openingBalance = '100',
  String bankSubtype = '',
  String creditCardLimit = '',
  String dueDayOfMonth = '',
  String investmentType = '',
  String metalType = '',
  String propertyType = '',
  String ownershipPercentage = '100',
  String businessType = '',
  String businessTypeOther = '',
  String industry = '',
  String industryOther = '',
  String valuationDate = '2026-01-01',
}) => AccountFormValues(
  accountTypeCode: type,
  name: name,
  openingBalance: openingBalance,
  bankSubtype: bankSubtype,
  creditCardLimit: creditCardLimit,
  dueDayOfMonth: dueDayOfMonth,
  investmentType: investmentType,
  metalType: metalType,
  propertyType: propertyType,
  ownershipPercentage: ownershipPercentage,
  businessType: businessType,
  businessTypeOther: businessTypeOther,
  industry: industry,
  industryOther: industryOther,
  valuationDate: valuationDate,
);

void main() {
  test('cash needs a name and a valid balance', () {
    expect(validateAccountForm(v(), isCreate: true), isEmpty);
    expect(
      validateAccountForm(v(name: ' '), isCreate: true),
      containsPair('name', anything),
    );
    expect(
      validateAccountForm(v(openingBalance: '1.999'), isCreate: true),
      containsPair('openingBalance', anything),
    );
  });

  test('bank needs a subtype; credit needs a limit above the balance', () {
    expect(
      validateAccountForm(v(type: 'bank'), isCreate: true),
      containsPair('bankSubtype', anything),
    );
    // credit with no limit
    expect(
      validateAccountForm(
        v(type: 'bank', bankSubtype: 'credit', openingBalance: '50'),
        isCreate: true,
      ),
      containsPair('creditCardLimit', anything),
    );
    // available credit exceeds the limit
    final over = validateAccountForm(
      v(
        type: 'bank',
        bankSubtype: 'credit',
        openingBalance: '200',
        creditCardLimit: '100',
      ),
      isCreate: true,
    );
    expect(over, containsPair('openingBalance', anything));
    // valid credit account
    expect(
      validateAccountForm(
        v(
          type: 'bank',
          bankSubtype: 'credit',
          openingBalance: '40',
          creditCardLimit: '100',
          dueDayOfMonth: '25',
        ),
        isCreate: true,
      ),
      isEmpty,
    );
  });

  test('brokerage needs an investment type', () {
    expect(
      validateAccountForm(v(type: 'brokerage'), isCreate: true),
      containsPair('investmentType', anything),
    );
    expect(
      validateAccountForm(
        v(type: 'brokerage', investmentType: 'stock_etf'),
        isCreate: true,
      ),
      isEmpty,
    );
  });

  test('gold needs a metal type but no name', () {
    final errs = validateAccountForm(v(type: 'gold', name: ''), isCreate: true);
    expect(errs.containsKey('name'), isFalse);
    expect(errs, containsPair('metalType', anything));
    expect(
      validateAccountForm(
        v(type: 'gold', name: '', metalType: 'silver'),
        isCreate: true,
      ),
      isEmpty,
    );
  });

  test('real estate needs ownership, property type and a valuation date', () {
    final missing = validateAccountForm(
      v(type: 'real_estate', ownershipPercentage: '', valuationDate: ''),
      isCreate: true,
    );
    expect(
      missing.keys,
      containsAll(['ownershipPercentage', 'propertyType', 'valuationDate']),
    );
    expect(
      validateAccountForm(
        v(
          type: 'real_estate',
          ownershipPercentage: '50',
          propertyType: 'apartment',
          valuationDate: '2026-01-01',
        ),
        isCreate: true,
      ),
      isEmpty,
    );
    // ownership over 100 is rejected
    expect(
      validateAccountForm(
        v(
          type: 'real_estate',
          ownershipPercentage: '120',
          propertyType: 'land',
        ),
        isCreate: true,
      ),
      containsPair('ownershipPercentage', anything),
    );
  });

  test('business "other" classifications need custom text', () {
    final errs = validateAccountForm(
      v(
        type: 'business',
        businessType: 'other',
        industry: 'other',
        ownershipPercentage: '100',
      ),
      isCreate: true,
    );
    expect(errs.keys, containsAll(['businessTypeOther', 'industryOther']));
    expect(
      validateAccountForm(
        v(
          type: 'business',
          businessType: 'other',
          businessTypeOther: 'Import/export',
          industry: 'retail',
          ownershipPercentage: '100',
        ),
        isCreate: true,
      ),
      isEmpty,
    );
  });

  test('real estate edit mode drops the create-only valuation checks', () {
    final errs = validateAccountForm(
      v(
        type: 'real_estate',
        openingBalance: '',
        ownershipPercentage: '50',
        propertyType: 'villa',
        valuationDate: '',
      ),
      isCreate: false,
    );
    expect(errs.containsKey('openingBalance'), isFalse);
    expect(errs.containsKey('valuationDate'), isFalse);
  });
}
