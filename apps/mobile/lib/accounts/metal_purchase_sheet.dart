import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/local_datetime.dart';
import '../core/money_format.dart';
import '../i18n/accounts_copy.dart';
import '../i18n/app_language.dart';
import '../theme/tokens.dart';
import '../widgets/app_sheet.dart';
import '../widgets/primary_button.dart';
import 'account_form.dart';
import 'account_models.dart';
import 'accounts_controller.dart';
import 'metal_purchase_form.dart';

/// "Buy more gold/silver" (docs/accounts.md §2.6 / §6.6). Calls
/// `add_metal_purchase`, which applies the weighted-average cost update and,
/// when funded from a Cash/Bank account, debits it.
class MetalPurchaseSheet extends StatefulWidget {
  const MetalPurchaseSheet({
    super.key,
    required this.controller,
    required this.account,
    this.editing,
  });

  final AccountsController controller;
  final Account account;

  /// When set, the sheet corrects this purchase (`correct_metal_purchase`)
  /// instead of adding a new one. The correction supersedes the original rather
  /// than editing it, so history stays append-only.
  final MetalPurchase? editing;

  @override
  State<MetalPurchaseSheet> createState() => _MetalPurchaseSheetState();
}

class _MetalPurchaseSheetState extends State<MetalPurchaseSheet> {
  final _v = MetalPurchaseFormValues();
  final _grams = TextEditingController();
  final _cost = TextEditingController();
  final _fees = TextEditingController();
  final _notes = TextEditingController();

  List<Account> _fundingAccounts = const [];
  bool _submitted = false;
  Map<String, String> _errors = const {};

  String get _metalType => widget.account.metalType ?? 'gold';

  bool get _isEditing => widget.editing != null;

  @override
  void initState() {
    super.initState();
    final editing = widget.editing;
    if (editing != null) {
      _v
        ..purity = editing.purity
        ..purchaseDate = formatLocalDateTimeInput(
          DateTime.tryParse(editing.purchasedAt)?.toLocal(),
        )
        ..unitsGrams = editing.quantityGrams
        ..costPerUnit = editing.costPerUnit
        ..fees = editing.fees
        ..paidFromAccount = editing.fundingMode == 'cash_account'
        ..fundingAccountId = editing.fundingAccountId ?? ''
        ..notes = editing.notes ?? '';
      _grams.text = editing.quantityGrams;
      _cost.text = editing.costPerUnit;
      _fees.text = editing.fees;
      _notes.text = editing.notes ?? '';
    } else {
      _v.purity = widget.account.purity ?? '';
    }
    widget.controller.service
        .fundingCandidates(widget.account.currencyCode)
        .then((list) {
          if (mounted) setState(() => _fundingAccounts = list);
        });
  }

