import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/account_valuation.dart';
import 'package:tharwati_mobile/accounts/accounts_service.dart';
import 'package:tharwati_mobile/accounts/widgets/account_row_card.dart';
import 'package:tharwati_mobile/i18n/accounts_copy.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

void main() {
  test('Accounts list copy localizes labels and isolates Arabic values', () {
    final english = AccountsCopy.of(AppLanguage.en);
    final arabic = AccountsCopy.of(AppLanguage.ar);

    expect(english.accounts, 'Accounts');
    expect(english.accountType(AccountType.bank), 'Bank');
    expect(arabic.accounts, 'الحسابات');
    expect(arabic.accountType(AccountType.brokerage), 'وساطة');
    expect(arabic.bankSubtype('credit'), 'ائتمان بنكي');
    expect(arabic.propertyType('apartment'), 'شقة');
    expect(arabic.unavailable, 'غير متاح');
    expect(arabic.accountCount(2), contains('\u20662\u2069'));
    expect(arabic.due('15'), contains('\u206615\u2069'));
    expect(arabic.owned('25%'), contains('\u206625%\u2069'));
    expect(arabic.ltr('EGP 1,250.00'), '\u2066EGP 1,250.00\u2069');
    expect(AppLanguage.ar.direction, TextDirection.rtl);
    expect(AppLanguage.en.direction, TextDirection.ltr);
  });

  test(
    'Accounts form copy localizes create, edit, selectors, and validation',
    () {
      final english = AccountsCopy.of(AppLanguage.en);
      final arabic = AccountsCopy.of(AppLanguage.ar);

      expect(english.createAccountTitle, 'Create account');
      expect(english.editAccountTitle, 'Edit account');
      expect(arabic.createAccountTitle, 'إنشاء حساب');
      expect(arabic.editAccountTitle, 'تعديل الحساب');
      expect(arabic.accountType(AccountType.realEstate, short: true), 'عقار');
      expect(arabic.bankOption('credit'), 'ائتمان');
      expect(arabic.investmentOption('stock_etf'), 'أسهم وصناديق مؤشرات');
      expect(arabic.propertyType('apartment'), 'شقة');
      expect(arabic.currencyLabel('EGP'), contains('\u2066EGP\u2069'));
      expect(arabic.validation('Name is required'), 'الاسم مطلوب');
      expect(arabic.accountUnavailable, 'هذا الحساب لم يعد متاحًا.');
      expect(arabic.lifecycleAction('close'), 'إغلاق');
      expect(
        arabic.validation('Enter a value between 0 and 100'),
        'أدخل قيمة بين 0 و100',
      );
    },
  );

  test(
    'Valued-account copy localizes detail, valuation, and disposal flows',
    () {
      final english = AccountsCopy.of(AppLanguage.en);
      final arabic = AccountsCopy.of(AppLanguage.ar);

      expect(english.attributableValue, 'Your attributable value');
      expect(english.updateCurrentValue, 'Update current value');
      expect(english.markAsSold, 'Mark as sold');
      expect(
        english.saleDestinationRequired,
        'Select where the sale proceeds were deposited.',
      );

      expect(arabic.attributableValue, 'قيمتك المنسوبة');
      expect(arabic.valuationHistory, 'سجل التقييمات');
      expect(arabic.saleHistory, 'سجل المبيعات');
      expect(arabic.updateValue, 'تحديث القيمة');
      expect(arabic.sellOwnership, 'بيع الملكية');
      expect(arabic.saleDestination, 'إلى أين ذهبت الأموال؟');
      expect(
        arabic.propertySaleExitsOwnership('25%'),
        contains('\u206625%\u2069'),
      );
      expect(
        arabic.fullValueWithAmount('1,250.00 EGP'),
        contains('\u20661,250.00 EGP\u2069'),
      );
      expect(arabic.soldOwnership('25%'), contains('\u206625%\u2069'));
    },
  );

  test(
    'Cash and Bank records copy localizes read-only ledger presentation',
    () {
      final english = AccountsCopy.of(AppLanguage.en);
      final arabic = AccountsCopy.of(AppLanguage.ar);

      expect(english.accountRecords, 'Account records');
      expect(english.recordTypeValue('income'), 'Income');
      expect(english.loadMore, 'Load more');
      expect(arabic.accountRecords, 'سجلات الحساب');
      expect(arabic.searchRecords, 'ابحث في الملاحظات والفئات');
      expect(arabic.recordTypeValue('expense'), 'مصروف');
      expect(arabic.filtersCount(2), contains('\u20662\u2069'));
      expect(arabic.dayValue('15'), contains('\u206615\u2069'));
      expect(arabic.any, 'أي');
    },
  );

  test('Record write and category-management copy localizes controls', () {
    final english = AccountsCopy.of(AppLanguage.en);
    final arabic = AccountsCopy.of(AppLanguage.ar);

    expect(english.editRecord, 'Edit record');
    expect(english.deleteRecordTitle, 'Delete record?');
    expect(
      english.recordValidation('Category is required.'),
      'Category is required.',
    );
    expect(arabic.editRecord, 'تعديل السجل');
    expect(arabic.deleteRecord, 'حذف السجل');
    expect(arabic.manageCategories, 'إدارة الفئات');
    expect(arabic.recordTypeValue('transfer'), 'تحويل');
    expect(arabic.recordValidation('Category is required.'), 'الفئة مطلوبة.');
    expect(
      arabic.recordAccountPicker('Main', AccountType.bank, 'EGP'),
      contains('\u2066EGP\u2069'),
    );
  });

  test('Metal purity detail copy localizes and isolates financial values', () {
    final english = AccountsCopy.of(AppLanguage.en);
    final arabic = AccountsCopy.of(AppLanguage.ar);

    expect(english.purity('24k'), '24K');
    expect(english.currentMetalValue, 'Current value');
    expect(english.reversePurchase, 'Reverse');
    expect(english.reversePurchaseTitle, 'Reverse this purchase?');
    expect(arabic.purity('other'), 'أخرى');
    expect(arabic.currentMetalValue, 'القيمة الحالية');
    expect(arabic.purchasesCount(3), contains('\u20663\u2069'));
    expect(
      arabic.purchasePaid('1,250.00 EGP', '500.00 EGP'),
      allOf(
        contains('\u20661,250.00 EGP\u2069'),
        contains('\u2066500.00 EGP/g\u2069'),
      ),
    );
    expect(
      arabic.reversePurchaseBody('2.5g', '1,250.00 EGP'),
      allOf(contains('\u20662.5g\u2069'), contains('\u20661,250.00 EGP\u2069')),
    );
  });

  test('Metal purchase copy localizes form and UI validation', () {
    final english = AccountsCopy.of(AppLanguage.en);
    final arabic = AccountsCopy.of(AppLanguage.ar);

    expect(english.addMetalPurchase, 'Add purchase');
    expect(english.editMetalPurchase, 'Edit purchase');
    expect(
      english.metalPurchaseValidation('Fees must be zero or more.'),
      'Fees must be zero or more.',
    );
    expect(arabic.addMetalPurchase, 'إضافة عملية شراء');
    expect(arabic.purchaseDateTime, 'تاريخ ووقت الشراء');
    expect(arabic.paidFromCashBank, 'دُفع من حساب نقدي / بنكي');
    expect(
      arabic.metalPurchaseValidation('Choose a purity for this metal.'),
      'اختر عيارًا لهذا المعدن.',
    );
    expect(
      arabic.metalPurchaseValidation(
        'Grams must be a positive number (up to 3 decimals).',
      ),
      'يجب أن تكون الغرامات رقمًا موجبًا حتى 3 منازل عشرية.',
    );
  });

  test('Gold and Silver detail copy localizes captions and dates', () {
    final english = AccountsCopy.of(AppLanguage.en);
    final arabic = AccountsCopy.of(AppLanguage.ar);

    expect(english.metalName('gold'), 'Gold');
    expect(english.byPurity, 'By purity');
    expect(english.metalPurchaseDate(5, 1, 2026), '5 Jan 2026');
    expect(arabic.metalName('silver'), 'فضة');
    expect(arabic.byPurity, 'حسب العيار');
    expect(arabic.purchaseCount(2), contains('\u20662\u2069'));
    expect(
      arabic.metalTypeCurrencyCaption('gold', 'EGP'),
      contains('\u2066EGP\u2069'),
    );
    expect(
      arabic.metalPurchaseDate(5, 1, 2026),
      allOf(
        contains('يناير'),
        contains('\u20665\u2069'),
        contains('\u20662026\u2069'),
      ),
    );
  });

  testWidgets(
    'Arabic list cards localize unavailable values and preserve LTR data',
    (tester) async {
      await _pumpCard(
        tester,
        language: AppLanguage.ar,
        account: _account(type: AccountType.cash),
        value: const ResolvedValue(null, CurrentValueSource.ledger),
      );

      final unavailable = tester.widget<Text>(find.text('غير متاح'));
      expect(unavailable.textDirection, TextDirection.rtl);
      expect(find.byIcon(Icons.chevron_left), findsOneWidget);
      expect(find.byIcon(Icons.chevron_right), findsNothing);
      expect(find.text('\u2066EGP\u2069'), findsOneWidget);
    },
  );

  testWidgets(
    'Arabic metal card isolates purity and English keeps its affordance',
    (tester) async {
      await _pumpCard(
        tester,
        language: AppLanguage.ar,
        account: _account(
          type: AccountType.gold,
          purity: '24k',
          balanceGrams: '2.5',
        ),
        value: const ResolvedValue('100', CurrentValueSource.snapshot),
      );

      expect(find.textContaining('\u206624K\u2069'), findsOneWidget);
      final value = tester.widget<Text>(find.text('100.00 EGP'));
      expect(value.textDirection, TextDirection.ltr);

      await _pumpCard(
        tester,
        language: AppLanguage.en,
        account: _account(type: AccountType.cash),
        value: const ResolvedValue(null, CurrentValueSource.ledger),
      );

      expect(find.text('Unavailable'), findsOneWidget);
      expect(find.byIcon(Icons.chevron_right), findsOneWidget);
    },
  );
}

