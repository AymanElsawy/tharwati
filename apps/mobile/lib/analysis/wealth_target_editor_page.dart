import 'package:flutter/material.dart';

import '../core/money_format.dart';
import '../dashboard/logic/dashboard_aggregate.dart';
import '../i18n/app_language.dart';
import '../i18n/wealth_analysis_copy.dart';
import '../theme/tokens.dart';
import '../widgets/primary_button.dart';
import 'domain/wealth_analysis.dart';
import 'domain/wealth_target_allocation.dart';

class WealthTargetEditorPage extends StatefulWidget {
  const WealthTargetEditorPage({
    super.key,
    required this.plan,
    required this.onSave,
  });

  final WealthTargetPlan plan;
  final Future<bool> Function(WealthTargetPlan plan) onSave;

  @override
  State<WealthTargetEditorPage> createState() => _WealthTargetEditorPageState();
}

class _WealthTargetEditorPageState extends State<WealthTargetEditorPage> {
  late final Map<AssetGroup, TextEditingController> _targets;
  late final TextEditingController _tolerance;
  bool _saving = false;
  bool _saveFailed = false;

  @override
  void initState() {
    super.initState();
    final saved = {
      for (final target in widget.plan.targets)
        target.assetClass: target.percentage,
    };
    _targets = {
      for (final group in wealthAssetGroups)
        group: TextEditingController(text: saved[group] ?? '0'),
    };
    _tolerance = TextEditingController(text: widget.plan.tolerancePercentage);
  }

  @override
  void dispose() {
    for (final controller in _targets.values) {
      controller.dispose();
    }
    _tolerance.dispose();
    super.dispose();
  }

  WealthTargetInputSummary get _targetSummary => summarizeWealthTargetInputs({
    for (final entry in _targets.entries) entry.key: entry.value.text,
  });

  WealthToleranceInputSummary get _toleranceSummary =>
      summarizeWealthToleranceInput(_tolerance.text);

  Future<void> _save() async {
    final targets = _targetSummary.targets;
    final tolerance = _toleranceSummary.tolerancePercentage;
    if (targets == null || tolerance == null) return;
    setState(() {
      _saving = true;
      _saveFailed = false;
    });
    final saved = await widget.onSave(
      WealthTargetPlan(targets: targets, tolerancePercentage: tolerance),
    );
    if (!mounted) return;
    if (saved) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _saving = false;
        _saveFailed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = WealthAnalysisCopy.of(AppLanguageScope.of(context).language);
    final targetSummary = _targetSummary;
    final toleranceSummary = _toleranceSummary;
    final canSave =
        !_saving && targetSummary.isValid && toleranceSummary.isValid;

    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        title: Text(copy.editorTitle),
        leading: IconButton(
          tooltip: copy.cancel,
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          icon: const Icon(Icons.close),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter,
                  8,
                  AppSpacing.gutter,
                  16,
                ),
                children: [
                  Text(
                    copy.editorDescription,
                    style: TextStyle(
                      color: c.inkMuted,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 12),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      const gap = 10.0;
                      final width = (constraints.maxWidth - gap) / 2;
                      return Wrap(
                        spacing: gap,
                        runSpacing: 10,
                        children: [
                          for (final group in wealthAssetGroups)
                            SizedBox(
                              width: width,
                              child: _PercentageField(
                                label: copy.assetGroup(group),
                                controller: _targets[group]!,
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  Text(
                    copy.zeroExclusion,
                    style: TextStyle(
                      color: c.inkMuted,
                      fontSize: 11,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 14),
                  FractionallySizedBox(
                    widthFactor: 0.5,
                    alignment: AlignmentDirectional.centerStart,
                    child: _PercentageField(
                      label: copy.tolerance,
                      controller: _tolerance,
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    toleranceSummary.tolerancePercentage == '0'
                        ? copy.zeroToleranceHelper
                        : toleranceSummary.tolerancePercentage == null
                        ? copy.toleranceError
                        : copy.toleranceHelper(
                            MoneyFormat.percent(
                              toleranceSummary.tolerancePercentage,
                            ),
                          ),
                    style: TextStyle(
                      color: toleranceSummary.isValid ? c.inkMuted : c.negative,
                      fontSize: 11,
                      height: 1.35,
                    ),
                  ),
                  if (_saveFailed) ...[
                    const SizedBox(height: 10),
                    Text(
                      copy.saveError,
                      style: TextStyle(color: c.negative, fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                10,
                AppSpacing.gutter,
                12,
              ),
              decoration: BoxDecoration(
                color: c.surface,
                border: Border(top: BorderSide(color: c.line)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        copy.total,
                        style: TextStyle(
                          color: c.ink,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '${MoneyFormat.percent(targetSummary.total)} / 100%',
                        textDirection: TextDirection.ltr,
                        style: TextStyle(
                          color: targetSummary.isValid ? c.ink : c.negative,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  if (!targetSummary.isValid) ...[
                    const SizedBox(height: 4),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(
                        copy.totalError,
                        style: TextStyle(color: c.negative, fontSize: 11),
                      ),
                    ),
                  ],
                  const SizedBox(height: 9),
                  PrimaryButton(
                    label: _saving ? copy.saving : copy.save,
                    onPressed: canSave ? _save : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PercentageField extends StatelessWidget {
  const _PercentageField({
    required this.label,
    required this.controller,
    required this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: c.ink,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          onChanged: onChanged,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textDirection: TextDirection.ltr,
          decoration: const InputDecoration(suffixText: '%'),
        ),
      ],
    );
  }
}
