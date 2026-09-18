import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/local_datetime.dart';
import '../../i18n/accounts_copy.dart';
import '../../i18n/app_language.dart';
import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/primary_button.dart';
import '../account_models.dart';
import 'brokerage_controller.dart';
import 'brokerage_models.dart';
import 'trade_sheet.dart';

class ExistingHoldingSheet extends StatefulWidget {
  const ExistingHoldingSheet({
    super.key,
    required this.controller,
    required this.account,
  });

  final BrokerageController controller;
  final Account account;

  @override
  State<ExistingHoldingSheet> createState() => _ExistingHoldingSheetState();
}

class _ExistingHoldingSheetState extends State<ExistingHoldingSheet> {
  late final ExistingHoldingFormValues _values = ExistingHoldingFormValues(
    occurredAt: formatLocalDateTimeInput(),
  );
  final _quantity = TextEditingController();
  final _averageCost = TextEditingController();
  final _rate = TextEditingController();
  final _notes = TextEditingController();
  Asset? _asset;
  bool _submitted = false;
  Map<String, String> _errors = const {};

  bool get _crossCurrency =>
      _asset != null && _asset!.currencyCode != widget.account.currencyCode;

  @override
  void dispose() {
    _quantity.dispose();
    _averageCost.dispose();
    _rate.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _sync() {
    _values
      ..quantity = _quantity.text.trim()
      ..averageCost = _averageCost.text.trim()
      ..notes = _notes.text
      ..accountFxRate = _crossCurrency ? _rate.text.trim() : null;
  }

  Future<void> _pickAsset() async {
    final picked = await showAppSheet<Object>(
      context,
      builder: (_) => BrokerageAssetPickerSheet(
        controller: widget.controller,
        holdings: widget.controller.sellableHoldings,
        allowSearch: true,
      ),
    );
    if (picked == null || !mounted) return;
    if (picked is Holding) {
      setState(() {
        _asset = picked.asset;
        _values.assetId = picked.assetId;
      });
      return;
    }
    if (picked is AssetSearchResult) {
      final id = await widget.controller.resolveAsset(picked);
      if (id == null || !mounted) return;
      setState(() {
        _values.assetId = id;
        _asset = Asset(
          id: id,
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
    final current = DateTime.tryParse(_values.occurredAt) ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(current),
    );
    if (!mounted) return;
    setState(() {
      _values.occurredAt = formatLocalDateTimeInput(
        DateTime(
          date.year,
          date.month,
          date.day,
          time?.hour ?? current.hour,
          time?.minute ?? current.minute,
        ),
      );
    });
  }

  Future<void> _submit() async {
    _sync();
    final errors = validateExistingHolding(
      _values,
      crossCurrency: _crossCurrency,
    );
    setState(() {
      _submitted = true;
      _errors = errors;
    });
    if (errors.isNotEmpty) return;
    if (await widget.controller.addExistingHolding(_values) && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  String? _error(String key, AccountsCopy copy) =>
      _submitted ? copy.existingHoldingValidation(_errors[key]) : null;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final c = context.colors;
      final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
      _sync();
      final assetCurrency = _asset?.currencyCode ?? widget.account.currencyCode;
      return AppSheet(
        title: copy.addExistingHolding,
        subtitle: copy.addExistingHoldingSubtitle,
        children: [
          SheetField(
            label: copy.instrument,
            error: _error('assetId', copy),
            child: InkWell(
              onTap: widget.controller.busy ? null : _pickAsset,
              borderRadius: BorderRadius.circular(AppRadius.field),
              child: SheetBox(
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _asset == null
                            ? copy.searchOrChooseHolding
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
          if (widget.controller.actionError != null)
            Text(
              widget.controller.actionError!,
              style: TextStyle(color: c.negative, fontSize: 13),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: SheetField(
                  label: copy.quantity,
                  error: _error('quantity', copy),
                  child: _number(_quantity, '0'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SheetField(
                  label: copy.historicalAverageCost,
                  hint: copy.currencyValue(assetCurrency),
                  error: _error('averageCost', copy),
                  child: _number(_averageCost, '0.00'),
                ),
              ),
            ],
          ),
          if (_crossCurrency)
            SheetField(
              label: copy.historicalExchangeRate(
                assetCurrency,
                widget.account.currencyCode,
              ),
              error: _error('accountFxRate', copy),
              child: _number(_rate, '0.00'),
            ),
          SheetField(
            label: copy.dateTime,
            error: _error('occurredAt', copy),
            child: InkWell(
              onTap: widget.controller.busy ? null : _pickDateTime,
              borderRadius: BorderRadius.circular(AppRadius.field),
              child: SheetBox(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _values.occurredAt.replaceFirst('T', '  '),
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
                enabled: !widget.controller.busy,
                decoration: InputDecoration(hintText: copy.optional),
              ),
            ),
          ),
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
                  label: copy.recordExistingHolding,
                  busy: widget.controller.busy,
                  onPressed: widget.controller.busy ? null : _submit,
                ),
              ),
            ],
          ),
        ],
      );
    },
  );

  Widget _number(TextEditingController controller, String hint) => SheetBox(
    child: TextField(
      controller: controller,
      enabled: !widget.controller.busy,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      textDirection: TextDirection.ltr,
      onChanged: (_) => setState(_sync),
      decoration: InputDecoration(hintText: hint),
      style: TextStyle(color: context.colors.ink, fontSize: 15),
    ),
  );
}
