import 'package:flutter/material.dart';

import '../../core/decimals.dart';
import '../../core/local_datetime.dart';
import '../../core/money_format.dart';
import '../../i18n/accounts_copy.dart';
import '../../i18n/app_language.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/callout.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import '../accounts_controller.dart';
import '../accounts_service.dart';
import '../metal_purchase_sheet.dart';
import 'metal_purity.dart';

/// One purity's slice of a gold/silver account — port of the web
/// `MetalPurityDetailsPage`. Shows the purity's totals and every effective
/// purchase at that purity, each correctable or reversible.
class MetalPurityDetailPage extends StatefulWidget {
  const MetalPurityDetailPage({
    super.key,
    required this.controller,
    required this.accountId,
    required this.purity,
  });

  final AccountsController controller;
  final String accountId;
  final String purity;

  @override
  State<MetalPurityDetailPage> createState() => _MetalPurityDetailPageState();
}

class _MetalPurityDetailPageState extends State<MetalPurityDetailPage> {
  GoldAccountDetail? _detail;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await widget.controller.service.loadGoldDetail(
        widget.accountId,
      );
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
      setState(() {
        _error = copy.puritySafeError;
        _loading = false;
      });
    }
  }

  Future<void> _edit(MetalPurchase purchase) async {
    final account = _detail?.account;
    if (account == null) return;
    final changed = await showAppSheet<bool>(
      context,
      builder: (_) => MetalPurchaseSheet(
        controller: widget.controller,
        account: account,
        editing: purchase,
      ),
    );
    if (changed == true) await _load();
  }

  Future<void> _reverse(MetalPurchase purchase) async {
    final currency = _detail?.account.currencyCode ?? '';
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final weight = '${_grams(purchase.quantityGrams)}g';
    final amount = MoneyFormat.money(metalPurchaseCost(purchase), currency);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(copy.reversePurchaseTitle),
        content: Text(copy.reversePurchaseBody(weight, amount)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(copy.cancel),
          ),
          CompactButton(
            label: copy.reversePurchase,
            tone: CompactButtonTone.danger,
            onPressed: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final done = await widget.controller.run(
      (s) => s.reverseMetalPurchase(purchase.id),
    );
    if (done && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(title: Text(copy.purity(widget.purity))),
      body: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, _) => RefreshIndicator(
          onRefresh: _load,
          color: c.accent,
          child: _body(c, copy),
        ),
      ),
    );
  }

  Widget _body(AppColors c, AccountsCopy copy) {
    if (_loading) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(child: CircularProgressIndicator()),
        ],
      );
    }
    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Callout(
            tone: CalloutTone.danger,
            title: copy.purityLoadError,
            message: _error!,
            action: CompactButton(
              label: copy.tryAgain,
              tone: CompactButtonTone.neutral,
              onPressed: _load,
            ),
          ),
        ],
      );
    }

    final detail = _detail!;
    final account = detail.account;
    final purchases = detail.purchasesForPurity(widget.purity);
    final aggregate = detail.purities
        .where((p) => p.purity == widget.purity)
        .firstOrNull;

    if (aggregate == null || purchases.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            copy.noPurityPurchases,
            style: TextStyle(color: c.inkMuted, fontSize: 13),
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        if (widget.controller.actionError != null) ...[
          Callout(
            tone: CalloutTone.danger,
            message: widget.controller.actionError!,
          ),
          const SizedBox(height: 12),
        ],
        _Summary(aggregate: aggregate, currency: account.currencyCode),
        const SizedBox(height: 16),
        Text(
          copy.purchasesCount(purchases.length),
          style: TextStyle(
            color: c.inkMuted,
            fontSize: 11,
            letterSpacing: 1,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        for (final p in purchases) ...[
          _PurchaseRow(
            purchase: p,
            currency: account.currencyCode,
            pricePerGram: aggregate.currentPricePerGram,
            enabled: account.isActive && !widget.controller.busy,
            onEdit: () => _edit(p),
            onReverse: () => _reverse(p),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.aggregate, required this.currency});

  final MetalPurityAggregate aggregate;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final gain = aggregate.unrealizedGain;
    final gainNegative = gain != null && (D.compare(gain, '0') ?? 0) < 0;
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
          Text(
            copy.currentMetalValue,
            style: TextStyle(color: c.inkMuted, fontSize: 12),
          ),
          const SizedBox(height: 4),
          Text(
            MoneyFormat.money(aggregate.currentValue, currency),
            textDirection: TextDirection.ltr,
            style: TextStyle(
              color: aggregate.currentValue == null ? c.inkMuted : c.ink,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          if (gain != null) ...[
            const SizedBox(height: 4),
            Text(
              copy.gainVsCost(MoneyFormat.signedMoney(gain, currency)),
              style: TextStyle(
                color: gainNegative ? c.negative : c.accent,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: 14),
          _row(c, copy.weight, '${_grams(aggregate.totalUnitsGrams)} g'),
          _row(
            c,
            copy.cost,
            MoneyFormat.money(aggregate.totalAmount, currency),
          ),
          _row(
            c,
            copy.pricePerGram,
            MoneyFormat.money(aggregate.currentPricePerGram, currency),
          ),
          _row(c, copy.purchases, '${aggregate.transactionCount}'),
        ],
      ),
    );
  }

  Widget _row(AppColors c, String label, String value) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: c.inkMuted, fontSize: 13)),
        Text(
          value,
          textDirection: TextDirection.ltr,
          style: TextStyle(
            color: c.ink,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

String _grams(String value) =>
    MoneyFormat.money(value, 'g').replaceAll(' g', '');

class _PurchaseRow extends StatelessWidget {
  const _PurchaseRow({
    required this.purchase,
    required this.currency,
    required this.pricePerGram,
    required this.enabled,
    required this.onEdit,
    required this.onReverse,
  });

  final MetalPurchase purchase;
  final String currency;
  final String? pricePerGram;
  final bool enabled;
  final VoidCallback onEdit;
  final VoidCallback onReverse;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final when = formatLocalDateTime(purchase.purchasedAt);
    final value = metalCurrentValue(purchase.quantityGrams, pricePerGram);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_grams(purchase.quantityGrams)} g',
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    color: c.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${when.date} · ${when.time}',
                  textDirection: TextDirection.ltr,
                  style: TextStyle(color: c.inkMuted, fontSize: 12),
                ),
                const SizedBox(height: 6),
                Text(
                  copy.purchasePaid(
                    MoneyFormat.money(metalPurchaseCost(purchase), currency),
                    MoneyFormat.money(purchase.costPerUnit, currency),
                  ),
                  style: TextStyle(color: c.inkMuted, fontSize: 12),
                ),
                if (value != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    copy.nowValue(MoneyFormat.money(value, currency)),
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                if (purchase.notes != null && purchase.notes!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    purchase.notes!,
                    style: TextStyle(color: c.inkMuted, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
          PopupMenuButton<String>(
            enabled: enabled,
            icon: Icon(Icons.more_horiz, size: 20, color: c.inkMuted),
            onSelected: (v) => v == 'edit' ? onEdit() : onReverse(),
            itemBuilder: (_) => [
              PopupMenuItem(value: 'edit', child: Text(copy.edit)),
              PopupMenuItem(
                value: 'reverse',
                child: Text(
                  copy.reversePurchase,
                  style: TextStyle(color: c.negative),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
