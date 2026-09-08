import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../data/currencies.dart';
import '../onboarding_scaffold.dart';

/// Onboarding step 3 — "Choose your base currency". One of the five the app
/// supports; only used to display total wealth and reports.
class CurrencyStep extends StatelessWidget {
  const CurrencyStep({
    super.key,
    required this.selected,
    required this.onBack,
    required this.onSelect,
    required this.onContinue,
  });

  final Currency? selected;
  final VoidCallback onBack;
  final ValueChanged<Currency> onSelect;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OnboardingScaffold(
      step: 3,
      title: 'Choose your base currency',
      subtitle:
          'Assets can be added in any currency. Your base currency only sets '
          'how totals and reports are shown.',
      primaryLabel: 'Continue',
      primaryEnabled: selected != null,
      onPrimary: onContinue,
      onBack: onBack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final currency in kSupportedCurrencies)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                onTap: () => onSelect(currency),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  constraints: const BoxConstraints(
                    minHeight: AppSizes.listRow,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: selected?.code == currency.code
                        ? c.accentSoft
                        : c.surface,
                    border: Border.all(
                      color: selected?.code == currency.code
                          ? c.accent
                          : c.line,
                      width: selected?.code == currency.code ? 1.5 : 1,
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 44,
                        child: Text(
                          currency.code,
                          style: TextStyle(
                            color: c.accent,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          currency.name,
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(
                        currency.symbol,
                        style: TextStyle(color: c.inkMuted, fontSize: 14),
                      ),
                      if (selected?.code == currency.code) ...[
                        const SizedBox(width: 10),
                        Icon(Icons.check, size: 20, color: c.accent),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
