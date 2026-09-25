import 'package:flutter/material.dart';

import '../accounts/account_models.dart';
import '../accounts/account_detail_page.dart';
import '../accounts/accounts_controller.dart';
import '../accounts/brokerage/brokerage_controller.dart';
import '../accounts/brokerage/holding_detail_page.dart';
import '../core/decimals.dart';
import '../core/money_format.dart';
import '../core/quantity_format.dart';
import '../core/securities_allocation.dart';
import '../i18n/app_language.dart';
import '../i18n/portfolio_copy.dart';
import '../theme/tokens.dart';
import '../widgets/callout.dart';
import 'portfolio_controller.dart';
import 'portfolio_models.dart';

class PortfolioPage extends StatefulWidget {
  const PortfolioPage({
    super.key,
    this.controller,
    this.onOpenAccounts,
    this.onOpenAccount,
    this.onOpenHolding,
  });
  final PortfolioController? controller;
  final VoidCallback? onOpenAccounts;
  final ValueChanged<Account>? onOpenAccount;
  final void Function(Account account, String assetId)? onOpenHolding;

  @override
  State<PortfolioPage> createState() => _PortfolioPageState();
}

class _PortfolioPageState extends State<PortfolioPage> {
  late final PortfolioController _controller =
      widget.controller ?? PortfolioController();

  @override
  void initState() {
    super.initState();
    if (_controller.status == PortfolioLoadStatus.initial) _controller.load();
  }

  @override
  void dispose() {
    if (widget.controller == null) _controller.dispose();
    super.dispose();
  }

  void _openAccount(Account account) {
    if (widget.onOpenAccount case final callback?) {
      callback(account);
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _BrokerageAccountRoute(account: account),
      ),
    );
  }

  void _openHolding(Account account, String assetId) {
    if (widget.onOpenHolding case final callback?) {
      callback(account, assetId);
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _HoldingRoute(account: account, assetId: assetId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final copy = PortfolioCopy.of(AppLanguageScope.of(context).language);
    return Scaffold(
      backgroundColor: context.colors.canvas,
      appBar: AppBar(title: Text(copy.title)),
      body: SafeArea(
        top: false,
        child: ListenableBuilder(
          listenable: _controller,
          builder: (context, _) {
            if (_controller.status == PortfolioLoadStatus.loading &&
                _controller.data == null) {
              return const _LoadingState();
            }
            if (_controller.status == PortfolioLoadStatus.error ||
                _controller.data == null) {
              return _ErrorState(copy: copy, onRetry: _controller.load);
            }
            return _ReadyBody(
              data: _controller.data!,
              controller: _controller,
              copy: copy,
              onOpenAccounts: widget.onOpenAccounts,
              onOpenAccount: _openAccount,
              onOpenHolding: _openHolding,
            );
          },
        ),
      ),
    );
  }
}

class _ReadyBody extends StatelessWidget {
  const _ReadyBody({
    required this.data,
    required this.controller,
    required this.copy,
    required this.onOpenAccounts,
    required this.onOpenAccount,
    required this.onOpenHolding,
  });
  final PortfolioAnalysis data;
  final PortfolioController controller;
  final PortfolioCopy copy;
  final VoidCallback? onOpenAccounts;
  final ValueChanged<Account> onOpenAccount;
  final void Function(Account, String) onOpenHolding;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: controller.refresh,
    color: context.colors.accent,
    child: ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 36),
      children: [
        _Header(data: data, controller: controller, copy: copy),
        if (controller.refreshError != null) ...[
          const SizedBox(height: 12),
          Callout(tone: CalloutTone.warning, message: copy.refreshFailed),
        ],
        const SizedBox(height: 18),
        if (data.coverage == PortfolioCoverage.noBrokerageAccounts)
          _EmptyCard(
            icon: Icons.account_balance_outlined,
            title: copy.noAccounts,
            body: copy.noAccountsBody,
            action: onOpenAccounts == null
                ? null
                : TextButton(
                    onPressed: onOpenAccounts,
                    child: Text(copy.openAccounts),
                  ),
          )
        else ...[
          _ScopeSelector(data: data, controller: controller, copy: copy),
          const SizedBox(height: 20),
          _Summary(data: data, copy: copy),
          const SizedBox(height: 20),
          _CashCurrent(data: data, copy: copy),
          const SizedBox(height: 20),
          _Allocation(data: data, copy: copy),
          const SizedBox(height: 20),
          _Holdings(
            data: data,
            copy: copy,
            onOpenAccount: onOpenAccount,
            onOpenHolding: onOpenHolding,
          ),
        ],
      ],
    ),
  );
}

