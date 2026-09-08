import '../core/decimals.dart';
import 'goal_models.dart';

/// Today as `YYYY-MM-DD` in the device's local zone — port of the web `today()`
/// (which uses UTC; a goal's "not in the future" check is date-only and the DB
/// re-validates against `current_date`, so local is the friendlier client guard).
String goalToday() {
  final now = DateTime.now();
  final m = now.month.toString().padLeft(2, '0');
  final d = now.day.toString().padLeft(2, '0');
  return '${now.year}-$m-$d';
}

final _isoDate = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// Validation codes, 1:1 with the web `GoalValidationCode`.
enum GoalValidation {
  nameRequired,
  typeInvalid,
  customTypeRequired,
  targetPositive,
  currencyInvalid,
  savedPositive,
  dateNotFuture,
  amountPositive,
}

String goalValidationMessage(GoalValidation code) {
  switch (code) {
    case GoalValidation.nameRequired:
      return 'Give the goal a name.';
    case GoalValidation.typeInvalid:
      return 'Pick a goal type.';
    case GoalValidation.customTypeRequired:
      return 'Name the custom goal type.';
    case GoalValidation.targetPositive:
      return 'Target amount must be greater than zero.';
    case GoalValidation.currencyInvalid:
      return 'Choose a supported currency.';
    case GoalValidation.savedPositive:
      return 'Starting amount must be greater than zero.';
    case GoalValidation.dateNotFuture:
      return 'The date can’t be in the future.';
    case GoalValidation.amountPositive:
      return 'Amount must be greater than zero.';
  }
}

class GoalFormInput {
  const GoalFormInput({
    required this.name,
    required this.goalType,
    required this.customTypeName,
    required this.targetAmount,
    required this.currencyCode,
    required this.targetDate,
    this.savedSoFar,
    this.savedOn,
  });

  final String name;
  final String goalType;
  final String? customTypeName;
  final String targetAmount; // decimal string
  final String currencyCode;
  final String? targetDate; // 'YYYY-MM-DD' or null
  final String? savedSoFar; // decimal string, add-only
  final String? savedOn; // 'YYYY-MM-DD', add-only
}

class GoalEntryInput {
  const GoalEntryInput({
    required this.entryType, // 'progress' | 'withdrawal'
    required this.amount,
    required this.effectiveOn,
    required this.note,
  });

  final String entryType;
  final String amount; // decimal string
  final String effectiveOn; // 'YYYY-MM-DD'
  final String? note;
}

/// Port of the web `validateGoalInput`.
GoalValidation? validateGoalInput(GoalFormInput input) {
  if (input.name.trim().isEmpty) return GoalValidation.nameRequired;
  if (!goalTypes.contains(input.goalType)) return GoalValidation.typeInvalid;
  if (input.goalType == 'other' &&
      (input.customTypeName == null || input.customTypeName!.trim().isEmpty)) {
    return GoalValidation.customTypeRequired;
  }
  if ((D.compare(input.targetAmount, '0') ?? -1) != 1) {
    return GoalValidation.targetPositive;
  }
  if (!goalCurrencies.contains(input.currencyCode)) {
    return GoalValidation.currencyInvalid;
  }
  if (input.savedSoFar != null &&
      input.savedSoFar!.isNotEmpty &&
      (D.compare(input.savedSoFar, '0') ?? -1) != 1) {
    return GoalValidation.savedPositive;
  }
  if (input.savedOn != null &&
      input.savedOn!.isNotEmpty &&
      input.savedOn!.compareTo(goalToday()) > 0) {
    return GoalValidation.dateNotFuture;
  }
  return null;
}

/// Port of the web `validateEntryInput`.
GoalValidation? validateEntryInput(GoalEntryInput input) {
  if ((D.compare(input.amount, '0') ?? -1) != 1) {
    return GoalValidation.amountPositive;
  }
  if (!_isoDate.hasMatch(input.effectiveOn) ||
      input.effectiveOn.compareTo(goalToday()) > 0) {
    return GoalValidation.dateNotFuture;
  }
  return null;
}

/// Replays progress entries to a funded amount — port of the web's
/// `fundedAmount` (`src/features/goals/domain/goals.ts`). Entries must be in
/// creation order. Returns null if any stored decimal is invalid.
String? fundedAmount(List<GoalProgressEntry> entries) {
  final byId = {for (final e in entries) e.id: e};
  var total = '0';
  for (final entry in entries) {
    String? next;
    switch (entry.entryType) {
      case 'progress':
        next = D.add(total, entry.amount);
      case 'withdrawal':
        next = D.subtract(total, entry.amount);
      default: // reversal
        final original = entry.reversesEntryId == null
            ? null
            : byId[entry.reversesEntryId];
        if (original?.entryType == 'progress') {
          next = D.subtract(total, entry.amount);
        } else if (original?.entryType == 'withdrawal') {
          next = D.add(total, entry.amount);
        } else {
          next = null;
        }
    }
    if (next == null) return null;
    total = next;
  }
  return total;
}

/// Port of `toGoalSummary`. Returns null when stored decimals can't be read —
/// the card then shows its unavailable state rather than zeroes.
GoalSummary? toGoalSummary(Goal goal, List<GoalProgressEntry> entries) {
  final funded = fundedAmount(entries);
  if (funded == null) return null;

  final ratio = D.divide(funded, goal.targetAmount, scale: 8);
  final percentage = ratio == null ? null : D.multiply(ratio, '100');
  if (percentage == null) return null;

  final surplus = (D.compare(funded, goal.targetAmount) ?? 0) > 0
      ? D.subtract(funded, goal.targetAmount)
      : '0';
  if (surplus == null) return null;

  return GoalSummary(
    goal: goal,
    fundedAmount: funded,
    progressPercent: percentage,
    displayPercent: (D.compare(percentage, '100') ?? 0) > 0
        ? '100'
        : percentage,
    surplusAmount: surplus,
    hasHistory: entries.isNotEmpty,
  );
}
