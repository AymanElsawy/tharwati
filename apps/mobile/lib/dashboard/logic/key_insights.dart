import '../data/dashboard_snapshot.dart';
import 'dashboard_aggregate.dart';

enum InsightTone { ready, stale, empty, incomplete }

/// A single deterministic data-quality statement — no inferred financial claims
/// (docs/dashboard.md §2.5 / §3.1 "Key Insights").
class KeyInsight {
  const KeyInsight({
    required this.tone,
    required this.title,
    required this.body,
  });

  final InsightTone tone;
  final String title;
  final String body;
}

KeyInsight keyInsightFor(DashboardAggregate aggregate) {
  final incomplete = aggregate.status == AggregateStatus.incomplete;
  final stale = aggregate.freshness == SnapshotFreshness.stale;
  final empty = aggregate.accountCount == 0;

  if (incomplete) {
    return const KeyInsight(
      tone: InsightTone.incomplete,
      title: 'Some values are missing',
      body:
          'One or more accounts have no current value or exchange rate, so the '
          'dashboard totals are unavailable rather than partial.',
    );
  }
  if (stale) {
    return const KeyInsight(
      tone: InsightTone.stale,
      title: 'Values may be out of date',
      body:
          'The latest valuation used a stale price or rate. Refresh once your '
          'connection is stable.',
    );
  }
  if (empty) {
    return const KeyInsight(
      tone: InsightTone.empty,
      title: 'No accounts yet',
      body: 'Add an account to see your net worth and allocation.',
    );
  }
  return const KeyInsight(
    tone: InsightTone.ready,
    title: 'Dashboard values are available',
    body: 'Every active account has a current value in your base currency.',
  );
}
