import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Builds the app's semantic light and dark themes. Inter is the default UI and
/// financial face; Playfair Display is reserved for display/page/section styles;
/// Noto Sans Arabic remains the fallback when Arabic copy is introduced.
class AppTheme {
  static ThemeData light() => _build(AppColors.light);
  static ThemeData dark() => _build(AppColors.dark);

  static ThemeData _build(AppColors c) {
    final base = ThemeData(
      useMaterial3: true,
      brightness: c.brightness,
      scaffoldBackgroundColor: c.canvas,
    );

    final arabicFallback = GoogleFonts.notoSansArabic().fontFamily;
    final serifFamily = GoogleFonts.playfairDisplay().fontFamily;
    final bodyTheme = GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: c.ink,
      displayColor: c.ink,
      fontFamilyFallback: [?arabicFallback],
    );
    TextStyle? serif(TextStyle? style) =>
        style?.copyWith(fontFamily: serifFamily, fontWeight: FontWeight.w400);
    final textTheme = bodyTheme.copyWith(
      displayLarge: serif(bodyTheme.displayLarge),
      displayMedium: serif(bodyTheme.displayMedium),
      displaySmall: serif(bodyTheme.displaySmall),
      headlineLarge: serif(bodyTheme.headlineLarge),
      headlineMedium: serif(bodyTheme.headlineMedium),
      headlineSmall: serif(bodyTheme.headlineSmall),
      titleLarge: serif(bodyTheme.titleLarge),
    );

    final scheme =
        ColorScheme.fromSeed(
          seedColor: c.accent,
          brightness: c.brightness,
        ).copyWith(
          primary: c.accent,
          onPrimary: c.onAccent,
          surface: c.surface,
          error: c.negative,
        );

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
        titleTextStyle: textTheme.titleLarge?.copyWith(color: c.ink),
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
        focusedBorder: _fieldBorder(c.focusRing, width: 1.5),
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
          foregroundColor: c.onAccent,
          disabledBackgroundColor: c.disabledFill,
          disabledForegroundColor: c.disabledFg,
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.button),
          ),
        ),
      ),
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
        checkColor: WidgetStatePropertyAll(c.onAccent),
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
