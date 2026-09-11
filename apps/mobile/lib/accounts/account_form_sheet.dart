import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../dashboard/data/dashboard_repository.dart';
import '../i18n/accounts_copy.dart';
import '../i18n/app_language.dart';
import '../theme/tokens.dart';
import '../widgets/app_sheet.dart';
import '../widgets/primary_button.dart';
import 'account_form.dart';
import 'account_models.dart';
import 'account_schema.dart';
import 'accounts_controller.dart';

/// Flow 3 — Add / edit account. Field order, controls, labels, placeholders and
/// validation mirror the web `AccountForm` / `AccountFormDialog`
/// (src/features/accounts/components/AccountForm.tsx) 1:1, rendered with the
/// mobile sheet tokens. Create keeps the mobile single-sheet type grid; edit
/// skips the picker (type is immutable). Gold auto-names itself and hides the
/// name, balance and notes fields.
class AccountFormSheet extends StatefulWidget {
  const AccountFormSheet({super.key, required this.controller, this.account});

  final AccountsController controller;
  final Account? account;

  bool get isEditing => account != null;

  @override
  State<AccountFormSheet> createState() => _AccountFormSheetState();
}

class _AccountFormSheetState extends State<AccountFormSheet> {
  late final AccountFormValues _v = widget.isEditing
      ? AccountFormValues.fromAccount(widget.account!)
      : AccountFormValues(
          currencyCode: 'EGP',
        ); // updated from profile in initState

  final _name = TextEditingController();
  final _balance = TextEditingController();
  final _creditLimit = TextEditingController();
  final _ownership = TextEditingController();
  final _businessOther = TextEditingController();
  final _industryOther = TextEditingController();
  final _method = TextEditingController();
  final _location = TextEditingController();
  final _notes = TextEditingController();
  final _valNotes = TextEditingController();

  bool _submitted = false;
  Map<String, String> _errors = const {};

  @override
  void initState() {
    super.initState();
    if (!widget.isEditing) _loadDefaultCurrency();
    _name.text = _v.name;
    _balance.text = widget.isEditing && _v.type.isValued
        ? ''
        : _v.openingBalance;
    _creditLimit.text = _v.creditCardLimit;
    _ownership.text = _v.ownershipPercentage;
    _businessOther.text = _v.businessTypeOther;
    _industryOther.text = _v.industryOther;
    _method.text = _v.valuationMethod;
    _location.text = _v.location;
    _notes.text = _v.notes;
    _valNotes.text = _v.valuationNotes;
  }

