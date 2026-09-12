import 'package:flutter/material.dart';

import 'accounts/accounts_page.dart';
import 'analysis/analysis_placeholder_pages.dart';
import 'dashboard/dashboard_screen.dart';
import 'goals/goals_page.dart';
import 'i18n/app_language.dart';
import 'i18n/navigation_copy.dart';
import 'settings/settings_page.dart';
import 'theme/tokens.dart';

/// Authenticated five-tab shell. Analysis retains its localized placeholder
/// while the other destinations mount their implemented pages.
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = NavigationCopy.of(AppLanguageScope.of(context).language);
    final pages = <Widget>[
      DashboardScreen(
        onOpenAccounts: () => setState(() => _index = 1),
        onOpenAnalysis: () => setState(() => _index = 2),
        onOpenPortfolioAnalysis: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const PortfolioAnalysisPlaceholderPage(),
          ),
        ),
        onOpenGoals: () => setState(() => _index = 3),
      ),
      const AccountsPage(),
      const WealthAnalysisPlaceholderPage(),
      const GoalsPage(),
      const SettingsPage(),
    ];

    return Scaffold(
      backgroundColor: c.canvas,
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          color: c.surface,
          border: Border(top: BorderSide(color: c.line)),
        ),
        child: SafeArea(
          top: false,
          child: NavigationBarTheme(
            data: NavigationBarThemeData(
              height: 64,
              backgroundColor: Colors.transparent,
              indicatorColor: Colors.transparent,
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                final selected = states.contains(WidgetState.selected);
                return TextStyle(
                  color: selected ? c.accent : c.inkMuted,
                  fontSize: 10,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                );
              }),
              iconTheme: WidgetStateProperty.resolveWith(
                (states) => IconThemeData(
                  color: states.contains(WidgetState.selected)
                      ? c.accent
                      : c.inkMuted,
                ),
              ),
            ),
            child: NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: [
                NavigationDestination(
                  icon: Icon(Icons.grid_view_outlined),
                  selectedIcon: Icon(Icons.grid_view_rounded),
                  label: copy.dashboard,
                ),
                NavigationDestination(
                  icon: Icon(Icons.account_balance_wallet_outlined),
                  label: copy.accounts,
                ),
                NavigationDestination(
                  icon: Icon(Icons.show_chart),
                  label: copy.analysis,
                ),
                NavigationDestination(
                  icon: Icon(Icons.track_changes_outlined),
                  label: copy.goals,
                ),
                NavigationDestination(
                  icon: Icon(Icons.settings_outlined),
                  label: copy.settings,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Settings presentation is defined in settings/settings_page.dart.
