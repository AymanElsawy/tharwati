import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/decimals.dart';
import '../../core/local_datetime.dart';
import '../../core/money_format.dart';
import '../../i18n/accounts_copy.dart';
import '../../i18n/app_language.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import 'records_controller.dart';
import 'records_models.dart';
import 'refund_submission.dart';

class RefundSheet extends StatefulWidget {
  const RefundSheet({
    super.key,
    required this.controller,
    required this.expenseId,
    required this.originalAccountId,
    required this.category,
    required this.summary,
    required this.accounts,
  });

  final RecordsController controller;
  final String expenseId, originalAccountId, category;
  final ExpenseRefundSummary summary;
  final List<Account> accounts;

  @override
  State<RefundSheet> createState() => _RefundSheetState();
}

class _RefundSheetState extends State<RefundSheet> {
  late String _account = widget.originalAccountId;
  late String _date = formatLocalDateTimeInput();
  late final _amount = TextEditingController(
    text: D.normalize(widget.summary.remainingAmount) ?? '',
  );
  final _notes = TextEditingController();
  final _submissionKey = RefundSubmissionKey();
  bool _submitting = false;

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final now = DateTime.now();
    final current = DateTime.tryParse(_date) ?? now;
    final date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(now.year - 30),
      lastDate: DateTime(now.year + 1),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current),
    );
    setState(() => _date = formatLocalDateTimeInput(DateTime(
      date.year, date.month, date.day,
      time?.hour ?? current.hour, time?.minute ?? current.minute,
    )));
  }

  Future<void> _save() async {
    if (_submitting) return;
    final normalizedAmount = D.normalize(_amount.text);
    if (normalizedAmount == null) return;
    setState(() => _submitting = true);
    final amount = normalizedAmount;
    final notes = _notes.text.trim();
    final payload = [widget.expenseId, amount, _account, _date, notes].join('\u0000');
    final ok = await widget.controller.addRefund(
      expenseId: widget.expenseId,
      amount: amount,
      accountId: _account,
      occurredAt: _date,
      notes: notes,
      idempotencyKey: _submissionKey.forPayload(payload),
    );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() => _submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final remaining = remainingAfterRefund(
      widget.summary.remainingAmount, _amount.text,
    );
    final previewAmount = D.normalize(_amount.text);
    final currency = widget.summary.currencyCode;

    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) => AppSheet(
        title: copy.recordRefund,
        children: [
          Text(widget.category, style: TextStyle(color: c.inkMuted)),
          Text('${copy.originalAmount}: ${MoneyFormat.money(widget.summary.originalAmount, currency)}', textDirection: TextDirection.ltr),
          Text('${copy.refunded}: ${MoneyFormat.money(widget.summary.refundedAmount, currency)}', textDirection: TextDirection.ltr),
          Text('${copy.remainingRefundable}: ${MoneyFormat.money(widget.summary.remainingAmount, currency)}', textDirection: TextDirection.ltr),
          SheetField(
            label: copy.refundAmount,
            child: SheetBox(child: TextField(
              controller: _amount,
              onChanged: (_) => setState(() {}),
              textDirection: TextDirection.ltr,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
              decoration: const InputDecoration(border: InputBorder.none, isCollapsed: true),
            )),
          ),
          Text('${copy.currentRefundAmount}: ${copy.ltr(previewAmount == null ? '—' : MoneyFormat.money(previewAmount, currency))}'),
          Text('${copy.remainingAfterRefund}: ${copy.ltr(remaining == null ? '—' : MoneyFormat.money(remaining, currency))}'),
          SheetField(
            label: copy.destinationAccountLabel,
            child: SheetBox(child: DropdownButtonHideUnderline(child: DropdownButton<String>(
              value: _account,
              isDense: true,
              isExpanded: true,
              onChanged: (v) => setState(() => _account = v ?? _account),
              items: [for (final a in widget.accounts) DropdownMenuItem(value: a.id, child: Text('${a.name} · ${a.currencyCode}'))],
            ))),
          ),
          SheetField(
            label: copy.dateTime,
            child: InkWell(
              onTap: _pick,
              child: SheetBox(child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_date.replaceFirst('T', '  '), textDirection: TextDirection.ltr),
                  Icon(Icons.event_outlined, color: c.inkMuted),
                ],
              )),
            ),
          ),
          SheetField(
            label: copy.notes,
            optional: true,
            child: SheetBox(child: TextField(
              controller: _notes,
              decoration: const InputDecoration(border: InputBorder.none, isCollapsed: true),
            )),
          ),
          if (widget.controller.actionError != null)
            Text(
              widget.controller.actionError == 'invalid_refund_request'
                  ? copy.invalidRefundRequest
                  : widget.controller.actionError!,
              style: TextStyle(color: c.negative),
            ),
          PrimaryButton(
            label: copy.recordRefund,
            busy: widget.controller.busy || _submitting,
            onPressed: remaining == null || widget.controller.busy || _submitting
                ? null
                : _save,
          ),
        ],
      ),
    );
  }
}