  @override
  void dispose() {
    _grams.dispose();
    _cost.dispose();
    _fees.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _sync() {
    _v
      ..unitsGrams = _grams.text.trim()
      ..costPerUnit = _cost.text.trim()
      ..fees = _fees.text.trim()
      ..notes = _notes.text;
  }

  Future<void> _submit() async {
    _sync();
    final errs = validateMetalPurchase(_v, metalType: _metalType);
    setState(() {
      _submitted = true;
      _errors = errs;
    });
    if (errs.isNotEmpty) return;
    final editing = widget.editing;
    final ok = await widget.controller.run(
      (s) => editing == null
          ? s.addMetalPurchase(widget.account.id, _v)
          : s.correctMetalPurchase(editing.id, _v),
    );
    if (ok && mounted) Navigator.of(context).pop(true);
  }

  String? _err(String field, AccountsCopy copy) =>
      _submitted ? copy.metalPurchaseValidation(_errors[field]) : null;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final c = context.colors;
        final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
        _sync();
        final subtotal = _v.subtotal;
        final total = _v.totalCost;
        final currency = widget.account.currencyCode;
        return AppSheet(
          title: _isEditing ? copy.editMetalPurchase : copy.addMetalPurchase,
          subtitle: _isEditing
              ? copy.editMetalPurchaseSubtitle
              : copy.addMetalPurchaseSubtitle,
          children: [
            SheetField(
              label: copy.purityLabel,
              error: _err('purity', copy),
              child: SheetBox(
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _v.purity.isEmpty ? null : _v.purity,
                    isDense: true,
                    isExpanded: true,
                    hint: Text(
                      copy.select,
                      style: TextStyle(color: c.disabledFg, fontSize: 15),
                    ),
                    onChanged: (v) => setState(() => _v.purity = v ?? ''),
                    items: [
                      for (final p in purityOptionsFor(_metalType))
                        DropdownMenuItem(value: p, child: Text(copy.purity(p))),
                    ],
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
            SheetField(
              label: copy.purchaseDateTime,
              error: _err('purchaseDate', copy),
              child: InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(AppRadius.field),
                child: SheetBox(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _v.purchaseDate
                            .replaceFirst('T', '  ')
                            .split('.')
                            .first,
                        textDirection: TextDirection.ltr,
                        style: TextStyle(color: c.ink, fontSize: 14),
                      ),
                      Icon(Icons.event_outlined, size: 18, color: c.inkMuted),
                    ],
                  ),
                ),
              ),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: SheetField(
                    label: copy.grams,
                    error: _err('unitsGrams', copy),
                    child: _num(_grams, '0.000'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SheetField(
                    label: copy.costPerGram,
                    error: _err('costPerUnit', copy),
                    child: _num(_cost, '0.00'),
                  ),
                ),
              ],
            ),
            SheetField(
              label: copy.fees,
              optional: true,
              error: _err('fees', copy),
              child: _num(_fees, '0.00'),
            ),
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: c.fieldFill,
                border: Border.all(color: c.line),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                children: [
                  _summaryRow(
                    c,
                    copy.purchaseSubtotal,
                    MoneyFormat.money(subtotal, currency),
                  ),
                  const SizedBox(height: 6),
                  _summaryRow(
                    c,
                    copy.totalCost,
                    MoneyFormat.money(total, currency),
                    strong: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _PaidFromToggle(
              value: _v.paidFromAccount,
              onChanged: (v) => setState(() => _v.paidFromAccount = v),
            ),
            if (_v.paidFromAccount) ...[
              const SizedBox(height: 10),
              SheetField(
                label: copy.paidFrom,
                error: _err('fundingAccountId', copy),
                child: SheetBox(
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _v.fundingAccountId.isEmpty
                          ? null
                          : _v.fundingAccountId,
                      isDense: true,
                      isExpanded: true,
                      hint: Text(
                        _fundingAccounts.isEmpty
                            ? copy.noSameCurrencyFundingAccount
                            : copy.select,
                        style: TextStyle(color: c.disabledFg, fontSize: 14),
                      ),
                      onChanged: (v) =>
                          setState(() => _v.fundingAccountId = v ?? ''),
                      items: [
                        for (final a in _fundingAccounts)
                          DropdownMenuItem(
                            value: a.id,
                            child: Text(
                              copy.fundingAccountOption(a.name, a.type),
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
              ),
            ],
            SheetField(
              label: copy.notes,
              optional: true,
              child: SheetBox(
                child: TextField(
                  controller: _notes,
                  minLines: 2,
                  maxLines: 3,
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
                    label: _isEditing
                        ? copy.saveChanges
                        : copy.addMetalPurchase,
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

  Widget _summaryRow(
    AppColors c,
    String label,
    String value, {
    bool strong = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: c.inkMuted,
            fontSize: strong ? 13 : 12,
            fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          textDirection: TextDirection.ltr,
          style: TextStyle(
            color: c.ink,
            fontSize: strong ? 14 : 13,
            fontWeight: FontWeight.w700,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }

  Widget _num(TextEditingController controller, String hint) => SheetBox(
    child: TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      textDirection: TextDirection.ltr,
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        border: InputBorder.none,
        isCollapsed: true,
        hintText: hint,
      ),
      style: TextStyle(
        color: context.colors.ink,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    ),
  );

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final current = DateTime.tryParse(_v.purchaseDate) ?? now;
    final date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(now.year - 30),
      lastDate: now,
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
      time?.hour ?? 12,
      time?.minute ?? 0,
    );
    setState(() => _v.purchaseDate = picked.toIso8601String());
  }
}

class _PaidFromToggle extends StatelessWidget {
  const _PaidFromToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      children: [
        Expanded(
          child: Text(
            AccountsCopy.of(
              AppLanguageScope.of(context).language,
            ).paidFromCashBank,
            style: TextStyle(
              color: c.ink,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Switch(value: value, onChanged: onChanged, activeThumbColor: c.accent),
      ],
    );
  }
}
