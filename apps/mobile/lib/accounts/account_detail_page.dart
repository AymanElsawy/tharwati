import 'package:flutter/material.dart';

import '../core/decimals.dart';
import '../core/money_format.dart';
import '../i18n/accounts_copy.dart';
import '../i18n/app_language.dart';
import '../theme/tokens.dart';
import '../widgets/app_sheet.dart';
import '../widgets/callout.dart';
import '../widgets/primary_button.dart';
import 'account_form_sheet.dart';
import 'account_models.dart';
import 'account_valuation.dart';
import 'accounts_controller.dart';
import 'accounts_service.dart';
import 'brokerage/brokerage_account_detail_page.dart';
import 'metal/metal_purity.dart';
import 'metal/metal_purity_detail_page.dart';
import 'metal_purchase_sheet.dart';
import 'records/account_records_page.dart';
import 'valued/valued_account_detail_page.dart';
import 'widgets/account_type_icon.dart';

/// Flow 3 screen 12 — one account. Gold/silver gets the metal hero (weight,
/// purity, weighted-average cost, unrealized gain) + append-only purchase
/// history; every type gets Edit / Close-Reopen / guarded Delete.
class AccountDetailPage extends StatefulWidget {
  const AccountDetailPage({
    super.key,
    required this.controller,
    required this.accountId,
  });

  final AccountsController controller;
  final String accountId;

  @override
  State<AccountDetailPage> createState() => _AccountDetailPageState();
}

