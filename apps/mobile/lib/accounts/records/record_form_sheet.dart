import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/local_datetime.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import 'record_category_picker.dart';
import 'record_schema.dart';
import 'records_controller.dart';
import 'records_models.dart';
import 'records_service.dart';

/// Add / edit an account record — port of the web `AccountRecordFormDialog`.
/// Income / expense take a category; transfer takes a destination account and,
/// when the currencies differ, a manual "amount received".
class RecordFormSheet extends StatefulWidget {
  const RecordFormSheet({
    super.key,
    required this.controller,
    required this.recordAccounts,
    this.initialAccount,
    this.editing,
  });

  final RecordsController controller;
  final List<Account> recordAccounts;
  final Account? initialAccount;
  final EditableAccountRecord? editing;

  @override
  State<RecordFormSheet> createState() => _RecordFormSheetState();
}

class _RecordFormSheetState extends State<RecordFormSheet> {
  late AccountRecordFormValues _v;
  final _amount = TextEditingController();
  final _received = TextEditingController();
  final _notes = TextEditingController();
  bool _submitted = false;
  Map<String, String> _errors = const {};

  bool get _isEditing => widget.editing != null;

  @override
  void initState() {
    super.initState();
    _v =
        widget.editing?.values.copy() ??
        AccountRecordFormValues(
          accountId: widget.initialAccount?.id ?? '',
          occurredAt: formatLocalDateTimeInput(),
        );
    _amount.text = _v.amount;
    _received.text = _v.receivedAmount;
    _notes.text = _v.notes;
  }

  @override
  void dispose() {
    _amount.dispose();
    _received.dispose();
    _notes.dispose();
    super.dispose();
  }

  Account? _acc(String id) {
    for (final a in widget.recordAccounts) {
      if (a.id == id) return a;
    }
    return null;
  }

  bool get _crossCurrency {
    if (_v.type != AccountRecordType.transfer) return false;
    final from = _acc(_v.accountId);
    final to = _acc(_v.toAccountId);
    return from != null && to != null && from.currencyCode != to.currencyCode;
  }

  void _sync() {
    _v
      ..amount = _amount.text.trim()
      ..receivedAmount = _received.text.trim()
      ..notes = _notes.text;
    if (_v.type == AccountRecordType.transfer && !_crossCurrency) {
      _v.receivedAmount = _v.amount;
    }
  }

  Future<void> _submit() async {
    _sync();
    final errs = validateAccountRecordForm(_v);
    setState(() {
      _submitted = true;
      _errors = errs;
    });
    if (errs.isNotEmpty) return;
    final ok = await widget.controller.submit(
      _v,
      editingId: widget.editing?.id,
    );
    if (ok && mounted) Navigator.of(context).pop(true);
  }

  Future<void> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete record?'),
        content: const Text(
          'This will remove the record from your history. Your account '
          'balances will be updated.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          CompactButton(
            label: 'Delete record',
            tone: CompactButtonTone.danger,
            onPressed: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final done = await widget.controller.reverse(widget.editing!.id);
    if (done && mounted) Navigator.of(context).pop(true);
  }

  String? _err(String f) => _submitted ? _errors[f] : null;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final c = context.colors;
        final isTransfer = _v.type == AccountRecordType.transfer;
        final from = _acc(_v.accountId);

