import '../../core/decimals.dart';
import '../../dashboard/logic/dashboard_aggregate.dart';

const wealthAssetGroups = <AssetGroup>[
  AssetGroup.cashAndBank,
  AssetGroup.brokerage,
  AssetGroup.goldAndSilver,
  AssetGroup.realEstate,
  AssetGroup.business,
  AssetGroup.other,
];

class WealthAssetClass {
  const WealthAssetClass({
    required this.group,
    required this.value,
    required this.percentage,
  });

  final AssetGroup group;
  final String? value;
  final String? percentage;
}

class WealthAnalysisEvidence {
  const WealthAnalysisEvidence({
    required this.assetClasses,
    required this.largestExposure,
    required this.cashAndBankExposure,
  });

  final List<WealthAssetClass> assetClasses;
  final WealthAssetClass? largestExposure;
  final WealthAssetClass? cashAndBankExposure;
}

/// Projects the shared Dashboard aggregate into the six-class Wealth Analysis
/// model. Incomplete valuation remains unavailable rather than becoming zero.
WealthAnalysisEvidence buildWealthAnalysisEvidence(
  DashboardAggregate aggregate,
) {
  if (aggregate.status != AggregateStatus.complete ||
      !D.isPositive(aggregate.totalAssets)) {
    final classes = wealthAssetGroups
        .map(
          (group) => WealthAssetClass(
            group: group,
            value: aggregate.status == AggregateStatus.complete
                ? aggregate.assetBreakdown[group]
                : null,
            percentage: null,
          ),
        )
        .toList(growable: false);
    return WealthAnalysisEvidence(
      assetClasses: classes,
      largestExposure: null,
      cashAndBankExposure: classes.first,
    );
  }

  final total = aggregate.totalAssets!;
  final positive = wealthAssetGroups
      .where((group) => D.isPositive(aggregate.assetBreakdown[group]))
      .toList(growable: false);
  var priorTotal = '0';
  final percentages = <AssetGroup, String>{};
  for (var index = 0; index < positive.length; index++) {
    final group = positive[index];
    final percentage = index == positive.length - 1
        ? D.subtract('100', priorTotal)!
        : D.multiply(
            D.divide(aggregate.assetBreakdown[group], total, scale: 6),
            '100',
          )!;
    percentages[group] = percentage;
    priorTotal = D.add(priorTotal, percentage)!;
  }

  final classes = wealthAssetGroups
      .map(
        (group) => WealthAssetClass(
          group: group,
          value: aggregate.assetBreakdown[group],
          percentage: percentages[group],
        ),
      )
      .toList(growable: false);
  WealthAssetClass? largest;
  for (final item in classes.where((item) => item.percentage != null)) {
    if (largest == null ||
        (D.compare(item.percentage, largest.percentage) ?? 0) > 0) {
      largest = item;
    }
  }
  return WealthAnalysisEvidence(
    assetClasses: classes,
    largestExposure: largest,
    cashAndBankExposure: classes.first,
  );
}
