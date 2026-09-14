import '../../core/decimals.dart';
import '../../dashboard/logic/dashboard_aggregate.dart';
import 'wealth_analysis.dart';

class WealthTarget {
  const WealthTarget({required this.assetClass, required this.percentage});

  final AssetGroup assetClass;
  final String percentage;
}

class WealthTargetPlan {
  const WealthTargetPlan({
    required this.targets,
    required this.tolerancePercentage,
  });

  final List<WealthTarget> targets;
  final String tolerancePercentage;
}

class WealthTargetInputSummary {
  const WealthTargetInputSummary({
    required this.total,
    required this.isValid,
    required this.targets,
  });

  final String total;
  final bool isValid;
  final List<WealthTarget>? targets;
}

class WealthToleranceInputSummary {
  const WealthToleranceInputSummary({
    required this.isValid,
    required this.tolerancePercentage,
  });

  final bool isValid;
  final String? tolerancePercentage;
}

enum WealthTargetDriftStatus { within, above, below }

class WealthTargetDriftRow {
  const WealthTargetDriftRow({
    required this.assetClass,
    required this.currentPercentage,
    required this.targetPercentage,
    required this.lowerBoundPercentage,
    required this.upperBoundPercentage,
    required this.gapPercentage,
    required this.monetaryGap,
    required this.status,
  });

  final WealthAssetClass assetClass;
  final String currentPercentage;
  final String targetPercentage;
  final String lowerBoundPercentage;
  final String upperBoundPercentage;
  final String gapPercentage;
  final String monetaryGap;
  final WealthTargetDriftStatus status;
}

enum WealthTargetComparisonStatus { notConfigured, unavailable, available }

enum WealthTargetUnavailableReason {
  invalidTargets,
  invalidTolerance,
  valuationIncomplete,
  participatingValueUnavailable,
  zeroComparisonBase,
}

class WealthTargetComparison {
  const WealthTargetComparison._({
    required this.status,
    this.reason,
    this.comparisonBase,
    this.rows = const [],
    this.largestDeviation,
  });

  const WealthTargetComparison.notConfigured()
    : this._(status: WealthTargetComparisonStatus.notConfigured);

  const WealthTargetComparison.unavailable(WealthTargetUnavailableReason reason)
    : this._(status: WealthTargetComparisonStatus.unavailable, reason: reason);

  const WealthTargetComparison.available({
    required String comparisonBase,
    required List<WealthTargetDriftRow> rows,
    required WealthTargetDriftRow? largestDeviation,
  }) : this._(
         status: WealthTargetComparisonStatus.available,
         comparisonBase: comparisonBase,
         rows: rows,
         largestDeviation: largestDeviation,
       );

  final WealthTargetComparisonStatus status;
  final WealthTargetUnavailableReason? reason;
  final String? comparisonBase;
  final List<WealthTargetDriftRow> rows;
  final WealthTargetDriftRow? largestDeviation;
}

final _percentagePattern = RegExp(r'^\d+(?:\.\d{1,6})?$');

String? _validPercentage(String value) {
  if (!_percentagePattern.hasMatch(value)) return null;
  final normalized = D.normalize(value);
  if (normalized == null ||
      (D.compare(normalized, '0') ?? 0) < 0 ||
      (D.compare(normalized, '100') ?? 0) > 0) {
    return null;
  }
  return normalized;
}

WealthToleranceInputSummary summarizeWealthToleranceInput(String input) {
  final tolerance = _validPercentage(input.isEmpty ? '0' : input);
  return WealthToleranceInputSummary(
    isValid: tolerance != null,
    tolerancePercentage: tolerance,
  );
}

WealthTargetInputSummary summarizeWealthTargetInputs(
  Map<AssetGroup, String> inputs,
) {
  var total = '0';
  var valid = true;
  final targets = <WealthTarget>[];
  for (final assetClass in wealthAssetGroups) {
    final normalized = _validPercentage(inputs[assetClass] ?? '');
    if (normalized == null) {
      valid = false;
      continue;
    }
    total = D.add(total, normalized)!;
    targets.add(WealthTarget(assetClass: assetClass, percentage: normalized));
  }
  final isValid =
      valid &&
      targets.length == wealthAssetGroups.length &&
      D.compare(total, '100') == 0;
  return WealthTargetInputSummary(
    total: total,
    isValid: isValid,
    targets: isValid ? targets : null,
  );
}

bool _targetsAreValid(List<WealthTarget> targets) {
  if (targets.length != wealthAssetGroups.length) return false;
  return summarizeWealthTargetInputs({
    for (final target in targets) target.assetClass: target.percentage,
  }).isValid;
}

