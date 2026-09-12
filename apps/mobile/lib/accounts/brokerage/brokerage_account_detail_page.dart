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
import 'brokerage_activity.dart';
import 'brokerage_controller.dart';
import 'brokerage_models.dart';
import 'brokerage_valuation.dart';
import 'dividend_sheet.dart';
import 'holding_detail_page.dart';
import 'trade_sheet.dart';

/// Brokerage account detail — port of the web `BrokerageAccountDetailsPage`:
/// the value header, the holdings table (each row opening its position), and
/// the account's activity feed. Buy, Sell and Dividend are all live
/// (docs/accounts.md §10.3).
class BrokerageAccountDetailPage extends StatefulWidget {
  const BrokerageAccountDetailPage({
    super.key,
    required this.accountsController,
    required this.account,
    required this.onEditAccount,
    this.controller,
  });

  final AccountsController accountsController;
  final Account account;
  final VoidCallback onEditAccount;

  /// Injected by tests; production builds create their own.
  final BrokerageController? controller;

  @override
  State<BrokerageAccountDetailPage> createState() =>
      _BrokerageAccountDetailPageState();
}

class _BrokerageAccountDetailPageState
    extends State<BrokerageAccountDetailPage> {
  late final BrokerageController _controller =
      widget.controller ?? BrokerageController(accountId: widget.account.id);

  @override
  void initState() {
    super.initState();
    _controller.load();
  }

  @override
  void dispose() {
    if (widget.controller == null) _controller.dispose();
    super.dispose();
  }

  Future<void> _trade(TradeSide side, {String? assetId}) async {
    _controller.clearActionError();
    await showAppSheet<bool>(
      context,
      builder: (_) => TradeSheet(
        controller: _controller,
        account: widget.account,
        side: side,
        presetAssetId: assetId,
      ),
    );
  }

  Future<void> _dividend({String? assetId}) async {
    _controller.clearActionError();
    await showAppSheet<bool>(
      context,
      builder: (_) => DividendSheet(
        controller: _controller,
        account: widget.account,
        presetAssetId: assetId,
      ),
    );
  }

  void _openHolding(String assetId) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HoldingDetailPage(
          controller: _controller,
          account: widget.account,
          assetId: assetId,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        title: Text(widget.account.name),
        actions: [
          IconButton(
            onPressed: widget.onEditAccount,
            icon: const Icon(Icons.edit_outlined),
            tooltip: copy.editAccount,
          ),
        ],
      ),
      body: ListenableBuilder(
        listenable: _controller,
        builder: (context, _) => RefreshIndicator(
          onRefresh: _controller.load,
          color: c.accent,
          child: _body(c, copy),
        ),
      ),
    );
  }

  Widget _body(AppColors c, AccountsCopy copy) {
    switch (_controller.status) {
      case BrokerageStatus.loading:
        return ListView(
          children: const [
            SizedBox(height: 120),
            Center(child: CircularProgressIndicator()),
          ],
        );
      case BrokerageStatus.error:
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Callout(
              tone: CalloutTone.danger,
              title: copy.brokerageLoadError,
              message: copy.brokerageSafeError,
              action: CompactButton(
                label: copy.tryAgain,
                tone: CompactButtonTone.neutral,
                onPressed: _controller.load,
              ),
            ),
          ],
        );
      case BrokerageStatus.ready:
        final v = _controller.valuation!;
        final currency = widget.account.currencyCode;
        final active = widget.account.isActive;
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            if (_controller.actionError != null) ...[
              Callout(
                tone: CalloutTone.danger,
                message: _controller.actionError!,
              ),
              const SizedBox(height: 12),
            ],
            _Header(valuation: v, currency: currency),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: PrimaryButton(
                    label: copy.buy,
                    fontSize: 14,
                    onPressed: active && !_controller.busy
                        ? () => _trade(TradeSide.buy)
                        : null,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SecondaryButton(
                    label: copy.sell,
                    fontSize: 14,
                    onPressed: active && !_controller.busy && !v.isEmpty
                        ? () => _trade(TradeSide.sell)
                        : null,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SecondaryButton(
                    label: copy.dividend,
                    fontSize: 14,
                    onPressed: active && !_controller.busy && !v.isEmpty
                        ? () => _dividend()
                        : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(
              copy.holdingsCount(v.holdings.length),
              style: TextStyle(
                color: c.inkMuted,
                fontSize: 11,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            if (v.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  border: Border.all(color: c.line),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      copy.noInvestments,
                      style: TextStyle(
                        color: c.ink,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      copy.noInvestmentsDescription,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: c.inkMuted,
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              )
            else
              for (final entry in v.holdings) ...[
                _HoldingRow(
                  entry: entry,
                  accountCurrency: currency,
                  onTap: () => _openHolding(entry.holding.assetId),
                  onSell: active && !_controller.busy
                      ? () => _trade(
                          TradeSide.sell,
                          assetId: entry.holding.assetId,
                        )
                      : null,
                  onBuy: active && !_controller.busy
                      ? () => _trade(
                          TradeSide.buy,
                          assetId: entry.holding.assetId,
                        )
                      : null,
                  onDividend: active && !_controller.busy
                      ? () => _dividend(assetId: entry.holding.assetId)
                      : null,
                ),
                const SizedBox(height: 8),
              ],
            const SizedBox(height: 20),
            Text(
              copy.activity,
              style: TextStyle(
                color: c.inkMuted,
                fontSize: 11,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            if (_controller.activityFailed)
              Text(
                copy.activityLoadError,
                style: TextStyle(color: c.inkMuted, fontSize: 13, height: 1.4),
              )
            else if (_controller.activity.isEmpty)
              Text(
                copy.noActivity,
                style: TextStyle(color: c.inkMuted, fontSize: 13),
              )
            else
              for (final group in _controller.activityGroups) ...[
                Padding(
                  padding: const EdgeInsets.only(top: 10, bottom: 6),
                  child: Text(
                    copy.localizedDate(group.date),
                    textDirection: TextDirection.ltr,
                    style: TextStyle(
                      color: c.inkMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                for (final item in group.items) ...[
                  _ActivityRow(
                    item: item,
                    accountId: widget.account.id,
                    accountCurrency: currency,
                  ),
                  const SizedBox(height: 8),
                ],
              ],
          ],
        );
    }
  }
}

/// One ledger row. A reversed entry stays visible, struck through and tagged —
/// the ledger is append-only, so hiding it would misrepresent the history.
class _ActivityRow extends StatelessWidget {
  const _ActivityRow({
    required this.item,
    required this.accountId,
    required this.accountCurrency,
  });

  final ActivityItem item;
  final String accountId;
  final String accountCurrency;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final when = formatLocalDateTime(item.occurredAt);
    final entry = activityAssetEntry(item);
    final asset = entry?.asset;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final label = localizedActivityLabel(item, accountId, copy);

    return Opacity(
      opacity: item.isDeleted ? 0.6 : 1,
      child: Container(
        padding: const EdgeInsets.all(14),
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
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            decoration: item.isDeleted
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                      ),
                      if (item.presentation == ActivityPresentation.updated)
                        _tag(c, copy.updated),
                      if (item.isDeleted) _tag(c, copy.removed),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      copy.ltr(when.time),
                      if (asset != null) copy.ltr(asset.symbol ?? asset.name),
                      if (entry?.quantityDelta != null)
                        copy.activityUnits(
                          absoluteDecimal(entry!.quantityDelta!),
                        ),
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: c.inkMuted, fontSize: 12),
                  ),
                  if (item.notes != null && item.notes!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      item.notes!,
                      style: TextStyle(color: c.inkMuted, fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
            if (entry?.unitPrice != null)
              Text(
                MoneyFormat.money(
                  entry!.unitPrice,
                  asset?.currencyCode ?? accountCurrency,
                ),
                textDirection: TextDirection.ltr,
                style: TextStyle(
                  color: c.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _tag(AppColors c, String text) => Padding(
    padding: const EdgeInsets.only(left: 6),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: c.fieldFill,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.chip),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: c.inkMuted,
          fontSize: 9,
          letterSpacing: 0.6,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
  );
}

class _Header extends StatelessWidget {
  const _Header({required this.valuation, required this.currency});

  final BrokerageValuation valuation;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final gain = valuation.totalUnrealizedGainLoss;
    final negative = gain != null && (D.compare(gain, '0') ?? 0) < 0;
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
            copy.currentValue,
            style: TextStyle(color: c.inkMuted, fontSize: 12),
          ),
          const SizedBox(height: 4),
          Text(
            MoneyFormat.money(valuation.currentValue, currency),
            textDirection: TextDirection.ltr,
            style: TextStyle(
              color: valuation.currentValue == null ? c.inkMuted : c.ink,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          if (gain != null) ...[
            const SizedBox(height: 4),
            Text(
              copy.signedMoneyWithPercent(
                MoneyFormat.signedMoney(gain, currency),
                MoneyFormat.percent(valuation.totalUnrealizedReturnPercent),
              ),
              style: TextStyle(
                color: negative ? c.negative : c.accent,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: 14),
          _row(
            c,
            copy.availableCash,
            MoneyFormat.money(valuation.cashBalance, currency),
          ),
          _row(
            c,
            copy.holdingsMarketValue,
            MoneyFormat.money(valuation.totalMarketValue, currency),
          ),
          _row(
            c,
            copy.holdingsCost,
            MoneyFormat.money(valuation.totalCostBasis, currency),
          ),
          if (!valuation.isComplete) ...[
            const SizedBox(height: 12),
            Callout(
              tone: CalloutTone.warning,
              message: copy.incompleteHoldings(valuation.unpricedCount),
            ),
          ],
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

class _HoldingRow extends StatelessWidget {
  const _HoldingRow({
    required this.entry,
    required this.accountCurrency,
    required this.onTap,
    required this.onSell,
    required this.onBuy,
    required this.onDividend,
  });

  final HoldingValuation entry;
  final String accountCurrency;
  final VoidCallback onTap;
  final VoidCallback? onSell;
  final VoidCallback? onBuy;
  final VoidCallback? onDividend;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final h = entry.holding;
    final assetCurrency = h.asset.currencyCode;
    final gain = entry.unrealizedGainLoss;
    final negative = gain != null && (D.compare(gain, '0') ?? 0) < 0;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
        decoration: BoxDecoration(
          color: c.surface,
          border: Border.all(color: c.line),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        h.displayName,
                        textDirection: TextDirection.ltr,
                        style: TextStyle(
                          color: c.ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        h.asset.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: c.inkMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  enabled: onBuy != null || onSell != null,
                  icon: Icon(Icons.more_horiz, size: 20, color: c.inkMuted),
                  onSelected: (v) => switch (v) {
                    'buy' => onBuy?.call(),
                    'sell' => onSell?.call(),
                    _ => onDividend?.call(),
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(value: 'buy', child: Text(copy.buyMore)),
                    PopupMenuItem(value: 'sell', child: Text(copy.sell)),
                    PopupMenuItem(
                      value: 'dividend',
                      child: Text(copy.dividend),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 18,
              runSpacing: 8,
              children: [
                _stat(c, copy.quantity, h.quantity),
                _stat(
                  c,
                  copy.price,
                  MoneyFormat.money(entry.marketPrice?.price, assetCurrency),
                ),
                _stat(
                  c,
                  copy.marketValue,
                  MoneyFormat.money(entry.marketValue, assetCurrency),
                ),
                _stat(
                  c,
                  copy.cost,
                  MoneyFormat.money(h.totalCostBasis, h.costCurrencyCode),
                ),
              ],
            ),
            if (gain != null) ...[
              const SizedBox(height: 8),
              Text(
                copy.signedMoneyWithPercent(
                  MoneyFormat.signedMoney(gain, h.costCurrencyCode),
                  MoneyFormat.percent(entry.unrealizedReturnPercent),
                ),
                style: TextStyle(
                  color: negative ? c.negative : c.accent,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ] else ...[
              const SizedBox(height: 8),
              Text(
                copy.noCurrentPrice,
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _stat(AppColors c, String label, String value) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(label, style: TextStyle(color: c.inkMuted, fontSize: 11)),
      const SizedBox(height: 1),
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
  );
}
