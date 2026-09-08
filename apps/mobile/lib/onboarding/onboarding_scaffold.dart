import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import '../widgets/primary_button.dart';
import '../widgets/step_dots.dart';

/// Shared shell for the 5 onboarding steps — progress dots (with an optional
/// back chevron), a title + subtitle, a flexible [child], and a bottom action
/// row. Mirrors the web onboarding's step chrome, in the mobile design system.
class OnboardingScaffold extends StatelessWidget {
  const OnboardingScaffold({
    super.key,
    required this.step,
    required this.title,
    this.subtitle,
    required this.child,
    required this.primaryLabel,
    required this.onPrimary,
    this.primaryEnabled = true,
    this.primaryBusy = false,
    this.onBack,
    this.error,
    this.childFills = false,
  });

  static const totalSteps = 5;

  final int step;
  final String title;
  final String? subtitle;
  final Widget child;
  final String primaryLabel;
  final VoidCallback? onPrimary;
  final bool primaryEnabled;
  final bool primaryBusy;
  final VoidCallback? onBack;
  final String? error;

  /// True when [child] should take the remaining space (a scrolling list);
  /// false to size it to content.
  final bool childFills;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 14, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  if (onBack != null) ...[
                    IconButton(
                      onPressed: primaryBusy ? null : onBack,
                      icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                      color: c.ink,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(
                        minWidth: AppSizes.touchTarget,
                        minHeight: AppSizes.touchTarget,
                      ),
                      tooltip: 'Back',
                    ),
                    const SizedBox(width: 4),
                  ],
                  Expanded(
                    child: StepDots(step: step, total: totalSteps),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              Text(
                title,
                style: TextStyle(
                  color: c.ink,
                  fontSize: 30,
                  height: 1.1,
                  letterSpacing: -0.4,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 8),
                Text(
                  subtitle!,
                  style: TextStyle(
                    color: c.inkMuted,
                    fontSize: 14,
                    height: 1.5,
                  ),
                ),
              ],
              const SizedBox(height: 20),
              if (childFills)
                Expanded(child: child)
              else ...[
                child,
                const Spacer(),
              ],
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(
                  error!,
                  style: TextStyle(
                    color: c.negative,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
              const SizedBox(height: 12),
              PrimaryButton(
                label: primaryLabel,
                busy: primaryBusy,
                onPressed: primaryEnabled ? onPrimary : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
