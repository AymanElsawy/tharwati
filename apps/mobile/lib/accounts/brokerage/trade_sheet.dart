import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/local_datetime.dart';
import '../../core/money_format.dart';
import '../../i18n/accounts_copy.dart';
import '../../i18n/app_language.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/form_controls.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import 'brokerage_controller.dart';
import 'brokerage_models.dart';
import 'brokerage_valuation.dart';

/// Buy / sell a holding — port of the web `BrokerageBuyDialog` and
/// `BrokerageSellDialog`. A sell picks from what the account already holds; a
/// buy can also search for a new instrument.
class TradeSheet extends StatefulWidget {
  const TradeSheet({
    super.key,
    required this.controller,
    required this.account,
    required this.side,
    this.presetAssetId,
  });

  final BrokerageController controller;
  final Account account;
  final TradeSide side;

  /// Pre-selects an instrument — set when the trade is raised from a row.
  final String? presetAssetId;

  @override
  State<TradeSheet> createState() => _TradeSheetState();
}

class _TradeSheetState extends State<TradeSheet> {
  late final TradeFormValues _v = TradeFormValues(
    side: widget.side,
    assetId: widget.presetAssetId ?? '',
    occurredAt: formatLocalDateTimeInput(),
  );

  final _quantity = TextEditingController();
  final _price = TextEditingController();
  final _fees = TextEditingController();
  final _rate = TextEditingController();
  final _notes = TextEditingController();

  /// The instrument being traded — either an existing holding's asset or one
  /// resolved from search.
  Asset? _asset;
  bool _submitted = false;
  Map<String, String> _errors = const {};

  bool get _isBuy => widget.side == TradeSide.buy;

  @override
  void initState() {
    super.initState();
    _selectAssetId(widget.presetAssetId);
  }

