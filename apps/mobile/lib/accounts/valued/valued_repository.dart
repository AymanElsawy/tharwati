import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/decimals.dart';
import '../accounts_repository.dart' show AccountsException;
import 'valued_models.dart';

/// RPC layer for Real Estate / Business valuations + disposals — 1:1 with the
/// web `account-valuations.service.ts` / `account-disposals.service.ts`.
class ValuedRepository {
  ValuedRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  // ---- valuations ---------------------------------------------------

  Future<List<AccountValuationEntry>> getEffectiveValuations(String id) async {
    final rows = await _client.rpc(
      'get_effective_account_valuations',
      params: {
        'p_account_ids': [id],
      },
    );
    // Ordered valued_on desc, created_at desc — newest first.
    return [
      for (final r in rows as List)
        AccountValuationEntry.fromRow((r as Map).cast<String, dynamic>()),
    ];
  }

  Future<void> addValuation(String accountId, AccountValuationInput v) =>
      _rpc('add_account_valuation', {
        'p_account_id': accountId,
        'p_valuation_amount': v.valuationAmount,
        'p_valued_on': v.valuedOn,
        'p_valuation_method': v.valuationMethod,
        'p_notes': v.notes,
      });

  Future<void> correctValuation(String valuationId, AccountValuationInput v) =>
      _rpc('correct_account_valuation', {
        'p_valuation_id': valuationId,
        'p_valuation_amount': v.valuationAmount,
        'p_valued_on': v.valuedOn,
        'p_valuation_method': v.valuationMethod,
        'p_notes': v.notes,
      });

  // ---- disposals + ownership -------------------------------------

  Future<AccountOwnershipProjection?> getCurrentOwnership(String id) async {
    final rows = await _client.rpc(
      'get_account_current_ownership',
      params: {
        'p_account_ids': [id],
      },
    );
    final list = rows as List;
    if (list.isEmpty) return null;
    return AccountOwnershipProjection.fromRow(
      (list.first as Map).cast<String, dynamic>(),
    );
  }

  Future<List<AccountDisposal>> getDisposals(String id) async {
    final rows = await _client.rpc(
      'get_account_disposals',
      params: {
        'p_account_ids': [id],
      },
    );
    return [
      for (final r in rows as List)
        AccountDisposal.fromRow((r as Map).cast<String, dynamic>()),
    ];
  }

  Future<void> addDisposal(String accountId, AddAccountDisposalInput v) =>
      _rpc('add_account_disposal', {
        'p_account_id': accountId,
        'p_disposed_on': v.disposedOn,
        'p_sale_amount': v.saleAmount,
        'p_sale_currency_code': v.saleCurrencyCode,
        'p_ownership_percentage_sold': v.ownershipPercentageSold,
        'p_idempotency_key': v.idempotencyKey,
        'p_notes': v.notes,
        'p_destination_account_id': v.destinationAccountId,
      });

  Future<void> _rpc(String fn, Map<String, dynamic> params) async {
    try {
      await _client.rpc(fn, params: params);
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  static String _friendly(PostgrestException e) {
    final m = e.message.toLowerCase();
    if (m.contains('future')) return 'That date can’t be in the future.';
    if (m.contains('ownership')) {
      return 'The ownership percentage isn’t valid for this account.';
    }
    if (e.code == '42501') return 'You don’t have permission to do that.';
    return e.message;
  }
}

/// Attributable value = full valuation × ownership% ÷ 100 (web
/// `attributableValuation`).
String? attributableValuation(
  AccountValuationEntry? valuation,
  String? ownershipPercentage,
) {
  if (valuation == null || ownershipPercentage == null) return null;
  final product = D.multiply(valuation.valuationAmount, ownershipPercentage);
  return product == null ? null : D.divide(product, '100', scale: 2);
}
