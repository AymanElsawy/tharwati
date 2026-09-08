import 'package:flutter/material.dart';

import '../auth/password_policy.dart';
import '../theme/tokens.dart';

/// Four-segment meter under the Sign up password field (Flow 1 · 02). Segments
/// fill as the password satisfies each part of [PasswordPolicy]: 12+ characters,
/// a lowercase letter, an uppercase letter, a digit.
class PasswordStrengthBar extends StatelessWidget {
  const PasswordStrengthBar({super.key, required this.password});

  final String password;

  static int scoreFor(String value) {
    var score = 0;
    if (value.length >= PasswordPolicy.minLength) score++;
    if (RegExp(r'[a-z]').hasMatch(value)) score++;
    if (RegExp(r'[A-Z]').hasMatch(value)) score++;
    if (RegExp(r'[0-9]').hasMatch(value)) score++;
    return score;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final score = password.isEmpty ? 0 : scoreFor(password);
    final label = switch (score) {
      0 => '',
      1 => 'Weak',
      2 => 'Fair',
      3 => 'Good',
      _ => 'Strong',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Row(
          children: List.generate(4, (i) {
            return Expanded(
              child: Container(
                margin: EdgeInsets.only(right: i == 3 ? 0 : 4),
                height: 4,
                decoration: BoxDecoration(
                  color: i < score ? c.accent : c.line,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }),
        ),
        if (label.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            '$label · at least ${PasswordPolicy.minLength} characters, '
            'with upper, lower and a number',
            style: TextStyle(
              color: c.inkMuted,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}
