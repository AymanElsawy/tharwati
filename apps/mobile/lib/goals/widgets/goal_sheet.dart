import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// Shows a goals bottom sheet (Flow 5 screens 22/23 + entry). Returns whatever
/// the sheet pops with.
Future<T?> showGoalSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
}) {
  final c = context.colors;
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: c.surface,
    barrierColor: const Color(0xFF0B1210).withValues(alpha: 0.45),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    builder: (context) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: builder(context),
    ),
  );
}

/// The shared sheet chrome: grab handle, title row with a close affordance, and
/// a scrollable body.
class GoalSheet extends StatelessWidget {
  const GoalSheet({
    super.key,
    required this.title,
    this.subtitle,
    required this.children,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.9,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: c.line,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: TextStyle(
                            color: c.ink,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            subtitle!,
                            style: TextStyle(color: c.inkMuted, fontSize: 12),
                          ),
                        ],
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.close_rounded, size: 20),
                    style: IconButton.styleFrom(
                      backgroundColor: c.fieldFill,
                      foregroundColor: c.inkMuted,
                      minimumSize: const Size(36, 36),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

/// A labelled field row in a sheet: 13/600 label (with an optional "· optional"
/// hint) above [child].
class SheetField extends StatelessWidget {
  const SheetField({
    super.key,
    required this.label,
    this.optional = false,
    this.hint,
    required this.child,
  });

  final String label;
  final bool optional;
  final String? hint;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text.rich(
            TextSpan(
              text: label,
              style: TextStyle(
                color: c.ink,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
              children: [
                if (optional)
                  TextSpan(
                    text: '  · optional',
                    style: TextStyle(
                      color: c.disabledFg,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          child,
          if (hint != null) ...[
            const SizedBox(height: 4),
            Text(hint!, style: TextStyle(color: c.disabledFg, fontSize: 11)),
          ],
        ],
      ),
    );
  }
}
