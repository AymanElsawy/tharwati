import 'package:flutter/material.dart';

/// Semantic visual tokens for the Flutter client. Screens consume these through
/// [BuildContext.colors] rather than reading palette values directly.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.accent,
    required this.onAccent,
    required this.accentSoft,
    required this.canvas,
    required this.surface,
    required this.ink,
    required this.inkMuted,
    required this.negative,
    required this.negativeSoft,
    required this.metal,
    required this.artworkGold,
    required this.metalSoft,
    required this.line,
    required this.fieldFill,
    required this.successSoft,
    required this.successBorder,
    required this.warningFg,
    required this.warningSoft,
    required this.warningBorder,
    required this.dangerBorder,
    required this.disabledFill,
    required this.disabledFg,
    required this.focusRing,
    required this.brightness,
  });

  final Color accent;
  final Color onAccent;
  final Color accentSoft;
  final Color canvas;
  final Color surface;
  final Color ink;
  final Color inkMuted;
  final Color negative;
  final Color negativeSoft;
  final Color metal;
  final Color artworkGold;
  final Color metalSoft;
  final Color line;
  final Color fieldFill;
  final Color successSoft;
  final Color successBorder;
  final Color warningFg;
  final Color warningSoft;
  final Color warningBorder;
  final Color dangerBorder;
  final Color disabledFill;
  final Color disabledFg;
  final Color focusRing;
  final Brightness brightness;

  bool get isDark => brightness == Brightness.dark;

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return t < 0.5 ? this : other;
  }

  static const light = AppColors(
    accent: Color(0xFF0F3D32),
    onAccent: Color(0xFFFFFFFF),
    accentSoft: Color(0xFFEAF0E8),
    canvas: Color(0xFFF8F6ED),
    surface: Color(0xFFFFFEFA),
    ink: Color(0xFF0B2A22),
    inkMuted: Color(0xFF59655E),
    negative: Color(0xFF8B3025),
    negativeSoft: Color(0xFFF1E1D7),
    metal: Color(0xFF9A753A),
    artworkGold: Color(0xFFC9A96B),
    metalSoft: Color(0xFFF2EBD9),
    line: Color(0xFFE7E8DF),
    fieldFill: Color(0xFFF1F0E8),
    successSoft: Color(0xFFEAF0E8),
    successBorder: Color(0xFFC9D9CE),
    warningFg: Color(0xFF76591F),
    warningSoft: Color(0xFFF2EBD9),
    warningBorder: Color(0xFFE1D1AE),
    dangerBorder: Color(0xFFE0BBB2),
    disabledFill: Color(0xFFE1E4DC),
    disabledFg: Color(0xFF7A857F),
    focusRing: Color(0xFF4E8B76),
    brightness: Brightness.light,
  );

  static const dark = AppColors(
    accent: Color(0xFFC9A96B),
    onAccent: Color(0xFF071C17),
    accentSoft: Color(0xFF183E31),
    canvas: Color(0xFF071C17),
    surface: Color(0xFF102E26),
    ink: Color(0xFFF8F6ED),
    inkMuted: Color(0xFFB8C7BE),
    negative: Color(0xFFF2A49B),
    negativeSoft: Color(0xFF301E1C),
    metal: Color(0xFFC9A96B),
    artworkGold: Color(0xFFC9A96B),
    metalSoft: Color(0xFF263426),
    line: Color(0xFF244339),
    fieldFill: Color(0xFF0B251E),
    successSoft: Color(0xFF183E31),
    successBorder: Color(0xFF356150),
    warningFg: Color(0xFFC9A96B),
    warningSoft: Color(0xFF263426),
    warningBorder: Color(0xFF4B5F43),
    dangerBorder: Color(0xFF70443E),
    disabledFill: Color(0xFF244339),
    disabledFg: Color(0xFF789087),
    focusRing: Color(0xFF76B49C),
    brightness: Brightness.dark,
  );
}

class AppRadius {
  static const field = 12.0;
  static const button = 16.0;
  static const card = 16.0;
  static const chip = 999.0;
}

class AppSpacing {
  static const hairline = 4.0;
  static const inRow = 8.0;
  static const rowGap = 12.0;
  static const card = 16.0;
  static const gutter = 18.0;
  static const section = 24.0;
}

class AppSizes {
  static const touchTarget = 44.0;
  static const field = 52.0;
  static const button = 52.0;
  static const listRow = 60.0;
}

/// Categorical chart colours. Their order remains stable so a category keeps
/// its colour; charts still require accompanying text labels.
class AppChartColors {
  static const light = <Color>[
    Color(0xFF0F3D32),
    Color(0xFF4E8B76),
    Color(0xFFC9A96B),
    Color(0xFFB8734F),
    Color(0xFFA7B9A7),
    Color(0xFF8B3025),
    Color(0xFFE7DDC9),
  ];

  static const dark = <Color>[
    Color(0xFF258F72),
    Color(0xFF76B49C),
    Color(0xFFC9A96B),
    Color(0xFFC98369),
    Color(0xFFA7B9A7),
    Color(0xFFF2A49B),
    Color(0xFF8A775B),
  ];

  static List<Color> of(AppColors c) => c.isDark ? dark : light;
}

extension AppColorsX on BuildContext {
  AppColors get colors =>
      Theme.of(this).extension<AppColors>() ?? AppColors.light;
}