  @override
  void dispose() {
    _quantity.dispose();
    _price.dispose();
    _fees.dispose();
    _rate.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _selectAssetId(String? assetId) {
    if (assetId == null || assetId.isEmpty) return;
    final holding = widget.controller.holdingForAsset(assetId);
    if (holding == null) return;
    setState(() {
      _asset = holding.asset;
      _v.assetId = assetId;
      final last = widget.controller.lastPriceFor(assetId);
      if (last != null && _price.text.isEmpty) _price.text = last;
    });
  }

  /// True when the instrument trades in a different currency than the account,
  /// which is when the RPC needs an explicit rate.
  bool get _crossCurrency =>
      _asset != null && _asset!.currencyCode != widget.account.currencyCode;

  void _sync() {
    _v
      ..quantity = _quantity.text.trim()
      ..unitPrice = _price.text.trim()
      ..fees = _fees.text.trim()
      ..notes = _notes.text
      ..accountFxRate = _crossCurrency ? _rate.text.trim() : null;
  }

  Future<void> _pickAsset() async {
    final holdings = widget.controller.sellableHoldings;
    final picked = await showAppSheet<Object>(
      context,
      builder: (_) => _AssetPickerSheet(
        controller: widget.controller,
        holdings: holdings,
        allowSearch: _isBuy,
      ),
    );
    if (picked == null || !mounted) return;

    if (picked is Holding) {
      _selectAssetId(picked.assetId);
      return;
    }
    if (picked is AssetSearchResult) {
      final assetId = await widget.controller.resolveAsset(picked);
      if (assetId == null || !mounted) return;
      setState(() {
        _v.assetId = assetId;
        _asset = Asset(
          id: assetId,
          name: picked.name,
          symbol: picked.symbol,
          exchange: picked.exchange,
          assetTypeCode: picked.instrumentType,
          currencyCode: picked.currencyCode,
          canonicalQuantityUnit: null,
        );
      });
    }
  }

  Future<void> _pickDateTime() async {
    final current = DateTime.tryParse(_v.occurredAt) ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current),
    );
    if (!mounted) return;
    final picked = DateTime(
      date.year,
      date.month,
      date.day,
      time?.hour ?? current.hour,
      time?.minute ?? current.minute,
    );
    setState(() => _v.occurredAt = formatLocalDateTimeInput(picked));
  }

  Future<void> _submit() async {
    _sync();
    final errs = validateTrade(
      _v,
      sellingFrom: _isBuy
          ? null
          : widget.controller.holdingForAsset(_v.assetId),
    );
    setState(() {
      _submitted = true;
      _errors = errs;
    });
    if (errs.isNotEmpty) return;
    final ok = await widget.controller.submitTrade(_v);
    if (ok && mounted) Navigator.of(context).pop(true);
  }

  String? _err(String field, AccountsCopy copy) =>
      _submitted ? copy.tradeValidation(_errors[field]) : null;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final c = context.colors;
        final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
        _sync();
        final assetCurrency =
            _asset?.currencyCode ?? widget.account.currencyCode;
        final preview = previewTrade(
          side: widget.side,
          quantity: _v.quantity,
          unitPrice: _v.unitPrice,
          fees: _v.fees,
          accountFxRate: _v.accountFxRate,
        );

        return AppSheet(
          title: _isBuy ? copy.buy : copy.sell,
          subtitle: _isBuy ? copy.buyTradeSubtitle : copy.sellTradeSubtitle,
          children: [
            SheetField(
              label: copy.instrument,
              error: _err('assetId', copy),
              child: InkWell(
                onTap: widget.controller.busy ? null : _pickAsset,
                borderRadius: BorderRadius.circular(AppRadius.field),
                child: SheetBox(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _asset == null
                              ? (_isBuy
                                    ? copy.searchOrChooseHolding
                                    : copy.chooseHolding)
                              : copy.instrumentCaption(
                                  _asset!.symbol,
                                  _asset!.name,
                                ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: _asset == null ? c.disabledFg : c.ink,
                            fontSize: 15,
                            fontWeight: _asset == null
                                ? FontWeight.w400
                                : FontWeight.w600,
                          ),
                        ),
                      ),
                      Icon(Icons.expand_more, size: 18, color: c.inkMuted),
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
                    label: copy.quantity,
                    error: _err('quantity', copy),
                    child: _num(_quantity, '0'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SheetField(
                    label: _isBuy ? copy.unitPrice : copy.unitSalePrice,
                    hint: copy.currencyValue(assetCurrency),
                    error: _err('unitPrice', copy),
                    child: _num(_price, '0.00'),
                  ),
                ),
              ],
            ),
            SheetField(
              label: copy.fees,
              optional: true,
              hint: copy.currencyValue(assetCurrency),
              error: _err('fees', copy),
              child: _num(_fees, '0.00'),
            ),
            if (_crossCurrency)
              SheetField(
                label: copy.tradeExchangeRate(
                  assetCurrency,
                  widget.account.currencyCode,
                ),
                error: _err('accountFxRate', copy),
                child: _num(_rate, '0.00'),
              ),
            SheetField(
              label: copy.dateTime,
              error: _err('occurredAt', copy),
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
                        style: TextStyle(color: c.ink, fontSize: 14),
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
                minHeight: 78,
                child: TextField(
                  controller: _notes,
                  maxLines: 3,
                  decoration: InputDecoration(hintText: copy.optional),
                  style: TextStyle(color: c.ink, fontSize: 15),
                ),
              ),
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
                    _isBuy ? copy.purchaseAmount : copy.grossProceeds,
                    MoneyFormat.money(preview.grossAmount, assetCurrency),
                  ),
                  const SizedBox(height: 6),
                  _summaryRow(
                    c,
                    copy.fees,
                    MoneyFormat.money(preview.fees, assetCurrency),
                  ),
                  const SizedBox(height: 6),
                  _summaryRow(
                    c,
                    _isBuy ? copy.totalCost : copy.netProceeds,
                    MoneyFormat.money(preview.assetTotal, assetCurrency),
                    strong: true,
                  ),
                  if (_crossCurrency) ...[
                    const SizedBox(height: 6),
                    _summaryRow(
                      c,
                      _isBuy ? copy.cashDebited : copy.cashCredited,
                      MoneyFormat.money(
                        preview.accountTotal,
                        widget.account.currencyCode,
                      ),
                      strong: true,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
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
                    label: _isBuy ? copy.recordBuy : copy.recordSell,
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
      onChanged: (_) => setState(_sync),
      decoration: InputDecoration(hintText: hint),
      style: TextStyle(
        color: context.colors.ink,
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
    ),
  );

  Widget _summaryRow(
    AppColors c,
    String label,
    String value, {
    bool strong = false,
  }) => Row(
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
          fontSize: strong ? 15 : 13,
          fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
        ),
      ),
    ],
  );
}

