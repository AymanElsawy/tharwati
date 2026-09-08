// Goals data model — port of the web `GoalRow` / `GoalProgressEntryRow` shapes
// (src/features/goals/domain/goals.ts + repositories/goals.repository.ts).
// Money and quantity values are decimal strings end to end (see lib/core/decimals.dart).

/// Fixed goal types, matching the DB check constraint and the web `goalTypes`.
const goalTypes = <String>[
  'buy_home',
  'buy_car',
  'travel',
  'education',
  'other',
];

/// Supported currencies for a goal (DB check + web `currencyInvalid` regex).
const goalCurrencies = <String>['USD', 'SAR', 'EGP', 'EUR', 'GBP'];

const goalStatuses = <String>['active', 'completed', 'cancelled'];

/// English label for a goal type (`other` falls back to its custom name).
String goalTypeLabel(String goalType, {String? customTypeName}) {
  switch (goalType) {
    case 'buy_home':
      return 'Buy a home';
    case 'buy_car':
      return 'Buy a car';
    case 'travel':
      return 'Travel';
    case 'education':
      return 'Education';
    default:
      final custom = customTypeName?.trim();
      return (custom == null || custom.isEmpty) ? 'Other' : custom;
  }
}

bool showsCustomGoalType(String goalType) => goalType == 'other';

/// Currency is permanently locked once any progress history exists.
bool isGoalCurrencyLocked(bool hasHistory) => hasHistory;

class Goal {
  const Goal({
    required this.id,
    required this.name,
    required this.goalType,
    required this.customTypeName,
    required this.targetAmount,
    required this.currencyCode,
    required this.targetDate,
    required this.status,
    required this.archivedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String goalType;
  final String? customTypeName;
  final String targetAmount; // decimal string
  final String currencyCode;
  final String? targetDate; // 'YYYY-MM-DD' or null
  final String status; // 'active' | 'completed' | 'cancelled'
  final String? archivedAt; // ISO timestamp or null
  final String createdAt;
  final String updatedAt;

  bool get isArchived => archivedAt != null;
  bool get isActive => status == 'active';
  bool get isMutable => isActive && !isArchived;

  String get typeLabel =>
      goalTypeLabel(goalType, customTypeName: customTypeName);

  factory Goal.fromRow(Map<String, dynamic> row) => Goal(
    id: row['id'] as String,
    name: (row['name'] as String?) ?? '',
    goalType: (row['goal_type'] as String?) ?? 'other',
    customTypeName: row['custom_type_name'] as String?,
    targetAmount: (row['target_amount'] as String?) ?? '0',
    currencyCode: row['currency_code'] as String,
    targetDate: row['target_date'] as String?,
    status: (row['status'] as String?) ?? 'active',
    archivedAt: row['archived_at'] as String?,
    createdAt: '${row['created_at']}',
    updatedAt: '${row['updated_at'] ?? row['created_at']}',
  );
}

class GoalProgressEntry {
  const GoalProgressEntry({
    required this.id,
    required this.goalId,
    required this.entryType,
    required this.amount,
    required this.effectiveOn,
    required this.note,
    required this.reversesEntryId,
    required this.replacementForEntryId,
    required this.createdAt,
  });

  final String id;
  final String goalId;
  final String entryType; // 'progress' | 'withdrawal' | 'reversal'
  final String amount; // decimal string, always positive
  final String effectiveOn; // 'YYYY-MM-DD'
  final String? note;
  final String? reversesEntryId;
  final String? replacementForEntryId;
  final String createdAt;

  factory GoalProgressEntry.fromRow(Map<String, dynamic> row) =>
      GoalProgressEntry(
        id: row['id'] as String,
        goalId: '${row['goal_id']}',
        entryType: row['entry_type'] as String,
        amount: (row['amount'] as String?) ?? '0',
        effectiveOn: '${row['effective_on']}',
        note: row['note'] as String?,
        reversesEntryId: row['reverses_entry_id'] as String?,
        replacementForEntryId: row['replacement_for_entry_id'] as String?,
        createdAt: '${row['created_at']}',
      );
}

/// A history entry with the two back-links the timeline needs: the reversal that
/// negated it, and the replacement that corrected it (port of the web
/// `GoalHistoryEntry`).
class GoalHistoryEntry {
  const GoalHistoryEntry({
    required this.entry,
    required this.reversedByEntryId,
    required this.replacementEntryId,
  });

  final GoalProgressEntry entry;
  final String? reversedByEntryId;
  final String? replacementEntryId;

  String get id => entry.id;
}

/// One correctable/root entry plus its recorded reversal/replacement children,
/// oldest child first (port of the web `GoalHistoryGroup`).
class GoalHistoryGroup {
  const GoalHistoryGroup({required this.root, required this.related});

  final GoalHistoryEntry root;
  final List<GoalHistoryEntry> related;

  List<GoalHistoryEntry> get all => [root, ...related];
}

class GoalSummary {
  const GoalSummary({
    required this.goal,
    required this.fundedAmount,
    required this.progressPercent,
    required this.displayPercent,
    required this.surplusAmount,
    required this.hasHistory,
  });

  final Goal goal;
  final String fundedAmount; // decimal string
  final String progressPercent; // uncapped, decimal string
  final String displayPercent; // capped at 100 for the bar, decimal string
  final String surplusAmount; // amount over target, "0" if none
  final bool hasHistory;

  bool isOverdue(String today) =>
      goal.isActive &&
      goal.targetDate != null &&
      goal.targetDate!.compareTo(today) < 0;
}

class DashboardGoalsModel {
  const DashboardGoalsModel({required this.goals, required this.hasAnyGoals});

  /// At most 3, ordered by target date ascending (undated last).
  final List<GoalSummary> goals;

  /// True if the user has *any* goal (active, completed, cancelled or archived)
  /// — distinguishes "create your first goal" from "no active goals".
  final bool hasAnyGoals;
}

/// The full Goals page read model — every goal summarised, plus each goal's
/// history entries with correction back-links (port of the web `GoalsReadModel`).
class GoalsReadModel {
  const GoalsReadModel({required this.goals, required this.entriesByGoal});

  final List<GoalSummary> goals;
  final Map<String, List<GoalHistoryEntry>> entriesByGoal;

  GoalSummary? goalById(String id) {
    for (final g in goals) {
      if (g.goal.id == id) return g;
    }
    return null;
  }
}
