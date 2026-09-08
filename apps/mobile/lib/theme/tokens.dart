import 'package:flutter/material.dart';

/// Design tokens from the "Style tile" artboard of the Tharwati Mobile design
/// canvas (Claude Design project 2634f553). One green accent everywhere; the
/// amber `metal` tint is the only second hue, reserved for gold/silver.
///
/// Two palettes — [AppColors.light] and [AppColors.dark]. Screens never read raw
/// hex; they pull from the [AppColors] handed to them by [AppTheme] via
/// `context.colors` (see extension at the bottom of this file).
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.accent,
    required this.accentSoft,
    required this.canvas,
    required this.surface,
    required this.ink,
    required this.inkMuted,
    required this.negative,
    required this.negativeSoft,
    required this.metal,
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
  final Color accentSoft;
  final Color canvas;
  final Color surface;
  final Color ink;
  final Color inkMuted;
  final Color negative;
  final Color negativeSoft;
  final Color metal;
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

  // The palette is one of two fixed constants; no per-field theming, so
  // copyWith is an identity and lerp is a hard swap at the midpoint.
  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return t < 0.5 ? this : other;
  }

  static const light = AppColors(
    accent: Color(0xFF15694A),
    accentSoft: Color(0xFFE4EFE8),
    canvas: Color(0xFFE8EEEB),
    surface: Color(0xFFFFFFFF),
    ink: Color(0xFF0F1F1A),
    inkMuted: Color(0xFF5A6B64),
    negative: Color(0xFFB4443A),
    negativeSoft: Color(0xFFFDF4F3),
    metal: Color(0xFFC97A16),
    metalSoft: Color(0xFFFBEFDD),
    line: Color(0xFFDDE5E1),
    fieldFill: Color(0xFFF4F7F5),
    successSoft: Color(0xFFE4EFE8),
    successBorder: Color(0xFFBEDCCB),
    warningFg: Color(0xFF8A5A0C),
    warningSoft: Color(0xFFFDF6EA),
    warningBorder: Color(0xFFE4C9A8),
    dangerBorder: Color(0xFFE7C7C3),
    disabledFill: Color(0xFFC7D5CE),
    disabledFg: Color(0xFF7C8B85),
    focusRing: Color(0xFF9BC7B3),
    brightness: Brightness.light,
  );

  static const dark = AppColors(
    accent: Color(0xFF3E9E77),
    accentSoft: Color(0xFF173025),
    canvas: Color(0xFF0B1210),
    surface: Color(0xFF141E1B),
    ink: Color(0xFFEAF2EE),
    inkMuted: Color(0xFF93A49D),
    negative: Color(0xFFE4796D),
    negativeSoft: Color(0xFF2A1613),
    metal: Color(0xFFE0A040),
    metalSoft: Color(0xFF2E2312),
    line: Color(0xFF24312C),
    fieldFill: Color(0xFF101917),
    successSoft: Color(0xFF173025),
    successBorder: Color(0xFF2E5343),
    warningFg: Color(0xFFE0A040),
    warningSoft: Color(0xFF2E2312),
    warningBorder: Color(0xFF5C4726),
    dangerBorder: Color(0xFF5C302B),
    disabledFill: Color(0xFF24312C),
    disabledFg: Color(0xFF6B7D76),
    focusRing: Color(0xFF3E9E77),
    brightness: Brightness.dark,
  );
}

/// Corner radii — field 12, button 16, card 22, pill full (Style tile).
class AppRadius {
  static const field = 12.0;
  static const button = 16.0;
  static const card = 22.0;
  static const chip = 999.0;
}

/// 4 · 8 · 12 · 16 · 20 · 28 spacing steps (Style tile).
class AppSpacing {
  static const hairline = 4.0;
  static const inRow = 8.0;
  static const rowGap = 12.0;
  static const card = 16.0;
  static const gutter = 20.0;
  static const section = 28.0;
}

/// Minimum interactive height / list-row height from the Style tile.
class AppSizes {
  static const touchTarget = 44.0;
  static const field = 52.0;
  static const button = 52.0;
  static const listRow = 60.0;
}

/// Categorical series colours for the dashboard donuts. Not role tokens — these
/// are the four hues the Dashboard artboards (07/08) use for the assets
/// breakdown: accent, metal, plus a slate blue and a soft green that only ever
/// appear inside a chart. Order is stable so a category keeps its colour.
class AppChartColors {
  static const light = <Color>[
    Color(0xFF15694A), // accent
    Color(0xFFC97A16), // metal
    Color(0xFF3D5A80), // slate
    Color(0xFF9BC7B3), // mint
    Color(0xFF6E8B84), // muted (5th+ categories)
    Color(0xFFB4443A), // negative-ish (rare)
    Color(0xFFCBB79A), // sand
  ];

  static const dark = <Color>[
    Color(0xFF3E9E77),
    Color(0xFFE0A040),
    Color(0xFF7FA3CF),
    Color(0xFF2C5F49),
    Color(0xFF8FB6A3),
    Color(0xFFE4796D),
    Color(0xFF6A5C45),
  ];

  static List<Color> of(AppColors c) => c.isDark ? dark : light;
}

/// `context.colors` — the active [AppColors], registered as a [ThemeExtension]
/// by [AppTheme]. Falls back to the light palette if the theme lacks it.
extension AppColorsX on BuildContext {
  AppColors get colors =>
      Theme.of(this).extension<AppColors>() ?? AppColors.light;
}
