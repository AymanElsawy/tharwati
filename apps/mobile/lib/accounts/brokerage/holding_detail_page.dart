import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/decimals.dart';
import '../../core/local_datetime.dart';
import '../../core/money_format.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/callout.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import 'brokerage_activity.dart';
import 'brokerage_controller.dart';
import 'brokerage_models.dart';
import 'brokerage_valuation.dart';
import 'trade_sheet.dart';

/// One position — port of the web `BrokerageHoldingDetailsPage`: the position's
/// figures, then its buy / sell / opening-position history. An opening position
/// (an "existing holding" you entered by hand) can be corrected or reversed;
/// trades cannot, because they are real ledger events.
class HoldingDetailPage extends StatefulWidget {
  const HoldingDetailPage({
    super.key,
    required this.controller,
    required this.account,
    required this.assetId,
  });

  final BrokerageController controller;
  final Account account;
  final String assetId;

  @override
  State<HoldingDetailPage> createState() => _HoldingDetailPageState();
}

class _HoldingDetailPageState extends State<HoldingDetailPage> {
  List<ActivityItem> _history = const [];
  bool _loading = true;
  bool _historyFailed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final history = await widget.controller.holdingHistory(widget.assetId);
      if (!mounted) return;
      setState(() {
        _history = history;
        _historyFailed = false;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _history = const [];
        _historyFailed = true;
        _loading = false;
      });
    }
  }

  Future<void> _sell() async {
    widget.controller.clearActionError();
    final done = await showAppSheet<bool>(
      context,
      builder: (_) => TradeSheet(
        controller: widget.controller,
        account: widget.account,
        side: TradeSide.sell,
        presetAssetId: widget.assetId,
      ),
    );
    if (done == true) await _load();
  }

  Future<void> _buy() async {
    widget.controller.clearActionError();
    final done = await showAppSheet<bool>(
      context,
      builder: (_) => TradeSheet(
        controller: widget.controller,
        account: widget.account,
        side: TradeSide.buy,
        presetAssetId: widget.assetId,
      ),
    );
    if (done == true) await _load();
  }

  Future<void> _correct(ActivityItem item) async {
    final entry = activityAssetEntry(item);
    if (entry == null) return;
    final done = await showAppSheet<bool>(
      context,
      builder: (_) => _CorrectExistingHoldingSheet(
        controller: widget.controller,
        account: widget.account,
        item: item,
        entry: entry,
      ),
    );
    if (done == true) await _load();
  }

  Future<void> _reverse(ActivityItem item) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove this existing holding?'),
        content: const Text(
          'The entry stays in the ledger marked reversed, and the position’s '
          'quantity and cost basis are adjusted back.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          CompactButton(
            label: 'Remove',
            tone: CompactButtonTone.danger,
            onPressed: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final done = await widget.controller.reverseExistingHolding(item.id);
    if (done && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final entry = widget.controller.valuationForAsset(widget.assetId);
        final asset = entry?.holding.asset;
        return Scaffold(
          backgroundColor: c.canvas,
          appBar: AppBar(
            title: Text(asset?.symbol ?? asset?.name ?? 'Holding'),
          ),
          body: RefreshIndicator(
            onRefresh: _load,
            color: c.accent,
            child: entry == null
                ? ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      Text(
                        'This position is no longer open.',
                        style: TextStyle(color: c.inkMuted, fontSize: 13),
                      ),
                    ],
                  )
                : _body(c, entry),
          ),
        );
      },
    );
  }

  Widget _body(AppColors c, HoldingValuation entry) {
    final h = entry.holding;
    final assetCurrency = h.asset.currencyCode;
    final gain = entry.unrealizedGainLoss;
    final negative = gain != null && (D.compare(gain, '0') ?? 0) < 0;
    final active = widget.account.isActive && !widget.controller.busy;

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
        Container(
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
                h.asset.name,
                style: TextStyle(
                  color: c.ink,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                [
                  if (h.asset.exchange != null) h.asset.exchange!,
                  assetCurrency,
                ].join(' · '),
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              Text(
                'Market value',
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
              const SizedBox(height: 2),
              Text(
                MoneyFormat.money(entry.marketValue, assetCurrency),
                textDirection: TextDirection.ltr,
                style: TextStyle(
                  color: entry.marketValue == null ? c.inkMuted : c.ink,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              if (gain != null) ...[
                const SizedBox(height: 4),
                Text(
                  '${MoneyFormat.signedMoney(gain, h.costCurrencyCode)} · '
                  '${MoneyFormat.percent(entry.unrealizedReturnPercent)}',
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    color: negative ? c.negative : c.accent,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              const SizedBox(height: 14),
              _row(c, 'Quantity', h.quantity),
              _row(
                c,
                'Average cost',
                MoneyFormat.money(h.averageCost, h.costCurrencyCode),
              ),
              _row(
                c,
                'Total cost',
                MoneyFormat.money(h.totalCostBasis, h.costCurrencyCode),
              ),
              _row(
                c,
                'Current price',
                MoneyFormat.money(entry.marketPrice?.price, assetCurrency),
              ),
              if (entry.marketPrice?.stale == true)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'This price is stale — the provider hasn’t refreshed it '
                    'recently.',
                    style: TextStyle(color: c.warningFg, fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: PrimaryButton(
                label: 'Buy more',
                fontSize: 14,
                onPressed: active ? _buy : null,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SecondaryButton(
                label: 'Sell',
                fontSize: 14,
                onPressed: active ? _sell : null,
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text(
          'HISTORY',
          style: TextStyle(
            color: c.inkMuted,
            fontSize: 11,
            letterSpacing: 1,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        if (_loading)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_historyFailed)
          Text(
            'We couldn’t load this position’s history.',
            style: TextStyle(color: c.inkMuted, fontSize: 13),
          )
        else if (_history.isEmpty)
          Text(
            'No history yet.',
            style: TextStyle(color: c.inkMuted, fontSize: 13),
          )
        else
          for (final item in _history) ...[
            _HistoryRow(
              item: item,
              accountCurrency: widget.account.currencyCode,
              assetCurrency: assetCurrency,
              // Only a hand-entered opening position is editable; a buy or sell
              // is a real ledger event and is corrected by trading, not editing.
              canEdit:
                  active &&
                  item.transactionTypeCode == 'opening_position' &&
                  !item.isDeleted,
              onCorrect: () => _correct(item),
              onReverse: () => _reverse(item),
            ),
            const SizedBox(height: 8),
          ],
      ],
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

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({
    required this.item,
    required this.accountCurrency,
    required this.assetCurrency,
    required this.canEdit,
    required this.onCorrect,
    required this.onReverse,
  });

  final ActivityItem item;
  final String accountCurrency;
  final String assetCurrency;
  final bool canEdit;
  final VoidCallback onCorrect;
  final VoidCallback onReverse;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final when = formatLocalDateTime(item.occurredAt);
    final entry = activityAssetEntry(item);
    final label = switch (item.transactionTypeCode) {
      'buy' => 'Buy',
      'sell' => 'Sell',
      'dividend' => 'Dividend',
      _ => 'Existing holding',
    };

    return Opacity(
      opacity: item.isDeleted ? 0.6 : 1,
      child: Container(
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
                  Row(
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          color: c.ink,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          decoration: item.isDeleted
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                      ),
                      if (item.presentation == ActivityPresentation.updated)
                        _tag(c, 'UPDATED'),
                      if (item.isDeleted) _tag(c, 'REMOVED'),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${when.date} · ${when.time}',
                    style: TextStyle(color: c.inkMuted, fontSize: 12),
                  ),
                  if (entry != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      [
                        if (entry.quantityDelta != null)
                          '${absoluteDecimal(entry.quantityDelta!)} units',
                        if (entry.unitPrice != null)
                          '@ ${MoneyFormat.money(entry.unitPrice, assetCurrency)}',
                      ].join(' '),
                      textDirection: TextDirection.ltr,
                      style: TextStyle(color: c.inkMuted, fontSize: 12),
                    ),
                  ],
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
            if (canEdit)
              PopupMenuButton<String>(
                icon: Icon(Icons.more_horiz, size: 20, color: c.inkMuted),
                onSelected: (v) => v == 'edit' ? onCorrect() : onReverse(),
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                  PopupMenuItem(
                    value: 'remove',
                    child: Text('Remove', style: TextStyle(color: c.negative)),
                  ),
                ],
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

/// Corrects a hand-entered opening position (`correct_existing_holding`).
class _CorrectExistingHoldingSheet extends StatefulWidget {
  const _CorrectExistingHoldingSheet({
    required this.controller,
    required this.account,
    required this.item,
    required this.entry,
  });

  final BrokerageController controller;
  final Account account;
  final ActivityItem item;
  final ActivityEntry entry;

  @override
  State<_CorrectExistingHoldingSheet> createState() =>
      _CorrectExistingHoldingSheetState();
}

class _CorrectExistingHoldingSheetState
    extends State<_CorrectExistingHoldingSheet> {
  late final _quantity = TextEditingController(
    text: widget.entry.quantityDelta == null
        ? ''
        : absoluteDecimal(widget.entry.quantityDelta!),
  );
  late final _averageCost = TextEditingController(
    text: widget.entry.unitPrice ?? '',
  );
  late final _rate = TextEditingController(
    text: widget.entry.accountFxRate ?? '',
  );
  late final _notes = TextEditingController(text: widget.item.notes ?? '');
  late String _occurredAt = formatLocalDateTimeInput(
    DateTime.tryParse(widget.item.occurredAt)?.toLocal(),
  );

  bool _submitted = false;
  Map<String, String> _errors = const {};

  bool get _crossCurrency => widget.entry.accountFxRate != null;

  @override
  void dispose() {
    _quantity.dispose();
    _averageCost.dispose();
    _rate.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final errors = <String, String>{};
    final decimal = RegExp(r'^\d+(?:\.\d+)?$');
    if (!decimal.hasMatch(_quantity.text.trim()) ||
        (D.compare(_quantity.text.trim(), '0') ?? 0) <= 0) {
      errors['quantity'] = 'Enter a quantity greater than zero.';
    }
    if (!decimal.hasMatch(_averageCost.text.trim()) ||
        (D.compare(_averageCost.text.trim(), '0') ?? 0) <= 0) {
      errors['averageCost'] = 'Enter an average cost greater than zero.';
    }
    if (_crossCurrency &&
        (!decimal.hasMatch(_rate.text.trim()) ||
            (D.compare(_rate.text.trim(), '0') ?? 0) <= 0)) {
      errors['rate'] = 'Enter the exchange rate.';
    }
    setState(() {
      _submitted = true;
      _errors = errors;
    });
    if (errors.isNotEmpty) return;

    final ok = await widget.controller.correctExistingHolding(
      originalTransactionId: widget.item.id,
      quantity: _quantity.text,
      averageCost: _averageCost.text,
      occurredAt: _occurredAt,
      notes: _notes.text,
      accountFxRate: _crossCurrency ? _rate.text : null,
    );
    if (ok && mounted) Navigator.of(context).pop(true);
  }

  String? _err(String field) => _submitted ? _errors[field] : null;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final c = context.colors;
        return AppSheet(
          title: 'Edit existing holding',
          subtitle:
              'Saves a corrected version. The original stays in the ledger, '
              'superseded.',
          children: [
            SheetField(
              label: 'Quantity',
              error: _err('quantity'),
              child: _num(_quantity, '0'),
            ),
            SheetField(
              label: 'Average cost per unit',
              error: _err('averageCost'),
              child: _num(_averageCost, '0.00'),
            ),
            if (_crossCurrency)
              SheetField(
                label: 'Exchange rate to ${widget.account.currencyCode}',
                error: _err('rate'),
                child: _num(_rate, '0.00'),
              ),
            SheetField(
              label: 'Date & time',
              child: InkWell(
                onTap: () async {
                  final current =
                      DateTime.tryParse(_occurredAt) ?? DateTime.now();
                  final date = await showDatePicker(
                    context: context,
                    initialDate: current,
                    firstDate: DateTime(2000),
                    lastDate: DateTime.now(),
                  );
                  if (date == null || !mounted) return;
                  setState(
                    () => _occurredAt = formatLocalDateTimeInput(
                      DateTime(
                        date.year,
                        date.month,
                        date.day,
                        current.hour,
                        current.minute,
                      ),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(AppRadius.field),
                child: SheetBox(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _occurredAt.replaceFirst('T', '  '),
                        textDirection: TextDirection.ltr,
                        style: TextStyle(color: c.ink, fontSize: 14),
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
                minHeight: 78,
                child: TextField(
                  controller: _notes,
                  maxLines: 3,
                  decoration: const InputDecoration(hintText: 'Optional'),
                  style: TextStyle(color: c.ink, fontSize: 15),
                ),
              ),
            ),
            if (widget.controller.actionError != null) ...[
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
                    label: 'Cancel',
                    onPressed: widget.controller.busy
                        ? null
                        : () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: PrimaryButton(
                    label: 'Save changes',
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

  Widget _num(TextEditingController controller, String hint) => SheetBox(
    child: TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      textDirection: TextDirection.ltr,
      decoration: InputDecoration(hintText: hint),
      style: TextStyle(
        color: context.colors.ink,
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}
