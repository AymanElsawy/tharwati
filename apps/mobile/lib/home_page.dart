import 'package:flutter/material.dart';

import 'dashboard/dashboard_screen.dart';
import 'goals/goals_page.dart';
import 'main.dart';
import 'theme/tokens.dart';

/// Authenticated shell — the five-tab bottom navigation from the design. Only
/// Dashboard (Flow 2) is built; the other tabs are placeholders for their flows.
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
    final pages = <Widget>[
      DashboardScreen(
        onOpenAccounts: () => setState(() => _index = 1),
        onOpenGoals: () => setState(() => _index = 3),
      ),
      const _ComingSoon(title: 'Accounts', flow: 'Flow 3'),
      const _ComingSoon(title: 'Investments', flow: 'Flow 4'),
      const GoalsPage(),
      const _SettingsPlaceholder(),
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
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.grid_view_outlined),
                  selectedIcon: Icon(Icons.grid_view_rounded),
                  label: 'Dashboard',
                ),
                NavigationDestination(
                  icon: Icon(Icons.account_balance_wallet_outlined),
                  label: 'Accounts',
                ),
                NavigationDestination(
                  icon: Icon(Icons.show_chart),
                  label: 'Invest',
                ),
                NavigationDestination(
                  icon: Icon(Icons.track_changes_outlined),
                  label: 'Goals',
                ),
                NavigationDestination(
                  icon: Icon(Icons.settings_outlined),
                  label: 'Settings',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ComingSoon extends StatelessWidget {
  const _ComingSoon({required this.title, required this.flow});

  final String title;
  final String flow;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(
          '$title — coming with $flow',
          style: TextStyle(color: c.inkMuted, fontSize: 14),
        ),
      ),
    );
  }
}

class _SettingsPlaceholder extends StatelessWidget {
  const _SettingsPlaceholder();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final email = authService.currentUser?.email ?? '';
    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(title: const Text('Settings')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Signed in as $email',
              style: TextStyle(color: c.inkMuted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Text(
              'Full settings come with Flow 6.',
              style: TextStyle(color: c.inkMuted, fontSize: 13),
            ),
            const Spacer(),
            OutlinedButton(
              onPressed: authService.signOut,
              child: const Text('Sign out'),
            ),
          ],
        ),
      ),
    );
  }
}
