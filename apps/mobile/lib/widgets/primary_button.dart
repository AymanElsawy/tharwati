import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Filled accent button, 52px tall, radius 16 (Component sheet · Buttons).
/// Shows an inline spinner and disables itself while [busy].
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.busy = false,
    this.fontSize,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  /// Override the theme's 16px label — used where the button sits in a tight
  /// multi-button row (e.g. the goal detail hero).
  final double? fontSize;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: fontSize == null
          ? null
          : FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              textStyle: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w700,
              ),
            ),
      child: busy
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(Colors.white),
              ),
            )
          : Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}

/// Outlined accent button — the "Withdraw" secondary style. Same 52px height and
/// radius 16 as [PrimaryButton] so the two sit side by side as one group.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.busy = false,
    this.fontSize,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final double? fontSize;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: busy ? null : onPressed,
      style: fontSize == null
          ? null
          : OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              textStyle: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w700,
              ),
            ),
      child: busy
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}

/// Neutral / tertiary button — filled with the field tint, a hairline border and
/// muted ink. The "Cancel" / "Close" action in the Flow 5 sheets. Same footprint
/// as [PrimaryButton].
class NeutralButton extends StatelessWidget {
  const NeutralButton({super.key, required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(AppSizes.button),
        backgroundColor: c.fieldFill,
        foregroundColor: c.inkMuted,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.button),
          side: BorderSide(color: c.line),
        ),
      ),
      child: Text(label),
    );
  }
}

/// Ghost / text-weight button on the canvas — e.g. "Skip for now".
class GhostButton extends StatelessWidget {
  const GhostButton({super.key, required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        minimumSize: const Size.fromHeight(AppSizes.touchTarget),
        foregroundColor: c.ink.withValues(alpha: 0.75),
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
      child: Text(label),
    );
  }
}
