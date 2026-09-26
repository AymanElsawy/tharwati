import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/decimals.dart';
import '../../core/read_deadline.dart';
import '../../dashboard/logic/dashboard_aggregate.dart';
import '../domain/wealth_target_allocation.dart';

abstract interface class WealthAllocationTargetsStore {
  Future<WealthTargetPlan> load();
  Future<void> replace(WealthTargetPlan plan);
}

const _groupByStorageClass = <String, AssetGroup>{
  'cash_and_bank': AssetGroup.cashAndBank,
  'brokerage': AssetGroup.brokerage,
  'gold_and_silver': AssetGroup.goldAndSilver,
  'real_estate': AssetGroup.realEstate,
  'business': AssetGroup.business,
  'other': AssetGroup.other,
};

const _storageClassByGroup = <AssetGroup, String>{
  AssetGroup.cashAndBank: 'cash_and_bank',
  AssetGroup.brokerage: 'brokerage',
  AssetGroup.goldAndSilver: 'gold_and_silver',
  AssetGroup.realEstate: 'real_estate',
  AssetGroup.business: 'business',
  AssetGroup.other: 'other',
};

/// PostgREST may decode PostgreSQL numeric as either a JSON number or string.
/// This boundary converts both into the app's canonical decimal-string type.
String normalizePostgrestDecimal(Object? value, String fieldName) {
  final raw = switch (value) {
    String string => string,
    num number when number.isFinite => number.toString(),
    _ => throw FormatException('$fieldName is not a finite decimal value'),
  };
  final normalized = D.normalize(raw);
  if (normalized == null) {
    throw FormatException('$fieldName is not a finite decimal value');
  }
  return normalized;
}

WealthTargetPlan mapStoredWealthTargetPlan(
  List<Map<String, dynamic>> rows,
  Map<String, dynamic>? preference,
) {
  final targets = rows
      .map((row) {
        final assetClass = _groupByStorageClass[row['asset_class']];
        if (assetClass == null) {
          throw const FormatException('Unknown wealth target asset class');
        }
        return WealthTarget(
          assetClass: assetClass,
          percentage: normalizePostgrestDecimal(
            row['target_percentage'],
            'target_percentage',
          ),
        );
      })
      .toList(growable: false);
  return WealthTargetPlan(
    targets: targets,
    tolerancePercentage: preference?['tolerance_percentage'] == null
        ? '0'
        : normalizePostgrestDecimal(
            preference!['tolerance_percentage'],
            'tolerance_percentage',
          ),
  );
}

class WealthAllocationTargetsRepository
    implements WealthAllocationTargetsStore {
  WealthAllocationTargetsRepository([SupabaseClient? client])
    : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  String get _userId {
    final user = _client.auth.currentUser;
    if (user == null) throw StateError('No authenticated user.');
    return user.id;
  }

  @override
  Future<WealthTargetPlan> load() async {
    return readWithDeadline(simpleReadDeadline, (abort) async {
      final userId = _userId;
      final rawTargets = await _client
          .from('wealth_allocation_targets')
          .select('asset_class,target_percentage')
          .eq('user_id', userId)
          .order('asset_class')
          .abortSignal(abort);
      final rawPreference = await _client
          .from('wealth_allocation_target_preferences')
          .select('tolerance_percentage')
          .eq('user_id', userId)
          .maybeSingle()
          .abortSignal(abort);
      return mapStoredWealthTargetPlan(
        (rawTargets as List)
            .map((row) => (row as Map).cast<String, dynamic>())
            .toList(growable: false),
        (rawPreference as Map?)?.cast<String, dynamic>(),
      );
    });
  }

  @override
  Future<void> replace(WealthTargetPlan plan) async {
    final storedTargets = <String, String>{
      for (final target in plan.targets)
        _storageClassByGroup[target.assetClass]!: target.percentage,
    };
    await _client.rpc(
      'replace_wealth_allocation_plan',
      params: {
        'p_targets': storedTargets,
        'p_tolerance_percentage': plan.tolerancePercentage,
      },
    );
  }
}
