import 'package:flutter/material.dart';

import '../main.dart';
import '../i18n/app_language.dart';
import '../i18n/dashboard_copy.dart';
import '../theme/tokens.dart';
import '../widgets/callout.dart';
import '../widgets/primary_button.dart';
import 'logic/dashboard_aggregate.dart';
import 'state/dashboard_controller.dart';
import 'state/dashboard_goals_controller.dart';
import 'widgets/assets_breakdown_card.dart';
import 'widgets/dashboard_card.dart';
import 'widgets/dashboard_masthead.dart';
import 'widgets/dashboard_skeletons.dart';
import 'widgets/goals_card.dart';
import 'widgets/key_insights_card.dart';
import 'widgets/net_worth_hero.dart';
import 'widgets/portfolio_allocation_card.dart';

/// Flow 2 — the live dashboard. Reuses the `dashboard-valuation` Edge Function
/// for valuation; `DashboardController` runs the ported decimal aggregate over
/// its snapshot. Pull down or fire a [DataChange] to refresh.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    this.onOpenAccounts,
    this.onOpenAnalysis,
    this.onOpenPortfolioAnalysis,
    this.onOpenGoals,
  });

  final VoidCallback? onOpenAccounts;
  final VoidCallback? onOpenAnalysis;
  final VoidCallback? onOpenPortfolioAnalysis;
  final VoidCallback? onOpenGoals;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _dashboard = DashboardController();
  final _goals = DashboardGoalsController();

  @override
  void dispose() {
    _dashboard.dispose();
    _goals.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: ListenableBuilder(
        listenable: _dashboard,
        builder: (context, _) {
          final status = _dashboard.status;
          final aggregate = _dashboard.aggregate;
          return RefreshIndicator(
            onRefresh: _dashboard.refresh,
            color: c.accent,
            child: ListView(
              padding: EdgeInsets.zero,
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                DashboardMasthead(
                  name: authService.currentFullName,
                  welcome:
                      status == DashboardStatus.ready &&
                      (aggregate?.isEmpty ?? false),
                ),
                Transform.translate(
                  offset: const Offset(0, -32),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.gutter,
                      0,
                      AppSpacing.gutter,
                      0,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: _body(status, aggregate),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  List<Widget> _body(DashboardStatus status, DashboardAggregate? aggregate) {
    final copy = DashboardCopy.of(AppLanguageScope.of(context).language);
    switch (status) {
      case DashboardStatus.loading:
        return const [DashboardLoadingBody()];
      case DashboardStatus.noBaseCurrency:
        return [
          DashboardCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  copy.finishSetup,
                  style: TextStyle(
                    color: context.colors.ink,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  copy.baseCurrencyMessage,
                  style: TextStyle(
                    color: context.colors.inkMuted,
                    fontSize: 13,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 12),
                PrimaryButton(
                  label: copy.completeOnboarding,
                  onPressed: authService.signOut,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _goalsCard(),
        ];
      case DashboardStatus.error:
        return [
          Callout(
            tone: CalloutTone.danger,
            title: copy.valuesUnavailable,
            message: copy.serverUnavailable,
            action: OutlinedButton(
              onPressed: _dashboard.refresh,
              child: Text(copy.retry),
            ),
          ),
          const SizedBox(height: 14),
          _goalsCard(),
        ];
      case DashboardStatus.ready:
        if (aggregate == null) return const [DashboardLoadingBody()];
        final agg = aggregate;
        return [
          NetWorthHero(
            aggregate: agg,
            animateTotal:
                !_dashboard.lastLoadSilent &&
                !MediaQuery.of(context).disableAnimations,
            onAddAccount: widget.onOpenAccounts,
          ),
          const SizedBox(height: 14),
          AssetsBreakdownCard(aggregate: agg, onTap: widget.onOpenAnalysis),
          const SizedBox(height: 14),
          if (_dashboard.insight != null) ...[
            KeyInsightsCard(insight: _dashboard.insight!),
            const SizedBox(height: 14),
          ],
          PortfolioAllocationCard(
            items: _dashboard.allocation,
            status: _dashboard.allocationStatus,
            currency: agg.baseCurrencyCode,
            onTap: widget.onOpenPortfolioAnalysis,
          ),
          const SizedBox(height: 14),
          _goalsCard(),
        ];
    }
  }

  Widget _goalsCard() =>
      GoalsCard(controller: _goals, onViewAll: widget.onOpenGoals);
}
