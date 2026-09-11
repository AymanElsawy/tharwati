import 'package:supabase_flutter/supabase_flutter.dart';

import 'account_models.dart';
import 'accounts_repository.dart';
import 'metal_purchase_form.dart';

/// Gold/silver "buy more" via `add_metal_purchase`, and effective purchase
/// history via `get_effective_metal_purchases` (docs/accounts.md §2.3, §5).
/// The RPC's account-row response is ignored — history is always re-read (§9.8).
class MetalPurchasesRepository {
  MetalPurchasesRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  /// The shared purchase payload — `add_metal_purchase` and
  /// `correct_metal_purchase` take the same fields, differing only in whether
  /// they are keyed by account or by the purchase being replaced.
  static Map<String, dynamic> _purchaseParams(MetalPurchaseFormValues v) => {
    'p_purity': v.purity,
    'p_occurred_at': DateTime.parse(v.purchaseDate).toUtc().toIso8601String(),
    'p_quantity_grams': v.unitsGrams.trim(),
    'p_cost_per_unit': v.costPerUnit.trim(),
    'p_funding_mode': v.paidFromAccount ? 'cash_account' : 'external',
    'p_funding_account_id': v.paidFromAccount && v.fundingAccountId.isNotEmpty
        ? v.fundingAccountId
        : null,
    'p_fees': v.fees.trim().isEmpty ? '0' : v.fees.trim(),
    'p_notes': v.notes.trim().isEmpty ? null : v.notes.trim(),
  };

  Future<void> addPurchase(String accountId, MetalPurchaseFormValues v) => _rpc(
    'add_metal_purchase',
    {'p_account_id': accountId, ..._purchaseParams(v)},
  );

  /// Supersedes a purchase with corrected figures. The RPC writes a new
  /// effective row and links the old one, so history stays append-only —
  /// nothing is mutated in place.
  Future<void> correctPurchase(String purchaseId, MetalPurchaseFormValues v) =>
      _rpc('correct_metal_purchase', {
        'p_purchase_id': purchaseId,
        ..._purchaseParams(v),
      });

  /// Backs a purchase out, releasing any funding-account debit with it.
  Future<void> reversePurchase(String purchaseId) =>
      _rpc('reverse_metal_purchase', {'p_purchase_id': purchaseId});

  Future<void> _rpc(String fn, Map<String, dynamic> params) async {
    try {
      await _client.rpc(fn, params: params);
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  /// Effective purchases (reversed / corrected rows filtered out), newest first.
  Future<List<MetalPurchase>> getPurchaseHistory(
    List<String> accountIds,
  ) async {
    if (accountIds.isEmpty) return const [];
    final rows = await _client.rpc(
      'get_effective_metal_purchases',
      params: {'p_account_ids': accountIds},
    );
    return (rows as List)
        .map((r) => MetalPurchase.fromRow((r as Map).cast<String, dynamic>()))
        .toList();
  }

  static String _friendly(PostgrestException e) {
    final m = e.message;
    if (m.contains('funding account currency must match')) {
      return 'The funding account must be in the same currency as this metal '
          'account.';
    }
    if (m.contains('insufficient') || m.contains('available')) {
      return 'That funding account doesn’t have enough available balance.';
    }
    if (m.contains('purity')) return 'That purity isn’t valid for this metal.';
    if (m.contains('grams must be positive')) {
      return 'Enter a positive number of grams.';
    }
    if (m.contains('cost per unit must be positive')) {
      return 'Enter a cost per gram greater than zero.';
    }
    if (m.contains('does not exist')) {
      return 'This metal account is no longer available.';
    }
    if (m.contains('already reversed') || m.contains('already corrected')) {
      return 'This purchase has already been changed. Reload and try again.';
    }
    if (m.contains('not effective') || m.contains('superseded')) {
      return 'This purchase is no longer the current version. Reload and try '
          'again.';
    }
    return 'Couldn’t record the purchase. Please try again.';
  }
}
