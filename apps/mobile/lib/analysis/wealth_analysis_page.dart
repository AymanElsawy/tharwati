import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/decimals.dart';
import '../core/money_format.dart';
import '../errors/safe_app_error.dart';
import '../dashboard/data/dashboard_snapshot.dart';
import '../dashboard/logic/dashboard_aggregate.dart';
import '../i18n/app_language.dart';
import '../i18n/wealth_analysis_copy.dart';
import '../theme/tokens.dart';
import '../widgets/callout.dart';
import '../widgets/primary_button.dart';
import 'data/wealth_analysis_service.dart';
import 'domain/wealth_analysis.dart';
import 'domain/wealth_target_allocation.dart';
import 'state/wealth_analysis_controller.dart';
import 'wealth_target_editor_page.dart';

class WealthAnalysisPage extends StatefulWidget {
  const WealthAnalysisPage({
    super.key,
    this.controller,
    this.isActive = true,
    this.onOpenPortfolioAnalysis,
  });

  final WealthAnalysisController? controller;
  final bool isActive;
  final VoidCallback? onOpenPortfolioAnalysis;

  @override
  State<WealthAnalysisPage> createState() => _WealthAnalysisPageState();
}

class _WealthAnalysisPageState extends State<WealthAnalysisPage> {
  late final WealthAnalysisController _controller;
  late final bool _ownsController;

  @override
  void initState() {
    super.initState();
    _ownsController = widget.controller == null;
    _controller = widget.controller ?? WealthAnalysisController();
  }

  @override
  void dispose() {
    if (_ownsController) _controller.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant WealthAnalysisPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    _controller.handleTabActivity(
      wasActive: oldWidget.isActive,
      isActive: widget.isActive,
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = WealthAnalysisCopy.of(AppLanguageScope.of(context).language);
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        bottom: false,
        child: ListenableBuilder(
          listenable: _controller,
          builder: (context, _) {
            if (_controller.status == WealthAnalysisStatus.loading) {
              return _LoadingState(copy: copy);
            }
            if (_controller.status == WealthAnalysisStatus.error ||
                _controller.data == null) {
              return _ErrorState(
                copy: copy,
                error: _controller.loadError,
                onRetry: _controller.load,
              );
            }
            return _ReadyBody(
              data: _controller.data!,
              controller: _controller,
              copy: copy,
              onOpenPortfolioAnalysis: widget.onOpenPortfolioAnalysis,
            );
          },
        ),
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState({required this.copy});
  final WealthAnalysisCopy copy;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircularProgressIndicator(color: context.colors.accent),
        const SizedBox(height: 14),
        Text(copy.loading, style: TextStyle(color: context.colors.inkMuted)),
      ],
    ),
  );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({
    required this.copy,
    required this.error,
    required this.onRetry,
  });
  final WealthAnalysisCopy copy;
  final Object? error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(AppSpacing.gutter),
    children: [
      const SizedBox(height: 80),
      Callout(
        tone: CalloutTone.danger,
        title: copy.loadError,
        message: error == null
            ? copy.loadErrorBody
            : safeAppErrorMessage(
                error!,
                AppLanguageScope.of(context).language,
              ),
        action: OutlinedButton(onPressed: onRetry, child: Text(copy.retry)),
      ),
    ],
  );
}

class _ReadyBody extends StatelessWidget {
  const _ReadyBody({
    required this.data,
    required this.controller,
    required this.copy,
    required this.onOpenPortfolioAnalysis,
  });

  final WealthAnalysisData data;
  final WealthAnalysisController controller;
  final WealthAnalysisCopy copy;
  final VoidCallback? onOpenPortfolioAnalysis;