class _AccountDetailPageState extends State<AccountDetailPage> {
  GoldAccountDetail? _gold;
  bool _goldLoading = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onControllerChanged);
    _maybeLoadGold();
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    super.dispose();
  }

  void _onControllerChanged() {
    if (!mounted) return;
    _maybeLoadGold();
    setState(() {});
  }

  AccountItem? get _item {
    for (final i in widget.controller.model?.items ?? const <AccountItem>[]) {
      if (i.account.id == widget.accountId) return i;
    }
    return null;
  }

  Future<void> _maybeLoadGold() async {
    final item = _item;
    if (item == null || item.account.type != AccountType.gold) return;
    if (_goldLoading) return;
    _goldLoading = true;
    try {
      final detail = await widget.controller.service.loadGoldDetail(
        widget.accountId,
      );
      if (mounted) setState(() => _gold = detail);
    } catch (_) {
      // leave _gold as-is; the page still renders the list-level value
    } finally {
      _goldLoading = false;
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

  Future<void> _addPurchase(Account a) async {
    widget.controller.clearActionError();
    await showAppSheet<bool>(
      context,
      builder: (_) =>
          MetalPurchaseSheet(controller: widget.controller, account: a),
    );
  }

  Future<void> _lifecycle(AccountItem item, String action) async {
    final a = item.account;
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
            onPressed: () => Navigator.of(context).pop(true),
            tone: action == 'delete'
                ? CompactButtonTone.danger
                : CompactButtonTone.accent,
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
    final item = _item;
    if (item == null) {
      return Scaffold(
        backgroundColor: c.canvas,
        appBar: AppBar(),
        body: Center(child: Text(copy.accountUnavailable)),
      );
    }
    final a = item.account;
    final lifecycle = item.lifecycle;

    // Web routes each type to its own detail surface (AccountDetailsPage.tsx):
    // Cash / Bank -> the records ledger; Real Estate / Business -> the valued
    // account page (valuation history + disposal).
    if (a.type == AccountType.cash || a.type == AccountType.bank) {
      return AccountRecordsPage(
        account: a,
        accountsController: widget.controller,
        resolvedValue: item.value.amount,
        onEditAccount: () => _edit(a),
      );
    }
    if (a.type.isValued) {
      return ValuedAccountDetailPage(
        controller: widget.controller,
        accountId: a.id,
      );
    }
    if (a.type == AccountType.brokerage) {
      return BrokerageAccountDetailPage(
        accountsController: widget.controller,
        account: a,
        onEditAccount: () => _edit(a),
      );
    }

    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        title: Text(a.name),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_horiz),
            onSelected: (v) {
              switch (v) {
                case 'edit':
                  _edit(a);
                case 'add_purchase':
                  _addPurchase(a);
                case 'close':
                  _lifecycle(item, 'close');
                case 'reopen':
                  _lifecycle(item, 'reopen');
                case 'delete':
                  _lifecycle(item, 'delete');
              }
            },
            itemBuilder: (context) => [
              if (a.type == AccountType.gold && a.isActive)
                const PopupMenuItem(
                  value: 'add_purchase',
                  child: Text('Add purchase'),
                ),
              PopupMenuItem(value: 'edit', child: Text(copy.edit)),
              if (a.isActive && !a.isSold)
                PopupMenuItem(
                  value: 'close',
                  enabled: lifecycle?.canClose ?? true,
                  child: Text(copy.closeAccount),
                )
              else if (a.isClosed)
                PopupMenuItem(
                  value: 'reopen',
                  child: Text(copy.reopenAccount),
                ),
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
        onRefresh: widget.controller.load,
        color: c.accent,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            if (widget.controller.actionError != null) ...[
              Callout(
                tone: CalloutTone.danger,
                message: widget.controller.actionError!,
              ),
              const SizedBox(height: 14),
            ],
            if (a.type == AccountType.gold)
              _GoldHero(item: item, detail: _gold)
            else if (a.isBankCredit)
              _CreditSummary(item: item)
            else
              _GenericHero(item: item),
            const SizedBox(height: 14),
            Row(
              children: [
                if (a.type == AccountType.gold && a.isActive) ...[
                  Expanded(
                    child: PrimaryButton(
                      label: 'Add purchase',
                      fontSize: 14,
                      onPressed: widget.controller.busy
                          ? null
                          : () => _addPurchase(a),
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: SecondaryButton(
                    label: copy.editAccount,
                    fontSize: 14,
                    onPressed: widget.controller.busy ? null : () => _edit(a),
                  ),
                ),
              ],
            ),
            if (a.type == AccountType.gold) ...[
              const SizedBox(height: 14),
              _PurityBreakdown(
                detail: _gold,
                onOpen: (purity) async {
                  await Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => MetalPurityDetailPage(
                        controller: widget.controller,
                        accountId: a.id,
                        purity: purity,
                      ),
                    ),
                  );
                  _goldLoading = false;
                  await _maybeLoadGold();
                },
              ),
              const SizedBox(height: 14),
              _PurchaseHistory(detail: _gold),
            ] else if (a.type == AccountType.cash ||
                a.type == AccountType.bank) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: c.surface,
                  border: Border.all(color: c.line),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'The full income / expense / transfer ledger for this account '
                  'arrives in a later flow. The value above is ledger-adjusted.',
                  style: TextStyle(
                    color: c.inkMuted,
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _GenericHero extends StatelessWidget {
  const _GenericHero({required this.item});
  final AccountItem item;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final a = item.account;
    return _HeroShell(
      account: a,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label(c, copy.currentValue),
          const SizedBox(height: 4),
          Text(
            MoneyFormat.money(item.value.amount, a.currencyCode),
            textDirection: TextDirection.ltr,
            style: TextStyle(
              color: c.ink,
              fontSize: 30,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          if (item.value.source == CurrentValueSource.valuation &&
              !item.value.isUnavailable)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                copy.latestValuationOwnership(a.ownershipPercentage ?? '100'),
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class _CreditSummary extends StatelessWidget {
  const _CreditSummary({required this.item});
  final AccountItem item;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final a = item.account;
    final limit = a.creditCardLimit;
    final available = item.value.amount; // ledger-projected current_balance
    final amountDue = (limit != null && available != null)
        ? D.subtract(limit, available)
        : null;

    Widget row(String label, String? value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: c.inkMuted, fontSize: 13)),
          Text(
            MoneyFormat.money(value, a.currencyCode),
            textDirection: TextDirection.ltr,
            style: TextStyle(
              color: c.ink,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );

    return _HeroShell(
      account: a,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.creditSummary,
            style: TextStyle(
              color: c.ink,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          row(copy.creditLimit, limit),
          row(copy.availableCredit, available),
          row(copy.amountDue, amountDue),
          if (a.dueDayOfMonth != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                copy.paymentDueDay('${a.dueDayOfMonth}'),
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class _GoldHero extends StatelessWidget {
  const _GoldHero({required this.item, required this.detail});
  final AccountItem item;
  final GoldAccountDetail? detail;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final a = item.account;
    final purchases = detail?.purchases ?? const <MetalPurchase>[];
    // Fold in chronological order for the weighted average / weight.
    final chrono = purchases.reversed.toList();
    final wa = foldMetalPurchases(chrono);
    final totalCost = totalMetalCost(purchases);
    final currentValue = (detail?.currentValue.amount) ?? item.value.amount;
    final gain = (currentValue != null)
        ? D.subtract(currentValue, totalCost)
        : null;
    final gainPct = (gain != null && (D.compare(totalCost, '0') ?? 0) > 0)
        ? D.multiply(D.divide(gain, totalCost, scale: 6), '100')
        : null;
    final gainPositive = gain != null && (D.compare(gain, '0') ?? 0) >= 0;

    Widget cell(String label, String value) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: c.fieldFill,
        borderRadius: BorderRadius.circular(13),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: c.inkMuted,
              fontSize: 10,
              letterSpacing: 1,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            textDirection: TextDirection.ltr,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: c.ink,
              fontSize: 14,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );

    return _HeroShell(
      account: a,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label(c, 'CURRENT VALUE'),
          const SizedBox(height: 4),
          Text(
            MoneyFormat.money(currentValue, a.currencyCode),
            textDirection: TextDirection.ltr,
            style: TextStyle(
              color: c.ink,
              fontSize: 30,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              currentValue == null
                  ? 'Live metal price unavailable right now'
                  : 'Weight × the live ${a.metalType ?? "metal"} price',
              style: TextStyle(color: c.inkMuted, fontSize: 12),
            ),
          ),
          const SizedBox(height: 14),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 2.5,
            children: [
              cell('METAL', a.typeLabel),
              cell('PURITY', (a.purity ?? '—').toUpperCase()),
              cell('WEIGHT', '${_grams(wa.balanceGrams)} g'),
              cell('TOTAL COST', MoneyFormat.money(totalCost, a.currencyCode)),
            ],
          ),
          if (gain != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.only(top: 12),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: c.line)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    gainPositive ? 'Unrealized gain' : 'Unrealized loss',
                    style: TextStyle(
                      color: c.inkMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '${gainPositive ? "+" : ""}${MoneyFormat.money(gain, a.currencyCode)}'
                    '${gainPct != null ? " · ${MoneyFormat.percent(gainPct)}" : ""}',
                    textDirection: TextDirection.ltr,
                    style: TextStyle(
                      color: gainPositive ? c.accent : c.negative,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _grams(String s) {
    final n = double.tryParse(s);
    if (n == null) return s;
    return n.toStringAsFixed(2);
  }
}

class _HeroShell extends StatelessWidget {
  const _HeroShell({required this.account, required this.child});
  final Account account;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AccountTypeIcon(type: account.type, size: 46),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      account.name,
                      style: TextStyle(
                        color: c.ink,
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${account.typeLabel} · ${account.currencyCode}',
                      style: TextStyle(color: c.inkMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

/// Per-purity slices of a metal account — the web `MetalPurityDetailsPage`
/// entry points. Each row opens that purity's transactions.
class _PurityBreakdown extends StatelessWidget {
  const _PurityBreakdown({required this.detail, required this.onOpen});

  final GoldAccountDetail? detail;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final rows = detail?.purities ?? const <MetalPurityAggregate>[];
    if (detail == null || rows.isEmpty) return const SizedBox.shrink();
    final currency = detail!.account.currencyCode;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'By purity',
            style: TextStyle(
              color: c.ink,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Each purity is valued at the spot price scaled by its fineness.',
            style: TextStyle(color: c.inkMuted, fontSize: 12, height: 1.4),
          ),
          const SizedBox(height: 10),
          for (final row in rows)
            InkWell(
              onTap: () => onOpen(row.purity),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: c.metalSoft,
                        borderRadius: BorderRadius.circular(AppRadius.chip),
                      ),
                      child: Text(
                        row.purity == 'other'
                            ? 'Other'
                            : row.purity.toUpperCase(),
                        style: TextStyle(
                          color: c.metal,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${MoneyFormat.money(row.totalUnitsGrams, 'g').replaceAll(' g', '')} g',
                            textDirection: TextDirection.ltr,
                            style: TextStyle(
                              color: c.ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '${row.transactionCount} '
                            '${row.transactionCount == 1 ? "purchase" : "purchases"}',
                            style: TextStyle(color: c.inkMuted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      MoneyFormat.money(row.currentValue, currency),
                      textDirection: TextDirection.ltr,
                      style: TextStyle(
                        color: row.currentValue == null ? c.inkMuted : c.ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Icon(Icons.chevron_right, size: 18, color: c.inkMuted),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PurchaseHistory extends StatelessWidget {
  const _PurchaseHistory({required this.detail});
  final GoldAccountDetail? detail;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final purchases = detail?.purchases;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Purchase history',
                style: TextStyle(
                  color: c.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: c.fieldFill,
                  border: Border.all(color: c.line),
                  borderRadius: BorderRadius.circular(AppRadius.chip),
                ),
                child: Text(
                  'APPEND-ONLY',
                  style: TextStyle(
                    color: c.inkMuted,
                    fontSize: 9,
                    letterSpacing: 1,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (purchases == null)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(8),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else if (purchases.isEmpty)
            Text(
              'No purchases yet. Add one to start the weighted-average cost.',
              style: TextStyle(color: c.inkMuted, fontSize: 13),
            )
          else
            for (var i = 0; i < purchases.length; i++) ...[
              _PurchaseRow(
                purchase: purchases[i],
                currencyCode: detail!.account.currencyCode,
              ),
              if (i != purchases.length - 1) const SizedBox(height: 8),
            ],
          const SizedBox(height: 10),
          Text(
            'Purchases can be added but never edited or deleted — correct one '
            'by appending an adjusting entry.',
            style: TextStyle(color: c.disabledFg, fontSize: 11, height: 1.5),
          ),
        ],
      ),
    );
  }
}

class _PurchaseRow extends StatelessWidget {
  const _PurchaseRow({required this.purchase, required this.currencyCode});
  final MetalPurchase purchase;
  final String currencyCode;

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final at = DateTime.tryParse(purchase.purchasedAt)?.toLocal();
    final date = at == null
        ? purchase.purchasedAt
        : '${at.day} ${_months[at.month - 1]} ${at.year}';
    final sub = D.multiply(purchase.quantityGrams, purchase.costPerUnit);
    final total = D.add(sub ?? '0', purchase.fees) ?? sub ?? '0';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                date,
                textDirection: TextDirection.ltr,
                style: TextStyle(
                  color: c.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                MoneyFormat.money(total, currencyCode),
                textDirection: TextDirection.ltr,
                style: TextStyle(
                  color: c.ink,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_g(purchase.quantityGrams)} g · ${purchase.purity.toUpperCase()}',
                textDirection: TextDirection.ltr,
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
              Text(
                '${MoneyFormat.money(purchase.costPerUnit, currencyCode)} / g',
                textDirection: TextDirection.ltr,
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _g(String s) {
    final n = double.tryParse(s);
    return n == null ? s : n.toStringAsFixed(2);
  }
}

Widget _label(AppColors c, String text) => Text(
  text,
  style: TextStyle(
    color: c.inkMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: FontWeight.w700,
  ),
);
