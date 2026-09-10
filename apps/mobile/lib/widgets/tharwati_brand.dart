import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// Theme-aware rendering of the approved source-derived logo raster. The image
/// itself carries the green/ivory and gold artwork; it is never tinted or
/// stretched.
class TharwatiBrand extends StatelessWidget {
  const TharwatiBrand({super.key, this.width = 54});

  static const lightAsset = 'assets/branding/tharwati-logo-light.png';
  static const darkAsset = 'assets/branding/tharwati-logo-dark.png';
  static const aspectRatio = 876 / 506;

  final double width;

  @override
  Widget build(BuildContext context) {
    final asset = context.colors.isDark ? darkAsset : lightAsset;
    return Image.asset(
      asset,
      width: width,
      height: width / aspectRatio,
      fit: BoxFit.contain,
      semanticLabel: 'Tharwati',
    );
  }
}
