import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/local_datetime.dart';
import '../../core/money_format.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import 'brokerage_controller.dart';
import 'brokerage_models.dart';
import 'brokerage_valuation.dart';

/// Record a dividend — port of the web `BrokerageDividendDialog`. Three
/// settlements: paid as cash, fully reinvested, or partly reinvested with the
/// remainder left as cash. Each maps to its own RPC.
class DividendSheet extends StatefulWidget {
  const DividendSheet({
    super.key,
    required this.controller,
    required this.account,
    this.presetAssetId,
  });

  final BrokerageController controller;
  final Account account;
  final String? presetAssetId;

  @override
  State<DividendSheet> createState() => _DividendSheetState();
}

class _DividendSheetState extends State<DividendSheet> {
  DividendMode _mode = DividendMode.cash;
  String _assetId = '';
  Asset? _asset;
  String _occurredAt = formatLocalDateTimeInput();

  final _gross = TextEditingController();
  final _tax = TextEditingController(text: '0');
  final _fees = TextEditingController(text: '0');
  final _unitPrice = TextEditingController();
  final _reinvested = TextEditingController();
  final _notes = TextEditingController();

  bool _submitted = false;
  Map<String, String> _errors = const {};

  @override
  void initState() {
    super.initState();
    _select(widget.presetAssetId);
  }

