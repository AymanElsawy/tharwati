import 'package:flutter/material.dart';

import '../theme/tokens.dart';

enum CalloutTone { info, success, warning, danger }

/// The tinted advisory box used across Flow 1 — the green "Check your inbox"
/// panel, the red "No account uses that email" error, the amber "This link has
/// expired" warning, and the neutral onboarding note.
class Callout extends StatelessWidget {
  const Callout({
    super.key,
    required this.tone,
    this.title,
    required this.message,
    this.action,
  });

  final CalloutTone tone;
  final String? title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final palette = switch (tone) {
      CalloutTone.info => (
        bg: c.fieldFill,
        border: c.line,
        fg: c.inkMuted,
        icon: Icons.info_outline,
      ),
      CalloutTone.success => (
        bg: c.successSoft,
        border: c.successBorder,
        fg: c.accent,
        icon: Icons.mark_email_read_outlined,
      ),
      CalloutTone.warning => (
        bg: c.warningSoft,
        border: c.warningBorder,
        fg: c.warningFg,
        icon: Icons.schedule_outlined,
      ),
      CalloutTone.danger => (
        bg: c.negativeSoft,
        border: c.dangerBorder,
        fg: c.negative,
        icon: Icons.error_outline,
      ),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.bg,
        border: Border.all(color: palette.border),
        borderRadius: BorderRadius.circular(AppRadius.field),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(palette.icon, size: 20, color: palette.fg),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) ...[
                  Text(
                    title!,
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                ],
                Text(
                  message,
                  style: TextStyle(
                    color: title != null
                        ? c.ink.withValues(alpha: 0.8)
                        : palette.fg,
                    fontSize: 13,
                    height: 1.5,
                    fontWeight: title != null
                        ? FontWeight.w400
                        : FontWeight.w500,
                  ),
                ),
                if (action != null) ...[const SizedBox(height: 10), action!],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