        return AppSheet(
          title: _isEditing ? 'Edit record' : 'Add record',
          children: [
            _TypeToggle(
              value: _v.type,
              onChanged: (t) => setState(() {
                _v.type = t;
                if (t == AccountRecordType.transfer) {
                  _v.mainCategoryId = '';
                  _v.subcategoryId = '';
                }
              }),
            ),
            const SizedBox(height: 14),

            _accountField(
              label: isTransfer ? 'From account' : 'Account',
              value: _v.accountId,
              error: _err('accountId'),
              onChanged: (v) => setState(() => _v.accountId = v),
            ),

            if (isTransfer)
              _accountField(
                label: 'To account',
                value: _v.toAccountId,
                error: _err('toAccountId'),
                onChanged: (v) => setState(() => _v.toAccountId = v),
              )
            else
              RecordCategoryField(
                categories: widget.controller.categories,
                mainCategoryId: _v.mainCategoryId,
                subcategoryId: _v.subcategoryId,
                error: _err('subcategoryId'),
                onChanged: (mainId, subId) => setState(() {
                  _v.mainCategoryId = mainId;
                  _v.subcategoryId = subId;
                }),
                onManage: () async {
                  final changed = await showAppSheet<bool>(
                    context,
                    builder: (_) => const RecordCategoryManagerSheet(),
                  );
                  if (changed == true) widget.controller.reloadCategories();
                },
              ),

            SheetField(
              label: isTransfer ? 'Amount sent' : 'Amount',
              error: _err('amount'),
              child: _amountField(_amount, from?.currencyCode),
            ),

            if (isTransfer && _crossCurrency)
              SheetField(
                label: 'Expected / actual amount received',
                error: _err('receivedAmount'),
                child: _amountField(
                  _received,
                  _acc(_v.toAccountId)?.currencyCode,
                ),
              ),

            SheetField(
              label: 'Date & time',
              error: _err('occurredAt'),
              child: InkWell(
                onTap: _pickDateTime,
                borderRadius: BorderRadius.circular(AppRadius.field),
                child: SheetBox(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _v.occurredAt.replaceFirst('T', '  '),
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
              label: 'Notes',
              optional: true,
              child: SheetBox(
                child: TextField(
                  controller: _notes,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isCollapsed: true,
                  ),
                  style: TextStyle(color: c.ink, fontSize: 14),
                ),
              ),
            ),

            if (widget.controller.actionError != null) ...[
              const SizedBox(height: 2),
              Text(
                widget.controller.actionError!,
                style: TextStyle(color: c.negative, fontSize: 13),
              ),
              const SizedBox(height: 10),
            ],

            Row(
              children: [
                if (_isEditing) ...[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: widget.controller.busy ? null : _confirmDelete,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: c.negative,
                        side: BorderSide(
                          color: c.negative.withValues(alpha: 0.4),
                        ),
                      ),
                      child: const Text('Delete'),
                    ),
                  ),
                  const SizedBox(width: 10),
                ] else
                  Expanded(
                    child: NeutralButton(
                      label: 'Cancel',
                      onPressed: widget.controller.busy
                          ? null
                          : () => Navigator.of(context).pop(),
                    ),
                  ),
                const SizedBox(width: 0),
                Expanded(
                  flex: 2,
                  child: PrimaryButton(
                    label: 'Save record',
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

  Widget _accountField({
    required String label,
    required String value,
    required String? error,
    required ValueChanged<String> onChanged,
  }) {
    final c = context.colors;
    return SheetField(
      label: label,
      error: error,
      child: SheetBox(
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: value.isEmpty ? '' : value,
            isDense: true,
            isExpanded: true,
            onChanged: (v) => onChanged(v ?? ''),
            items: [
              const DropdownMenuItem(value: '', child: Text('—')),
              for (final a in widget.recordAccounts)
                DropdownMenuItem(
                  value: a.id,
                  child: Text(
                    accountPickerLabel(a),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            style: TextStyle(
              color: c.ink,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  Widget _amountField(TextEditingController ctl, String? currency) {
    final c = context.colors;
    return SheetBox(
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: ctl,
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
          if (currency != null)
            Text(currency, style: TextStyle(color: c.inkMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final current = DateTime.tryParse(_v.occurredAt) ?? now;
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
    final picked = DateTime(
      date.year,
      date.month,
      date.day,
      time?.hour ?? current.hour,
      time?.minute ?? current.minute,
    );
    setState(() => _v.occurredAt = formatLocalDateTimeInput(picked));
  }
}

class _TypeToggle extends StatelessWidget {
  const _TypeToggle({required this.value, required this.onChanged});
  final AccountRecordType value;
  final ValueChanged<AccountRecordType> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    const items = [
      (AccountRecordType.income, 'Income', Color(0xFF059669)),
      (AccountRecordType.expense, 'Expense', Color(0xFFDC2626)),
      (AccountRecordType.transfer, 'Transfer', Color(0xFF475569)),
    ];
    return Row(
      children: [
        for (final (type, label, color) in items) ...[
          Expanded(
            child: GestureDetector(
              onTap: () => onChanged(type),
              child: Container(
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: value == type ? color : c.surface,
                  border: Border.all(color: value == type ? color : c.line),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    color: value == type ? Colors.white : c.inkMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
          if (type != AccountRecordType.transfer) const SizedBox(width: 8),
        ],
      ],
    );
  }
}
