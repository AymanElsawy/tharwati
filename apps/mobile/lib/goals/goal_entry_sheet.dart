import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/tokens.dart';
import '../widgets/primary_button.dart';
import 'goal_math.dart';
import 'goal_models.dart';
import 'goals_controller.dart';
import 'widgets/goal_sheet.dart';

enum GoalEntryMode { progress, withdrawal, correct }

/// Add progress / Withdraw / Correct an entry (Flow 5). `correct` records an
/// explicit replacement for [entry] via `correct_goal_progress_entry`; the
/// other two add a fresh `progress` / `withdrawal` entry. Validation mirrors the
/// web `validateEntryInput`; the RPC re-checks and its errors surface on the
/// [GoalsController].
class GoalEntrySheet extends StatefulWidget {
  const GoalEntrySheet({
    super.key,
    required this.controller,
    required this.goal,
    required this.mode,
    this.entry,
  });

  final GoalsController controller;
  final Goal goal;
  final GoalEntryMode mode;
  final GoalHistoryEntry? entry;

  @override
  State<GoalEntrySheet> createState() => _GoalEntrySheetState();
}

class _GoalEntrySheetState extends State<GoalEntrySheet> {
  late final _amount = TextEditingController(
    text: widget.mode == GoalEntryMode.correct
        ? (widget.entry?.entry.amount ?? '')
        : '',
  );
  late String _date = widget.mode == GoalEntryMode.correct
      ? (widget.entry?.entry.effectiveOn ?? goalToday())
      : goalToday();
  final _note = TextEditingController();
  String? _localError;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  String get _title => switch (widget.mode) {
    GoalEntryMode.progress => 'Add progress',
    GoalEntryMode.withdrawal => 'Withdraw from goal',
    GoalEntryMode.correct => 'Correct entry',
  };

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_date) ?? now,
      firstDate: DateTime(now.year - 20),
      lastDate: now,
    );
    if (picked != null) {
      setState(
        () => _date =
            '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
      );
    }
  }

  Future<void> _submit() async {
    setState(() => _localError = null);
    final amount = _amount.text.trim();

    if (widget.mode == GoalEntryMode.correct) {
      final v = validateEntryInput(
        GoalEntryInput(
          entryType: 'progress',
          amount: amount,
          effectiveOn: _date,
          note: null,
        ),
      );
      if (v != null) {
        setState(() => _localError = goalValidationMessage(v));
        return;
      }
      final ok = await _confirm(
        'Record a correction?',
        'The original entry stays in the history; the corrected value is added '
            'alongside it. Funded amount is recalculated.',
      );
      if (!ok) return;
      final done = await widget.controller.run(
        (s) => s.correctGoalEntry(
          widget.entry!.id,
          amount: amount,
          effectiveOn: _date,
          note: _note.text.trim().isEmpty ? null : _note.text.trim(),
        ),
      );
      if (done && mounted) Navigator.of(context).pop(true);
      return;
    }

    final input = GoalEntryInput(
      entryType: widget.mode == GoalEntryMode.progress
          ? 'progress'
          : 'withdrawal',
      amount: amount,
      effectiveOn: _date,
      note: _note.text.trim().isEmpty ? null : _note.text.trim(),
    );
    final v = validateEntryInput(input);
    if (v != null) {
      setState(() => _localError = goalValidationMessage(v));
      return;
    }
    final done = await widget.controller.run(
      (s) => s.addGoalEntry(widget.goal.id, input),
    );
    if (done && mounted) Navigator.of(context).pop(true);
  }

  Future<bool> _confirm(String title, String body) async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(title),
            content: Text(body),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Continue'),
              ),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final error = _localError ?? widget.controller.actionError;
        return GoalSheet(
          title: _title,
          subtitle:
              'Goal progress is a separate ledger — this never moves account '
              'money.',
          children: [
            SheetField(
              label: 'Amount (${widget.goal.currencyCode})',
              child: _Box(
                child: TextField(
                  controller: _amount,
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
            SheetField(
              label: 'Date',
              child: InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(AppRadius.field),
                child: _Box(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _date,
                        textDirection: TextDirection.ltr,
                        style: TextStyle(color: c.ink, fontSize: 15),
                      ),
                      Icon(Icons.event_outlined, size: 18, color: c.inkMuted),
                    ],
                  ),
                ),
              ),
            ),
            SheetField(
              label: 'Note',
              optional: true,
              child: _Box(
                child: TextField(
                  controller: _note,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isCollapsed: true,
                    hintText: 'What this entry is for',
                  ),
                  style: TextStyle(color: c.ink, fontSize: 14),
                ),
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 2),
              Text(error, style: TextStyle(color: c.negative, fontSize: 13)),
              const SizedBox(height: 10),
            ],
            const SizedBox(height: 4),
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
                    label: 'Save entry',
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
