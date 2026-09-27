import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/accounts_repository.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_activity.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_controller.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_models.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_repository.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_valuation.dart';
import 'package:tharwati_mobile/accounts/brokerage/trade_sheet.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/tokens.dart';
import 'package:tharwati_mobile/widgets/primary_button.dart';

const _asset = Asset(
  id: 'etf',
  name: 'ETF',
  symbol: 'ETF',
  exchange: 'XNAS',
  assetTypeCode: 'etf',
  currencyCode: 'USD',
  canonicalQuantityUnit: 'shares',
);

Holding _holding(String quantity) => Holding(
  id: 'holding',
  accountId: 'account',
  assetId: 'etf',
  quantity: quantity,
  averageCost: '1',
  totalCostBasis: '1',
  costCurrencyCode: 'USD',
  asset: _asset,
);

Account _account(String currency) => Account(
  id: 'account',
  type: AccountType.brokerage,
  name: 'Brokerage',
  currencyCode: currency,
  openingBalance: '1000',
  isActive: true,
  notes: null,
  bankSubtype: null,
  creditCardLimit: null,
  dueDayOfMonth: null,
  investmentType: 'stock_etf',
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

TradeFormValues _trade({
  TradeSide side = TradeSide.buy,
  String quantity = '1.25',
  String price = '2.50',
  String fees = '0.05',
  String? rate,
}) => TradeFormValues(
  side: side,
  assetId: 'etf',
  quantity: quantity,
  unitPrice: price,
  fees: fees,
  accountFxRate: rate,
  occurredAt: '2026-09-24T10:00',
);

class _Repository extends BrokerageRepository {
  _Repository()
    : super(
        SupabaseClient(
          'http://127.0.0.1:54321',
          'test-key',
          authOptions: const AuthClientOptions(autoRefreshToken: false),
        ),
      );

  TradeFormValues? submitted;
  int calls = 0;
  bool rejectForCash = false;

  @override
  Future<void> addBuy(
    String accountId,
    TradeFormValues values,
    String key,
  ) async {
    calls++;
    submitted = values;
    if (rejectForCash) {
      throw AccountsException(
        'This account doesn’t have enough available cash.',
      );
    }
  }

  @override
  Future<List<Holding>> getHoldingsForAccount(String accountId) async =>
      const [];
  @override
  Future<Map<String, MarketPrice>> getPrices(List<String> ids) async =>
      const {};
  @override
  Future<String> getCashBalance(String accountId) async => '1000';
  @override
  Future<List<ActivityItem>> getActivity(String accountId) async => const [];
}

Future<void> _pumpTrade(
  WidgetTester tester,
  BrokerageController controller,
  String accountCurrency,
) async {
  controller.valuation = valueBrokerageAccount(
    holdings: [_holding('999999999999999999.0000000001')],
    pricesByAssetId: const {},
    cashBalance: '1000',
  );
  await tester.pumpWidget(
    AppLanguageScope(
      controller: AppLanguageController(),
      child: MaterialApp(
        theme: ThemeData(extensions: const [AppColors.light]),
        home: Scaffold(
          body: TradeSheet(
            controller: controller,
            account: _account(accountCurrency),
            side: TradeSide.buy,
            presetAssetId: 'etf',
          ),
        ),
      ),
    ),
  );
}

Future<void> _enterPreviewAmounts(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField).at(0), '1.25');
  await tester.enterText(find.byType(TextField).at(1), '2.50');
  await tester.enterText(find.byType(TextField).at(2), '0.05');
  await tester.pump();
}

