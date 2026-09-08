import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Builds the light / dark [ThemeData] for the app from the design's Style tile.
///
/// Type family: Plus Jakarta Sans for Latin, IBM Plex Sans Arabic as the
/// fallback face so Arabic copy renders correctly under true RTL. Both are
/// pulled by `google_fonts` on first run and cached on device.
class AppTheme {
  static ThemeData light() => _build(AppColors.light);
  static ThemeData dark() => _build(AppColors.dark);

  static ThemeData _build(AppColors c) {
    final base = ThemeData(
      useMaterial3: true,
      brightness: c.brightness,
      scaffoldBackgroundColor: c.canvas,
    );

    // Plus Jakarta Sans for Latin; IBM Plex Sans Arabic as the fallback face so
    // Arabic copy renders correctly once RTL locales land.
    final arabicFallback = GoogleFonts.ibmPlexSansArabic().fontFamily;
    final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme)
        .apply(
          bodyColor: c.ink,
          displayColor: c.ink,
          fontFamilyFallback: [?arabicFallback],
        );

    final scheme = ColorScheme.fromSeed(
      seedColor: c.accent,
      brightness: c.brightness,
    ).copyWith(primary: c.accent, surface: c.surface, error: c.negative);

    return base.copyWith(
      colorScheme: scheme,
      textTheme: textTheme,
      primaryColor: c.accent,
      extensions: <ThemeExtension<dynamic>>[c],
      dividerColor: c.line,
      dividerTheme: DividerThemeData(color: c.line, space: 1, thickness: 1),
      appBarTheme: AppBarTheme(
        backgroundColor: c.canvas,
        foregroundColor: c.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      textSelectionTheme: TextSelectionThemeData(cursorColor: c.accent),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        hintStyle: TextStyle(color: c.inkMuted.withValues(alpha: 0.8)),
        labelStyle: TextStyle(
          color: c.ink.withValues(alpha: 0.85),
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
        floatingLabelBehavior: FloatingLabelBehavior.never,
        border: _fieldBorder(c.line),
        enabledBorder: _fieldBorder(c.line),
        focusedBorder: _fieldBorder(c.accent, width: 1.5),
        errorBorder: _fieldBorder(c.negative, width: 1.5),
        focusedErrorBorder: _fieldBorder(c.negative, width: 1.5),
        errorStyle: TextStyle(
          color: c.negative,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(AppSizes.button),
          backgroundColor: c.accent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: c.disabledFill,
          disabledForegroundColor: c.disabledFg,
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.button),
          ),
        ),
      ),
      // Same footprint as the filled button (Style tile: 52 tall, radius 16) so
      // a filled + outlined pair reads as one control group.
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(AppSizes.button),
          foregroundColor: c.accent,
          disabledForegroundColor: c.disabledFg,
          side: BorderSide(color: c.accent, width: 1.5),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.button),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.accent,
          minimumSize: const Size(0, AppSizes.touchTarget),
          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? c.accent
              : Colors.transparent,
        ),
        checkColor: const WidgetStatePropertyAll(Colors.white),
        side: BorderSide(color: c.inkMuted, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: c.accent),
    );
  }

  static OutlineInputBorder _fieldBorder(Color color, {double width = 1}) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.field),
        borderSide: BorderSide(color: color, width: width),
      );
}