String _absolute(String value) =>
    (D.compare(value, '0') ?? 0) < 0 ? D.subtract('0', value)! : value;

WealthTargetComparison calculateWealthTargetComparison({
  required DashboardAggregate aggregate,
  required WealthAnalysisEvidence evidence,
  required List<WealthTarget> targets,
  String? tolerancePercentage,
}) {
  if (targets.isEmpty) return const WealthTargetComparison.notConfigured();
  if (!_targetsAreValid(targets)) {
    return const WealthTargetComparison.unavailable(
      WealthTargetUnavailableReason.invalidTargets,
    );
  }
  final tolerance = _validPercentage(tolerancePercentage ?? '0');
  if (tolerance == null) {
    return const WealthTargetComparison.unavailable(
      WealthTargetUnavailableReason.invalidTolerance,
    );
  }
  if (aggregate.status != AggregateStatus.complete) {
    return const WealthTargetComparison.unavailable(
      WealthTargetUnavailableReason.valuationIncomplete,
    );
  }

  final participating = targets
      .where((target) => (D.compare(target.percentage, '0') ?? 0) > 0)
      .toList(growable: false);
  final byGroup = {
    for (final assetClass in evidence.assetClasses)
      assetClass.group: assetClass,
  };
  final participatingClasses = participating
      .map((target) => (target: target, asset: byGroup[target.assetClass]))
      .toList(growable: false);
  if (participatingClasses.any((item) => item.asset?.value == null)) {
    return const WealthTargetComparison.unavailable(
      WealthTargetUnavailableReason.participatingValueUnavailable,
    );
  }
  final comparisonBase = D.sum(
    participatingClasses.map((item) => item.asset!.value),
  );
  if (!D.isPositive(comparisonBase)) {
    return const WealthTargetComparison.unavailable(
      WealthTargetUnavailableReason.zeroComparisonBase,
    );
  }

  final rows = <WealthTargetDriftRow>[];
  for (final item in participatingClasses) {
    final currentRatio = D.divide(
      item.asset!.value,
      comparisonBase,
      scale: 12,
    )!;
    final targetRatio = D.divide(item.target.percentage, '100', scale: 12)!;
    final currentPercentage = D.multiply(currentRatio, '100')!;
    final targetImpliedValue = D.multiply(comparisonBase, targetRatio)!;
    final gapPercentage = D.subtract(
      currentPercentage,
      item.target.percentage,
    )!;
    final monetaryGap = D.subtract(item.asset!.value, targetImpliedValue)!;
    final rawLower = D.subtract(item.target.percentage, tolerance)!;
    final rawUpper = D.add(item.target.percentage, tolerance)!;
    final lower = (D.compare(rawLower, '0') ?? 0) < 0 ? '0' : rawLower;
    final upper = (D.compare(rawUpper, '100') ?? 0) > 0 ? '100' : rawUpper;
    final status = (D.compare(currentPercentage, lower) ?? 0) < 0
        ? WealthTargetDriftStatus.below
        : (D.compare(currentPercentage, upper) ?? 0) > 0
        ? WealthTargetDriftStatus.above
        : WealthTargetDriftStatus.within;
    rows.add(
      WealthTargetDriftRow(
        assetClass: item.asset!,
        currentPercentage: currentPercentage,
        targetPercentage: item.target.percentage,
        lowerBoundPercentage: lower,
        upperBoundPercentage: upper,
        gapPercentage: gapPercentage,
        monetaryGap: monetaryGap,
        status: status,
      ),
    );
  }

  WealthTargetDriftRow? largest;
  for (final row in rows.where(
    (row) => row.status != WealthTargetDriftStatus.within,
  )) {
    if (largest == null ||
        (D.compare(
                  _absolute(row.gapPercentage),
                  _absolute(largest.gapPercentage),
                ) ??
                0) >
            0) {
      largest = row;
    }
  }
  return WealthTargetComparison.available(
    comparisonBase: comparisonBase!,
    rows: rows,
    largestDeviation: largest,
  );
}

List<WealthAssetClass> getExcludedValuedTargetClasses(
  WealthAnalysisEvidence evidence,
  List<WealthTarget> targets,
) {
  final byGroup = {
    for (final target in targets) target.assetClass: target.percentage,
  };
  return evidence.assetClasses
      .where(
        (asset) =>
            D.compare(byGroup[asset.group], '0') == 0 &&
            D.isPositive(asset.value),
      )
      .toList(growable: false);
}
