import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../home_page.dart';
import '../main.dart';
import '../onboarding/onboarding_flow.dart';
import '../theme/tokens.dart';
import '../widgets/brand_mark.dart';
import '../widgets/callout.dart';
import '../widgets/primary_button.dart';
import 'login_page.dart';

/// Bumped by [OnboardingFlow] after `completeOnboarding` succeeds so the gate
/// re-reads `profiles.onboarding_completed` and routes on to Home.
final onboardingRefresh = ValueNotifier<int>(0);

/// Route guard on top of RLS: signed out → login, signed in → onboarding or home
/// depending on `profiles.onboarding_completed` (docs/auth.md session lifecycle).
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  Future<bool>? _onboarding;
  String? _resolvedFor;
  int _resolvedAt = 0;

  @override
  void initState() {
    super.initState();
    onboardingRefresh.addListener(_onRefresh);
  }

  @override
  void dispose() {
    onboardingRefresh.removeListener(_onRefresh);
    super.dispose();
  }

  void _onRefresh() {
    setState(() {
      _resolvedFor = null; // force _resolve to fetch again
    });
  }

  void _resolve(String userId) {
    if (_resolvedFor == userId && _resolvedAt == onboardingRefresh.value) {
      return;
    }
    _resolvedFor = userId;
    _resolvedAt = onboardingRefresh.value;
    _onboarding = authService.getOnboardingCompletion();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: authService.onAuthStateChange,
      builder: (context, snapshot) {
        final session = snapshot.data?.session ?? authService.currentSession;

        if (session == null) {
          _resolvedFor = null;
          _onboarding = null;
          return const LoginPage();
        }

        // Ignore pure token refreshes for the same user — keep the tree.
        _resolve(session.user.id);

        return FutureBuilder<bool>(
          future: _onboarding,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const _Loading();
            }
            if (snap.hasError) {
              return _AccountLoadError(
                onRetry: () {
                  setState(() {
                    _resolvedFor = null;
                    _resolve(session.user.id);
                  });
                },
              );
            }
            return snap.data == true
                ? const HomePage()
                : const OnboardingFlow();
          },
        );
      },
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: const SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              BrandMark(),
              SizedBox(height: 32),
              SizedBox(
                height: 22,
                width: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountLoadError extends StatelessWidget {
  const _AccountLoadError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Callout(
                  tone: CalloutTone.danger,
                  title: 'Couldn’t load your account',
                  message:
                      'Check your connection and try again. Nothing was '
                      'changed.',
                ),
                const SizedBox(height: 16),
                PrimaryButton(label: 'Retry', onPressed: onRetry),
                const SizedBox(height: 4),
                TextButton(
                  onPressed: authService.signOut,
                  child: const Text('Sign out'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
