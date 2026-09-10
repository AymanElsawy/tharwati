import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/tokens.dart';
import '../widgets/primary_button.dart';
import 'goal_math.dart';
import 'goal_models.dart';
import 'goals_controller.dart';
import 'widgets/goal_sheet.dart';

/// Add / edit goal (Flow 5 screen 23). New goals may record a starting amount
/// (persisted atomically as the first `progress` entry by `create_goal`); edits
/// cannot, and their currency is locked once history exists. Validation mirrors
/// the web `validateGoalInput`.
class GoalFormSheet extends StatefulWidget {
  const GoalFormSheet({
    super.key,
    required this.controller,
    this.goal,
    this.defaultCurrency = 'EGP',
  });

  final GoalsController controller;
  final GoalSummary? goal;
  final String defaultCurrency;

  bool get isEditing => goal != null;

  @override
  State<GoalFormSheet> createState() => _GoalFormSheetState();
}

class _GoalFormSheetState extends State<GoalFormSheet> {
  late final _name = TextEditingController(text: widget.goal?.goal.name ?? '');
  late final _customType = TextEditingController(
    text: widget.goal?.goal.customTypeName ?? '',
  );
  late final _target = TextEditingController(
    text: widget.goal?.goal.targetAmount ?? '',
  );
  late final _saved = TextEditingController();
  late String _type = widget.goal?.goal.goalType ?? 'buy_home';
  late String _currency =
      widget.goal?.goal.currencyCode ?? widget.defaultCurrency;
  late String? _targetDate = widget.goal?.goal.targetDate;
  late String _savedOn = goalToday();
  String? _localError;

  bool get _currencyLocked =>
      widget.isEditing && isGoalCurrencyLocked(widget.goal!.hasHistory);

  @override
  void dispose() {
    _name.dispose();
    _customType.dispose();
    _target.dispose();
    _saved.dispose();
    super.dispose();
  }

