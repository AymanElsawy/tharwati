import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/account_models.dart';
import 'package:tharwati_mobile/accounts/metal/metal_purity.dart';
import 'package:tharwati_mobile/core/decimals.dart';

MetalPurchase purchase({
  String id = 'p1',
  String purity = '21k',
  String grams = '10',
  String cost = '3000',
  String fees = '0',
}) => MetalPurchase(
  id: id,
  accountId: 'a1',
  purity: purity,
  purchasedAt: '2026-01-05T10:00:00Z',
  quantityGrams: grams,
  costPerUnit: cost,
  fees: fees,
  fundingMode: 'external',
  fundingAccountId: null,
  notes: null,
  createdAt: '2026-01-05T10:00:00Z',
);

void main() {
  group('metalPurityFactor', () {
    test('gold karat is karat/24', () {
      expect(D.compare(metalPurityFactor('24k')!, '1'), 0);
      expect(D.compare(metalPurityFactor('18k')!, '0.75'), 0);
      expect(D.compare(metalPurityFactor('21k')!, '0.875'), 0);
    });

    test('silver uses the millesimal table', () {
      expect(D.compare(metalPurityFactor('925')!, '0.925'), 0);
      expect(D.compare(metalPurityFactor('800')!, '0.8'), 0);
    });

    test('unknown purities are unavailable, not guessed', () {
      // `other` is selectable on the account form, so this path is reachable.
      expect(metalPurityFactor('other'), isNull);
      expect(
        metalPurityFactor('23k'),
        isNull,
        reason: '23k is not a real karat',
      );
      expect(metalPurityFactor('999999'), isNull);
    });
  });

  group('derivePricePerGram', () {
    // The Edge Function computes Σ(gramsᵢ × price × factorᵢ). Recovering `price`
    // by division must land back on the number it started from.
    test('round-trips the snapshot total', () {
      const spot = '4000';
      final purchases = [
        purchase(id: 'a', purity: '24k', grams: '10'),
        purchase(id: 'b', purity: '21k', grams: '8'),
        purchase(id: 'c', purity: '18k', grams: '5'),
      ];
      // Σ(grams × factor) = 10*1 + 8*0.875 + 5*0.75 = 20.75
      final total = D.multiply(spot, '20.75')!;

      final derived = derivePricePerGram(
        accountCurrentValue: total,
        purchases: purchases,
      );
      expect(D.compare(derived!, spot), 0);
    });

    test('is unavailable when any purity is unknown', () {
      expect(
        derivePricePerGram(
          accountCurrentValue: '1000',
          purchases: [purchase(purity: 'other')],
        ),
        isNull,
      );
    });

    test('is unavailable when the snapshot has no value', () {
      expect(
        derivePricePerGram(accountCurrentValue: null, purchases: [purchase()]),
        isNull,
      );
    });

    test('is unavailable rather than dividing by zero', () {
      expect(
        derivePricePerGram(
          accountCurrentValue: '0',
          purchases: [purchase(grams: '0')],
        ),
        isNull,
      );
    });
  });

  group('aggregateByPurity', () {
    test('groups, sums cost incl. fees, and sorts by purity', () {
      final rows = aggregateByPurity([
        purchase(id: 'a', purity: '21k', grams: '10', cost: '3000', fees: '50'),
        purchase(id: 'b', purity: '21k', grams: '5', cost: '3200', fees: '0'),
        purchase(id: 'c', purity: '18k', grams: '4', cost: '2600', fees: '10'),
      ], '4000');

      expect(rows.map((r) => r.purity), ['18k', '21k']);

      final k21 = rows[1];
      expect(k21.transactionCount, 2);
      expect(D.compare(k21.totalUnitsGrams, '15'), 0);
      // 10*3000+50 + 5*3200 = 30050 + 16000 = 46050
      expect(D.compare(k21.totalAmount, '46050'), 0);
      // 4000 * 0.875 = 3500/g; 15g -> 52500
      expect(D.compare(k21.currentPricePerGram!, '3500'), 0);
      expect(D.compare(k21.currentValue!, '52500'), 0);
      expect(D.compare(k21.unrealizedGain!, '6450'), 0);
    });

    test('an unknown purity yields an unavailable value, not zero', () {
      final rows = aggregateByPurity([purchase(purity: 'other')], '4000');
      expect(rows.single.currentPricePerGram, isNull);
      expect(rows.single.currentValue, isNull);
      expect(rows.single.unrealizedGain, isNull);
      // Cost is still known — only the valuation is missing.
      expect(D.compare(rows.single.totalAmount, '30000'), 0);
    });

    test('no price makes every value unavailable but keeps grams and cost', () {
      final rows = aggregateByPurity([purchase()], null);
      expect(rows.single.currentValue, isNull);
      expect(D.compare(rows.single.totalUnitsGrams, '10'), 0);
    });

    test('the per-purity values sum back to the account total', () {
      final purchases = [
        purchase(id: 'a', purity: '24k', grams: '10'),
        purchase(id: 'b', purity: '21k', grams: '8'),
      ];
      const spot = '4000';
      final total = D.multiply(spot, '17')!; // 10*1 + 8*0.875
      final price = derivePricePerGram(
        accountCurrentValue: total,
        purchases: purchases,
      );

      var summed = '0';
      for (final row in aggregateByPurity(purchases, price)) {
        summed = D.add(summed, row.currentValue!)!;
      }
      expect(D.compare(summed, total), 0);
    });
  });
}