  @override
  Widget build(BuildContext context) {
    if (data.aggregate.isEmpty) {
      return RefreshIndicator(
        onRefresh: controller.load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.gutter),
          children: [
            _PageHeader(copy: copy),
            const SizedBox(height: 24),
            _AnalysisCard(
              child: Column(
                children: [
                  Icon(
                    Icons.insights_outlined,
                    color: context.colors.inkMuted,
                    size: 32,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    copy.emptyTitle,
                    style: TextStyle(
                      color: context.colors.ink,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    copy.emptyBody,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: context.colors.inkMuted,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          10,
          AppSpacing.gutter,
          32,
        ),
        children: [
          _PageHeader(copy: copy),
          if (controller.loadError != null) ...[
            const SizedBox(height: 12),
            Callout(
              tone: CalloutTone.warning,
              title: copy.refreshError,
              message: safeAppErrorMessage(
                controller.loadError!,
                AppLanguageScope.of(context).language,
              ),
              action: TextButton(
                onPressed: controller.load,
                child: Text(copy.retry),
              ),
            ),
          ],
          const SizedBox(height: 18),
          _WealthHealth(data: data, copy: copy),
          const SizedBox(height: 20),
          _AttentionSummary(aggregate: data.aggregate, copy: copy),
          const SizedBox(height: 20),
          _WealthAllocation(
            data: data,
            copy: copy,
            onOpenPortfolioAnalysis: onOpenPortfolioAnalysis,
          ),
          const SizedBox(height: 20),
          _TargetAllocation(data: data, controller: controller, copy: copy),
        ],
      ),
    );
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader({required this.copy});
  final WealthAnalysisCopy copy;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        copy.pageTitle,
        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
          color: context.colors.ink,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 5),
      Text(
        copy.pageSubtitle,
        style: TextStyle(color: context.colors.inkMuted, height: 1.45),
      ),
    ],
  );
}

class _WealthHealth extends StatelessWidget {
  const _WealthHealth({required this.data, required this.copy});
  final WealthAnalysisData data;
  final WealthAnalysisCopy copy;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final aggregate = data.aggregate;
    String money(String? value) => MoneyFormat.money(
      value,
      aggregate.baseCurrencyCode,
      unavailableLabel: copy.unavailable,
    );
    return _AnalysisCard(
      accent: true,
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Eyebrow(copy.healthEyebrow),
                const SizedBox(height: 8),
                Text(
                  copy.healthTitle,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: c.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  copy.healthSynthesis(
                    incomplete: aggregate.status == AggregateStatus.incomplete,
                    stale: aggregate.freshness == SnapshotFreshness.stale,
                  ),
                  style: TextStyle(color: c.inkMuted, height: 1.45),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 13,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: c.canvas,
                    borderRadius: BorderRadius.circular(AppRadius.field),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        copy.netWealth,
                        style: TextStyle(color: c.inkMuted, fontSize: 12),
                      ),
                      Flexible(
                        child: Text(
                          money(aggregate.netWorth),
                          textDirection: TextDirection.ltr,
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AttentionSummary extends StatelessWidget {
  const _AttentionSummary({required this.aggregate, required this.copy});
  final DashboardAggregate aggregate;
  final WealthAnalysisCopy copy;

  @override
  Widget build(BuildContext context) {
    final items = <({IconData icon, String title, String body})>[];
    if (aggregate.status == AggregateStatus.incomplete) {
      items.add((
        icon: Icons.warning_amber_rounded,
        title: copy.incompleteAttention,
        body: copy.unresolvedSources(
          aggregate.unavailableSources.toSet().length,
        ),
      ));
    }
    if (aggregate.freshness == SnapshotFreshness.stale) {
      items.add((
        icon: Icons.schedule_outlined,
        title: copy.staleAttention,
        body: copy.staleAttentionBody,
      ));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          eyebrow: copy.attentionEyebrow,
          title: copy.attentionTitle,
        ),
        const SizedBox(height: 12),
        if (items.isEmpty)
          _AnalysisCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(Icons.verified_outlined, color: context.colors.accent),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        copy.noObservations,
                        style: TextStyle(
                          color: context.colors.ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        copy.noObservationsBody,
                        style: TextStyle(
                          color: context.colors.inkMuted,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          for (final item in items) ...[
            _AnalysisCard(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(item.icon, color: context.colors.warningFg),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: TextStyle(
                            color: context.colors.ink,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.body,
                          style: TextStyle(
                            color: context.colors.inkMuted,
                            fontSize: 12,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (item != items.last) const SizedBox(height: 8),
          ],
      ],
    );
  }
}

class _WealthAllocation extends StatelessWidget {
  const _WealthAllocation({
    required this.data,
    required this.copy,
    required this.onOpenPortfolioAnalysis,
  });
  final WealthAnalysisData data;
  final WealthAnalysisCopy copy;
  final VoidCallback? onOpenPortfolioAnalysis;

  @override
  Widget build(BuildContext context) {
    final aggregate = data.aggregate;
    final valued =
        data.evidence.assetClasses
            .where((item) => item.percentage != null)
            .toList()
          ..sort((a, b) => D.compare(b.percentage, a.percentage) ?? 0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          eyebrow: copy.allocationEyebrow,
          title: copy.allocationTitle,
          description: copy.allocationDescription,
        ),
        const SizedBox(height: 12),
        if (aggregate.status == AggregateStatus.incomplete)
          _AnalysisCard(
            child: Text(
              copy.allocationUnavailable,
              style: TextStyle(color: context.colors.inkMuted, height: 1.5),
            ),
          )
        else if (valued.isEmpty)
          _AnalysisCard(
            child: Text(
              copy.allocationEmpty,
              style: TextStyle(color: context.colors.inkMuted),
            ),
          )
        else
          _AnalysisCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                SizedBox(
                  width: 168,
                  height: 168,
                  child: CustomPaint(
                    painter: _WealthDonutPainter(
                      values: valued,
                      colors: _assetColors(context),
                      track: context.colors.canvas,
                    ),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(34),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              copy.valuedTotal,
                              style: TextStyle(
                                color: context.colors.inkMuted,
                                fontSize: 10,
                              ),
                            ),
                            const SizedBox(height: 4),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                '${MoneyFormat.compact(aggregate.totalAssets)} ${aggregate.baseCurrencyCode}',
                                textDirection: TextDirection.ltr,
                                style: TextStyle(
                                  color: context.colors.ink,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              copy.completeCoverage,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: context.colors.accent,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                for (final asset in valued) ...[
                  _AllocationLegendRow(
                    asset: asset,
                    copy: copy,
                    currency: aggregate.baseCurrencyCode,
                    color: _assetColors(context)[asset.group]!,
                    onTap: asset.group == AssetGroup.brokerage
                        ? onOpenPortfolioAnalysis
                        : null,
                  ),
                  if (asset != valued.last) const SizedBox(height: 9),
                ],
                if (data.evidence.largestExposure case final largest?) ...[
                  const SizedBox(height: 12),
                  Divider(height: 1, color: context.colors.line),
                  const SizedBox(height: 11),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.layers_outlined,
                        color: context.colors.accent,
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              copy.largestExposure,
                              style: TextStyle(
                                color: context.colors.ink,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              copy.largestExposureBody(
                                copy.assetGroup(largest.group),
                                MoneyFormat.percent(largest.percentage),
                              ),
                              style: TextStyle(
                                color: context.colors.inkMuted,
                                fontSize: 12,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _AllocationLegendRow extends StatelessWidget {
  const _AllocationLegendRow({
    required this.asset,
    required this.copy,
    required this.currency,
    required this.color,
    this.onTap,
  });
  final WealthAssetClass asset;
  final WealthAnalysisCopy copy;
  final String currency;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                copy.assetGroup(asset.group),
                style: TextStyle(
                  color: context.colors.ink,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                MoneyFormat.money(
                  asset.value,
                  currency,
                  unavailableLabel: copy.unavailable,
                ),
                textDirection: TextDirection.ltr,
                style: TextStyle(color: context.colors.inkMuted, fontSize: 12),
              ),
            ],
          ),
        ),
        Text(
          MoneyFormat.percent(asset.percentage),
          textDirection: TextDirection.ltr,
          style: TextStyle(
            color: context.colors.ink,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
    if (onTap == null) return row;
    return InkWell(
      key: const Key('wealth-brokerage-portfolio-link'),
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: row,
      ),
    );
  }
}

class _TargetAllocation extends StatelessWidget {
  const _TargetAllocation({
    required this.data,
    required this.controller,
    required this.copy,
  });
  final WealthAnalysisData data;
  final WealthAnalysisController controller;
  final WealthAnalysisCopy copy;

  Future<void> _edit(BuildContext context) => Navigator.of(context).push(
    MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (_) => WealthTargetEditorPage(
        plan: data.targetPlan,
        onSave: controller.saveTargetPlan,
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final comparison = calculateWealthTargetComparison(
      aggregate: data.aggregate,
      evidence: data.evidence,
      targets: data.targetPlan.targets,
      tolerancePercentage: data.targetPlan.tolerancePercentage,
    );
    final excluded = getExcludedValuedTargetClasses(
      data.evidence,
      data.targetPlan.targets,
    );
    final rowsByGroup = {
      for (final row in comparison.rows) row.assetClass.group: row,
    };
    final orderedRows = wealthAssetGroups
        .map((group) => rowsByGroup[group])
        .whereType<WealthTargetDriftRow>()
        .toList(growable: false);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SectionHeader(
                    eyebrow: copy.targetEyebrow,
                    title: copy.targetTitle,
                    description: copy.targetDescription,
                  ),
                  const SizedBox(height: 5),
                  Text(
                    copy.toleranceSummary(
                      MoneyFormat.percent(data.targetPlan.tolerancePercentage),
                    ),
                    style: TextStyle(
                      color: context.colors.inkMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            CompactButton(
              onPressed: () => _edit(context),
              icon: Icons.edit_outlined,
              label: data.targetPlan.targets.isEmpty
                  ? copy.setTarget
                  : copy.editTarget,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (comparison.status == WealthTargetComparisonStatus.notConfigured)
          _AnalysisCard(
            child: Text(
              copy.noTarget,
              style: TextStyle(color: context.colors.inkMuted),
            ),
          )
        else if (comparison.status == WealthTargetComparisonStatus.unavailable)
          _AnalysisCard(
            child: Text(
              copy.targetUnavailable,
              style: TextStyle(color: context.colors.inkMuted, height: 1.45),
            ),
          )
        else ...[
          for (final row in orderedRows) ...[
            _DriftCard(
              row: row,
              currency: data.aggregate.baseCurrencyCode,
              copy: copy,
            ),
            if (row != orderedRows.last) const SizedBox(height: 8),
          ],
          const SizedBox(height: 11),
          _AnalysisCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  comparison.largestDeviation == null
                      ? Icons.check_circle_outline
                      : Icons.balance_outlined,
                  color: comparison.largestDeviation == null
                      ? context.colors.metal
                      : _driftColor(
                          context,
                          comparison.largestDeviation!.status,
                        ),
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    comparison.largestDeviation == null
                        ? copy.allWithin
                        : _largestText(
                            comparison.largestDeviation!,
                            data.aggregate.baseCurrencyCode,
                            copy,
                          ),
                    style: TextStyle(
                      color: context.colors.inkMuted,
                      fontSize: 12,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (excluded.isNotEmpty) ...[
            const SizedBox(height: 9),
            _AnalysisCard(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline,
                    color: context.colors.inkMuted,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      copy.excludedTargets(
                        excluded
                            .map((item) => copy.assetGroup(item.group))
                            .toList(growable: false),
                      ),
                      style: TextStyle(
                        color: context.colors.inkMuted,
                        fontSize: 12,
                        height: 1.45,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ],
    );
  }

  String _largestText(
    WealthTargetDriftRow row,
    String currency,
    WealthAnalysisCopy copy,
  ) => copy.largestDeviation(
    copy.assetGroup(row.assetClass.group),
    MoneyFormat.percent(_absolute(row.gapPercentage)),
    row.status,
    MoneyFormat.roundedMoney(_absolute(row.monetaryGap), currency),
  );
}

class _DriftCard extends StatelessWidget {
  const _DriftCard({
    required this.row,
    required this.currency,
    required this.copy,
  });
  final WealthTargetDriftRow row;
  final String currency;
  final WealthAnalysisCopy copy;

  @override
  Widget build(BuildContext context) {
    final direction = _driftColor(context, row.status);
    return _AnalysisCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.assetGroup(row.assetClass.group),
            style: TextStyle(
              color: context.colors.ink,
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _DriftMetric(
                  label: copy.current,
                  value: MoneyFormat.percent(row.currentPercentage),
                  color: direction,
                ),
              ),
              Expanded(
                child: _DriftMetric(
                  label: copy.target,
                  value: MoneyFormat.percent(row.targetPercentage),
                  color: context.colors.ink,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _InlineDriftMetric(
            label: copy.gap,
            value:
                '${_signedPercent(row.gapPercentage)} · ${MoneyFormat.signedRoundedMoney(row.monetaryGap, currency)}',
            color: direction,
            numeric: true,
          ),
          const SizedBox(height: 8),
          Divider(height: 1, color: context.colors.line),
          const SizedBox(height: 8),
          _InlineDriftMetric(
            label: copy.status,
            value: copy.driftStatus(row.status),
            color: direction,
            numeric: false,
          ),
        ],
      ),
    );
  }
}

class _InlineDriftMetric extends StatelessWidget {
  const _InlineDriftMetric({
    required this.label,
    required this.value,
    required this.color,
    required this.numeric,
  });
  final String label;
  final String value;
  final Color color;
  final bool numeric;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: TextStyle(color: context.colors.inkMuted, fontSize: 11),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Text(
          value,
          textAlign: TextAlign.end,
          textDirection: numeric ? TextDirection.ltr : null,
          style: TextStyle(color: color, fontWeight: FontWeight.w800),
        ),
      ),
    ],
  );
}

class _DriftMetric extends StatelessWidget {
  const _DriftMetric({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: TextStyle(color: context.colors.inkMuted, fontSize: 11),
      ),
      const SizedBox(height: 3),
      Text(
        value,
        textDirection: TextDirection.ltr,
        style: TextStyle(color: color, fontWeight: FontWeight.w800),
      ),
    ],
  );
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.eyebrow,
    required this.title,
    this.description,
  });
  final String eyebrow;
  final String title;
  final String? description;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _Eyebrow(eyebrow),
      const SizedBox(height: 5),
      Text(
        title,
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          color: context.colors.ink,
          fontWeight: FontWeight.w800,
        ),
      ),
      if (description != null) ...[
        const SizedBox(height: 4),
        Text(
          description!,
          style: TextStyle(
            color: context.colors.inkMuted,
            fontSize: 13,
            height: 1.4,
          ),
        ),
      ],
    ],
  );
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: TextStyle(
      color: context.colors.accent,
      fontSize: 10,
      fontWeight: FontWeight.w800,
      letterSpacing: 1.1,
    ),
  );
}

class _AnalysisCard extends StatelessWidget {
  const _AnalysisCard({
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.accent = false,
  });
  final Widget child;
  final EdgeInsets padding;
  final bool accent;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding,
    decoration: BoxDecoration(
      color: context.colors.surface,
      border: Border.all(
        color: accent
            ? context.colors.artworkGold.withValues(alpha: 0.46)
            : context.colors.line,
      ),
      borderRadius: BorderRadius.circular(20),
    ),
    child: child,
  );
}

Map<AssetGroup, Color> _assetColors(BuildContext context) {
  final palette = AppChartColors.of(context.colors);
  return {
    for (var index = 0; index < wealthAssetGroups.length; index++)
      wealthAssetGroups[index]: palette[index],
  };
}

Color _driftColor(BuildContext context, WealthTargetDriftStatus status) =>
    switch (status) {
      WealthTargetDriftStatus.above =>
        context.colors.isDark
            ? const Color(0xFF76B49C)
            : const Color(0xFF18794E),
      WealthTargetDriftStatus.below => context.colors.negative,
      WealthTargetDriftStatus.within => context.colors.metal,
    };

String _absolute(String value) =>
    (D.compare(value, '0') ?? 0) < 0 ? D.subtract('0', value)! : value;

String _signedPercent(String value) {
  final sign = (D.compare(value, '0') ?? 0) > 0 ? '+' : '';
  return '$sign${MoneyFormat.percent(value)}';
}

class _WealthDonutPainter extends CustomPainter {
  _WealthDonutPainter({
    required this.values,
    required this.colors,
    required this.track,
  });
  final List<WealthAssetClass> values;
  final Map<AssetGroup, Color> colors;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = 18.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawArc(rect, 0, math.pi * 2, false, paint..color = track);
    var start = -math.pi / 2;
    for (final value in values) {
      // Conversion to double is confined to canvas geometry; financial and
      // percentage calculations remain decimal-string based in the domain.
      final percentage = double.parse(value.percentage!);
      final sweep = percentage / 100 * math.pi * 2;
      canvas.drawArc(
        rect,
        start,
        math.max(0, sweep - 0.025),
        false,
        paint..color = colors[value.group]!,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_WealthDonutPainter oldDelegate) =>
      oldDelegate.values != values ||
      oldDelegate.colors != colors ||
      oldDelegate.track != track;
}
