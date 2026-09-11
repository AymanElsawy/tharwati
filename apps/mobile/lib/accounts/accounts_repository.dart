import 'package:supabase_flutter/supabase_flutter.dart';

import 'account_form.dart';
import 'account_models.dart';

/// Raised for account reads/mutations; [message] is already user-facing (port of
/// the web `RepositoryError` + `createAccount`/`updateAccount` friendly-error
/// translation, docs/accounts.md §4, §5).
class AccountsException implements Exception {
  AccountsException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Every `financial_accounts` numeric column is `::text` cast so exact decimal
/// precision survives the wire (docs/accounts.md §2.4).
const _accountSelect =
    'id,user_id,account_type_code,name,currency_code,opening_balance::text,'
    'is_active,notes,bank_subtype,credit_card_limit::text,due_day_of_month,'
    'investment_type,balance_grams::text,property_type,'
    'ownership_percentage::text,business_type,industry,location,metal_type,'
    'purity,purchase_date,cost_per_unit::text,closed_reason,closed_on,'
    'created_at,updated_at';

class AccountsRepository {
  AccountsRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;
  String get _userId => _client.auth.currentUser!.id;

  // ---- reads --------------------------------------------------------------

  Future<List<Account>> getAccounts() async {
    final rows = await _client
        .from('financial_accounts')
        .select(_accountSelect)
        .eq('user_id', _userId)
        .order('created_at', ascending: false);
    return (rows as List)
        .map((r) => Account.fromRow((r as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Account> getAccount(String id) async {
    try {
      final row = await _client
          .from('financial_accounts')
          .select(_accountSelect)
          .eq('id', id)
          .eq('user_id', _userId)
          .single();
      return Account.fromRow((row).cast<String, dynamic>());
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  Future<List<AccountBalance>> getAccountBalances(List<String> ids) async {
    if (ids.isEmpty) return const [];
    final rows = await _client.rpc(
      'get_account_balances',
      params: {'p_account_ids': ids},
    );
    return (rows as List)
        .map((r) => AccountBalance.fromRow((r as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<AccountValuation>> getEffectiveValuations(
    List<String> ids,
  ) async {
    if (ids.isEmpty) return const [];
    final rows = await _client.rpc(
      'get_effective_account_valuations',
      params: {'p_account_ids': ids},
    );
    // Ordered valued_on desc, created_at desc — first row per account is latest.
    return (rows as List)
        .map(
          (r) => AccountValuation.fromRow((r as Map).cast<String, dynamic>()),
        )
        .toList();
  }

  Future<List<AccountLifecycle>> getLifecycleEligibility(
    List<String> ids,
  ) async {
    if (ids.isEmpty) return const [];
    final rows = await _client.rpc(
      'get_account_lifecycle_eligibility',
      params: {'p_account_ids': ids},
    );
    return (rows as List)
        .map(
          (r) => AccountLifecycle.fromRow((r as Map).cast<String, dynamic>()),
        )
        .toList();
  }

  // ---- mutations --------------------------------------------------------

  Future<Account> createAccount(AccountFormValues v) async {
    final fields = toAccountTypeSpecificFields(v);
    final name = _accountName(v);
    try {
      if (v.type.isValued) {
        // Real Estate / Business are created atomically with their first
        // valuation via the dedicated RPC (docs/accounts.md §2.1).
        final row = await _client.rpc(
          'create_valued_account',
          params: {
            'p_account_type_code': v.type.code,
            'p_name': name,
            'p_currency_code': v.currencyCode,
            'p_property_type': fields.propertyType,
            'p_business_type': fields.businessType,
            'p_industry': fields.industry,
            'p_ownership_percentage': v.ownershipPercentage.trim(),
            'p_location': fields.location,
            'p_account_notes': _blankToNull(v.notes),
            'p_valuation_amount': v.openingBalance.trim(),
            'p_valued_on': v.valuationDate.trim(),
            // Free-text method, sent verbatim (web `p_valuation_method`).
            'p_valuation_method': _blankToNull(v.valuationMethod),
            'p_valuation_notes': _blankToNull(v.valuationNotes),
          },
        );
        final id = row is Map ? '${row['id']}' : '$row';
        return getAccount(id);
      }

      final columns = fields.toColumns(name: name, currencyCode: v.currencyCode)
        ..['user_id'] = _userId
        ..['account_type_code'] = v.type.code
        ..['notes'] = _blankToNull(v.notes);
      final row = await _client
          .from('financial_accounts')
          .insert(columns)
          .select(_accountSelect)
          .single();
      return Account.fromRow((row).cast<String, dynamic>());
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  Future<Account> updateAccount(String id, AccountFormValues v) async {
    final fields = toAccountTypeSpecificFields(v);
    final columns = fields.toColumns(name: _accountName(v))
      ..['notes'] = _blankToNull(v.notes);
    // currency_code / opening_balance stay editable only without history; the DB
    // triggers enforce that and _friendly surfaces the message.
    if (!v.type.isValued) columns['currency_code'] = v.currencyCode;
    try {
      final row = await _client
          .from('financial_accounts')
          .update(columns)
          .eq('id', id)
          .eq('user_id', _userId)
          .select(_accountSelect)
          .single();
      return Account.fromRow((row).cast<String, dynamic>());
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  Future<void> closeAccount(String id) =>
      _lifecycleRpc('close_financial_account', id);
  Future<void> reopenAccount(String id) =>
      _lifecycleRpc('reopen_financial_account', id);
  Future<void> deleteAccount(String id) =>
      _lifecycleRpc('delete_pristine_financial_account', id);

  Future<void> _lifecycleRpc(String fn, String id) async {
    try {
      await _client.rpc(fn, params: {'p_account_id': id});
    } on PostgrestException catch (e) {
      throw AccountsException(_friendly(e));
    }
  }

  /// Gold/silver accounts are always auto-named "Gold" / "Silver" (§4, §9.1).
  static String _accountName(AccountFormValues v) {
    if (v.type == AccountType.gold) {
      return v.metalType == 'silver' ? 'Silver' : 'Gold';
    }
    return v.name.trim();
  }

  static Object? _blankToNull(String? s) =>
      (s == null || s.trim().isEmpty) ? null : s.trim();

  static String _friendly(PostgrestException e) {
    final code = e.code ?? '';
    final message = e.message;
    if (code == 'PGRST116' ||
        code == 'P0002' ||
        message.contains('account not found')) {
      return 'That account is no longer available.';
    }
    if (code == '23505') {
      if (message.contains('user_currency_metal_type')) {
        return 'You already have this type of Gold/Silver account in this '
            'currency. Go to that account and add a purchase instead of '
            'creating a new one.';
      }
      return 'An account with this name already exists.';
    }
    if (code == '23514') {
      if (message.contains('account_close_blocked')) {
        return _lifecycleReason(message, 'close');
      }
      if (message.contains('account_delete_blocked')) {
        return _lifecycleReason(message, 'delete');
      }
      if (message.contains('account_reopen_blocked')) {
        return 'A sold account can’t be reopened.';
      }
      if (message.contains('currency cannot be changed')) {
        return 'This account already has financial history — its currency '
            'can’t be changed.';
      }
      if (message.contains('opening balance')) {
        return 'This account already has financial history — its opening '
            'balance can’t be changed.';
      }
      if (message.contains('ownership')) {
        return 'This account already has history — ownership is managed by the '
            'disposal timeline.';
      }
      return 'That change isn’t allowed for this account.';
    }
    if (code == '42501') return 'You don’t have permission to do that.';
    return 'Something went wrong. Please try again.';
  }

  static String _lifecycleReason(String message, String verb) {
    final reason = message.split(':').last.trim();
    final human = switch (reason) {
      'nonzero_balance' || 'nonzero_value' => 'the balance must be zero first',
      'nonzero_amount_due' => 'the amount due must be zero first',
      'remaining_metal_quantity' => 'sell or move the remaining metal first',
      'has_positive_holdings' ||
      'brokerage_has_value' => 'clear the holdings and available cash first',
      'ownership_remaining' ||
      'real_estate_business' => 'use the full-sale flow instead',
      'has_financial_history' ||
      'not_pristine' => 'it already has financial history',
      _ => 'it isn’t eligible',
    };
    return 'This account can’t be ${verb}d — $human.';
  }
}
