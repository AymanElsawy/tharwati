import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/goals/goal_history.dart';
import 'package:tharwati_mobile/goals/goal_math.dart';
import 'package:tharwati_mobile/goals/goal_models.dart';

GoalProgressEntry e(
  String id,
  String type,
  String amount, {
  String? reverses,
  String? replaces,
  String created = '',
}) => GoalProgressEntry(
  id: id,
  goalId: 'g',
  entryType: type,
  amount: amount,
  effectiveOn: '2026-01-01',
  note: null,
  reversesEntryId: reverses,
  replacementForEntryId: replaces,
  createdAt: created.isEmpty ? id : created,
);

void main() {
  group('validateGoalInput', () {
    GoalFormInput input({
      String name = 'Car',
      String type = 'buy_car',
      String? custom,
      String target = '1000',
      String currency = 'EGP',
      String? date,
      String? saved,
      String? savedOn,
    }) => GoalFormInput(
      name: name,
      goalType: type,
      customTypeName: custom,
      targetAmount: target,
      currencyCode: currency,
      targetDate: date,
      savedSoFar: saved,
      savedOn: savedOn,
    );

    test('accepts a well-formed goal', () {
      expect(validateGoalInput(input()), isNull);
    });

    test('rejects a blank name', () {
      expect(validateGoalInput(input(name: '  ')), GoalValidation.nameRequired);
    });

    test('requires a custom type name for "other"', () {
      expect(
        validateGoalInput(input(type: 'other')),
        GoalValidation.customTypeRequired,
      );
      expect(validateGoalInput(input(type: 'other', custom: 'Boat')), isNull);
    });

    test('rejects a non-positive target', () {
      expect(
        validateGoalInput(input(target: '0')),
        GoalValidation.targetPositive,
      );
      expect(
        validateGoalInput(input(target: '-5')),
        GoalValidation.targetPositive,
      );
    });

    test('rejects an unsupported currency', () {
      expect(
        validateGoalInput(input(currency: 'JPY')),
        GoalValidation.currencyInvalid,
      );
    });

    test('rejects a non-positive starting amount', () {
      expect(
        validateGoalInput(input(saved: '0')),
        GoalValidation.savedPositive,
      );
    });

    test('rejects a future starting date', () {
      expect(
        validateGoalInput(input(saved: '10', savedOn: '2999-01-01')),
        GoalValidation.dateNotFuture,
      );
    });
  });

  group('validateEntryInput', () {
    test('rejects a non-positive amount', () {
      expect(
        validateEntryInput(
          GoalEntryInput(
            entryType: 'progress',
            amount: '0',
            effectiveOn: '2026-01-01',
            note: null,
          ),
        ),
        GoalValidation.amountPositive,
      );
    });

    test('rejects a future or malformed effective date', () {
      expect(
        validateEntryInput(
          GoalEntryInput(
            entryType: 'progress',
            amount: '10',
            effectiveOn: '2999-01-01',
            note: null,
          ),
        ),
        GoalValidation.dateNotFuture,
      );
      expect(
        validateEntryInput(
          GoalEntryInput(
            entryType: 'progress',
            amount: '10',
            effectiveOn: 'not-a-date',
            note: null,
          ),
        ),
        GoalValidation.dateNotFuture,
      );
    });
  });

  group('groupGoalHistoryEntries', () {
    test('nests a reversal + replacement under their original entry', () {
      final entries = [
        e('1', 'progress', '1000', created: '2026-01-01'),
        e('2', 'progress', '500', created: '2026-01-02'),
        e('3', 'reversal', '500', reverses: '2', created: '2026-01-03'),
        e('4', 'progress', '800', replaces: '2', created: '2026-01-04'),
      ];
      final history = buildGoalHistoryEntries(entries)['g']!;
      final groups = groupGoalHistoryEntries(history);

      // Two roots: entry 1 and entry 2 (entry 2 owns the correction chain).
      expect(groups.map((x) => x.root.id), ['1', '2']);
      expect(groups[0].related, isEmpty);
      expect(groups[1].related.map((x) => x.id), ['3', '4']);

      final byId = {for (final h in history) h.id: h};
      // The reversal negates the +500 progress, so it shows as −.
      expect(historySign(byId['3']!, byId), '−');
      // Original entry 2 is flagged as reversed and corrected.
      expect(byId['2']!.reversedByEntryId, '3');
      expect(byId['2']!.replacementEntryId, '4');
    });
  });
}
