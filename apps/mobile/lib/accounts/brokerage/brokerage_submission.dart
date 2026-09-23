import 'dart:convert';
import '../../core/decimals.dart';
import '../../core/local_datetime.dart';
import 'brokerage_models.dart';
import 'brokerage_valuation.dart';

String brokerageTradeFingerprint(String accountId, TradeFormValues v) =>
    jsonEncode([
      v.side.name,
      accountId,
      v.assetId,
      D.normalize(v.quantity),
      D.normalize(v.unitPrice),
      localDateTimeInputToIso(v.occurredAt),
      v.notes.trim().isEmpty ? null : v.notes.trim(),
      D.normalize(v.fees.trim().isEmpty ? '0' : v.fees),
      D.normalize(v.accountFxRate),
    ]);

String brokerageDividendFingerprint({
  required String accountId,
  required String assetId,
  required DividendMode mode,
  required String gross,
  required String tax,
  required String fees,
  required String occurredAt,
  String? notes,
  String? unitPrice,
  String? reinvestedAmount,
}) => jsonEncode([
  mode.name,
  accountId,
  assetId,
  D.normalize(gross),
  D.normalize(tax.trim().isEmpty ? '0' : tax),
  D.normalize(fees.trim().isEmpty ? '0' : fees),
  localDateTimeInputToIso(occurredAt),
  notes?.trim().isEmpty == false ? notes!.trim() : null,
  mode == DividendMode.cash ? null : D.normalize(unitPrice),
  mode == DividendMode.partial ? D.normalize(reinvestedAmount) : null,
]);
