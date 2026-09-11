import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../account_models.dart';

/// The rounded type badge on account cards / headers. Gold & silver use the
/// reserved amber "metal" tint (Style tile); every other type uses the green
/// accent-soft.
class AccountTypeIcon extends StatelessWidget {
  const AccountTypeIcon({super.key, required this.type, this.size = 40});

  final AccountType type;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final metal = type.isMetal;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: metal ? c.metalSoft : c.accentSoft,
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      child: Icon(
        type.icon,
        size: size * 0.5,
        color: metal ? c.metal : c.accent,
      ),
    );
  }
}
