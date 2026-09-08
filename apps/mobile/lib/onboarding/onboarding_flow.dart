import 'package:flutter/material.dart';

import '../auth/auth_gate.dart';
import '../main.dart';
import '../theme/tokens.dart';
import 'data/countries.dart';
import 'data/country_currency.dart';
import 'data/currencies.dart';
import 'onboarding_scaffold.dart';
import 'steps/country_step.dart';
import 'steps/currency_step.dart';
import 'steps/goals_step.dart';

/// New users land here (the `handle_new_user` trigger sets
/// `onboarding_completed = false`). Mirrors the web onboarding: Welcome →
/// Country → Currency → Goals → Ready, then `complete_onboarding` (country +
/// base currency + goals) flips the gate so AuthGate rebuilds into HomePage.
///
/// The user's name is captured at signup (not here), matching the web.
class OnboardingFlow extends StatefulWidget {
  const OnboardingFlow({super.key});

  @override
  State<OnboardingFlow> createState() => _OnboardingFlowState();
}

enum _Step { welcome, country, currency, goals, ready }

class _OnboardingFlowState extends State<OnboardingFlow> {
  _Step _step = _Step.welcome;
  Country? _country;
  Currency? _currency;
  final Set<String> _goals = {};
  bool _saving = false;
  String? _error;

  void _go(_Step to) => setState(() => _step = to);

  void _pickCountry(Country country) {
    setState(() {
      _country = country;
      // Preselect the default currency, clamped to the supported five.
      _currency =
          findSupportedCurrency(defaultCurrencyCode(country.code)) ?? _currency;
    });
  }

  Future<void> _complete() async {
    if (_country == null || _currency == null || _goals.isEmpty) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await authService.completeOnboarding(
        countryCode: _country!.code,
        baseCurrencyCode: _currency!.code,
        selectedGoals: _goals.toList(),
      );
      onboardingRefresh.value++; // AuthGate re-reads the flag and routes on.
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error =
              'We couldn’t save your preferences. Check your connection and '
              'try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (_step) {
      case _Step.welcome:
        return _WelcomeStep(onContinue: () => _go(_Step.country));
      case _Step.country:
        return CountryStep(
          selected: _country,
          onBack: () => _go(_Step.welcome),
          onSelect: _pickCountry,
          onContinue: () => _go(_Step.currency),
        );
      case _Step.currency:
        return CurrencyStep(
          selected: _currency,
          onBack: () => _go(_Step.country),
          onSelect: (currency) => setState(() => _currency = currency),
          onContinue: () => _go(_Step.goals),
        );
      case _Step.goals:
        return GoalsStep(
          selected: _goals,
          onBack: () => _go(_Step.currency),
          onToggle: (id) => setState(() {
            _goals.contains(id) ? _goals.remove(id) : _goals.add(id);
          }),
          onContinue: () => _go(_Step.ready),
        );
      case _Step.ready:
        return _ReadyStep(
          name: authService.currentFullName,
          saving: _saving,
          error: _error,
          onBack: _saving ? null : () => _go(_Step.goals),
          onComplete: _complete,
        );
    }
  }
}

class _WelcomeStep extends StatelessWidget {
  const _WelcomeStep({required this.onContinue});

  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OnboardingScaffold(
      step: 1,
      title: 'Welcome to Tharwati',
      subtitle:
          'Build a clear picture of your wealth, track your goals, and get '
          'insights from your own data.',
      primaryLabel: 'Continue',
      onPrimary: onContinue,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.fieldFill,
          border: Border.all(color: c.line),
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
        child: Text(
          'A few quick questions set up your workspace. Nothing here creates '
          'accounts, goals or balances — you’ll add those yourself.',
          style: TextStyle(color: c.inkMuted, fontSize: 13, height: 1.5),
        ),
      ),
    );
  }
}

class _ReadyStep extends StatelessWidget {
  const _ReadyStep({
    required this.name,
    required this.saving,
    required this.error,
    required this.onBack,
    required this.onComplete,
  });

  final String? name;
  final bool saving;
  final String? error;
  final VoidCallback? onBack;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OnboardingScaffold(
      step: 5,
      title: name == null ? 'You’re all set' : 'You’re all set, $name',
      subtitle: 'Your personalized wealth workspace is ready.',
      primaryLabel: saving ? 'Saving…' : 'Go to dashboard',
      onPrimary: onComplete,
      primaryBusy: saving,
      onBack: onBack,
      error: error,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.accentSoft,
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
        child: Text(
          'We’ll track your wealth, watch your progress, and surface insights '
          'based on the goals you picked.',
          style: TextStyle(
            color: c.ink.withValues(alpha: 0.8),
            fontSize: 13,
            height: 1.5,
          ),
        ),
      ),
    );
  }
}
