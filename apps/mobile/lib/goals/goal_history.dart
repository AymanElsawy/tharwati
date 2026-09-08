import 'goal_models.dart';

/// Port of the web `buildGoalHistoryEntries` (services/goals.service.ts):
/// annotates every entry with the id of the reversal that negated it and the id
/// of the replacement that corrected it, grouped by goal. Input order is
/// preserved.
Map<String, List<GoalHistoryEntry>> buildGoalHistoryEntries(
  List<GoalProgressEntry> entries,
) {
  final reversalByOriginal = <String, String>{};
  final replacementByOriginal = <String, String>{};
  for (final e in entries) {
    if (e.reversesEntryId != null) {
      reversalByOriginal[e.reversesEntryId!] = e.id;
    }
    if (e.replacementForEntryId != null) {
      replacementByOriginal[e.replacementForEntryId!] = e.id;
    }
  }

  final byGoal = <String, List<GoalHistoryEntry>>{};
  for (final e in entries) {
    (byGoal[e.goalId] ??= []).add(
      GoalHistoryEntry(
        entry: e,
        reversedByEntryId: reversalByOriginal[e.id],
        replacementEntryId: replacementByOriginal[e.id],
      ),
    );
  }
  return byGoal;
}

/// Port of the web `groupGoalHistoryEntries`: roots are entries that neither
/// reverse nor replace another; each root's reversal/replacement children follow
/// it, oldest `createdAt` first, recursively (a replacement can itself be
/// corrected).
List<GoalHistoryGroup> groupGoalHistoryEntries(List<GoalHistoryEntry> entries) {
  final byOriginal = <String, List<GoalHistoryEntry>>{};
  final roots = <GoalHistoryEntry>[];
  for (final e in entries) {
    final originalId = e.entry.reversesEntryId ?? e.entry.replacementForEntryId;
    if (originalId != null) {
      (byOriginal[originalId] ??= []).add(e);
    } else {
      roots.add(e);
    }
  }

  List<GoalHistoryEntry> collect(GoalHistoryEntry entry) {
    final children = [...?byOriginal[entry.id]]
      ..sort((a, b) => a.entry.createdAt.compareTo(b.entry.createdAt));
    return children.expand((child) => [child, ...collect(child)]).toList();
  }

  return roots
      .map((root) => GoalHistoryGroup(root: root, related: collect(root)))
      .toList();
}

/// The kind an entry represents for labelling: a reversal/replacement inherits
/// the kind of the original it points at (port of the web `historyEntryType`).
String historyEntryKind(
  GoalHistoryEntry entry,
  Map<String, GoalHistoryEntry> byId,
) {
  final e = entry.entry;
  final original = e.reversesEntryId != null
      ? byId[e.reversesEntryId]
      : e.replacementForEntryId != null
      ? byId[e.replacementForEntryId]
      : entry;
  return original?.entry.entryType == 'withdrawal' ? 'withdrawal' : 'progress';
}

/// `+` / `−` shown against an entry's amount (port of the web `historySign`).
String historySign(GoalHistoryEntry entry, Map<String, GoalHistoryEntry> byId) {
  switch (entry.entry.entryType) {
    case 'progress':
      return '+';
    case 'withdrawal':
      return '−';
    default: // reversal: opposite of the original's effect
      return historyEntryKind(entry, byId) == 'withdrawal' ? '+' : '−';
  }
}
