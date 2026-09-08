import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../data/countries.dart';
import '../onboarding_scaffold.dart';

/// Onboarding step 2 — "Where do you currently live?". Searchable country list;
/// picking one preselects the base currency (handled by the flow).
class CountryStep extends StatefulWidget {
  const CountryStep({
    super.key,
    required this.selected,
    required this.onBack,
    required this.onSelect,
    required this.onContinue,
  });

  final Country? selected;
  final VoidCallback onBack;
  final ValueChanged<Country> onSelect;
  final VoidCallback onContinue;

  @override
  State<CountryStep> createState() => _CountryStepState();
}

class _CountryStepState extends State<CountryStep> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<Country> get _results {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return kCountries;
    return kCountries
        .where(
          (c) =>
              c.name.toLowerCase().contains(q) ||
              c.code.toLowerCase().contains(q),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OnboardingScaffold(
      step: 2,
      title: 'Where do you currently live?',
      subtitle:
          'Sets your currency default and tailors future insights. Change it '
          'any time in Settings.',
      primaryLabel: 'Continue',
      primaryEnabled: widget.selected != null,
      onPrimary: widget.onContinue,
      onBack: widget.onBack,
      childFills: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _search,
            onChanged: (v) => setState(() => _query = v),
            decoration: const InputDecoration(
              hintText: 'Search for a country',
              prefixIcon: Icon(Icons.search, size: 20),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _results.isEmpty
                ? Center(
                    child: Text(
                      'No countries found',
                      style: TextStyle(color: c.inkMuted, fontSize: 13),
                    ),
                  )
                : ListView.builder(
                    itemCount: _results.length,
                    itemBuilder: (context, i) {
                      final country = _results[i];
                      final isSelected = widget.selected?.code == country.code;
                      return InkWell(
                        onTap: () => widget.onSelect(country),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          constraints: const BoxConstraints(
                            minHeight: AppSizes.touchTarget,
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                          child: Row(
                            children: [
                              // Flag emoji don't render on the iOS Simulator (and
                              // aren't in the app font); the ISO code chip always
                              // shows and matches the currency step.
                              Container(
                                width: 34,
                                height: 24,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? c.accentSoft
                                      : c.fieldFill,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  country.code,
                                  style: TextStyle(
                                    color: c.inkMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  country.name,
                                  style: TextStyle(
                                    color: c.ink,
                                    fontSize: 15,
                                    fontWeight: isSelected
                                        ? FontWeight.w700
                                        : FontWeight.w500,
                                  ),
                                ),
                              ),
                              if (isSelected)
                                Icon(Icons.check, size: 20, color: c.accent),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
