import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/money_format.dart';
import '../../i18n/accounts_copy.dart';
import '../../i18n/app_language.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/primary_button.dart';
import '../account_form_sheet.dart';
import '../account_models.dart';
import '../accounts_controller.dart';
import 'valued_models.dart';
import 'valued_repository.dart';

/// Real Estate / Business account detail — port of the web
/// `ValuedAccountDetailsPage`: attributable value, metadata, valuation history,
/// "Update value", and the "Mark as sold" / "Sell ownership" disposal flow.
class ValuedAccountDetailPage extends StatefulWidget {
  const ValuedAccountDetailPage({
    super.key,
    required this.controller,
    required this.accountId,
  });

  final AccountsController controller;
  final String accountId;

  @override
  State<ValuedAccountDetailPage> createState() =>
      _ValuedAccountDetailPageState();
}

class _ValuedAccountDetailPageState extends State<ValuedAccountDetailPage> {
  final _repo = ValuedRepository();
  List<AccountValuationEntry> _valuations = const [];
  List<AccountDisposal> _disposals = const [];
  AccountOwnershipProjection? _ownership;
  bool _loading = true;
  bool _loadError = false;

  Account? get _account {
    for (final i in widget.controller.model?.items ?? const []) {
      if (i.account.id == widget.accountId) return i.account;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChange);
    _load();
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _repo.getEffectiveValuations(widget.accountId),
        _repo.getCurrentOwnership(widget.accountId),
        _repo.getDisposals(widget.accountId),
      ]);
      if (!mounted) return;
      setState(() {
        _valuations = results[0] as List<AccountValuationEntry>;
        _ownership = results[1] as AccountOwnershipProjection?;
        _disposals = results[2] as List<AccountDisposal>;
        _loading = false;
        _loadError = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadError = true;
        });
      }
    }
  }

  Future<void> _edit(Account a) async {
    widget.controller.clearActionError();
    await showAppSheet<bool>(
      context,
      builder: (_) =>
          AccountFormSheet(controller: widget.controller, account: a),
    );
  }

  Future<void> _lifecycle(Account a, String action) async {
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(copy.lifecycleTitle(action, a.name)),
        content: Text(copy.lifecycleBody(action)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(copy.cancel),
          ),
          CompactButton(
            tone: action == 'delete'
                ? CompactButtonTone.danger
                : CompactButtonTone.accent,
            onPressed: () => Navigator.of(context).pop(true),
            label: copy.lifecycleAction(action),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    final ok = await widget.controller.run(
      (s) => switch (action) {
        'close' => s.closeAccount(a.id),
        'reopen' => s.reopenAccount(a.id),
        _ => s.deleteAccount(a.id),
      },
    );
    if (ok && action == 'delete' && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final a = _account;
    if (a == null) {
      return Scaffold(
        backgroundColor: c.canvas,
        appBar: AppBar(),
        body: Center(child: Text(copy.accountUnavailable)),
      );
    }
    final latest = _valuations.isEmpty ? null : _valuations.first;
    final ownershipPct = _ownership?.ownershipPercentage;
    final value = attributableValuation(latest, ownershipPct);
    final isSold = a.isSold || (_ownership?.isSold ?? false);
    final isProperty = a.type == AccountType.realEstate;
    final lifecycle = _lifecycleFor(a);

    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        title: Text(a.name),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_horiz),
            onSelected: (v) => switch (v) {
              'edit' => _edit(a),
              'close' => _lifecycle(a, 'close'),
              'reopen' => _lifecycle(a, 'reopen'),
              _ => _lifecycle(a, 'delete'),
            },
            itemBuilder: (context) => [
              PopupMenuItem(value: 'edit', child: Text(copy.edit)),
              if (a.isActive && !isSold)
                PopupMenuItem(
                  value: 'close',
                  enabled: lifecycle?.canClose ?? true,
                  child: Text(copy.closeAccount),
                )
              else if (a.isClosed)
                PopupMenuItem(value: 'reopen', child: Text(copy.reopenAccount)),
              PopupMenuItem(
                value: 'delete',
                enabled: lifecycle?.canDelete ?? false,
                child: Text(copy.delete, style: TextStyle(color: c.negative)),
              ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await widget.controller.load();
          await _load();
        },
        color: c.accent,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 32),
          children: [
            if (widget.controller.actionError != null) ...[
              Text(
                widget.controller.actionError!,
                style: TextStyle(color: c.negative, fontSize: 13),
              ),
              const SizedBox(height: 12),
            ],
            Text(
              copy.financialAccountsHeading,
              style: TextStyle(
                color: c.inkMuted,
                fontSize: 11,
                letterSpacing: 1.2,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  a.name,
                  style: TextStyle(
                    color: c.ink,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (isSold) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: c.fieldFill,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      copy.sold,
                      style: TextStyle(
                        color: c.inkMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            Text(
              copy.attributableValue,
              style: TextStyle(color: c.inkMuted, fontSize: 13),
            ),
            const SizedBox(height: 4),
            Text(
              _loading ? '—' : MoneyFormat.money(value, a.currencyCode),
              textDirection: TextDirection.ltr,
              style: TextStyle(
                color: c.ink,
                fontSize: 30,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 16),
            if (!isSold)
              Row(
                children: [
                  Expanded(
                    child: SecondaryButton(
                      label: isProperty ? copy.markAsSold : copy.sellOwnership,
                      fontSize: 14,
                      onPressed: ownershipPct == null
                          ? null
                          : () => _openDisposal(a, ownershipPct, isProperty),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PrimaryButton(
                      label: copy.updateValue,
                      fontSize: 14,
                      onPressed: () => _openValuation(a),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 20),
            _section(
              context,
              copy.accountDetails,
              _metadataRows(a, ownershipPct, copy),
            ),
            const SizedBox(height: 16),
            _valuationHistory(context, a, copy),
            if (_disposals.isNotEmpty) ...[
              const SizedBox(height: 16),
              _disposalHistory(context, a, copy),
            ],
          ],
        ),
      ),
    );
  }

  AccountLifecycle? _lifecycleFor(Account a) {
    for (final i in widget.controller.model?.items ?? const []) {
      if (i.account.id == a.id) return i.lifecycle;
    }
    return null;
  }

  List<(String, String, TextDirection?)> _metadataRows(
    Account a,
    String? ownershipPct,
    AccountsCopy copy,
  ) {
    final owned = ownershipPct == null
        ? '—'
        : MoneyFormat.percent(ownershipPct);
    if (a.type == AccountType.business) {
      return [
        (copy.businessTypeLabel, copy.businessTypeValue(a.businessType), null),
        (copy.industry, copy.industryValue(a.industry), null),
        (copy.ownershipPercentageLabel, owned, TextDirection.ltr),
        if ((a.notes ?? '').isNotEmpty) (copy.descriptionNotes, a.notes!, null),
      ];
    }
    return [
      (copy.propertyTypeLabel, copy.propertyTypeValue(a.propertyType), null),
      (copy.ownershipPercentageLabel, owned, TextDirection.ltr),
      if ((a.location ?? '').isNotEmpty) (copy.location, a.location!, null),
      if ((a.notes ?? '').isNotEmpty) (copy.descriptionNotes, a.notes!, null),
    ];
  }

  Widget _section(
    BuildContext context,
    String title,
    List<(String, String, TextDirection?)> rows,
  ) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: c.ink,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          for (final (label, value, direction) in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(color: c.inkMuted, fontSize: 11),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    textDirection: direction,
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _valuationHistory(BuildContext context, Account a, AccountsCopy copy) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.valuationHistory,
            style: TextStyle(
              color: c.ink,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          if (!_loading && _valuations.isEmpty)
            Text(
              _loadError ? copy.loadError : copy.unavailableAccountData,
              style: TextStyle(color: c.inkMuted, fontSize: 13),
            )
          else
            for (final v in _valuations)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: c.fieldFill,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          v.valuedOn,
                          textDirection: TextDirection.ltr,
                          style: TextStyle(color: c.ink, fontSize: 13),
                        ),
                        Text(
                          copy.fullValueWithAmount(
                            MoneyFormat.money(
                              v.valuationAmount,
                              a.currencyCode,
                            ),
                          ),
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    if ((v.valuationMethod ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          v.valuationMethod!,
                          style: TextStyle(color: c.inkMuted, fontSize: 12),
                        ),
                      ),
                    if ((v.notes ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          v.notes!,
                          style: TextStyle(color: c.inkMuted, fontSize: 12),
                        ),
                      ),
                  ],
                ),
              ),
        ],
      ),
    );
  }

  Widget _disposalHistory(BuildContext context, Account a, AccountsCopy copy) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.saleHistory,
            style: TextStyle(
              color: c.ink,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          for (final d in _disposals)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: c.fieldFill,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        d.disposedOn,
                        textDirection: TextDirection.ltr,
                        style: TextStyle(color: c.ink, fontSize: 13),
                      ),
                      Text(
                        MoneyFormat.money(d.saleAmount, d.saleCurrencyCode),
                        textDirection: TextDirection.ltr,
                        style: TextStyle(
                          color: c.ink,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      copy.soldOwnership(
                        MoneyFormat.percent(d.ownershipPercentageSold),
                      ),
                      style: TextStyle(color: c.inkMuted, fontSize: 12),
                    ),
                  ),
                  if ((d.notes ?? '').isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        d.notes!,
                        style: TextStyle(color: c.inkMuted, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _openValuation(Account a) async {
    final saved = await showAppSheet<bool>(
      context,
      builder: (_) => _ValuationSheet(account: a, repo: _repo),
    );
    if (saved == true) {
      await widget.controller.load();
      await _load();
    }
  }

  Future<void> _openDisposal(
    Account a,
    String currentOwnership,
    bool isProperty,
  ) async {
    final saved = await showAppSheet<bool>(
      context,
      builder: (_) => _DisposalSheet(
        account: a,
        repo: _repo,
        controller: widget.controller,
        currentOwnership: currentOwnership,
        isProperty: isProperty,
      ),
    );
    if (saved == true) {
      await widget.controller.load();
      await _load();
    }
  }
}

// ---- Update value sheet (web AccountValuationDialog) ------------------

class _ValuationSheet extends StatefulWidget {
  const _ValuationSheet({required this.account, required this.repo});
  final Account account;
  final ValuedRepository repo;

  @override
  State<_ValuationSheet> createState() => _ValuationSheetState();
}

class _ValuationSheetState extends State<_ValuationSheet> {
  final _amount = TextEditingController();
  final _method = TextEditingController();
  final _notes = TextEditingController();
  late String _valuedOn = _today();
  bool _saving = false;
  String? _error;

  static String _today() => DateTime.now().toIso8601String().substring(0, 10);

  @override
  void dispose() {
    _amount.dispose();
    _method.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    if (_valuedOn.isEmpty) {
      setState(() => _error = copy.valuationDateRequired);
      return;
    }
    if (_valuedOn.compareTo(_today()) > 0) {
      setState(() => _error = copy.valuationDateFuture);
      return;
    }
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      await widget.repo.addValuation(
        widget.account.id,
        AccountValuationInput(
          valuationAmount: _amount.text.trim(),
          valuedOn: _valuedOn,
          valuationMethod: _method.text.trim().isEmpty
              ? null
              : _method.text.trim(),
          notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        ),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      setState(() => _error = copy.unexpectedError);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    return AppSheet(
      title: copy.updateCurrentValue,
      subtitle: widget.account.name,
      children: [
        SheetField(
          label: copy.currentValueLabel,
          child: SheetBox(
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
          label: copy.valuationDateLabel,
          child: InkWell(
            onTap: () async {
              final now = DateTime.now();
              final picked = await showDatePicker(
                context: context,
                initialDate: DateTime.tryParse(_valuedOn) ?? now,
                firstDate: DateTime(now.year - 30),
                lastDate: now,
              );
              if (picked != null) {
                setState(
                  () => _valuedOn =
                      '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
                );
              }
            },
            borderRadius: BorderRadius.circular(AppRadius.field),
            child: SheetBox(
              child: Text(
                _valuedOn,
                textDirection: TextDirection.ltr,
                style: TextStyle(color: c.ink, fontSize: 15),
              ),
            ),
          ),
        ),
        if (widget.account.type == AccountType.business)
          SheetField(
            label: copy.valuationMethodLabel,
            optional: true,
            child: SheetBox(
              child: TextField(
                controller: _method,
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  isCollapsed: true,
                ),
                style: TextStyle(color: c.ink, fontSize: 15),
              ),
            ),
          ),
        SheetField(
          label: copy.valuationNoteLabel,
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
        if (_error != null) ...[
          Text(_error!, style: TextStyle(color: c.negative, fontSize: 13)),
          const SizedBox(height: 10),
        ],
        Row(
          children: [
            Expanded(
              child: NeutralButton(
                label: copy.cancel,
                onPressed: _saving ? null : () => Navigator.of(context).pop(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: PrimaryButton(
                label: _saving ? copy.saving : copy.updateValue,
                busy: _saving,
                onPressed: _save,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ---- Disposal sheet (web AccountDisposalDialog) ---------------------

class _DisposalSheet extends StatefulWidget {
  const _DisposalSheet({
    required this.account,
    required this.repo,
    required this.controller,
    required this.currentOwnership,
    required this.isProperty,
  });
  final Account account;
  final ValuedRepository repo;
  final AccountsController controller;
  final String currentOwnership;
  final bool isProperty;

  @override
  State<_DisposalSheet> createState() => _DisposalSheetState();
}

class _DisposalSheetState extends State<_DisposalSheet> {
  final _amount = TextEditingController();
  final _ownershipSold = TextEditingController();
  final _notes = TextEditingController();
  late String _currency = widget.account.currencyCode;
  late String _soldOn = DateTime.now().toIso8601String().substring(0, 10);
  String _destinationId = '';
  bool _saving = false;
  String? _error;

  static final _amountRe = RegExp(r'^\d+(?:\.\d{1,2})?$');

  @override
  void dispose() {
    _amount.dispose();
    _ownershipSold.dispose();
    _notes.dispose();
    super.dispose();
  }

  bool get _positiveProceeds {
    final v = _amount.text.trim();
    return _amountRe.hasMatch(v) && (double.tryParse(v) ?? 0) > 0;
  }

  List<Account> get _destinations => [
    for (final i in widget.controller.model?.items ?? const [])
      if (i.account.isActive &&
          (i.account.type == AccountType.cash ||
              i.account.type == AccountType.bank) &&
          i.account.currencyCode == _currency)
        i.account,
  ];

  Future<void> _save() async {
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final raw = _amount.text.trim();
    if (!_amountRe.hasMatch(raw)) {
      setState(() => _error = copy.validSaleAmount);
      return;
    }
    if (_positiveProceeds && _destinationId.isEmpty) {
      setState(() => _error = copy.saleDestinationRequired);
      return;
    }
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      await widget.repo.addDisposal(
        widget.account.id,
        AddAccountDisposalInput(
          disposedOn: _soldOn,
          saleAmount: raw,
          saleCurrencyCode: _currency,
          ownershipPercentageSold: widget.isProperty
              ? widget.currentOwnership
              : _ownershipSold.text.trim(),
          idempotencyKey: '${DateTime.now().microsecondsSinceEpoch}',
          destinationAccountId: _positiveProceeds ? _destinationId : null,
          notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        ),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      setState(() => _error = copy.unexpectedError);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final title = widget.isProperty ? copy.markAsSold : copy.sellOwnership;
    return AppSheet(
      title: title,
      subtitle: widget.account.name,
      children: [
        SheetField(label: copy.saleAmountReceived, child: _num(_amount)),
        SheetField(
          label: copy.saleCurrency,
          child: SheetBox(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _currency,
                isDense: true,
                isExpanded: true,
                onChanged: (v) => setState(() {
                  _currency = v ?? _currency;
                  _destinationId = '';
                }),
                items: [
                  for (final code in kAccountCurrencies)
                    DropdownMenuItem(
                      value: code,
                      child: Text(code, textDirection: TextDirection.ltr),
                    ),
                ],
                style: TextStyle(color: c.ink, fontSize: 15),
              ),
            ),
          ),
        ),
        if (_positiveProceeds)
          SheetField(
            label: copy.saleDestination,
            hint: _destinations.isEmpty ? copy.noEligibleDestination : null,
            child: SheetBox(
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _destinationId,
                  isDense: true,
                  isExpanded: true,
                  onChanged: (v) => setState(() => _destinationId = v ?? ''),
                  items: [
                    DropdownMenuItem(
                      value: '',
                      child: Text(copy.selectCashOrBank),
                    ),
                    for (final a in _destinations)
                      DropdownMenuItem(
                        value: a.id,
                        child: Text(
                          copy.destinationAccount(a.name, a.type),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  style: TextStyle(color: c.ink, fontSize: 14),
                ),
              ),
            ),
          ),
        if (widget.isProperty)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Text(
              copy.propertySaleExitsOwnership(
                MoneyFormat.percent(widget.currentOwnership),
              ),
              style: TextStyle(color: c.inkMuted, fontSize: 12),
            ),
          )
        else
          SheetField(label: copy.ownershipSold, child: _num(_ownershipSold)),
        SheetField(
          label: copy.saleDate,
          child: InkWell(
            onTap: () async {
              final now = DateTime.now();
              final picked = await showDatePicker(
                context: context,
                initialDate: DateTime.tryParse(_soldOn) ?? now,
                firstDate: DateTime(now.year - 30),
                lastDate: now,
              );
              if (picked != null) {
                setState(
                  () => _soldOn =
                      '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
                );
              }
            },
            borderRadius: BorderRadius.circular(AppRadius.field),
            child: SheetBox(
              child: Text(
                _soldOn,
                textDirection: TextDirection.ltr,
                style: TextStyle(color: c.ink, fontSize: 15),
              ),
            ),
          ),
        ),
        SheetField(
          label: copy.saleNote,
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
        if (_error != null) ...[
          Text(_error!, style: TextStyle(color: c.negative, fontSize: 13)),
          const SizedBox(height: 10),
        ],
        Row(
          children: [
            Expanded(
              child: NeutralButton(
                label: copy.cancel,
                onPressed: _saving ? null : () => Navigator.of(context).pop(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: PrimaryButton(
                label: _saving ? copy.saving : title,
                busy: _saving,
                onPressed: _save,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _num(TextEditingController ctl) {
    final c = context.colors;
    return SheetBox(
      child: TextField(
        controller: ctl,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
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
    );
  }
}
