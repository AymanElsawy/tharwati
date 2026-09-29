import 'package:flutter/material.dart';

import '../../core/decimals.dart';
import '../../theme/tokens.dart';

/// Financial performance color for both Gold and Silver, independent of metal identity.
TextStyle metalGainTextStyle(
  AppColors colors,
  String gain, {
  required double fontSize,
}) {
  final sign = D.compare(gain, '0');
  return TextStyle(
    color: sign == null || sign == 0
        ? colors.inkMuted
        : sign < 0
        ? colors.negative
        : colors.positive,
    fontSize: fontSize,
    fontWeight: FontWeight.w700,
  );
}
