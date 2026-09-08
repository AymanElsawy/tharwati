import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/goals/goal_math.dart';
import 'package:tharwati_mobile/goals/goal_models.dart';

GoalProgressEntry entry(
  String id,
  String type,
  String amount, {
  String? reverses,
}) => GoalProgressEntry(
  id: id,
  goalId: 'g',
  entryType: type,
  amount: amount,
  effectiveOn: '2026-01-01',
  note: null,
  reversesEntryId: reverses,
  replacementForEntryId: null,
  createdAt: id,
);

Goal goal({required String targetAmount, String? targetDate}) => Goal(
  id: 'g',
  name: 'Goal',
  goalType: 'other',
  customTypeName: 'Misc',
  targetAmount: targetAmount,
  currencyCode: 'EGP',
  targetDate: targetDate,
  status: 'active',
  archivedAt: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
);

void main() {
  test('funded amount replays progress, withdrawal and reversal', () {
    final entries = [
      entry('1', 'progress', '1000'),
      entry('2', 'progress', '500'),
      entry('3', 'withdrawal', '200'),
      entry('4', 'reversal', '500', reverses: '2'), // undo the +500 progress
    ];
    expect(fundedAmount(entries), '800');
  });

  test(
    'summary caps the display percent at 100 but keeps the real percent',
    () {
      final g = goal(targetAmount: '100000', targetDate: '2028-01-01');
      final summary = toGoalSummary(g, [entry('1', 'progress', '124000')])!;

      expect(summary.fundedAmount, '124000');
      expect(summary.progressPercent, '124');
      expect(summary.displayPercent, '100');
      expect(summary.surplusAmount, '24000');
      expect(summary.isOverdue('2026-09-08'), isFalse);
    },
  );

  test('under-target goal has zero surplus and uncapped percent', () {
    final g = goal(targetAmount: '50000');
    final summary = toGoalSummary(g, [entry('1', 'progress', '34000')])!;

    expect(summary.progressPercent, '68');
    expect(summary.displayPercent, '68');
    expect(summary.surplusAmount, '0');
  });
}
