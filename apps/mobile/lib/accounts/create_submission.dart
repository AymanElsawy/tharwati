import 'dart:convert';
import '../core/decimals.dart';

const _decimals = {
  'p_balance_grams',
  'p_quantity_grams',
  'p_cost_per_unit',
  'p_fees',
  'p_quantity',
  'p_average_cost',
  'p_account_fx_rate',
  'p_valuation_amount',
  'p_opening_balance',
  'p_credit_card_limit',
  'p_ownership_percentage',
};

String createFingerprint(Map<String, dynamic> payload) {
  final keys = payload.keys.toList()..sort();
  return jsonEncode([
    for (final key in keys) [key, _normalize(key, payload[key])],
  ]);
}

Object? _normalize(String key, Object? value) {
  if (value is! String) return value;
  var text = value.trim();
  if (text.isEmpty) return null;
  if (_decimals.contains(key)) return D.normalize(text);
  if (key == 'p_purity') text = text.toLowerCase();
  if (key == 'p_valuation_method' && text.startsWith('other:')) {
    text = 'other:${text.substring(6).trim()}';
  }
  return text;
}
