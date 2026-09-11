import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_activity.dart';
import 'package:tharwati_mobile/accounts/brokerage/brokerage_valuation.dart';
import 'package:tharwati_mobile/core/decimals.dart';

ActivityEntry entry({
  String? memo,
  String? assetId,
  String? quantityDelta,
  String? accountId,
  String? entrySide,
  String amount = '0',
}) => ActivityEntry(
  accountId: accountId,
  assetId: assetId,
  quantityDelta: quantityDelta,
  costBasisDelta: null,
  accountCostBasisDelta: null,
  accountFxRate: null,
  unitPrice: null,
  transactionAmount: amount,
  accountAmount: amount,
  entrySide: entrySide,
  memo: memo,
  asset: null,
);

ActivityItem item({
  required String id,
  String type = 'buy',
  String? reverses,
  String? corrects,
  String occurredAt = '2026-09-09T10:00:00Z',
  List<ActivityEntry> entries = const [],
}) => ActivityItem(
  id: id,
  occurredAt: occurredAt,
  transactionTypeCode: type,
  transactionCurrencyCode: 'USD',
  notes: null,
  reversesTransactionId: reverses,
  correctsTransactionId: corrects,
  entries: entries,
);

void main() {
  group('presentActivity', () {
    test('a plain row is current', () {
      final rows = presentActivity([item(id: 'a')]);
      expect(rows.single.presentation, ActivityPresentation.current);
    });

    test('a reversed row is marked deleted, and the reversal row is kept', () {
      final rows = presentActivity([
        item(id: 'rev', reverses: 'a'),
        item(id: 'a'),
      ]);
      expect(rows.map((r) => r.id), ['rev', 'a']);
      expect(
        rows.firstWhere((r) => r.id == 'a').presentation,
        ActivityPresentation.deleted,
      );
    });

    test('a correction is marked updated', () {
      final rows = presentActivity([
        item(id: 'fix', corrects: 'a'),
        item(id: 'a'),
      ]);
      expect(
        rows.firstWhere((r) => r.id == 'fix').presentation,
        ActivityPresentation.updated,
      );
    });

    // A correction is posted as reversal + replacement. The original is then
    // both reversed and corrected, and showing it too would double-count.
    test('a row that was both reversed and corrected is dropped', () {
      final rows = presentActivity([
        item(id: 'fix', corrects: 'a'),
        item(id: 'rev', reverses: 'a'),
        item(id: 'a'),
      ]);
      expect(rows.map((r) => r.id), isNot(contains('a')));
      expect(rows.map((r) => r.id), ['fix', 'rev']);
    });

    test('opening_position_reversal never surfaces', () {
      final rows = presentActivity([
        item(id: 'r', type: 'opening_position_reversal', reverses: 'a'),
        item(id: 'a', type: 'opening_position'),
      ]);
      expect(rows.map((r) => r.id), ['a']);
      expect(rows.single.presentation, ActivityPresentation.deleted);
    });
  });

  group('activityLabel', () {
    test('trade and opening labels', () {
      expect(activityLabel(item(id: '1', type: 'buy'), 'acc'), 'Buy');
      expect(activityLabel(item(id: '1', type: 'sell'), 'acc'), 'Sell');
      expect(
        activityLabel(item(id: '1', type: 'opening_position'), 'acc'),
        'Existing holding',
      );
    });

    test('dividend reads by how it was settled', () {
      expect(activityLabel(item(id: '1', type: 'dividend'), 'acc'), 'Dividend');
      expect(
        activityLabel(
          item(
            id: '1',
            type: 'dividend',
            entries: [entry(memo: 'brokerage_dividend_reinvestment')],
          ),
          'acc',
        ),
        'Dividend reinvested',
      );
      expect(
        activityLabel(
          item(
            id: '1',
            type: 'dividend',
            entries: [entry(memo: 'brokerage_dividend_partial_reinvestment')],
          ),
          'acc',
        ),
        'Dividend partially reinvested',
      );
    });

    test('a transfer reads by direction relative to this account', () {
      final incoming = item(
        id: '1',
        type: 'transfer',
        entries: [entry(accountId: 'acc', entrySide: 'debit')],
      );
      final outgoing = item(
        id: '2',
        type: 'transfer',
        entries: [entry(accountId: 'acc', entrySide: 'credit')],
      );
      expect(activityLabel(incoming, 'acc'), 'Transfer in');
      expect(activityLabel(outgoing, 'acc'), 'Transfer out');
    });
  });

  group('activityAssetEntry', () {
    // A reinvested dividend has both a cash leg and an asset leg; the
    // reinvestment leg is the one carrying the units.
    test('reinvestment legs win over the gross cash leg', () {
      final e = activityAssetEntry(
        item(
          id: '1',
          type: 'dividend',
          entries: [
            entry(memo: 'brokerage_dividend_gross'),
            entry(memo: 'brokerage_dividend_reinvestment', assetId: 'a1'),
          ],
        ),
      );
      expect(e!.memo, 'brokerage_dividend_reinvestment');
    });

    test('falls back to any entry that actually moved quantity', () {
      final e = activityAssetEntry(
        item(
          id: '1',
          entries: [
            entry(memo: 'something_else'),
            entry(assetId: 'a1', quantityDelta: '3'),
          ],
        ),
      );
      expect(e!.assetId, 'a1');
    });

    test('a zero quantity delta does not count as the asset leg', () {
      final e = activityAssetEntry(
        item(
          id: '1',
          entries: [entry(assetId: 'a1', quantityDelta: '0')],
        ),
      );
      expect(e, isNull);
    });
  });

  test('sumEntries totals only matching memos, null when none match', () {
    final entries = [
      entry(memo: 'tax', amount: '5'),
      entry(memo: 'tax', amount: '2.5'),
      entry(memo: 'other', amount: '99'),
    ];
    expect(
      D.compare(sumEntries(entries, 'tax', (e) => e.transactionAmount)!, '7.5'),
      0,
    );
    expect(sumEntries(entries, 'missing', (e) => e.transactionAmount), isNull);
  });

  group('previewDividend', () {
    test('net is gross minus tax and fees', () {
      final p = previewDividend(
        mode: DividendMode.cash,
        gross: '100',
        tax: '15',
        fees: '2',
      );
      expect(D.compare(p.net!, '83'), 0);
      expect(p.quantityAdded, isNull);
    });

    test('full reinvestment buys net / price', () {
      final p = previewDividend(
        mode: DividendMode.full,
        gross: '100',
        tax: '0',
        fees: '0',
        unitPrice: '25',
      );
      expect(D.compare(p.quantityAdded!, '4'), 0);
    });

    test('partial splits into reinvested units and a cash remainder', () {
      final p = previewDividend(
        mode: DividendMode.partial,
        gross: '100',
        tax: '10',
        fees: '0',
        unitPrice: '30',
        reinvestedAmount: '60',
      );
      expect(D.compare(p.net!, '90'), 0);
      expect(D.compare(p.cashRemainder!, '30'), 0);
      expect(D.compare(p.quantityAdded!, '2'), 0);
    });

    test('blank tax and fees count as zero', () {
      final p = previewDividend(
        mode: DividendMode.cash,
        gross: '50',
        tax: '',
        fees: '  ',
      );
      expect(D.compare(p.net!, '50'), 0);
    });
  });

  group('validateDividend', () {
    Map<String, String> run({
      DividendMode mode = DividendMode.cash,
      String gross = '100',
      String tax = '0',
      String fees = '0',
      String unitPrice = '',
      String reinvested = '',
      bool currencyMatches = true,
    }) => validateDividend(
      mode: mode,
      assetId: 'a1',
      gross: gross,
      tax: tax,
      fees: fees,
      occurredAt: '2026-09-09T10:00:00',
      unitPrice: unitPrice,
      reinvestedAmount: reinvested,
      currencyMatches: currencyMatches,
    );

    test('a well-formed cash dividend passes', () {
      expect(run(), isEmpty);
    });

    // Tax and fees exceeding the gross is not a dividend at all.
    test('a non-positive net is rejected', () {
      expect(run(gross: '10', tax: '10'), contains('gross'));
      expect(run(gross: '10', tax: '8', fees: '5'), contains('gross'));
    });

    test('an asset in another currency is rejected', () {
      expect(run(currencyMatches: false), contains('assetId'));
    });

    test('reinvestment needs a positive unit price', () {
      expect(run(mode: DividendMode.full), contains('unitPrice'));
      expect(
        run(mode: DividendMode.full, unitPrice: '0'),
        contains('unitPrice'),
      );
      expect(run(mode: DividendMode.full, unitPrice: '25'), isEmpty);
    });

    // At or above the net it is a full reinvestment, which is a different RPC.
    test('partial must reinvest strictly less than the net', () {
      expect(
        run(mode: DividendMode.partial, unitPrice: '25', reinvested: '100'),
        contains('reinvestedAmount'),
      );
      expect(
        run(mode: DividendMode.partial, unitPrice: '25', reinvested: '150'),
        contains('reinvestedAmount'),
      );
      expect(
        run(mode: DividendMode.partial, unitPrice: '25', reinvested: '60'),
        isEmpty,
      );
    });

    test('partial needs a positive reinvested amount', () {
      expect(
        run(mode: DividendMode.partial, unitPrice: '25', reinvested: '0'),
        contains('reinvestedAmount'),
      );
    });
  });

  test('groupActivityByLocalDate keeps feed order and buckets by day', () {
    final groups = groupActivityByLocalDate([
      item(id: 'a', occurredAt: '2026-09-09T10:00:00Z'),
      item(id: 'b', occurredAt: '2026-09-09T18:00:00Z'),
      item(id: 'c', occurredAt: '2026-09-08T10:00:00Z'),
    ]);
    expect(groups.length, 2);
    expect(groups.first.items.map((i) => i.id), ['a', 'b']);
    expect(groups.last.items.map((i) => i.id), ['c']);
  });

  test('absoluteDecimal drops the ledger sign', () {
    expect(absoluteDecimal('-42.5'), '42.5');
    expect(absoluteDecimal('42.5'), '42.5');
  });
}
