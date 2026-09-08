import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import '../widgets/callout.dart';

/// Shared shell for the Flow 1 auth screens. Matches the design's phone layout:
/// a canvas ground, an optional back chevron, an optional brand [header], a
/// left-aligned [title] + [subtitle], the scrolling [children], and an optional
/// bottom-pinned [footer]. Any [error] renders as a danger [Callout] above the
/// body.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    this.title,
    this.subtitle,
    this.header,
    this.footer,
    this.error,
    this.showBack = false,
    required this.children,
  });

  final String? title;
  final String? subtitle;
  final Widget? header;
  final Widget? footer;
  final String? error;
  final bool showBack;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showBack)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                  color: c.ink,
                  tooltip: 'Back',
                ),
              ),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(24, showBack ? 8 : 40, 24, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (header != null) ...[
                      header!,
                      const SizedBox(height: 32),
                    ],
                    if (title != null)
                      Text(
                        title!,
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
                    if (title != null || subtitle != null)
                      const SizedBox(height: 24),
                    if (error != null) ...[
                      Callout(tone: CalloutTone.danger, message: error!),
                      const SizedBox(height: 16),
                    ],
                    ...children,
                  ],
                ),
              ),
            ),
            if (footer != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
                child: footer,
              ),
          ],
        ),
      ),
    );
  }
}
