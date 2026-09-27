import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/local_datetime.dart';
import '../../core/decimals.dart';
import '../../i18n/accounts_copy.dart';
import '../../i18n/app_language.dart';
import '../../portfolio/portfolio_models.dart';
import '../../portfolio/portfolio_repository.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import 'record_category_picker.dart';
import 'record_schema.dart';
import 'record_submission.dart';
import 'records_controller.dart';
import 'records_models.dart';
import 'refund_sheet.dart';

/// Add / edit an account record — port of the web `AccountRecordFormDialog`.
/// Income / expense take a category; transfer takes a destination account and,
/// when the currencies differ, an editable current-FX estimate.
class RecordFormSheet extends StatefulWidget {
  const RecordFormSheet({
    super.key,
    required this.controller,
    required this.recordAccounts,
    this.initialAccount,
    this.editing,
    this.fxRateLoader,
  });

  final RecordsController controller;
  final List<Account> recordAccounts;
  final Account? initialAccount;
  final EditableAccountRecord? editing;
  final Future<PortfolioFxRate?> Function(String from, String to)? fxRateLoader;

  @override
  State<RecordFormSheet> createState() => _RecordFormSheetState();
}

/// Compares form state without treating equivalent persisted display values as
/// edits. Amounts stay decimal strings; date-times are compared in the local
/// minute precision used by this form.
bool isAccountRecordFormDirty({
  required AccountRecordFormValues initial,
  required AccountRecordFormValues current,
  required String displayedAmount,
  required String displayedReceivedAmount,
  required String displayedNotes,
}) {
  bool sameDecimal(String left, String right) {
    final normalizedLeft = D.normalize(left);
    final normalizedRight = D.normalize(right);
    return normalizedLeft != null && normalizedRight != null
        ? normalizedLeft == normalizedRight
        : left.trim() == right.trim();
  }

  String localMinute(String value) {
    final parsed = DateTime.tryParse(value);
    return parsed == null ? value.trim() : formatLocalDateTimeInput(parsed);
  }

  return current.type != initial.type ||
      current.accountId != initial.accountId ||
      current.toAccountId != initial.toAccountId ||
      !sameDecimal(displayedAmount, initial.amount) ||
      !sameDecimal(displayedReceivedAmount, initial.receivedAmount) ||
      current.mainCategoryId != initial.mainCategoryId ||
      current.subcategoryId != initial.subcategoryId ||
      localMinute(current.occurredAt) != localMinute(initial.occurredAt) ||
      displayedNotes != initial.notes;
}

/// Only a completed Refund creation closes the parent Edit Expense sheet.
bool shouldCloseEditExpenseAfterRefund(bool? refundCreated) =>
    refundCreated == true;

/// Record-account eligibility is supplied by the caller. Transfers only add
/// the reciprocal constraint that one account cannot be both sides.
List<Account> transferAccountOptions(
  List<Account> accounts, {
  required String oppositeAccountId,
}) => accounts.where((account) => account.id != oppositeAccountId).toList();

AccountRecordFormValues normalizeTransferValues(
  AccountRecordFormValues values,
) {
  final normalized = values.copy();
  if (normalized.type == AccountRecordType.transfer &&
      normalized.accountId.isNotEmpty &&
      normalized.accountId == normalized.toAccountId) {
    normalized.toAccountId = '';
  }
  return normalized;
}

bool hasValidTransferAccountSelection(AccountRecordFormValues values) =>
    values.type != AccountRecordType.transfer ||
    (values.accountId.isNotEmpty &&
        values.toAccountId.isNotEmpty &&
        values.accountId != values.toAccountId);

class _RecordFormSheetState extends State<RecordFormSheet> {
  late AccountRecordFormValues _v;
  final _amount = TextEditingController();
  final _received = TextEditingController();
  final _notes = TextEditingController();
  bool _submitted = false;
  Map<String, String> _errors = const {};
  int _fxRequestVersion = 0;
  bool _receivedIsManual = false;
  bool _fxUnavailable = false;
  bool _fxLoading = false;
  bool _hasEstimate = false;

  bool get _isEditing => widget.editing != null;
  bool get _isDirty {
    final initial = widget.editing?.values;
    return initial != null &&
        isAccountRecordFormDirty(
          initial: initial,
          current: _v,
          displayedAmount: _amount.text,
          displayedReceivedAmount: _received.text,
          displayedNotes: _notes.text,
        );
  }

