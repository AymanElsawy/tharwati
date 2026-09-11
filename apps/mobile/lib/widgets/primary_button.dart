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
          ? SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(
                  Theme.of(context).colorScheme.onPrimary,
                ),
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
        foregroundColor: c.ink,
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

/// Tones for [CompactButton], all drawn from the Component sheet.
enum CompactButtonTone {
  /// Soft accent fill — the sheet's "Add progress" action.
  accent,

  /// Hairline outline on surface — the 44×44 overflow control's treatment.
  neutral,

  /// Outlined danger — the sheet's "Delete account". Red on white, never a
  /// red fill.
  danger,
}

/// The Component sheet's compact action: 44 tall, radius 14, 18px of horizontal
/// padding, 700/14 label. Used where a button sits beside content rather than
/// anchoring a form — the Accounts header's *Add account*, the ledger's *Add
/// record* / *Filters*, and destructive confirmations.
///
/// It hugs its label, which is what makes it safe here. [PrimaryButton] and
/// friends inherit the theme's `minimumSize: Size.fromHeight(52)` — width
/// `double.infinity` — so they stretch to their container, correct for a
/// stretched column child but wrong inside a `Row` or an `AlertDialog`'s
/// `OverflowBar`. Worse, that infinite minimum stays latent while constraints
/// are bounded (they clamp it) and only bites when a pass runs unconstrained —
/// a route being sized offstage — where it resolves to a *tight* infinity and
/// throws `BoxConstraints forces an infinite width`, aborting layout for the
/// whole subtree.
class CompactButton extends StatelessWidget {
  const CompactButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.tone = CompactButtonTone.accent,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final CompactButtonTone tone;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (Color bg, Color fg, Color? border) = switch (tone) {
      CompactButtonTone.accent => (c.accentSoft, c.accent, null),
      CompactButtonTone.neutral => (c.surface, c.ink, c.line),
      CompactButtonTone.danger => (c.surface, c.negative, c.dangerBorder),
    };
    final style = FilledButton.styleFrom(
      minimumSize: const Size(0, AppSizes.touchTarget),
      padding: const EdgeInsets.symmetric(horizontal: 18),
      backgroundColor: bg,
      foregroundColor: fg,
      disabledBackgroundColor: c.disabledFill,
      disabledForegroundColor: c.disabledFg,
      textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.control),
        // The sheet draws the danger outline at 1.5px, the neutral one at 1px.
        side: border == null
            ? BorderSide.none
            : BorderSide(
                color: border,
                width: tone == CompactButtonTone.danger ? 1.5 : 1,
              ),
      ),
    );
    final text = Text(label, maxLines: 1, overflow: TextOverflow.ellipsis);
    return icon == null
        ? FilledButton(onPressed: onPressed, style: style, child: text)
        : FilledButton.icon(
            onPressed: onPressed,
            style: style,
            icon: Icon(icon, size: 18),
            label: text,
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