void main() {
  test(
    'dot decimals and maximum precision remain exact; excess precision rejects',
    () {
      final valid = _trade(
        quantity: '999999999999999999.0000000001',
        price: '0.0000000001',
        fees: '0.0000000001',
        rate: '3.7500000001',
      );
      expect(validateTrade(valid), isEmpty);
      final params = brokerageBuyRpcParams('account', valid, 'key');
      expect(params['p_quantity'], valid.quantity);
      expect(params['p_unit_price'], valid.unitPrice);
      expect(params['p_fees'], valid.fees);
      expect(params['p_account_fx_rate'], valid.accountFxRate);
      expect(
        validateTrade(_trade(quantity: '1.00000000001')),
        contains('quantity'),
      );
      expect(
        validateTrade(_trade(price: '1.00000000001')),
        contains('unitPrice'),
      );
      expect(validateTrade(_trade(fees: '1.00000000001')), contains('fees'));
      expect(
        validateTrade(_trade(rate: '1.00000000001')),
        contains('accountFxRate'),
      );
      expect(
        validateTrade(_trade(quantity: '1000000000000000000')),
        contains('quantity'),
      );
    },
  );

  test('comma and malformed separators are rejected without guessing', () {
    for (final input in [
      '1,25',
      '1,000.25',
      '1..25',
      '1.2.5',
      '1٫25',
      '-1',
      ' 1.25',
    ]) {
      expect(isTradeDecimalLiteral(input), isFalse);
      expect(validateTrade(_trade(quantity: input)), contains('quantity'));
      expect(validateTrade(_trade(price: input)), contains('unitPrice'));
      expect(validateTrade(_trade(fees: input)), contains('fees'));
      expect(validateTrade(_trade(rate: input)), contains('accountFxRate'));
    }
    expect(validateTrade(_trade(quantity: '0')), contains('quantity'));
    expect(validateTrade(_trade(price: '0')), contains('unitPrice'));
    expect(validateTrade(_trade(rate: '0')), contains('accountFxRate'));
    expect(validateTrade(_trade(fees: '0')), isEmpty);
  });

  test('oversell uses exact decimals at the precision boundary', () {
    final held = _holding('9007199254740992.0000000001');
    expect(
      validateTrade(
        _trade(side: TradeSide.sell, quantity: '9007199254740992.0000000002'),
        sellingFrom: held,
      ),
      contains('quantity'),
    );
    expect(
      validateTrade(
        _trade(side: TradeSide.sell, quantity: held.quantity),
        sellingFrom: held,
      ),
      isEmpty,
    );
  });

  test('oversell message trims only insignificant quantity zeros', () {
    final whole = _holding('1.0000000000');
    expect(
      validateTrade(
        _trade(side: TradeSide.sell, quantity: '2'),
        sellingFrom: whole,
      )['quantity'],
      'You only hold 1.',
    );
    expect(whole.quantity, '1.0000000000');
    final fractional = _holding('1.5000000000');
    expect(
      validateTrade(
        _trade(side: TradeSide.sell, quantity: '2'),
        sellingFrom: fractional,
      )['quantity'],
      'You only hold 1.5.',
    );
    final precise = _holding('1.0000000001');
    expect(
      validateTrade(
        _trade(side: TradeSide.sell, quantity: '2'),
        sellingFrom: precise,
      )['quantity'],
      'You only hold 1.0000000001.',
    );
  });

  test('same-currency FX is null; cross-currency FX string is exact', () {
    final same = brokerageBuyRpcParams('account', _trade(), 'key');
    final cross = brokerageBuyRpcParams(
      'account',
      _trade(rate: '3.7500000001'),
      'key',
    );
    expect(same['p_account_fx_rate'], isNull);
    expect(cross['p_account_fx_rate'], '3.7500000001');
    expect(cross['p_quantity'], '1.25');
    expect(cross['p_unit_price'], '2.50');
    expect(cross['p_fees'], '0.05');
  });

  test('server available-cash rejection remains authoritative', () async {
    final repository = _Repository()..rejectForCash = true;
    final controller = BrokerageController(
      accountId: 'account',
      repository: repository,
    );
    expect(await controller.submitTrade(_trade()), isFalse);
    expect(repository.calls, 1);
    expect(controller.actionError, contains('available cash'));
    controller.dispose();
  });

  testWidgets('comma stays visible and cannot submit as a changed number', (
    tester,
  ) async {
    final repository = _Repository();
    final controller = BrokerageController(
      accountId: 'account',
      repository: repository,
    );
    await _pumpTrade(tester, controller, 'USD');
    final quantity = find.byType(TextField).at(0);
    await tester.enterText(quantity, '1,25');
    await tester.pump();
    expect(tester.widget<TextField>(quantity).controller!.text, '1,25');
    expect(find.textContaining('Use digits and a decimal point'), findsWidgets);
    tester.widget<PrimaryButton>(find.byType(PrimaryButton)).onPressed!.call();
    await tester.pump();
    expect(repository.calls, 0);
    await tester.enterText(quantity, '1.25');
    await tester.pump();
    expect(
      find.textContaining('Use digits and a decimal point'),
      findsOneWidget,
    );
    controller.dispose();
  });

  for (final currency in ['USD', 'SAR']) {
    testWidgets('$currency Buy sends exact decimal strings and correct FX', (
      tester,
    ) async {
      final repository = _Repository()..rejectForCash = true;
      final controller = BrokerageController(
        accountId: 'account',
        repository: repository,
      );
      await _pumpTrade(tester, controller, currency);
      await tester.enterText(find.byType(TextField).at(0), '1.25');
      await tester.enterText(find.byType(TextField).at(1), '2.50');
      await tester.enterText(find.byType(TextField).at(2), '0.05');
      if (currency == 'SAR') {
        await tester.enterText(find.byType(TextField).at(3), '3.7500000001');
      }
      tester
          .widget<PrimaryButton>(find.byType(PrimaryButton))
          .onPressed!
          .call();
      await tester.pump();
      expect(repository.calls, 1);
      expect(repository.submitted!.quantity, '1.25');
      expect(repository.submitted!.unitPrice, '2.50');
      expect(repository.submitted!.fees, '0.05');
      expect(
        repository.submitted!.accountFxRate,
        currency == 'SAR' ? '3.7500000001' : null,
      );
      controller.dispose();
    });
  }

  testWidgets('cross-currency preview with missing FX stays unavailable', (
    tester,
  ) async {
    final controller = BrokerageController(
      accountId: 'account',
      repository: _Repository(),
    );
    await _pumpTrade(tester, controller, 'SAR');
    await _enterPreviewAmounts(tester);
    expect(find.text('3.18 USD'), findsOneWidget);
    expect(find.text('Unavailable'), findsOneWidget);
    expect(find.text('3.18 SAR'), findsNothing);
    controller.dispose();
  });

  testWidgets('cross-currency invalid FX never shows a converted number', (
    tester,
  ) async {
    final controller = BrokerageController(
      accountId: 'account',
      repository: _Repository(),
    );
    await _pumpTrade(tester, controller, 'SAR');
    await _enterPreviewAmounts(tester);
    for (final rate in ['1,25', '0', '1.00000000001']) {
      await tester.enterText(find.byType(TextField).at(3), rate);
      await tester.pump();
      expect(find.text('3.18 USD'), findsOneWidget);
      expect(find.text('Unavailable'), findsOneWidget);
    }
    controller.dispose();
  });

  testWidgets('cross-currency valid FX restores the converted preview', (
    tester,
  ) async {
    final controller = BrokerageController(
      accountId: 'account',
      repository: _Repository(),
    );
    await _pumpTrade(tester, controller, 'SAR');
    await _enterPreviewAmounts(tester);
    await tester.enterText(find.byType(TextField).at(3), '3.75');
    await tester.pump();
    expect(find.text('3.18 USD'), findsOneWidget);
    expect(find.text('11.91 SAR'), findsOneWidget);
    expect(find.text('Unavailable'), findsNothing);
    await tester.enterText(find.byType(TextField).at(3), '1,25');
    await tester.pump();
    expect(find.text('11.91 SAR'), findsNothing);
    expect(find.text('Unavailable'), findsOneWidget);
    await tester.enterText(find.byType(TextField).at(3), '');
    await tester.pump();
    expect(find.text('Unavailable'), findsOneWidget);
    await tester.enterText(find.byType(TextField).at(3), '3.75');
    await tester.pump();
    expect(find.text('11.91 SAR'), findsOneWidget);
    controller.dispose();
  });

  testWidgets('same-currency preview keeps its asset total', (tester) async {
    final controller = BrokerageController(
      accountId: 'account',
      repository: _Repository(),
    );
    await _pumpTrade(tester, controller, 'USD');
    await _enterPreviewAmounts(tester);
    expect(find.text('3.18 USD'), findsOneWidget);
    expect(find.text('Unavailable'), findsNothing);
    controller.dispose();
  });
}