class _Header extends StatelessWidget {
  const _Header({
    required this.data,
    required this.controller,
    required this.copy,
  });
  final PortfolioAnalysis data;
  final PortfolioController controller;
  final PortfolioCopy copy;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        copy.subtitle,
        style: TextStyle(color: context.colors.inkMuted, height: 1.4),
      ),
      const SizedBox(height: 12),
      Row(
        children: [
          Icon(
            data.hasStalePrice || data.hasStaleFx
                ? Icons.schedule
                : Icons.verified_outlined,
            size: 18,
            color: data.hasStalePrice || data.hasStaleFx
                ? context.colors.warningFg
                : context.colors.accent,
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              controller.isRefreshing
                  ? copy.refreshing
                  : data.hasStalePrice || data.hasStaleFx
                  ? copy.stale
                  : copy.fresh,
              style: TextStyle(color: context.colors.inkMuted, fontSize: 12),
            ),
          ),
          IconButton(
            tooltip: copy.refresh,
            onPressed: controller.isRefreshing ? null : controller.refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      if (controller.isRefreshing) const LinearProgressIndicator(minHeight: 2),
    ],
  );
}

class _ScopeSelector extends StatelessWidget {
  const _ScopeSelector({
    required this.data,
    required this.controller,
    required this.copy,
  });
  final PortfolioAnalysis data;
  final PortfolioController controller;
  final PortfolioCopy copy;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _SectionTitle(copy.scope),
      const SizedBox(height: 9),
      DropdownButtonFormField<String>(
        key: const Key('portfolio-scope'),
        isExpanded: true,
        initialValue: controller.scopeId,
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.business_center_outlined),
        ),
        items: [
          DropdownMenuItem(
            value: allBrokerageAccountsScope,
            child: Text(copy.allAccounts),
          ),
          for (final account in data.accounts)
            DropdownMenuItem(
              value: account.id,
              child: Text(account.name, overflow: TextOverflow.ellipsis),
            ),
        ],
        onChanged: controller.isRefreshing
            ? null
            : (value) {
                if (value != null) controller.selectScope(value);
              },
      ),
    ],
  );
}

class _Summary extends StatelessWidget {
  const _Summary({required this.data, required this.copy});
  final PortfolioAnalysis data;
  final PortfolioCopy copy;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _SectionTitle(copy.summary),
      const SizedBox(height: 10),
      _Card(
        child: Column(
          children: [
            _PrimaryMetric(
              label: copy.invested,
              value: _money(data.investedMarketValueBase, data, copy),
            ),
            const SizedBox(height: 18),
            _MetricGrid(data: data, copy: copy),
            const SizedBox(height: 16),
            Divider(color: context.colors.line),
            const SizedBox(height: 12),
            Row(
              children: [
                _StatusChip(
                  label: copy.status(data.coverage),
                  coverage: data.coverage,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    copy.coverageValue(
                      data.validHoldingCount,
                      data.totalHoldingCount,
                    ),
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      color: context.colors.inkMuted,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            if (data.coverage == PortfolioCoverage.partial ||
                data.coverage == PortfolioCoverage.unavailable) ...[
              const SizedBox(height: 12),
              Callout(
                tone: CalloutTone.warning,
                title: copy.incomplete,
                message: copy.incompleteBody,
              ),
            ],
          ],
        ),
      ),
    ],
  );
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.data, required this.copy});
  final PortfolioAnalysis data;
  final PortfolioCopy copy;
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 10,
    runSpacing: 14,
    children: [
      _Metric(
        label: copy.costBasis,
        value: _money(data.costBasisBase, data, copy),
      ),
      _Metric(
        label: copy.gainLoss,
        value: _money(data.unrealizedGainLossBase, data, copy),
      ),
      _Metric(
        label: copy.returnLabel,
        value: _percent(data.unrealizedReturnPercent, copy),
      ),
    ],
  );
}

