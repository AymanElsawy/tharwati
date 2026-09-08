import 'package:supabase_flutter/supabase_flutter.dart';

import 'account_summary.dart';
import 'dashboard_snapshot.dart';

enum DashboardErrorKind {
  /// No `profiles.base_currency_code` yet — the user must finish onboarding.
  noBaseCurrency,

  /// The `dashboard-valuation` Edge Function or a table read failed.
  unavailable,
}

class DashboardException implements Exception {
  DashboardException(this.kind, {this.reason});

  final DashboardErrorKind kind;
  final String? reason;

  @override
  String toString() => 'DashboardException($kind, reason: $reason)';
}

/// Reads everything the dashboard needs. The heavy valuation (market prices,
/// metals, FX resolution, per-account current value) stays server-side in the
/// `dashboard-valuation` Edge Function — this just invokes it and reads the
/// account metadata the client-side aggregate groups by.
class DashboardRepository {
  DashboardRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  static const _accountSelect =
      'id,account_type_code,name,currency_code,opening_balance::text,'
      'is_active,bank_subtype,credit_card_limit::text,metal_type';

  Future<String?> fetchBaseCurrency() async {
    final row = await _client
        .from('profiles')
        .select('base_currency_code')
        .eq('id', _client.auth.currentUser!.id)
        .single();
    final code = row['base_currency_code'] as String?;
    return (code != null && code.isNotEmpty) ? code : null;
  }

  Future<List<AccountSummary>> fetchAccounts() async {
    final rows = await _client
        .from('financial_accounts')
        .select(_accountSelect)
        .eq('is_active', true);
    return (rows as List)
        .map((r) => AccountSummary.fromRow((r as Map).cast<String, dynamic>()))
        .toList();
  }

  /// Invokes the shared `dashboard-valuation` Edge Function and parses its
  /// snapshot. The Edge Function serves a 15-minute per-user/base-currency
  /// server cache, so repeat calls are cheap.
  Future<DashboardSnapshot> fetchSnapshot() async {
    try {
      final response = await _client.functions.invoke('dashboard-valuation');
      return DashboardSnapshot.parse(response.data);
    } on FunctionException catch (e) {
      final details = e.details;
      final reason = details is Map ? details['reason'] as String? : null;
      if (e.status == 422) {
        throw DashboardException(DashboardErrorKind.noBaseCurrency);
      }
      throw DashboardException(DashboardErrorKind.unavailable, reason: reason);
    } catch (e) {
      throw DashboardException(
        DashboardErrorKind.unavailable,
        reason: e.toString(),
      );
    }
  }
}