  @override
  void initState() {
    super.initState();
    _v = normalizeTransferValues(
      widget.editing?.values ??
        AccountRecordFormValues(
          accountId: widget.initialAccount?.id ?? '',
          occurredAt: formatLocalDateTimeInput(),
        ),
    );
    _amount.text = D.normalize(_v.amount) ?? _v.amount;
    _received.text = _v.receivedAmount;
    _notes.text = _v.notes;
    _receivedIsManual = _received.text.isNotEmpty;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_receivedIsManual) _requestFxEstimate();
    });
  }

  @override
  void dispose() {
    _fxRequestVersion++;
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

  ({String from, String to, String amount})? get _fxContext {
    if (!_crossCurrency) return null;
    final amount = _amount.text.trim();
    if (!RegExp(r'^\d{1,18}(?:\.\d{1,2})?$').hasMatch(amount) ||
        !D.isPositive(amount)) {
      return null;
    }
    return (
      from: _acc(_v.accountId)!.currencyCode,
      to: _acc(_v.toAccountId)!.currencyCode,
      amount: amount,
    );
  }

  void _financialInputChanged() {
    setState(() {
      _fxRequestVersion++;
      _received.clear();
      _receivedIsManual = false;
      _fxUnavailable = false;
      _fxLoading = false;
      _hasEstimate = false;
    });
    _requestFxEstimate();
  }

  void _refreshReceivedError() {
    if (!_submitted) return;
    _sync();
    final error = validateAccountRecordForm(_v)['receivedAmount'];
    _errors = {..._errors};
    if (error == null) {
      _errors.remove('receivedAmount');
    } else {
      _errors['receivedAmount'] = error;
    }
  }

  Future<void> _requestFxEstimate() async {
    final context = _fxContext;
    if (context == null) return;
    final version = ++_fxRequestVersion;
    setState(() {
      _fxLoading = true;
      _fxUnavailable = false;
    });
    try {
      final rate = await (widget.fxRateLoader ??
          SupabasePortfolioDataSource().loadFxRate)(context.from, context.to);
      if (!mounted ||
          version != _fxRequestVersion ||
          _fxContext != context ||
          _receivedIsManual) {
        return;
      }
      final multiplied = rate == null || rate.stale ||
              rate.fromCurrencyCode != context.from ||
              rate.toCurrencyCode != context.to || !D.isPositive(rate.rate)
          ? null
          : D.multiply(context.amount, rate.rate);
      final estimate = multiplied == null
          ? null
          : D.divide(multiplied, '1', scale: 2);
      setState(() {
        _fxLoading = false;
        if (D.isPositive(estimate)) {
          _received.text = estimate!;
          _hasEstimate = true;
          _refreshReceivedError();
        } else {
          _fxUnavailable = true;
        }
      });
    } catch (_) {
      if (!mounted ||
          version != _fxRequestVersion ||
          _fxContext != context ||
          _receivedIsManual) {
        return;
      }
      setState(() {
        _fxLoading = false;
        _fxUnavailable = true;
      });
    }
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
    final fingerprint = accountRecordSubmissionFingerprint(_v);
    bool current() {
      if (!mounted || ModalRoute.of(context)?.isCurrent == false) return false;
      _sync();
      return accountRecordSubmissionFingerprint(_v) == fingerprint;
    }
    final ok = await widget.controller.submit(
      _v,
      editingId: widget.editing?.id,
      isCurrent: current,
      onCommitted: () { if (current()) Navigator.of(context).pop(true); },
    );
    if (_isEditing && ok && mounted) Navigator.of(context).pop(true);
  }

  Future<void> _confirmDelete() async {
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(copy.deleteRecordTitle),
        content: Text(copy.deleteRecordBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(copy.cancel),
          ),
          CompactButton(
            label: copy.deleteRecord,
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

  Future<void> _refund() async {
    if (widget.editing == null || _v.type != AccountRecordType.expense || _isDirty) return;
    final summary = await widget.controller.refundSummary(widget.editing!.id);
    if (summary == null || !D.isPositive(summary.remainingAmount) || !mounted) return;
    final from = _acc(_v.accountId); if (from == null) return;
    final eligible = widget.recordAccounts.where((a) => a.currencyCode == summary.currencyCode).toList();
    final main = widget.controller.categories.where((item) => item.id == _v.mainCategoryId).firstOrNull;
    final sub = main?.subcategories.where((item) => item.id == _v.subcategoryId).firstOrNull;
    final category = sub == null ? (main?.name ?? '') : '${main!.name} → ${sub.name}';
    widget.controller.clearActionError();
    final refundCreated = await showAppSheet<bool>(
      context,
      builder: (_) => RefundSheet(
        controller: widget.controller,
        expenseId: widget.editing!.id,
        originalAccountId: from.id,
        category: category,
        summary: summary,
        accounts: eligible,
      ),
    );
    if (shouldCloseEditExpenseAfterRefund(refundCreated) && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  String? _err(BuildContext context, String field) => AccountsCopy.of(
    AppLanguageScope.of(context).language,
  ).recordValidation(_submitted ? _errors[field] : null);

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final c = context.colors;
        final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
        final isTransfer = _v.type == AccountRecordType.transfer;
        final from = _acc(_v.accountId);

        return AppSheet(
          title: _isEditing ? copy.editRecord : copy.addRecord,
          children: [
            _TypeToggle(
              value: _v.type,
              onChanged: (t) {
                setState(() {
                  final previousType = _v.type;
                  _v.type = t;
                  if (t == AccountRecordType.transfer) {
                    if (previousType != AccountRecordType.transfer) {
                      _v.toAccountId = '';
                    }
                    _v.mainCategoryId = '';
                    _v.subcategoryId = '';
                  }
                });
                _financialInputChanged();
              },
            ),
            const SizedBox(height: 14),

            _accountField(
              label: isTransfer ? copy.fromAccount : copy.account,
              value: _v.accountId,
              accounts: isTransfer
                  ? transferAccountOptions(
                      widget.recordAccounts,
                      oppositeAccountId: _v.toAccountId,
                    )
                  : widget.recordAccounts,
              error: _err(context, 'accountId'),
              onChanged: (v) {
                setState(() {
                  _v.accountId = v;
                  if (isTransfer && v == _v.toAccountId) _v.toAccountId = '';
                });
                if (isTransfer) _financialInputChanged();
              },
            ),

            if (isTransfer)
              _accountField(
                label: copy.toAccount,
                value: _v.toAccountId,
                accounts: transferAccountOptions(
                  widget.recordAccounts,
                  oppositeAccountId: _v.accountId,
                ),
                error: _err(context, 'toAccountId'),
                onChanged: (v) {
                  setState(() {
                    _v.toAccountId = v;
                    if (v == _v.accountId) _v.accountId = '';
                  });
                  _financialInputChanged();
                },
              )
            else
              RecordCategoryField(
                categories: widget.controller.categories,
                mainCategoryId: _v.mainCategoryId,
                subcategoryId: _v.subcategoryId,
                error: _err(context, 'subcategoryId'),
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
              label: isTransfer ? copy.amountSent : copy.amount,
              error: _err(context, 'amount'),
              child: _amountField(
                _amount,
                from?.currencyCode,
                onChanged: isTransfer ? _financialInputChanged : null,
              ),
            ),

            if (isTransfer && _crossCurrency)
              SheetField(
                label: copy.amountReceived,
                hint: _fxUnavailable
                    ? copy.transferFxUnavailable
                    : _fxLoading
                    ? copy.transferFxLoading
                    : _hasEstimate && !_receivedIsManual
                    ? copy.transferFxEstimated
                    : copy.transferFxManual,
                error: _err(context, 'receivedAmount'),
                child: _amountField(
                  _received,
                  _acc(_v.toAccountId)?.currencyCode,
                  hintText: '—',
                  onChanged: () => setState(() {
                    _receivedIsManual = true;
                    _hasEstimate = false;
                    _refreshReceivedError();
                  }),
                ),
              ),

            SheetField(
              label: copy.dateTime,
              error: _err(context, 'occurredAt'),
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
              label: copy.notes,
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

            if (_isEditing && _v.type == AccountRecordType.expense) ...[
              SizedBox(width: double.infinity, child: OutlinedButton(onPressed: widget.controller.busy || _isDirty ? null : _refund, child: Text(copy.recordRefund))),
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
                      child: Text(copy.delete),
                    ),
                  ),
                  const SizedBox(width: 10),
                ] else
                  Expanded(
                    child: NeutralButton(
                      label: copy.cancel,
                      onPressed: widget.controller.busy
                          ? null
                          : () => Navigator.of(context).pop(),
                    ),
                  ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: PrimaryButton(
                    label: copy.saveRecord,
                    busy: widget.controller.busy,
                    onPressed: hasValidTransferAccountSelection(_v)
                        ? _submit
                        : null,
                  ),
                ),
              ],
            ),
            if (_isEditing && _v.type == AccountRecordType.expense && _isDirty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  copy.saveBeforeRefund,
                  style: TextStyle(color: c.inkMuted, fontSize: 12),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _accountField({
    required String label,
    required String value,
    required List<Account> accounts,
    required String? error,
    required ValueChanged<String> onChanged,
  }) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
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
              for (final a in accounts)
                DropdownMenuItem(
                  value: a.id,
                  child: Text(
                    copy.recordAccountPicker(a.name, a.type, a.currencyCode),
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

  Widget _amountField(
    TextEditingController ctl,
    String? currency, {
    String hintText = '0.00',
    VoidCallback? onChanged,
  }) {
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
              onChanged: (_) {
                if (onChanged != null) {
                  onChanged();
                } else {
                  setState(() {});
                }
              },
              decoration: InputDecoration(
                border: InputBorder.none,
                isCollapsed: true,
                hintText: hintText,
              ),
              style: TextStyle(
                color: c.ink,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          if (currency != null)
            Text(
              currency,
              textDirection: TextDirection.ltr,
              style: TextStyle(color: c.inkMuted, fontSize: 12),
            ),
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
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final items = [
      (
        AccountRecordType.income,
        copy.recordTypeValue('income'),
        const Color(0xFF059669),
      ),
      (
        AccountRecordType.expense,
        copy.recordTypeValue('expense'),
        const Color(0xFFDC2626),
      ),
      (
        AccountRecordType.transfer,
        copy.recordTypeValue('transfer'),
        const Color(0xFF475569),
      ),
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