Future<void> _pumpCard(
  WidgetTester tester, {
  required AppLanguage language,
  required Account account,
  required ResolvedValue value,
}) async {
  final controller = AppLanguageController(store: _MemoryLanguageStore());
  await controller.setLanguage(language);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: Directionality(
        textDirection: language.direction,
        child: AppLanguageScope(
          controller: controller,
          child: Scaffold(
            body: AccountRowCard(
              item: AccountItem(
                account: account,
                value: value,
                lifecycle: null,
              ),
              onTap: () {},
            ),
          ),
        ),
      ),
    ),
  );
}

Account _account({
  required AccountType type,
  String? purity,
  String? balanceGrams,
}) => Account(
  id: 'account-1',
  type: type,
  name: 'Primary account',
  currencyCode: 'EGP',
  openingBalance: '0',
  isActive: true,
  notes: null,
  bankSubtype: null,
  creditCardLimit: null,
  dueDayOfMonth: null,
  investmentType: null,
  balanceGrams: balanceGrams,
  propertyType: null,
  ownershipPercentage: null,
  businessType: null,
  industry: null,
  location: null,
  metalType: type == AccountType.gold ? 'gold' : null,
  purity: purity,
  purchaseDate: null,
  costPerUnit: null,
  closedReason: null,
  closedOn: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
);

class _MemoryLanguageStore implements LanguageStore {
  @override
  Future<String?> readLanguage() async => null;

  @override
  Future<void> writeLanguage(String code) async {}
}
