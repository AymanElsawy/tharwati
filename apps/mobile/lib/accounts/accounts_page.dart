import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import '../i18n/app_language.dart';
import '../errors/safe_app_error.dart';
import '../i18n/accounts_copy.dart';
import '../widgets/app_sheet.dart';
import '../widgets/callout.dart';
import '../widgets/form_controls.dart';
import '../widgets/primary_button.dart';
import 'account_detail_page.dart';
import 'account_form_sheet.dart';
import 'account_models.dart';
import 'accounts_controller.dart';
import 'accounts_service.dart';
import 'widgets/account_row_card.dart';

/// The Accounts tab — a searchable, filterable, sortable inventory split into
/// Active / Closed-Archived / Sold sections. Mirrors the web `AccountsPage` +
/// `AccountFilterBar` + `AccountInventory` (a flat sorted list, not grouped by
/// type). Tapping a row opens the type-specific detail surface.
class AccountsPage extends StatefulWidget {
  const AccountsPage({super.key, this.controller});

  /// Injected by tests; production builds create their own.
  final AccountsController? controller;

  @override
  State<AccountsPage> createState() => _AccountsPageState();
}

class _AccountsPageState extends State<AccountsPage> {
  late final AccountsController _controller =
      widget.controller ??
      AccountsController(
        language: () =>
            mounted ? AppLanguageScope.of(context).language : AppLanguage.en,
      );
  final _search = TextEditingController();

