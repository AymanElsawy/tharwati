import 'decimals.dart';

enum SecuritiesAllocationGroup {
  stocks,
  etfs,
  bonds,
  mutualFunds,
  cryptocurrency,
  other,
}

class SecuritiesAllocationValue {
  const SecuritiesAllocationValue(this.assetTypeCode, this.valueBase);
  final String assetTypeCode;
  final String valueBase;
}

class SecuritiesAllocationItem {
  const SecuritiesAllocationItem({
    required this.group,
    required this.valueBase,
    required this.percentage,
  });
  final SecuritiesAllocationGroup group;
  final String valueBase;
  final String percentage;
}

SecuritiesAllocationGroup securitiesGroupFor(String code) => switch (code) {
  'stock' => SecuritiesAllocationGroup.stocks,
  'etf' => SecuritiesAllocationGroup.etfs,
  'bond' => SecuritiesAllocationGroup.bonds,
  'mutual_fund' => SecuritiesAllocationGroup.mutualFunds,
  'cryptocurrency' => SecuritiesAllocationGroup.cryptocurrency,
  _ => SecuritiesAllocationGroup.other,
};

/// Groups positive security values and makes the displayed percentages total
/// exactly 100 by assigning the rounding residual to the last present group.
List<SecuritiesAllocationItem> calculateSecuritiesAllocation(
  Iterable<SecuritiesAllocationValue> values,
) {
  final totals = <SecuritiesAllocationGroup, String>{};
  for (final value in values) {
    if (!D.isPositive(value.valueBase)) continue;
    final group = securitiesGroupFor(value.assetTypeCode);
    totals[group] = D.add(totals[group] ?? '0', value.valueBase)!;
  }
  if (totals.isEmpty) return const [];
  final groups = SecuritiesAllocationGroup.values
      .where(totals.containsKey)
      .toList();
  final total = D.sum(groups.map((group) => totals[group]))!;
  var allocated = '0';
  return [
    for (var index = 0; index < groups.length; index++)
      () {
        final group = groups[index];
        final percentage = index == groups.length - 1
            ? D.subtract('100', allocated)!
            : D.divide(
                D.multiply(D.divide(totals[group], total, scale: 8), '100'),
                '1',
                scale: 2,
              )!;
        allocated = D.add(allocated, percentage)!;
        return SecuritiesAllocationItem(
          group: group,
          valueBase: totals[group]!,
          percentage: percentage,
        );
      }(),
  ];
}
