import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/account_form.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/account_valuation.dart';

MetalPurchase purchase(String grams, String costPerGram, {String fees = '0'}) =>
    MetalPurchase(
      id: grams,
      accountId: 'g',
      purity: '21k',
      purchasedAt: '2026-01-01T00:00:00Z',
      quantityGrams: grams,
      costPerUnit: costPerGram,
      fees: fees,
      fundingMode: 'external',
      fundingAccountId: null,
      notes: null,
      createdAt: '2026-01-01',
    );

Account account({required AccountType type, String ownership = '100'}) =>
    Account(
      id: 'a',
      type: type,
      name: 'X',
      currencyCode: 'EGP',
      openingBalance: '0',
      isActive: true,
      notes: null,
      bankSubtype: null,
      creditCardLimit: null,
      dueDayOfMonth: null,
      investmentType: null,
      balanceGrams: null,
      propertyType: null,
      ownershipPercentage: ownership,
      businessType: null,
      industry: null,
      location: null,
      metalType: type == AccountType.gold ? 'gold' : null,
      purity: null,
      purchaseDate: null,
      costPerUnit: null,
      closedReason: null,
      closedOn: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    );

void main() {
  test('weighted-average cost folds fees into the acquisition cost', () {
    // First buy: 10 g @ 100 + 50 fees => cost basis 1050, cost/g = 105.
    final first = applyMetalPurchase(
      oldBalanceGrams: '0',
      oldCostPerUnit: '0',
      quantityGrams: '10',
      costPerUnit: '100',
      fees: '50',
    )!;
    expect(first.balanceGrams, '10');
    expect(first.costPerUnit, '105');

    // Second buy: 10 g @ 205, no fees.
    // total cost = 10*105 + 10*205 = 3100 over 20 g => 155/g.
    final second = applyMetalPurchase(
      oldBalanceGrams: first.balanceGrams,
      oldCostPerUnit: first.costPerUnit,
      quantityGrams: '10',
      costPerUnit: '205',
    )!;
    expect(second.balanceGrams, '20');
    expect(second.costPerUnit, '155');
  });

  test('foldMetalPurchases replays a purchase list to the same result', () {
    final wa = foldMetalPurchases([
      purchase('10', '100', fees: '50'),
      purchase('10', '205'),
    ]);
    expect(wa.balanceGrams, '20');
    expect(wa.costPerUnit, '155');
  });

  test('totalMetalCost sums historical cost + fees per purchase', () {
    final total = totalMetalCost([
      purchase('10', '100', fees: '50'), // 1050
      purchase('5', '200'), // 1000
    ]);
    expect(total, '2050');
  });

  test('real estate current value is latest valuation * ownership', () {
    final resolved = resolveCurrentValue(
      account: account(type: AccountType.realEstate, ownership: '50'),
      latestValuation: const AccountValuation(
        accountId: 'a',
        amount: '1260000',
        valuedOn: '2026-01-01',
        method: null,
      ),
    );
    expect(resolved.amount, '630000');
    expect(resolved.source, CurrentValueSource.valuation);
  });

  test('real estate with no valuation reads unavailable, not a fallback', () {
    final resolved = resolveCurrentValue(
      account: account(type: AccountType.realEstate),
    );
    expect(resolved.isUnavailable, isTrue);
  });

  test('bank credit available credit / amount due are decimal-safe', () {
    // limit 120000, available (current_balance) 35801 => amount due 84199.
    expect(creditCardAmountDue('120000', '35801'), '84199');
  });
}
