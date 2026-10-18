import 'package:flutter/material.dart';

import 'tokens.dart';

const _font = 'PlusJakartaSans';

ThemeData buildTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final bg = dark ? Brand.darkBg : Brand.lightBg;
  final surface = dark ? Brand.darkSurface : Brand.lightSurface;
  final text = dark ? Brand.darkText : Brand.lightText;
  final muted = dark ? Brand.darkMuted : Brand.lightMuted;
  final border = dark ? Brand.darkBorder : Brand.lightBorder;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: dark ? Brand.gold300 : Brand.navy700,
    onPrimary: dark ? Brand.navy900 : Colors.white,
    primaryContainer: dark ? Brand.navy700 : const Color(0xFFE3E9F5),
    onPrimaryContainer: dark ? Brand.gold300 : Brand.navy900,
    secondary: Brand.gold500,
    onSecondary: Brand.navy900,
    secondaryContainer: dark ? const Color(0xFF3A3220) : const Color(0xFFFBF0D8),
    onSecondaryContainer: dark ? Brand.gold300 : const Color(0xFF5C4310),
    error: SeverityColors.critical,
    onError: Colors.white,
    surface: surface,
    onSurface: text,
    onSurfaceVariant: muted,
    surfaceContainerLowest: bg,
    surfaceContainerLow: dark ? const Color(0xFF101A31) : const Color(0xFFF9FAFC),
    surfaceContainer: surface,
    surfaceContainerHigh: dark ? const Color(0xFF1A2646) : const Color(0xFFEEF1F6),
    surfaceContainerHighest: dark ? const Color(0xFF213058) : const Color(0xFFE6EAF2),
    outline: border,
    outlineVariant: border,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    brightness: brightness,
    fontFamily: _font,
    scaffoldBackgroundColor: bg,
  );

  final controlShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.control));
  const buttonPadding = EdgeInsets.symmetric(horizontal: 20, vertical: 14);
  const minButton = Size(48, 52);

  OutlineInputBorder outline(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.control),
        borderSide: BorderSide(color: c, width: w),
      );

  return base.copyWith(
    textTheme: base.textTheme
        .copyWith(
          displaySmall: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, height: 1.15),
          headlineSmall: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, height: 1.2),
          titleLarge: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          titleMedium: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          bodyLarge: const TextStyle(fontSize: 16, height: 1.45),
          bodyMedium: const TextStyle(fontSize: 14, height: 1.45),
          labelLarge: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          labelSmall: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        )
        .apply(fontFamily: _font, bodyColor: text, displayColor: text),
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      foregroundColor: text,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: _font,
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: text,
      ),
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: dark ? 0 : 1,
      shadowColor: Brand.navy900.withValues(alpha: 0.12),
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.card),
        side: dark ? BorderSide(color: border) : BorderSide.none,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: minButton,
        padding: buttonPadding,
        shape: controlShape,
        textStyle: const TextStyle(fontFamily: _font, fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: minButton,
        padding: buttonPadding,
        shape: controlShape,
        side: BorderSide(color: border),
        foregroundColor: text,
        textStyle: const TextStyle(fontFamily: _font, fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, 48),
        shape: controlShape,
        textStyle: const TextStyle(fontFamily: _font, fontSize: 14, fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: outline(border),
      enabledBorder: outline(border),
      focusedBorder: outline(scheme.primary, 2),
      errorBorder: outline(SeverityColors.critical),
      focusedErrorBorder: outline(SeverityColors.critical, 2),
      labelStyle: TextStyle(color: muted),
      hintStyle: TextStyle(color: muted),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: const StadiumBorder(),
      side: BorderSide(color: border),
      labelStyle: TextStyle(fontFamily: _font, color: text, fontWeight: FontWeight.w500),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: scheme.secondaryContainer,
      height: 68,
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontFamily: _font, fontSize: 12, fontWeight: FontWeight.w700, color: text),
      ),
    ),
    dividerTheme: DividerThemeData(color: border, thickness: 1, space: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.control)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: surface,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
  );
}
