import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/decimals.dart';
import '../../core/local_datetime.dart';
import '../../core/money_format.dart';
import '../../i18n/accounts_copy.dart';
import '../../i18n/app_language.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/form_controls.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import '../accounts_controller.dart';
import 'record_form_sheet.dart';
import 'records_controller.dart';
import 'records_models.dart';
import 'records_service.dart';

/// The Cash / Bank account detail — an infinite-scrolling, filterable ledger of
/// records grouped by local day, with add / edit / delete. Port of the web
/// `AccountRecordsPage` (which is what `/accounts/:id` renders for cash & bank).
class AccountRecordsPage extends StatefulWidget {
  const AccountRecordsPage({
    super.key,
    required this.account,
    required this.accountsController,
    required this.onEditAccount,
    this.resolvedValue,
  });

  final Account account;
  final AccountsController accountsController;
  final VoidCallback onEditAccount;
  final String? resolvedValue;

  @override
  State<AccountRecordsPage> createState() => _AccountRecordsPageState();
}

class _AccountRecordsPageState extends State<AccountRecordsPage> {
  late final RecordsController _controller = RecordsController(
    accountId: widget.account.id,
  )..load();
  final _search = TextEditingController();
  final _scroll = ScrollController();
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 400) {
        _controller.loadMore();
      }
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _controller.dispose();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  List<Account> get _recordAccounts => recordAccounts(
    widget.accountsController.model?.items.map((i) => i.account).toList() ??
        [widget.account],
  );

  Future<void> _openForm({EditableAccountRecord? editing}) async {
    _controller.clearActionError();
    await showAppSheet<bool>(
      context,
      builder: (_) => RecordFormSheet(
        controller: _controller,
        recordAccounts: _recordAccounts,
        initialAccount: editing == null ? widget.account : null,
        editing: editing,
      ),
    );
    // Refresh the parent list so the account value stays in sync.
    widget.accountsController.load();
  }

  Future<void> _edit(AccountRecord record) async {
    if (!record.isEditable) return;
    final editable = await _controller.openForEdit(record.id);
    if (editable != null) await _openForm(editing: editable);
  }

  Future<void> _openFilters() async {
    final next = await showAppSheet<AccountRecordHistoryFilters>(
      context,
      builder: (_) => _FilterSheet(
        initial: _controller.filters.copy(),
        categories: _controller.categories,
        currencyCode: widget.account.currencyCode,
      ),
    );
    if (next != null) _controller.setFilters(next);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final a = widget.account;
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        title: Text(a.name),
        actions: [
          IconButton(
            tooltip: copy.editAccount,
            icon: const Icon(Icons.edit_outlined),
            onPressed: widget.onEditAccount,
          ),
        ],
      ),
      body: ListenableBuilder(
        listenable: _controller,
        builder: (context, _) {
          return Column(
            children: [
              _Header(
                account: a,
                resolvedValue: widget.resolvedValue,
                onAdd: a.isActive ? () => _openForm() : null,
              ),
              _SearchRow(
                controller: _search,
                onChanged: (v) {
                  _searchDebounce?.cancel();
                  _searchDebounce = Timer(
                    const Duration(milliseconds: 300),
                    () {
                      final f = _controller.filters.copy()..search = v;
                      _controller.setFilters(f);
                    },
                  );
                },
                onFilters: _openFilters,
                activeCount: _activeFilterCount(),
              ),
              if (_controller.actionError != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                  child: Text(
                    _controller.actionError!,
                    style: TextStyle(color: c.negative, fontSize: 13),
                  ),
                ),
              Expanded(child: _body(context, copy)),
            ],
          );
        },
      ),
    );
  }

  int _activeFilterCount() {
    final f = _controller.filters;
    var n = 0;
    if (f.fromDate.isNotEmpty) n++;
    if (f.toDate.isNotEmpty) n++;
    if (f.recordType != null) n++;
    if (f.mainCategoryId.isNotEmpty) n++;
    if (f.subcategoryId.isNotEmpty) n++;
    if (f.minAmount.isNotEmpty) n++;
    if (f.maxAmount.isNotEmpty) n++;
    return n;
  }

  Widget _body(BuildContext context, AccountsCopy copy) {
    final c = context.colors;
    switch (_controller.status) {
      case RecordsStatus.loading:
        return const Center(child: CircularProgressIndicator());
      case RecordsStatus.error:
        return Center(
          child: Text(
            copy.recordsLoadError,
            style: TextStyle(color: c.negative, fontSize: 14),
          ),
        );
      case RecordsStatus.ready:
        final groups = _controller.groups;
        if (groups.isEmpty) {
          return Center(
            child: Text(
              copy.noAccountRecords,
              style: TextStyle(color: c.inkMuted, fontSize: 14),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: _controller.load,
          color: c.accent,
          child: ListView(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              for (final group in groups)
                _DayGroup(
                  group: group,
                  categories: _controller.categories,
                  onTapRecord: _edit,
                  copy: copy,
                ),
              if (_controller.loadingMore)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_controller.pageError != null)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Center(
                    child: TextButton(
                      onPressed: _controller.loadMore,
                      child: Text(copy.loadMore),
                    ),
                  ),
                ),
            ],
          ),
        );
    }
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.account,
    required this.resolvedValue,
    required this.onAdd,
  });
  final Account account;
  final String? resolvedValue;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final isBankCredit = account.isBankCredit;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.accountRecords,
            style: TextStyle(
              color: c.inkMuted,
              fontSize: 11,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: isBankCredit
                    ? _CreditSummary(account: account, balance: resolvedValue)
                    : Text(
                        MoneyFormat.money(resolvedValue, account.currencyCode),
                        textDirection: TextDirection.ltr,
                        style: TextStyle(
                          color: c.ink,
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                        ),
                      ),
              ),
              if (onAdd != null)
                CompactButton(
                  label: copy.addRecord,
                  icon: Icons.add,
                  onPressed: onAdd,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CreditSummary extends StatelessWidget {
  const _CreditSummary({required this.account, required this.balance});
  final Account account;
  final String? balance;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final limit = account.creditCardLimit;
    // web getBankCreditSummary: needs limit > 0 and balance >= 0 and due >= 0.
    final valid =
        limit != null &&
        balance != null &&
        (D.compare(limit, '0') ?? 0) == 1 &&
        (D.compare(balance!, '0') ?? -1) != -1;
    if (!valid) {
      return Text(
        copy.creditSummaryUnavailable,
        style: TextStyle(color: c.metal, fontSize: 13),
      );
    }
    final amountDue = D.subtract(limit, balance);
    Widget cell(String label, String? value) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: c.inkMuted, fontSize: 11)),
        const SizedBox(height: 2),
        Text(
          value == null ? '—' : MoneyFormat.money(value, account.currencyCode),
          textDirection: TextDirection.ltr,
          style: TextStyle(
            color: c.ink,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
    return Wrap(
      spacing: 18,
      runSpacing: 8,
      children: [
        cell(copy.creditLimit, limit),
        cell(copy.availableCredit, balance),
        cell(copy.amountDue, amountDue),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              copy.dueDay,
              style: TextStyle(color: c.inkMuted, fontSize: 11),
            ),
            const SizedBox(height: 2),
            Text(
              account.dueDayOfMonth == null
                  ? copy.notSet
                  : copy.dayValue(account.dueDayOfMonth.toString()),
              style: TextStyle(
                color: c.ink,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SearchRow extends StatelessWidget {
  const _SearchRow({
    required this.controller,
    required this.onChanged,
    required this.onFilters,
    required this.activeCount,
  });
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onFilters;
  final int activeCount;

  @override
  Widget build(BuildContext context) {
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: SearchField(
              controller: controller,
              hintText: copy.searchRecords,
              onChanged: onChanged,
            ),
          ),
          const SizedBox(width: 8),
          CompactButton(
            label: activeCount == 0
                ? copy.filters
                : copy.filtersCount(activeCount),
            icon: Icons.tune,
            tone: CompactButtonTone.neutral,
            onPressed: onFilters,
          ),
        ],
      ),
    );
  }
}

class _DayGroup extends StatelessWidget {
  const _DayGroup({
    required this.group,
    required this.categories,
    required this.onTapRecord,
    required this.copy,
  });
  final AccountRecordDateGroup group;
  final List<VisibleRecordMainCategory> categories;
  final ValueChanged<AccountRecord> onTapRecord;
  final AccountsCopy copy;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final net = group.dailyNet;
    final netNegative = net.startsWith('-');
    final netZero = D.compare(net, '0') == 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                formatLocalCalendarDate(group.date),
                textDirection: TextDirection.ltr,
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
              Text(
                MoneyFormat.money(net, group.currencyCode),
                textDirection: TextDirection.ltr,
                style: TextStyle(
                  color: netZero
                      ? c.inkMuted
                      : (netNegative ? c.negative : c.accent),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        for (final record in group.records)
          _RecordRow(
            record: record,
            category: record.type == 'transfer'
                ? copy.recordTypeValue('transfer')
                : accountRecordCategoryLabel(record, categories),
            fallbackCategory: copy.recordTypeValue(record.type),
            onTap: () => onTapRecord(record),
          ),
        const SizedBox(height: 6),
      ],
    );
  }
}

