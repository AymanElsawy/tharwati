import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import 'form_controls.dart';

/// Shows a modal bottom sheet with the app's chrome. Returns whatever the sheet
/// pops with. Follows the soft keyboard via `viewInsets`.
Future<T?> showAppSheet<T>(
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

/// Grab handle, a title row with a close affordance, and a scrollable body.
class AppSheet extends StatelessWidget {
  const AppSheet({
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
          maxHeight: MediaQuery.of(context).size.height * 0.92,
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
/// hint) above [child], plus an optional [error] line.
class SheetField extends StatelessWidget {
  const SheetField({
    super.key,
    required this.label,
    this.optional = false,
    this.hint,
    this.error,
    required this.child,
  });

  final String label;
  final bool optional;
  final String? hint;
  final String? error;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Text.rich(
              TextSpan(
                text: label,
                style: TextStyle(
                  color: c.ink.withValues(alpha: 0.85),
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
          ),
          const SizedBox(height: 6),
          child,
          if (error != null) ...[
            const SizedBox(height: 4),
            Text(error!, style: TextStyle(color: c.negative, fontSize: 12)),
          ] else if (hint != null) ...[
            const SizedBox(height: 4),
            Text(hint!, style: TextStyle(color: c.disabledFg, fontSize: 11)),
          ],
        ],
      ),
    );
  }
}

/// The design's "Form fields" shell — a filled 52px input (radius 12, `line`
/// border) that grows a 1.5px accent focus ring when anything inside it takes
/// focus. Wraps a bare [TextField]/[DropdownButton]/segmented control so every
/// sheet field matches [TharwatiTextField] and the global `inputDecorationTheme`.
class SheetBox extends StatefulWidget {
  const SheetBox({
    super.key,
    required this.child,
    this.minHeight = AppSizes.field,
  });

  final Widget child;
  final double minHeight;

  @override
  State<SheetBox> createState() => _SheetBoxState();
}

class _SheetBoxState extends State<SheetBox> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Focus(
      canRequestFocus: false,
      skipTraversal: true,
      onFocusChange: (f) {
        if (f != _focused) setState(() => _focused = f);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        constraints: BoxConstraints(minHeight: widget.minHeight),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        alignment: Alignment.centerLeft,
        decoration: BoxDecoration(
          // fieldFill (not surface) so fields read against the white sheet.
          color: _focused ? c.surface : c.fieldFill,
          border: Border.all(
            color: _focused ? c.accent : c.line,
            width: _focused ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(AppRadius.field),
        ),
        child: BareFieldScope(child: widget.child),
      ),
    );
  }
}