class _CashCurrent extends StatelessWidget {
  const _CashCurrent({required this.data, required this.copy});
  final PortfolioAnalysis data;
  final PortfolioCopy copy;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _SectionTitle(copy.cashTitle),
      const SizedBox(height: 10),
      _Card(
        child: Column(
          children: [
            _ValueRow(
              copy.availableCash,
              _money(data.availableCashBase, data, copy),
            ),
            _ValueRow(
              copy.invested,
              _money(data.investedMarketValueBase, data, copy),
            ),
            Divider(color: context.colors.line),
            _ValueRow(
              copy.currentValue,
              _money(data.currentValueBase, data, copy),
              strong: true,
            ),
          ],
        ),
      ),
    ],
  );
}

class _Allocation extends StatelessWidget {
  const _Allocation({required this.data, required this.copy});
  final PortfolioAnalysis data;
  final PortfolioCopy copy;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _SectionTitle(copy.allocation),
      const SizedBox(height: 3),
      Text(
        copy.allocationNote,
        style: TextStyle(color: context.colors.inkMuted, fontSize: 12),
      ),
      const SizedBox(height: 10),
      _Card(
        child: data.allocation.isEmpty
            ? Text(
                data.totalHoldingCount == 0
                    ? copy.allocationEmpty
                    : copy.incompleteBody,
                style: TextStyle(color: context.colors.inkMuted, height: 1.4),
              )
            : Column(
                children: [
                  for (var i = 0; i < data.allocation.length; i++) ...[
                    _AllocationRow(
                      item: data.allocation[i],
                      copy: copy,
                      color: AppChartColors.of(context.colors)[i],
                    ),
                    if (i != data.allocation.length - 1)
                      const SizedBox(height: 13),
                  ],
                ],
              ),
      ),
    ],
  );
}

class _Holdings extends StatelessWidget {
  const _Holdings({
    required this.data,
    required this.copy,
    required this.onOpenAccount,
    required this.onOpenHolding,
  });
  final PortfolioAnalysis data;
  final PortfolioCopy copy;
  final ValueChanged<Account> onOpenAccount;
  final void Function(Account, String) onOpenHolding;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _SectionTitle(copy.holdings),
      const SizedBox(height: 10),
      if (data.holdings.isEmpty)
        _EmptyCard(
          icon: Icons.pie_chart_outline,
          title: copy.empty,
          body: copy.emptyBody,
        )
      else
        for (final group in data.accountGroups) ...[
          if (group.holdings.isNotEmpty)
            _AccountGroup(
              group: group,
              data: data,
              copy: copy,
              onOpenAccount: onOpenAccount,
              onOpenHolding: onOpenHolding,
            ),
          if (group.holdings.isNotEmpty) const SizedBox(height: 12),
        ],
    ],
  );
}