/// Picks an instrument: the account's own holdings, plus external search when
/// buying.
class _AssetPickerSheet extends StatefulWidget {
  const _AssetPickerSheet({
    required this.controller,
    required this.holdings,
    required this.allowSearch,
  });

  final BrokerageController controller;
  final List<Holding> holdings;
  final bool allowSearch;

  @override
  State<_AssetPickerSheet> createState() => _AssetPickerSheetState();
}

class _AssetPickerSheetState extends State<_AssetPickerSheet> {
  final _query = TextEditingController();
  Timer? _debounce;
  List<AssetSearchResult> _results = const [];
  bool _searching = false;
  String? _searchError;

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    if (!widget.allowSearch) {
      setState(() {});
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(value));
    setState(() {});
  }

  Future<void> _search(String value) async {
    if (value.trim().length < 2) {
      setState(() {
        _results = const [];
        _searchError = null;
      });
      return;
    }
    setState(() {
      _searching = true;
      _searchError = null;
    });
    try {
      final results = await widget.controller.searchAssets(value);
      if (!mounted) return;
      setState(() {
        _results = results;
        _searching = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _searchError = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    final query = _query.text.trim().toLowerCase();
    final held = [
      for (final h in widget.holdings)
        if (query.isEmpty ||
            h.asset.name.toLowerCase().contains(query) ||
            (h.asset.symbol ?? '').toLowerCase().contains(query))
          h,
    ];

    return AppSheet(
      title: copy.chooseInstrument,
      subtitle: widget.allowSearch
          ? copy.buyInstrumentPickerSubtitle
          : copy.sellInstrumentPickerSubtitle,
      children: [
        SearchField(
          controller: _query,
          hintText: widget.allowSearch
              ? copy.searchByNameOrSymbol
              : copy.filterYourHoldings,
          onChanged: _onQueryChanged,
        ),
        const SizedBox(height: 14),
        if (held.isNotEmpty) ...[
          _sectionLabel(c, copy.yourHoldings),
          for (final h in held)
            _row(
              c,
              title: h.asset.symbol == null
                  ? h.asset.name
                  : copy.symbolValue(h.asset.symbol!),
              subtitle: copy.holdingPickerCaption(
                h.asset.name,
                h.quantity,
                h.asset.quantityUnit,
              ),
              onTap: () => Navigator.of(context).pop(h),
            ),
        ],
        if (widget.allowSearch) ...[
          const SizedBox(height: 10),
          _sectionLabel(c, copy.searchResults),
          if (_searching)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else if (_searchError != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(
                _searchError!,
                style: TextStyle(color: c.negative, fontSize: 13),
              ),
            )
          else if (_query.text.trim().length < 2)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(
                copy.typeTwoCharacters,
                style: TextStyle(color: c.inkMuted, fontSize: 13),
              ),
            )
          else if (_results.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(
                copy.noInstrumentsMatched,
                style: TextStyle(color: c.inkMuted, fontSize: 13),
              ),
            )
          else
            for (final r in _results)
              _row(
                c,
                title: copy.symbolValue(r.symbol),
                subtitle: copy.assetSearchCaption(
                  r.name,
                  r.exchange,
                  r.currencyCode,
                ),
                onTap: () => Navigator.of(context).pop(r),
              ),
        ] else if (held.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(
              copy.noOpenHoldingsToSell,
              style: TextStyle(color: c.inkMuted, fontSize: 13),
            ),
          ),
      ],
    );
  }

  Widget _sectionLabel(AppColors c, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: TextStyle(
        color: c.inkMuted,
        fontSize: 11,
        letterSpacing: 1,
        fontWeight: FontWeight.w700,
      ),
    ),
  );

  Widget _row(
    AppColors c, {
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(12),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: c.ink,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: c.inkMuted, fontSize: 12),
          ),
        ],
      ),
    ),
  );
}
