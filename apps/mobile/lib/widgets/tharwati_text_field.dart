import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Labelled form field matching the design's "Form fields" component: a 13/600
/// label sitting above a 52px input with radius 12 and a green focus ring.
///
/// Wraps [TextFormField] and forwards the parts screens actually vary. For
/// passwords, pass [obscurable] to get the eye toggle from artboard 01.
class TharwatiTextField extends StatefulWidget {
  const TharwatiTextField({
    super.key,
    required this.label,
    this.controller,
    this.hintText,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.obscurable = false,
    this.obscureByDefault = true,
    this.validator,
    this.onChanged,
    this.onFieldSubmitted,
    this.autofocus = false,
  });

  final String label;
  final TextEditingController? controller;
  final String? hintText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final List<String>? autofillHints;

  /// When true the field renders a show/hide eye and starts obscured.
  final bool obscurable;
  final bool obscureByDefault;

  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final bool autofocus;

  @override
  State<TharwatiTextField> createState() => _TharwatiTextFieldState();
}

class _TharwatiTextFieldState extends State<TharwatiTextField> {
  late bool _obscured = widget.obscurable && widget.obscureByDefault;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6, left: 2),
          child: Text(
            widget.label,
            style: TextStyle(
              color: c.ink.withValues(alpha: 0.85),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        TextFormField(
          controller: widget.controller,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          autofillHints: widget.autofillHints,
          autofocus: widget.autofocus,
          obscureText: _obscured,
          validator: widget.validator,
          onChanged: widget.onChanged,
          onFieldSubmitted: widget.onFieldSubmitted,
          style: TextStyle(
            color: c.ink,
            fontSize: 15,
            fontWeight: FontWeight.w500,
          ),
          decoration: InputDecoration(
            hintText: widget.hintText,
            suffixIcon: widget.obscurable
                ? IconButton(
                    onPressed: () => setState(() => _obscured = !_obscured),
                    icon: Icon(
                      _obscured
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      size: 20,
                      color: c.inkMuted,
                    ),
                    tooltip: _obscured ? 'Show password' : 'Hide password',
                  )
                : null,
          ),
        ),
      ],
    );
  }
}