  @override
  void dispose() {
    if (widget.controller == null) _controller.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _openForm({Account? edit}) async {
    _controller.clearActionError();
    await showAppSheet<bool>(
      context,
      builder: (_) => AccountFormSheet(controller: _controller, account: edit),
    );
  }

  void _openDetail(String id) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            AccountDetailPage(controller: _controller, accountId: id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: _controller,
          builder: (context, _) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Header(onAdd: () => _openForm()),
                if (_controller.status == AccountsStatus.ready) ...[
                  _FilterBar(controller: _controller, search: _search),
                  _SortRow(controller: _controller),
                ],
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _controller.load,
                    color: c.accent,
                    child: _body(context),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    switch (_controller.status) {
      case AccountsStatus.loading:
        return ListView(
          children: const [
            SizedBox(height: 120),
            Center(child: CircularProgressIndicator()),
          ],
        );
      case AccountsStatus.error:
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Callout(
              tone: CalloutTone.danger,
              title: copy.loadError,
              message: _controller.readErrorCode == null
                  ? copy.recordsSafe
                  : safeAppErrorCodeMessage(
                      _controller.readErrorCode!,
                      AppLanguageScope.of(context).language,
                    ),
              action: CompactButton(
                label: copy.tryAgain,
                tone: CompactButtonTone.neutral,
                onPressed: _controller.load,
              ),
            ),
          ],
        );
      case AccountsStatus.ready:
        final active = _controller.activeItems;
        final closed = _controller.showClosed
            ? _controller.closedItems
            : const <AccountItem>[];
        final sold = _controller.soldItems;
        final empty = active.isEmpty && closed.isEmpty && sold.isEmpty;

        return CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_controller.refreshStale) ...[
                      Callout(
                        tone: CalloutTone.warning,
                        message: copy.savedRefreshFailed,
                      ),
                      TextButton(
                        onPressed: _controller.retryRefresh,
                        child: Text(copy.refreshData),
                      ),
                    ],
                    if (_controller.actionError != null) ...[
                      Callout(
                        tone: CalloutTone.danger,
                        message: _controller.actionError!,
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_controller.sort == AccountSort.custom &&
                        _controller.isSubsetFiltered)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          copy.clearFiltersToReorder,
                          style: TextStyle(color: c.inkMuted, fontSize: 12),
                        ),
                      ),
                    if (_controller.sort == AccountSort.custom &&
                        !_controller.hasCompleteOrder) ...[
                      Text(
                        copy.orderRefreshFailure,
                        style: TextStyle(color: c.inkMuted, fontSize: 12),
                      ),
                      TextButton(
                        onPressed: _controller.retryRefresh,
                        child: Text(copy.refreshData),
                      ),
                    ],
                    if (_controller.isReordering)
                      Text(
                        copy.orderSaving,
                        style: TextStyle(color: c.inkMuted, fontSize: 12),
                      ),
                    if (_controller.orderNotice != null)
                      Callout(
                        tone: CalloutTone.warning,
                        message: switch (_controller.orderNotice!) {
                          AccountOrderNotice.conflict => copy.orderConflict,
                          AccountOrderNotice.failure => copy.orderFailure,
                          AccountOrderNotice.refreshFailure =>
                            copy.orderRefreshFailure,
                        },
                      ),
                  ],
                ),
              ),
            ),
            if (empty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      border: Border.all(color: c.line),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          (_controller.model?.isEmpty ?? true)
                              ? copy.addFirstAccount
                              : copy.noFilteredAccounts,
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          copy.emptyDescription,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: c.inkMuted,
                            fontSize: 13,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else ...[
              if (active.isNotEmpty) _accountSliver(active),
              if (closed.isNotEmpty) ...[
                _sectionHeading(copy.closedArchived),
                _accountSliver(closed, deEmphasized: true),
              ],
              if (sold.isNotEmpty) ...[
                _sectionHeading(copy.sold),
                _accountSliver(sold, deEmphasized: true),
              ],
            ],
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        );
    }
  }

  Widget _sectionHeading(String title) => SliverToBoxAdapter(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: _SectionTitle(title),
    ),
  );

  Widget _accountSliver(List<AccountItem> items, {bool deEmphasized = false}) {
    final custom = _controller.sort == AccountSort.custom;
    final reorderable =
        custom && !_controller.isSubsetFiltered && _controller.hasCompleteOrder;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    Widget card(int index) {
      final item = items[index];
      return Padding(
        key: ValueKey(item.account.id),
        padding: const EdgeInsets.only(bottom: 8),
        child: AccountRowCard(
          item: item,
          deEmphasized: deEmphasized,
          onTap: () => _openDetail(item.account.id),
          reorderHandle: custom
              ? ReorderableDragStartListener(
                  index: index,
                  enabled: reorderable && _controller.canReorder,
                  child: Semantics(
                    label: copy.reorderAccount(item.account.name),
                    button: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () {},
                      child: SizedBox(
                        width: 32,
                        height: 40,
                        child: Icon(
                          Icons.drag_handle,
                          size: 22,
                          color: context.colors.inkMuted,
                        ),
                      ),
                    ),
                  ),
                )
              : null,
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      sliver: reorderable
          ? SliverReorderableList(
              itemCount: items.length,
              itemBuilder: (context, index) => card(index),
              onReorderItem: (oldIndex, newIndex) {
                final sectionIds = [for (final item in items) item.account.id];
                _controller.reorderSection(sectionIds, oldIndex, newIndex);
              },
              proxyDecorator: (child, index, animation) => AnimatedBuilder(
                animation: animation,
                builder: (context, _) => Transform.scale(
                  scale: 1 + 0.02 * animation.value,
                  child: Material(
                    color: context.colors.surface,
                    borderRadius: BorderRadius.circular(16),
                    elevation: 5 * animation.value,
                    child: child,
                  ),
                ),
              ),
            )
          : SliverList.builder(
              itemCount: items.length,
              itemBuilder: (context, index) => card(index),
            ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  copy.financialAccounts,
                  style: TextStyle(
                    color: c.inkMuted,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  copy.accounts,
                  style: TextStyle(
                    color: c.ink,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  copy.accountsSubtitle,
                  style: TextStyle(color: c.inkMuted, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          CompactButton(
            label: copy.addAccount,
            icon: Icons.add,
            onPressed: onAdd,
          ),
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.controller, required this.search});
  final AccountsController controller;
  final TextEditingController search;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    // The artboard sits these controls straight on the canvas (gap 12) — no
    // card. Nesting a bordered field inside a bordered card reads as a box in
    // a box.
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 2, 20, 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SearchField(
            controller: search,
            hintText: copy.searchAccounts,
            onChanged: controller.setSearch,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: FieldDropdown<AccountType?>(
                  value: controller.typeFilter,
                  onChanged: controller.setTypeFilter,
                  items: [
                    DropdownMenuItem(
                      value: null,
                      child: Text(copy.allAccountTypes),
                    ),
                    for (final t in AccountType.values)
                      DropdownMenuItem(
                        value: t,
                        child: Text(copy.accountType(t)),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FieldDropdown<String?>(
                  value: controller.currencyFilter,
                  onChanged: controller.setCurrencyFilter,
                  items: [
                    DropdownMenuItem(
                      value: null,
                      child: Text(copy.allCurrencies),
                    ),
                    for (final code in controller.availableCurrencies)
                      DropdownMenuItem(
                        value: code,
                        child: Directionality(
                          textDirection: TextDirection.ltr,
                          child: Text(code),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              GestureDetector(
                onTap: controller.toggleShowClosed,
                child: Row(
                  children: [
                    Icon(
                      controller.showClosed
                          ? Icons.check_box
                          : Icons.check_box_outline_blank,
                      size: 18,
                      color: controller.showClosed ? c.accent : c.inkMuted,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      copy.showClosed,
                      style: TextStyle(color: c.ink, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                copy.accountCount(controller.resultCount),
                style: TextStyle(color: c.inkMuted, fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SortRow extends StatelessWidget {
  const _SortRow({required this.controller});
  final AccountsController controller;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = AccountsCopy.of(AppLanguageScope.of(context).language);
    Widget chip(String label, AccountSort key) {
      final active = controller.sort == key;
      final flex = switch (key) {
        AccountSort.custom => 4,
        AccountSort.name => 8,
        AccountSort.type => 5,
        AccountSort.balance => 8,
      };
      return Expanded(
        flex: flex,
        child: GestureDetector(
          onTap: () => controller.toggleSort(key),
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
            decoration: BoxDecoration(
              color: active ? c.accentSoft : c.surface,
              border: Border.all(color: active ? c.accent : c.line),
              borderRadius: BorderRadius.circular(AppRadius.chip),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    softWrap: false,
                    style: TextStyle(
                      color: active ? c.accent : c.inkMuted,
                      fontSize: 12,
                      fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                    ),
                  ),
                ),
                if (active && key != AccountSort.custom) ...[
                  const SizedBox(width: 3),
                  Icon(
                    controller.ascending
                        ? Icons.arrow_upward
                        : Icons.arrow_downward,
                    size: 13,
                    color: c.accent,
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 2, 10, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.sort,
            style: TextStyle(
              color: c.inkMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              chip(copy.sortCustom, AccountSort.custom),
              const SizedBox(width: 4),
              chip(copy.sortAccountName, AccountSort.name),
              const SizedBox(width: 4),
              chip(copy.sortType, AccountSort.type),
              const SizedBox(width: 4),
              chip(copy.sortCurrentValue, AccountSort.balance),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Text(
      text,
      style: TextStyle(
        color: c.inkMuted,
        fontSize: 12,
        letterSpacing: 1,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}