  Future<void> _pickTargetDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_targetDate ?? '') ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 50),
    );
    if (picked != null) {
      setState(
        () => _targetDate =
            '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
      );
    }
  }

  Future<void> _submit() async {
    setState(() => _localError = null);
    final saved = _saved.text.trim();
    final input = GoalFormInput(
      name: _name.text.trim(),
      goalType: _type,
      customTypeName: showsCustomGoalType(_type)
          ? _customType.text.trim()
          : null,
      targetAmount: _target.text.trim(),
      currencyCode: _currency,
      targetDate: _targetDate,
      savedSoFar: !widget.isEditing && saved.isNotEmpty ? saved : null,
      savedOn: !widget.isEditing && saved.isNotEmpty ? _savedOn : null,
    );
    final v = validateGoalInput(input);
    if (v != null) {
      setState(() => _localError = goalValidationMessage(v));
      return;
    }
    final ok = await widget.controller.run(
      (s) => s.saveGoal(input, id: widget.goal?.goal.id),
    );
    if (ok && mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final error = _localError ?? widget.controller.actionError;
        return GoalSheet(
          title: widget.isEditing ? 'Edit goal' : 'New goal',
          subtitle:
              'This goal won’t change your net worth. It tracks intention, not '
              'account balances.',
          children: [
            SheetField(
              label: 'Goal name',
              child: _Box(
                child: TextField(
                  controller: _name,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isCollapsed: true,
                    hintText: 'e.g. Buy a car',
                  ),
                  style: TextStyle(color: c.ink, fontSize: 15),
                ),
              ),
            ),
            SheetField(
              label: 'Goal type',
              child: SizedBox(
                height: AppSizes.touchTarget,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(right: 2),
                  itemCount: goalTypes.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final type = goalTypes[index];
                    return _TypeChip(
                      label: goalTypeLabel(type),
                      selected: _type == type,
                      onTap: () => setState(() => _type = type),
                    );
                  },
                ),
              ),
            ),
            if (showsCustomGoalType(_type))
              SheetField(
                label: 'Custom type name',
                child: _Box(
                  child: TextField(
                    controller: _customType,
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isCollapsed: true,
                      hintText: 'What are you saving for?',
                    ),
                    style: TextStyle(color: c.ink, fontSize: 15),
                  ),
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: SheetField(
                    label: 'Target amount',
                    child: _Box(
                      child: TextField(
                        controller: _target,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                        ],
                        textDirection: TextDirection.ltr,
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isCollapsed: true,
                          hintText: '0.00',
                        ),
                        style: TextStyle(
                          color: c.ink,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 110,
                  child: SheetField(
                    label: 'Currency',
                    child: _Box(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _currency,
                          isDense: true,
                          isExpanded: true,
                          onChanged: _currencyLocked
                              ? null
                              : (v) => setState(() => _currency = v!),
                          items: [
                            for (final code in goalCurrencies)
                              DropdownMenuItem(value: code, child: Text(code)),
                          ],
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (_currencyLocked)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Text(
                  'Currency is locked once a goal has progress history.',
                  style: TextStyle(color: c.disabledFg, fontSize: 11),
                ),
              ),
            SheetField(
              label: 'Target date',
              optional: true,
              child: InkWell(
                onTap: _pickTargetDate,
                borderRadius: BorderRadius.circular(AppRadius.field),
                child: _Box(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _targetDate ?? 'No target date',
                        textDirection: TextDirection.ltr,
                        style: TextStyle(
                          color: _targetDate == null ? c.disabledFg : c.ink,
                          fontSize: 15,
                        ),
                      ),
                      Row(
                        children: [
                          if (_targetDate != null)
                            GestureDetector(
                              onTap: () => setState(() => _targetDate = null),
                              child: Icon(
                                Icons.clear,
                                size: 16,
                                color: c.inkMuted,
                              ),
                            ),
                          const SizedBox(width: 6),
                          Icon(
                            Icons.event_outlined,
                            size: 18,
                            color: c.inkMuted,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (!widget.isEditing) ...[
              SheetField(
                label: 'Starting amount',
                optional: true,
                hint: 'Recorded as the first history entry.',
                child: _Box(
                  child: TextField(
                    controller: _saved,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                    ],
                    textDirection: TextDirection.ltr,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isCollapsed: true,
                      hintText: '0.00',
                    ),
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              if (_saved.text.trim().isNotEmpty)
                SheetField(
                  label: 'Starting date',
                  child: InkWell(
                    onTap: () async {
                      final now = DateTime.now();
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: DateTime.tryParse(_savedOn) ?? now,
                        firstDate: DateTime(now.year - 20),
                        lastDate: now,
                      );
                      if (picked != null) {
                        setState(
                          () => _savedOn =
                              '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
                        );
                      }
                    },
                    borderRadius: BorderRadius.circular(AppRadius.field),
                    child: _Box(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _savedOn,
                            textDirection: TextDirection.ltr,
                            style: TextStyle(color: c.ink, fontSize: 15),
                          ),
                          Icon(
                            Icons.event_outlined,
                            size: 18,
                            color: c.inkMuted,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: c.fieldFill,
                border: Border.all(color: c.line),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                'Goals track savings on their own. Moving money in real life? '
                'Update the account too.',
                style: TextStyle(color: c.inkMuted, fontSize: 12, height: 1.5),
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error, style: TextStyle(color: c.negative, fontSize: 13)),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: NeutralButton(
                    label: 'Cancel',
                    onPressed: widget.controller.busy
                        ? null
                        : () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: PrimaryButton(
                    label: widget.isEditing ? 'Save goal' : 'Create goal',
                    busy: widget.controller.busy,
                    onPressed: _submit,
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
      constraints: const BoxConstraints(minHeight: AppSizes.touchTarget),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: selected ? c.accent : c.fieldFill,
          border: Border.all(color: selected ? c.accent : c.line),
          borderRadius: BorderRadius.circular(AppRadius.field),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? c.onAccent : c.inkMuted,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      constraints: const BoxConstraints(minHeight: AppSizes.field),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: c.fieldFill,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.field),
      ),
      child: child,
    );
  }
}