class _RecordRow extends StatelessWidget {
  const _RecordRow({
    required this.record,
    required this.category,
    required this.fallbackCategory,
    required this.onTap,
  });
  final AccountRecord record;
  final String? category;
  final String fallbackCategory;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final amountColor = record.type == 'income'
        ? c.accent
        : record.type == 'expense'
        ? c.negative
        : c.ink;
    final time = formatLocalDateTime(record.occurredAt).time;
    return InkWell(
      onTap: record.isEditable ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.line)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  time,
                  textDirection: TextDirection.ltr,
                  style: TextStyle(color: c.inkMuted, fontSize: 12),
                ),
                Text(
                  MoneyFormat.money(record.amount, record.currencyCode),
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    color: amountColor,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              category ?? fallbackCategory,
              style: TextStyle(
                color: c.ink,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            if ((record.notes ?? '').isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                record.notes!,
                style: TextStyle(color: c.inkMuted, fontSize: 13),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ---- filters sheet ------------------------------------------------------

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({
    required this.initial,
    required this.categories,
    required this.currencyCode,
  });
  final AccountRecordHistoryFilters initial;
  final List<VisibleRecordMainCategory> categories;
  final String currencyCode;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late final AccountRecordHistoryFilters _f = widget.initial;
  late final _min = TextEditingController(text: _f.minAmount);
  late final _max = TextEditingController(text: _f.maxAmount);

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  List<VisibleRecordSubcategory> get _subs {
    if (_f.mainCategoryId.isEmpty) return const [];
    for (final m in widget.categories) {
      if (m.id == _f.mainCategoryId) return m.subcategories;
    }
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    return AppSheet(
      title: copy.filters,
      children: [
        SheetField(
          label: copy.recordType,
          child: SheetBox(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _f.recordType?.code ?? '',
                isDense: true,
                isExpanded: true,
                onChanged: (v) => setState(
                  () => _f.recordType = (v == null || v.isEmpty)
                      ? null
                      : AccountRecordTypeX.fromCode(v),
                ),
                items: [
                  DropdownMenuItem(value: '', child: Text(copy.allRecordTypes)),
                  DropdownMenuItem(
                    value: 'income',
                    child: Text(copy.recordTypeValue('income')),
                  ),
                  DropdownMenuItem(
                    value: 'expense',
                    child: Text(copy.recordTypeValue('expense')),
                  ),
                  DropdownMenuItem(
                    value: 'transfer',
                    child: Text(copy.recordTypeValue('transfer')),
                  ),
                ],
                style: TextStyle(color: c.ink, fontSize: 15),
              ),
            ),
          ),
        ),
        Row(
          children: [
            Expanded(
              child: _dateField(
                copy.from,
                _f.fromDate,
                (v) => _f.fromDate = v,
                copy,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _dateField(copy.to, _f.toDate, (v) => _f.toDate = v, copy),
            ),
          ],
        ),
        SheetField(
          label: copy.mainCategory,
          child: SheetBox(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _f.mainCategoryId,
                isDense: true,
                isExpanded: true,
                onChanged: (v) => setState(() {
                  _f.mainCategoryId = v ?? '';
                  _f.subcategoryId = '';
                }),
                items: [
                  DropdownMenuItem(value: '', child: Text(copy.allCategories)),
                  for (final m in widget.categories)
                    DropdownMenuItem(value: m.id, child: Text(m.name)),
                ],
                style: TextStyle(color: c.ink, fontSize: 15),
              ),
            ),
          ),
        ),
        if (_subs.isNotEmpty)
          SheetField(
            label: copy.subcategory,
            child: SheetBox(
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _f.subcategoryId,
                  isDense: true,
                  isExpanded: true,
                  onChanged: (v) => setState(() => _f.subcategoryId = v ?? ''),
                  items: [
                    DropdownMenuItem(
                      value: '',
                      child: Text(copy.allSubcategories),
                    ),
                    for (final s in _subs)
                      DropdownMenuItem(value: s.id, child: Text(s.name)),
                  ],
                  style: TextStyle(color: c.ink, fontSize: 15),
                ),
              ),
            ),
          ),
        Row(
          children: [
            Expanded(
              child: SheetField(
                label: copy.minAmount,
                child: _amountBox(_min, (v) => _f.minAmount = v),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SheetField(
                label: copy.maxAmount,
                child: _amountBox(_max, (v) => _f.maxAmount = v),
              ),
            ),
          ],
        ),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () =>
                    Navigator.of(context).pop(AccountRecordHistoryFilters()),
                child: Text(copy.clearAll),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(_f),
                child: Text(copy.apply),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _dateField(
    String label,
    String value,
    ValueChanged<String> set,
    AccountsCopy copy,
  ) {
    final c = context.colors;
    return SheetField(
      label: label,
      child: InkWell(
        onTap: () async {
          final now = DateTime.now();
          final picked = await showDatePicker(
            context: context,
            initialDate: DateTime.tryParse(value) ?? now,
            firstDate: DateTime(now.year - 30),
            lastDate: DateTime(now.year + 1),
          );
          if (picked != null) {
            setState(
              () => set(
                '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
              ),
            );
          }
        },
        borderRadius: BorderRadius.circular(AppRadius.field),
        child: SheetBox(
          child: Text(
            value.isEmpty ? copy.any : value,
            textDirection: value.isEmpty ? null : TextDirection.ltr,
            style: TextStyle(
              color: value.isEmpty ? c.disabledFg : c.ink,
              fontSize: 15,
            ),
          ),
        ),
      ),
    );
  }

  Widget _amountBox(TextEditingController ctl, ValueChanged<String> set) {
    final c = context.colors;
    return SheetBox(
      child: TextField(
        controller: ctl,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        textDirection: TextDirection.ltr,
        onChanged: set,
        decoration: InputDecoration(
          border: InputBorder.none,
          isCollapsed: true,
          hintText: widget.currencyCode,
        ),
        style: TextStyle(color: c.ink, fontSize: 15),
      ),
    );
  }
}
