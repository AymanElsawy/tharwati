import 'package:flutter/foundation.dart';

/// The RPC requires every owned account ID, including hidden lifecycle sections.
bool hasCompleteAccountOrder(
  List<String> accountIds,
  List<String> canonicalIds,
) {
  final owned = accountIds.toSet();
  return owned.length == accountIds.length &&
      canonicalIds.length == owned.length &&
      canonicalIds.toSet().length == canonicalIds.length &&
      canonicalIds.every(owned.contains);
}

/// Replace this section's slots in the complete canonical order. newIndex is
/// the adjusted index supplied by SliverReorderableList.onReorderItem.
List<String>? reorderAccountSection(
  List<String> canonicalIds,
  List<String> sectionIds,
  int oldIndex,
  int newIndex,
) {
  if (oldIndex < 0 ||
      oldIndex >= sectionIds.length ||
      newIndex < 0 ||
      newIndex >= sectionIds.length) {
    return null;
  }
  final sectionSet = sectionIds.toSet();
  if (sectionSet.length != sectionIds.length) return null;
  final sectionSlots = canonicalIds.where(sectionSet.contains).toList();
  if (!listEquals(sectionSlots, sectionIds)) return null;
  final moved = [...sectionSlots];
  final id = moved.removeAt(oldIndex);
  moved.insert(newIndex, id);
  if (listEquals(moved, sectionSlots)) return null;
  var sectionIndex = 0;
  return [
    for (final accountId in canonicalIds)
      if (sectionSet.contains(accountId)) moved[sectionIndex++] else accountId,
  ];
}