  Future<void> _loadDefaultCurrency() async {
    try {
      final code = await DashboardRepository().fetchBaseCurrency();
      if (code != null && mounted && _v.currencyCode == 'EGP') {
        setState(() => _v.currencyCode = code);
      }
    } catch (_) {
      // Falls back to EGP; the field is editable.
    }
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _balance,
      _creditLimit,
      _ownership,
      _businessOther,
      _industryOther,
      _method,
      _location,
      _notes,
      _valNotes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _sync() {
    _v
      ..name = _name.text
      ..openingBalance = _balance.text.trim()
      ..creditCardLimit = _creditLimit.text.trim()
      ..ownershipPercentage = _ownership.text.trim()
      ..businessTypeOther = _businessOther.text
      ..industryOther = _industryOther.text
      ..valuationMethod = _method.text
      ..location = _location.text
      ..notes = _notes.text
      ..valuationNotes = _valNotes.text;
  }

  Future<void> _submit() async {
    _sync();
    final errs = validateAccountForm(_v, isCreate: !widget.isEditing);
    setState(() {
      _submitted = true;
      _errors = errs;
    });
    if (errs.isNotEmpty) return;

    final ok = await widget.controller.run((s) async {
      if (widget.isEditing) {
        await s.updateAccount(widget.account!.id, _v);
      } else {
        await s.createAccount(_v);
      }
    });
    if (ok && mounted) Navigator.of(context).pop(true);
  }

  String? _err(AccountsCopy copy, String field) =>
      _submitted && _errors[field] != null
      ? copy.validation(_errors[field]!)
      : null;

  // ---- lock state (web `isCurrencyLocked` / `isOpeningBalanceLocked`) --------

  bool get _hasHistory {
    if (!widget.isEditing) return false;
    final items = widget.controller.model?.items ?? const [];
    for (final i in items) {
      if (i.account.id == widget.account!.id) {
        return i.lifecycle?.hasFinancialHistory ?? false;
      }
    }
    return false;
  }

  bool get _currencyLocked =>
      widget.isEditing && (_hasHistory || widget.account!.type.isValued);

  bool get _openingBalanceLocked => widget.isEditing && _hasHistory;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final c = context.colors;
        final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
        final t = _v.type;
        final isValued = t.isValued;
        final isDisabled = widget.controller.busy;

        return AppSheet(
          title: widget.isEditing
              ? copy.editAccountTitle
              : copy.createAccountTitle,
          subtitle: widget.isEditing
              ? copy.accountType(t)
              : copy.accountCategoryHint,
          children: [
            if (!widget.isEditing) ...[
              _TypeGrid(
                selected: t,
                copy: copy,
                onSelect: (type) => setState(() {
                  _v.accountTypeCode = type.code;
                  if (type != AccountType.bank) _v.bankSubtype = '';
                  // Metals default to Gold so "add gold" is one tap; the
                  // Type dropdown still lets them switch.
                  if (type == AccountType.gold && _v.metalType.isEmpty) {
                    _v.metalType = 'gold';
                    _v.name = 'Gold';
                  }
                }),
              ),
              const SizedBox(height: 6),
            ],

            // 1 — Name (hidden for gold; auto-named "Gold" / "Silver").
            if (t != AccountType.gold)
              SheetField(
                label: copy.name,
                error: _err(copy, 'name'),
                child: SheetBox(
                  child: TextField(
                    controller: _name,
                    enabled: !isDisabled,
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      isCollapsed: true,
                      hintText: copy.nameHint,
                    ),
                    style: TextStyle(color: c.ink, fontSize: 15),
                  ),
                ),
              ),

            // 2 — Currency (always shown, full width).
            SheetField(
              label: copy.currency,
              hint: _currencyLocked ? copy.currencyLockedHint : null,
              child: _select(
                value: _v.currencyCode,
                codes: kAccountCurrencies,
                labelFor: copy.currencyLabel,
                placeholder: copy.selectOption,
                enabled: !isDisabled && !_currencyLocked,
                withPlaceholder: false,
                onChanged: (v) => setState(() => _v.currencyCode = v),
              ),
            ),

            // 3 — Type-specific block (web DOM order).
            ..._typeFields(c, copy, isDisabled),

            // 4 — Opening balance (non-gold, non-valued).
            if (t != AccountType.gold && !isValued)
              SheetField(
                label: copy.balanceLabelFor(t),
                error: _err(copy, 'openingBalance'),
                hint: _openingBalanceLocked ? copy.balanceLockedHint : null,
                child: _openingBalanceLocked
                    ? _ReadOnlyBox(text: _v.openingBalance)
                    : _amountField(_balance, enabled: !isDisabled),
              ),

            // 5 — Valued account (Real Estate / Business), create only.
            if (isValued && !widget.isEditing) ...[
              SheetField(
                label: copy.balanceLabelFor(t),
                error: _err(copy, 'openingBalance'),
                child: _amountField(_balance, enabled: !isDisabled),
              ),
              SheetField(
                label: copy.valuationDate,
                error: _err(copy, 'valuationDate'),
                child: _valuationDateField(),
              ),
              if (t == AccountType.business)
                SheetField(
                  label: copy.valuationMethod,
                  optional: true,
                  child: _plainField(_method, enabled: !isDisabled),
                ),
              SheetField(
                label: copy.valuationNote,
                optional: true,
                child: _plainField(
                  _valNotes,
                  enabled: !isDisabled,
                  minLines: 2,
                  maxLines: 4,
                ),
              ),
            ],

            // 6 — Description / Notes (hidden for gold).
            if (t != AccountType.gold)
              SheetField(
                label: copy.descriptionNotes,
                optional: true,
                child: _plainField(
                  _notes,
                  enabled: !isDisabled,
                  minLines: 2,
                  maxLines: 4,
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
                    label: widget.controller.busy
                        ? copy.saving
                        : widget.isEditing
                        ? copy.saveChanges
                        : copy.createAccountTitle,
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

  // ---- type-specific fields (web AccountForm conditional blocks) -------------

  List<Widget> _typeFields(AppColors c, AccountsCopy copy, bool isDisabled) {
    switch (_v.type) {
      case AccountType.bank:
        return [
          SheetField(
            label: copy.type,
            error: _err(copy, 'bankSubtype'),
            child: _select(
              value: _v.bankSubtype,
              codes: bankSubtypeCodes,
              labelFor: copy.bankOption,
              placeholder: copy.selectOption,
              enabled: !isDisabled,
              onChanged: (v) => setState(() => _v.bankSubtype = v),
            ),
          ),
          if (_v.bankSubtype == 'credit') ...[
            SheetField(
              label: copy.creditCardLimit,
              error: _err(copy, 'creditCardLimit'),
              child: _amountField(
                _creditLimit,
                enabled: !isDisabled && !_openingBalanceLocked,
              ),
            ),
            SheetField(
              label: copy.dueDayOfMonth,
              error: _err(copy, 'dueDayOfMonth'),
              child: _select(
                value: _v.dueDayOfMonth,
                codes: [for (var d = 1; d <= 31; d++) '$d'],
                labelFor: (value) =>
                    value.isEmpty ? copy.unset : copy.ltr(value),
                placeholder: copy.unset,
                enabled: !isDisabled,
                onChanged: (v) => setState(() => _v.dueDayOfMonth = v),
              ),
            ),
          ],
        ];
      case AccountType.brokerage:
        return [
          SheetField(
            label: copy.investmentsType,
            error: _err(copy, 'investmentType'),
            child: _select(
              value: _v.investmentType,
              codes: investmentTypeCodes,
              labelFor: copy.investmentOption,
              placeholder: copy.selectOption,
              enabled: !isDisabled,
              onChanged: (v) => setState(() => _v.investmentType = v),
            ),
          ),
        ];
      case AccountType.realEstate:
        return [
          SheetField(
            label: copy.propertyTypeLabel,
            error: _err(copy, 'propertyType'),
            child: _select(
              value: _v.propertyType,
              codes: propertyTypeCodes,
              labelFor: copy.propertyType,
              placeholder: copy.selectOption,
              enabled: !isDisabled,
              onChanged: (v) => setState(() => _v.propertyType = v),
            ),
          ),
          SheetField(
            label: copy.location,
            optional: true,
            child: _plainField(_location, enabled: !isDisabled),
          ),
          _ownershipField(
            c,
            copy,
            enabled: !isDisabled && !_openingBalanceLocked,
          ),
        ];
      case AccountType.business:
        return [
          SheetField(
            label: copy.businessType,
            error: _err(copy, 'businessType'),
            child: _select(
              value: _v.businessType,
              codes: businessTypeCodes,
              labelFor: copy.businessOption,
              placeholder: copy.selectOption,
              enabled: !isDisabled,
              onChanged: (v) => setState(() {
                _v.businessType = v;
                if (v != 'other') _v.businessTypeOther = '';
              }),
            ),
          ),
          if (_v.businessType == 'other')
            SheetField(
              label: copy.specifyBusinessType,
              error: _err(copy, 'businessTypeOther'),
              child: _plainField(_businessOther, enabled: !isDisabled),
            ),
          SheetField(
            label: copy.industry,
            error: _err(copy, 'industry'),
            child: _IndustrySelector(
              value: _v.industry,
              copy: copy,
              enabled: !isDisabled,
              onChanged: (v) => setState(() {
                _v.industry = v;
                if (v != 'other') _v.industryOther = '';
              }),
            ),
          ),
          if (_v.industry == 'other')
            SheetField(
              label: copy.specifyIndustry,
              error: _err(copy, 'industryOther'),
              child: _plainField(_industryOther, enabled: !isDisabled),
            ),
          _ownershipField(
            c,
            copy,
            enabled: !isDisabled && !_openingBalanceLocked,
          ),
        ];
      case AccountType.gold:
        return [
          SheetField(
            label: copy.type,
            error: _err(copy, 'metalType'),
            child: _select(
              value: _v.metalType,
              codes: metalTypeCodes,
              labelFor: copy.metalOption,
              placeholder: copy.selectOption,
              enabled: !isDisabled,
              onChanged: (v) => setState(() {
                _v.metalType = v;
                _v.name = v == 'silver' ? 'Silver' : 'Gold';
              }),
            ),
          ),
        ];
      case AccountType.cash:
      case AccountType.other:
        return const [];
    }
  }

  Widget _ownershipField(
    AppColors c,
    AccountsCopy copy, {
    bool enabled = true,
  }) => SheetField(
    label: copy.ownershipPercentage,
    error: _err(copy, 'ownershipPercentage'),
    child: SheetBox(
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _ownership,
              enabled: enabled,
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
                hintText: '100',
              ),
              style: TextStyle(
                color: c.ink,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Text(
            '%',
            style: TextStyle(color: c.inkMuted, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    ),
  );

  Widget _valuationDateField() => InkWell(
    onTap: () async {
      final now = DateTime.now();
      final picked = await showDatePicker(
        context: context,
        initialDate: DateTime.tryParse(_v.valuationDate) ?? now,
        firstDate: DateTime(now.year - 30),
        lastDate: now,
      );
      if (picked != null) {
        setState(
          () => _v.valuationDate =
              '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
        );
      }
    },
    borderRadius: BorderRadius.circular(AppRadius.field),
    child: SheetBox(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            _v.valuationDate,
            textDirection: TextDirection.ltr,
            style: TextStyle(color: context.colors.ink, fontSize: 15),
          ),
          Icon(Icons.event_outlined, size: 18, color: context.colors.inkMuted),
        ],
      ),
    ),
  );

  Widget _amountField(
    TextEditingController controller, {
    bool enabled = true,
  }) => SheetBox(
    child: TextField(
      controller: controller,
      enabled: enabled,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      textDirection: TextDirection.ltr,
      decoration: const InputDecoration(
        border: InputBorder.none,
        isCollapsed: true,
        hintText: '0.00',
      ),
      style: TextStyle(
        color: context.colors.ink,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      ),
    ),
  );

  Widget _plainField(
    TextEditingController controller, {
    bool enabled = true,
    int minLines = 1,
    int maxLines = 1,
  }) => SheetBox(
    child: TextField(
      controller: controller,
      enabled: enabled,
      minLines: minLines,
      maxLines: maxLines,
      decoration: const InputDecoration(
        border: InputBorder.none,
        isCollapsed: true,
      ),
      style: TextStyle(color: context.colors.ink, fontSize: 15),
    ),
  );

  /// A `<select>`-style dropdown. When [withPlaceholder] is true the first row is
  /// a re-selectable "Select an option" (`value: ''`), matching the web
  /// `<option value="">` placeholder.
  Widget _select({
    required String value,
    required List<String> codes,
    required String Function(String) labelFor,
    required ValueChanged<String> onChanged,
    required String placeholder,
    bool withPlaceholder = true,
    bool enabled = true,
  }) {
    final c = context.colors;
    final items = <String>[if (withPlaceholder) '', ...codes];
    String labelOf(String code) => code.isEmpty ? placeholder : labelFor(code);
    return SheetBox(
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: items.contains(value) ? value : items.first,
          isDense: true,
          isExpanded: true,
          onChanged: enabled ? (v) => onChanged(v ?? '') : null,
          items: [
            for (final item in items)
              DropdownMenuItem(
                value: item,
                child: Text(
                  labelOf(item),
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: item.isEmpty ? c.disabledFg : c.ink),
                ),
              ),
          ],
          style: TextStyle(
            color: c.ink,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

/// A locked, read-only value box (web renders a `div` with `aria-readonly`).
class _ReadOnlyBox extends StatelessWidget {
  const _ReadOnlyBox({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Opacity(
      opacity: 0.6,
      child: SheetBox(
        child: Text(
          text,
          textDirection: TextDirection.ltr,
          style: TextStyle(color: c.ink, fontSize: 15),
        ),
      ),
    );
  }
}

/// Searchable picker for the 16 industry codes — port of the web
/// `BusinessIndustrySelector` combobox. Tapping opens a search sheet.
class _IndustrySelector extends StatelessWidget {
  const _IndustrySelector({
    required this.value,
    required this.copy,
    required this.enabled,
    required this.onChanged,
  });

  final String value;
  final AccountsCopy copy;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final label = value.isEmpty
        ? copy.selectOption
        : copy.industryOption(value);
    return InkWell(
      onTap: enabled ? () => _open(context) : null,
      borderRadius: BorderRadius.circular(AppRadius.field),
      child: SheetBox(
        child: Row(
          children: [
            Icon(Icons.search, size: 16, color: c.inkMuted),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: value.isEmpty ? c.disabledFg : c.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Icon(Icons.expand_more, size: 18, color: c.inkMuted),
          ],
        ),
      ),
    );
  }

  Future<void> _open(BuildContext context) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      builder: (context) => _IndustrySearchSheet(selected: value, copy: copy),
    );
    if (picked != null) onChanged(picked);
  }
}

class _IndustrySearchSheet extends StatefulWidget {
  const _IndustrySearchSheet({required this.selected, required this.copy});
  final String selected;
  final AccountsCopy copy;

  @override
  State<_IndustrySearchSheet> createState() => _IndustrySearchSheetState();
}

class _IndustrySearchSheetState extends State<_IndustrySearchSheet> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final q = _query.text.trim().toLowerCase();
    final entries = industryCodes
        .where(
          (code) =>
              q.isEmpty ||
              widget.copy.industryOption(code).toLowerCase().contains(q),
        )
        .toList();
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        top: false,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.8,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: c.line,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
                child: SheetBox(
                  child: Row(
                    children: [
                      Icon(Icons.search, size: 17, color: c.inkMuted),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _query,
                          autofocus: true,
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            border: InputBorder.none,
                            isCollapsed: true,
                            hintText: widget.copy.selectOption,
                          ),
                          style: TextStyle(color: c.ink, fontSize: 15),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Flexible(
                child: entries.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(20),
                        child: Text(
                          widget.copy.noMatchingIndustries,
                          style: TextStyle(color: c.inkMuted, fontSize: 14),
                        ),
                      )
                    : ListView(
                        shrinkWrap: true,
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                        children: [
                          for (final code in entries)
                            ListTile(
                              title: Text(
                                widget.copy.industryOption(code),
                                style: TextStyle(
                                  color: code == widget.selected
                                      ? c.accent
                                      : c.ink,
                                  fontWeight: code == widget.selected
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                ),
                              ),
                              trailing: code == widget.selected
                                  ? Icon(Icons.check, size: 18, color: c.accent)
                                  : null,
                              onTap: () => Navigator.of(context).pop(code),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TypeGrid extends StatelessWidget {
  const _TypeGrid({
    required this.selected,
    required this.copy,
    required this.onSelect,
  });

  final AccountType selected;
  final AccountsCopy copy;
  final ValueChanged<AccountType> onSelect;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.accountTypeLabel,
            style: TextStyle(
              color: c.ink,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 0.92,
            children: [
              for (final type in AccountType.values)
                GestureDetector(
                  onTap: () => onSelect(type),
                  child: Container(
                    decoration: BoxDecoration(
                      color: selected == type
                          ? c.accentSoft
                          : Colors.transparent,
                      border: Border.all(
                        color: selected == type ? c.accent : c.line,
                        width: selected == type ? 1.5 : 1,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          type.icon,
                          size: 19,
                          color: selected == type ? c.accent : c.inkMuted,
                        ),
                        const SizedBox(height: 5),
                        Text(
                          copy.accountType(type, short: true),
                          style: TextStyle(
                            color: selected == type ? c.accent : c.inkMuted,
                            fontSize: 10,
                            fontWeight: selected == type
                                ? FontWeight.w700
                                : FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