  @override
  void dispose() {
    _gross.dispose();
    _tax.dispose();
    _fees.dispose();
    _unitPrice.dispose();
    _reinvested.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _select(String? assetId) {
    if (assetId == null || assetId.isEmpty) return;
    final holding = widget.controller.holdingForAsset(assetId);
    if (holding == null) return;
    setState(() {
      _assetId = assetId;
      _asset = holding.asset;
      final last = widget.controller.lastPriceFor(assetId);
      if (last != null && _unitPrice.text.isEmpty) _unitPrice.text = last;
    });
  }

  bool get _currencyMatches =>
      _asset == null || _asset!.currencyCode == widget.account.currencyCode;

  Future<void> _pickAsset() async {
    final holdings = widget.controller.sellableHoldings;
    if (holdings.isEmpty) return;
    final picked = await showModalBottomSheet<Holding>(
      context: context,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 12),
          children: [
            for (final h in holdings)
              ListTile(
                title: Text(h.asset.symbol ?? h.asset.name),
                subtitle: Text(h.asset.name),
                trailing: Text(h.asset.currencyCode),
                onTap: () => Navigator.of(context).pop(h),
              ),
          ],
        ),
      ),
    );
    if (picked != null) _select(picked.assetId);
  }

  Future<void> _pickDateTime() async {
    final current = DateTime.tryParse(_occurredAt) ?? DateTime.now();
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
    setState(
      () => _occurredAt = formatLocalDateTimeInput(
        DateTime(
          date.year,
          date.month,
          date.day,
          time?.hour ?? current.hour,
          time?.minute ?? current.minute,
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final errs = validateDividend(
      mode: _mode,
      assetId: _assetId,
      gross: _gross.text,
      tax: _tax.text,
      fees: _fees.text,
      occurredAt: _occurredAt,
      unitPrice: _unitPrice.text,
      reinvestedAmount: _reinvested.text,
      currencyMatches: _currencyMatches,
    );
    setState(() {
      _submitted = true;
      _errors = errs;
    });
    if (errs.isNotEmpty) return;
    final ok = await widget.controller.submitDividend(
      assetId: _assetId,
      mode: _mode,
      gross: _gross.text,
      tax: _tax.text,
      fees: _fees.text,
      occurredAt: _occurredAt,
      notes: _notes.text,
      unitPrice: _unitPrice.text,
      reinvestedAmount: _reinvested.text,
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
        final currency = widget.account.currencyCode;
        final preview = previewDividend(
          mode: _mode,
          gross: _gross.text,
          tax: _tax.text,
          fees: _fees.text,
          unitPrice: _unitPrice.text,
          reinvestedAmount: _reinvested.text,
        );
        final reinvesting = _mode != DividendMode.cash;

        return AppSheet(
          title: switch (_mode) {
            DividendMode.cash => 'Dividend',
            DividendMode.full => 'Reinvest dividend',
            DividendMode.partial => 'Partially reinvest dividend',
          },
          subtitle:
              'Recorded in the account currency. Tax and fees come out of the '
              'gross amount.',
          children: [
            SheetField(
              label: 'Settlement',
              child: _ModeToggle(
                mode: _mode,
                onChanged: (m) => setState(() => _mode = m),
              ),
            ),
            SheetField(
              label: 'Instrument',
              error: _err('assetId'),
              child: InkWell(
                onTap: widget.controller.busy ? null : _pickAsset,
                borderRadius: BorderRadius.circular(AppRadius.field),
                child: SheetBox(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _asset == null
                              ? 'Choose a holding'
                              : '${_asset!.symbol ?? _asset!.name} · ${_asset!.name}',
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
            SheetField(
              label: 'Gross dividend',
              hint: currency,
              error: _err('gross'),
              child: _num(_gross, '0.00'),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: SheetField(
                    label: 'Withholding tax',
                    error: _err('tax'),
                    child: _num(_tax, '0.00'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SheetField(
                    label: 'Fees',
                    error: _err('fees'),
                    child: _num(_fees, '0.00'),
                  ),
                ),
              ],
            ),
            if (_mode == DividendMode.partial)
              SheetField(
                label: 'Amount reinvested',
                hint: 'The rest stays as cash',
                error: _err('reinvestedAmount'),
                child: _num(_reinvested, '0.00'),
              ),
            if (reinvesting)
              SheetField(
                label: 'Reinvestment price per unit',
                hint: _asset?.currencyCode ?? currency,
                error: _err('unitPrice'),
                child: _num(_unitPrice, '0.00'),
              ),
            SheetField(
              label: 'Date & time',
              error: _err('occurredAt'),
              child: InkWell(
                onTap: _pickDateTime,
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
            Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                color: c.fieldFill,
                border: Border.all(color: c.line),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                children: [
                  _row(c, 'Gross', MoneyFormat.money(preview.gross, currency)),
                  const SizedBox(height: 6),
                  _row(c, 'Tax', MoneyFormat.money(preview.tax, currency)),
                  const SizedBox(height: 6),
                  _row(c, 'Fees', MoneyFormat.money(preview.fees, currency)),
                  const SizedBox(height: 6),
                  _row(
                    c,
                    'Net dividend',
                    MoneyFormat.money(preview.net, currency),
                    strong: true,
                  ),
                  if (_mode == DividendMode.partial) ...[
                    const SizedBox(height: 6),
                    _row(
                      c,
                      'Cash remainder',
                      MoneyFormat.money(preview.cashRemainder, currency),
                    ),
                  ],
                  if (reinvesting) ...[
                    const SizedBox(height: 6),
                    _row(
                      c,
                      'Units added',
                      preview.quantityAdded == null
                          ? '—'
                          : trimTrailingZeros(preview.quantityAdded!),
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
                    label: 'Record dividend',
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
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(hintText: hint),
      style: TextStyle(
        color: context.colors.ink,
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
    ),
  );

  Widget _row(AppColors c, String label, String value, {bool strong = false}) =>
      Row(
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

/// Trims a computed quantity to something readable without losing meaning.
String trimTrailingZeros(String value) {
  if (!value.contains('.')) return value;
  var trimmed = value.replaceFirst(RegExp(r'0+$'), '');
  if (trimmed.endsWith('.')) trimmed = trimmed.substring(0, trimmed.length - 1);
  return trimmed.isEmpty ? '0' : trimmed;
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({required this.mode, required this.onChanged});

  final DividendMode mode;
  final ValueChanged<DividendMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    const items = [
      (DividendMode.cash, 'Cash'),
      (DividendMode.full, 'Reinvest all'),
      (DividendMode.partial, 'Partial'),
    ];
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.fieldFill,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.field),
      ),
      child: Row(
        children: [
          for (final (value, label) in items)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(value),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                    color: mode == value ? c.surface : null,
                    borderRadius: BorderRadius.circular(9),
                    border: mode == value ? Border.all(color: c.accent) : null,
                  ),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: mode == value ? c.accent : c.inkMuted,
                      fontSize: 13,
                      fontWeight: mode == value
                          ? FontWeight.w700
                          : FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
