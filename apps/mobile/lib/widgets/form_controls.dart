import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Strips the chrome the global `inputDecorationTheme` would otherwise draw on
/// a bare [TextField], for fields that sit inside a shell — [ControlBox] or
/// `SheetBox` — which already paints the fill, border and focus ring.
///
/// Passing `border: InputBorder.none` at the call site is *not* enough:
/// `enabledBorder` / `focusedBorder` take precedence over `border` whenever the
/// field is enabled, and `filled: true` keeps painting the themed `surface`
/// fill. Together they render a second rounded box nested inside the shell.
/// Overriding the inherited theme fixes every field in the subtree at once —
/// including ones that forget to ask — while keeping `hintStyle`, `labelStyle`
/// and `errorStyle` from the app theme.
class BareFieldScope extends StatelessWidget {
  const BareFieldScope({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context);
    return Theme(
      data: base.copyWith(
        inputDecorationTheme: base.inputDecorationTheme.copyWith(
          filled: false,
          isDense: true,
          isCollapsed: true,
          contentPadding: EdgeInsets.zero,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          disabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          errorBorder: InputBorder.none,
          focusedErrorBorder: InputBorder.none,
        ),
      ),
      child: child,
    );
  }
}

/// The compact control shell from the Accounts artboard (screen 11): 44 tall,
/// radius 14, `surface` fill, hairline `line` border, 14px of padding.
///
/// Distinct from [SheetBox], which is the taller 52px *form* field used inside
/// sheets. This is the filter-bar size — a control that sits on a page beside
/// other controls rather than inside a form.
class ControlBox extends StatelessWidget {
  const ControlBox({super.key, required this.child, this.padding = 14});

  final Widget child;
  final double padding;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      height: AppSizes.touchTarget,
      padding: EdgeInsets.symmetric(horizontal: padding),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.control),
      ),
      child: BareFieldScope(child: child),
    );
  }
}

/// Search control from the Accounts artboard — leading 17px glyph in
/// `disabledFg`, the query, and a clear affordance once anything is typed.
///
/// The hint colour comes from the global `inputDecorationTheme`, so it stays in
/// step with every other field in the app.
class SearchField extends StatefulWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.hintText,
    required this.onChanged,
  });

  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String> onChanged;

  @override
  State<SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<SearchField> {
  @override
  void initState() {
    super.initState();
    // Drives the clear button's visibility; the parent may never rebuild us.
    widget.controller.addListener(_onText);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onText);
    super.dispose();
  }

  void _onText() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ControlBox(
      child: Row(
        children: [
          Icon(Icons.search, size: 17, color: c.disabledFg),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: widget.controller,
              onChanged: widget.onChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                border: InputBorder.none,
                isCollapsed: true,
                hintText: widget.hintText,
              ),
              style: TextStyle(color: c.ink, fontSize: 14),
            ),
          ),
          if (widget.controller.text.isNotEmpty)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                widget.controller.clear();
                widget.onChanged('');
              },
              child: Padding(
                padding: const EdgeInsets.only(left: 6),
                child: Icon(Icons.close, size: 16, color: c.inkMuted),
              ),
            ),
        ],
      ),
    );
  }
}

/// A `<select>` in the same 44px control shell — the mobile stand-in for the
/// web filter bar's dropdowns. (The canvas draws these as pill chips; the web
/// app is the source of truth for the Accounts tab, so they stay selects.)
class FieldDropdown<T> extends StatelessWidget {
  const FieldDropdown({
    super.key,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ControlBox(
      padding: 10,
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isDense: true,
          isExpanded: true,
          borderRadius: BorderRadius.circular(AppRadius.field),
          icon: Icon(Icons.expand_more, size: 18, color: c.inkMuted),
          onChanged: (v) => onChanged(v as T),
          items: items,
          style: TextStyle(color: c.ink, fontSize: 13),
        ),
      ),
    );
  }
}