class _AccountGroup extends StatelessWidget {
  const _AccountGroup({
    required this.group,
    required this.data,
    required this.copy,
    required this.onOpenAccount,
    required this.onOpenHolding,
  });
  final PortfolioAccountGroup group;
  final PortfolioAnalysis data;
  final PortfolioCopy copy;
  final ValueChanged<Account> onOpenAccount;
  final void Function(Account, String) onOpenHolding;
  @override
  Widget build(BuildContext context) => _Card(
    padding: EdgeInsets.zero,
    child: Column(
      children: [
        InkWell(
          key: Key('portfolio-account-${group.account.id}'),
          onTap: () => onOpenAccount(group.account),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(
                  Icons.account_balance_outlined,
                  color: context.colors.accent,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        group.account.name,
                        style: TextStyle(
                          color: context.colors.ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        group.account.currencyCode,
                        textDirection: TextDirection.ltr,
                        style: TextStyle(
                          color: context.colors.inkMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
          ),
        ),
        Divider(height: 1, color: context.colors.line),
        for (var i = 0; i < group.holdings.length; i++) ...[
          _HoldingRow(
            value: group.holdings[i],
            data: data,
            copy: copy,
            onTap: () =>
                onOpenHolding(group.account, group.holdings[i].holding.assetId),
          ),
          if (i != group.holdings.length - 1)
            Divider(height: 1, color: context.colors.line),
        ],
      ],
    ),
  );
}

class _HoldingRow extends StatelessWidget {
  const _HoldingRow({
    required this.value,
    required this.data,
    required this.copy,
    required this.onTap,
  });
  final PortfolioHoldingValue value;
  final PortfolioAnalysis data;
  final PortfolioCopy copy;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    key: Key('portfolio-holding-${value.holding.id}'),
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  value.holding.displayName,
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    color: context.colors.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (value.priceStale || value.fxStale)
                _SmallBadge(copy.staleBadge),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, size: 18),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            '${copy.quantity}: ${formatQuantity(value.holding.quantity, fractionDigits: value.holding.asset.quantityPrecision)} ${value.holding.asset.quantityUnit}',
            textDirection: TextDirection.ltr,
            style: TextStyle(color: context.colors.inkMuted, fontSize: 11),
          ),
          const SizedBox(height: 3),
          Text(
            '${copy.price}: ${value.price == null ? copy.unavailable : MoneyFormat.money(value.price!.price, value.price!.currencyCode, unavailableLabel: copy.unavailable)}',
            textDirection: TextDirection.ltr,
            style: TextStyle(color: context.colors.inkMuted, fontSize: 11),
          ),
          const SizedBox(height: 9),
          Row(
            children: [
              Expanded(
                child: _CompactValue(
                  copy.marketValue,
                  _money(value.marketValueBase, data, copy),
                ),
              ),
              Expanded(
                child: _CompactValue(
                  copy.costBasis,
                  _money(value.costBasisBase, data, copy),
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Row(
            children: [
              Expanded(
                child: _CompactValue(
                  copy.gainLoss,
                  _money(value.unrealizedGainLossBase, data, copy),
                ),
              ),
              Expanded(
                child: _CompactValue(
                  copy.returnLabel,
                  _percent(value.unrealizedReturnPercent, copy),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _AllocationRow extends StatelessWidget {
  const _AllocationRow({
    required this.item,
    required this.copy,
    required this.color,
  });
  final SecuritiesAllocationItem item;
  final PortfolioCopy copy;
  final Color color;
  @override
  Widget build(BuildContext context) {
    final progress = (double.tryParse(item.percentage) ?? 0) / 100;
    return Column(
      children: [
        Row(
          children: [
            Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                copy.allocationGroup(item.group),
                style: TextStyle(
                  color: context.colors.ink,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              MoneyFormat.percent(item.percentage),
              textDirection: TextDirection.ltr,
              style: TextStyle(
                color: context.colors.ink,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 7),
        LinearProgressIndicator(
          value: progress.clamp(0, 1),
          minHeight: 5,
          color: color,
          backgroundColor: context.colors.fieldFill,
          borderRadius: BorderRadius.circular(99),
        ),
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: (MediaQuery.sizeOf(context).width - 76) / 2,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(color: context.colors.inkMuted, fontSize: 11),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          textDirection: TextDirection.ltr,
          style: TextStyle(
            color: context.colors.ink,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}

class _PrimaryMetric extends StatelessWidget {
  const _PrimaryMetric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: TextStyle(color: context.colors.inkMuted, fontSize: 12),
      ),
      const SizedBox(height: 4),
      FittedBox(
        fit: BoxFit.scaleDown,
        alignment: AlignmentDirectional.centerStart,
        child: Text(
          value,
          textDirection: TextDirection.ltr,
          style: TextStyle(
            color: context.colors.ink,
            fontSize: 25,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
          ),
        ),
      ),
    ],
  );
}

class _CompactValue extends StatelessWidget {
  const _CompactValue(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: TextStyle(color: context.colors.inkMuted, fontSize: 10),
      ),
      Text(
        value,
        textDirection: TextDirection.ltr,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: context.colors.ink,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _ValueRow extends StatelessWidget {
  const _ValueRow(this.label, this.value, {this.strong = false});
  final String label;
  final String value;
  final bool strong;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      children: [
        Expanded(
          child: Text(label, style: TextStyle(color: context.colors.inkMuted)),
        ),
        Text(
          value,
          textDirection: TextDirection.ltr,
          style: TextStyle(
            color: context.colors.ink,
            fontWeight: strong ? FontWeight.w900 : FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.coverage});
  final String label;
  final PortfolioCoverage coverage;
  @override
  Widget build(BuildContext context) {
    final warning =
        coverage == PortfolioCoverage.partial ||
        coverage == PortfolioCoverage.unavailable;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: warning
            ? context.colors.warningSoft
            : context.colors.successSoft,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: warning ? context.colors.warningFg : context.colors.accent,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SmallBadge extends StatelessWidget {
  const _SmallBadge(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: context.colors.warningSoft,
      borderRadius: BorderRadius.circular(99),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: context.colors.warningFg,
        fontSize: 9,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: Theme.of(context).textTheme.titleMedium?.copyWith(
      color: context.colors.ink,
      fontWeight: FontWeight.w800,
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding,
    decoration: BoxDecoration(
      color: context.colors.surface,
      border: Border.all(color: context.colors.line),
      borderRadius: BorderRadius.circular(16),
    ),
    child: child,
  );
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;
  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      children: [
        Icon(icon, color: context.colors.inkMuted, size: 30),
        const SizedBox(height: 9),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: context.colors.ink,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          body,
          textAlign: TextAlign.center,
          style: TextStyle(color: context.colors.inkMuted, height: 1.4),
        ),
        if (action != null) ...[const SizedBox(height: 8), action!],
      ],
    ),
  );
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();
  @override
  Widget build(BuildContext context) =>
      Center(child: CircularProgressIndicator(color: context.colors.accent));
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.copy, required this.onRetry});
  final PortfolioCopy copy;
  final Future<void> Function() onRetry;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(18),
    children: [
      const SizedBox(height: 80),
      Callout(
        tone: CalloutTone.danger,
        title: copy.loadFailed,
        message: copy.loadFailedBody,
        action: TextButton(onPressed: onRetry, child: Text(copy.retry)),
      ),
    ],
  );
}

String _money(String? value, PortfolioAnalysis data, PortfolioCopy copy) =>
    MoneyFormat.money(
      value,
      data.baseCurrencyCode,
      unavailableLabel: copy.unavailable,
    );
String _percent(String? value, PortfolioCopy copy) =>
    D.normalize(value) == null ? copy.unavailable : MoneyFormat.percent(value);

class _BrokerageAccountRoute extends StatefulWidget {
  const _BrokerageAccountRoute({required this.account});
  final Account account;
  @override
  State<_BrokerageAccountRoute> createState() => _BrokerageAccountRouteState();
}

class _BrokerageAccountRouteState extends State<_BrokerageAccountRoute> {
  late final AccountsController controller = AccountsController(
    language: () => mounted
        ? AppLanguageScope.of(context).language
        : AppLanguage.en,
  );
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      if (controller.status == AccountsStatus.loading) {
        return Scaffold(
          backgroundColor: context.colors.canvas,
          appBar: AppBar(),
          body: const Center(child: CircularProgressIndicator()),
        );
      }
      return AccountDetailPage(
        controller: controller,
        accountId: widget.account.id,
      );
    },
  );
}

class _HoldingRoute extends StatefulWidget {
  const _HoldingRoute({required this.account, required this.assetId});
  final Account account;
  final String assetId;
  @override
  State<_HoldingRoute> createState() => _HoldingRouteState();
}

class _HoldingRouteState extends State<_HoldingRoute> {
  late final BrokerageController controller = BrokerageController(
    accountId: widget.account.id,
  );
  @override
  void initState() {
    super.initState();
    controller.load();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      if (controller.status == BrokerageStatus.loading) {
        return Scaffold(
          backgroundColor: context.colors.canvas,
          appBar: AppBar(),
          body: const Center(child: CircularProgressIndicator()),
        );
      }
      if (controller.status == BrokerageStatus.error ||
          controller.valuation == null) {
        return Scaffold(
          backgroundColor: context.colors.canvas,
          appBar: AppBar(),
          body: Center(
            child: Text(
              PortfolioCopy.of(
                AppLanguageScope.of(context).language,
              ).loadFailed,
            ),
          ),
        );
      }
      return HoldingDetailPage(
        controller: controller,
        account: widget.account,
        assetId: widget.assetId,
      );
    },
  );
}
