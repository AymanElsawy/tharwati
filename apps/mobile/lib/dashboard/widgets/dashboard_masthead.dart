import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../../i18n/app_language.dart';
import '../../i18n/dashboard_copy.dart';
import '../../widgets/tharwati_brand.dart';

/// Dashboard-only mountain masthead: localized date, personalized greeting, a
/// visual-only notification bell, and an avatar initial. Numeric/date text
/// stays LTR.
class DashboardMasthead extends StatelessWidget {
  const DashboardMasthead({
    super.key,
    required this.name,
    this.hasNotificationDot = true,
    this.welcome = false,
  });

  final String? name;
  final bool hasNotificationDot;

  static const height = 286.0;

  /// Use the first-run "Welcome" greeting instead of "Good morning/afternoon/
  /// evening".
  final bool welcome;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = DashboardCopy.of(AppLanguageScope.of(context).language);
    final now = DateTime.now();
    final firstName = (name == null || name!.trim().isEmpty)
        ? null
        : name!.trim().split(RegExp(r'\s+')).first;
    final greeting = copy.greeting(firstName ?? '', now.hour, welcome: welcome);

    return SizedBox(
      height: height,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // The approved source image has clipped lettering at its far-left
          // edge. Scale from the right so that source edge is not rendered.
          ClipRect(
            child: Transform.scale(
              scale: 1.14,
              alignment: Alignment.centerRight,
              child: SizedBox.expand(
                child: Image.asset(
                  'assets/images/mountain.png',
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: c.isDark
                    ? [
                        c.canvas.withValues(alpha: 0.98),
                        c.canvas.withValues(alpha: 0.28),
                        c.canvas.withValues(alpha: 0.78),
                      ]
                    : [
                        c.canvas.withValues(alpha: 0.88),
                        c.canvas.withValues(alpha: 0.55),
                        c.canvas.withValues(alpha: 0.22),
                      ],
                stops: const [0, 0.4, 1],
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                8,
                AppSpacing.gutter,
                36,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      const TharwatiBrand(),
                      const Spacer(),
                      _BellButton(
                        dot: hasNotificationDot,
                        onMasthead: c.ink,
                        canvas: c.canvas,
                      ),
                      const SizedBox(width: 8),
                      _Avatar(initial: firstName, color: c.ink),
                    ],
                  ),
                  const SizedBox(height: 62),
                  Text(
                    greeting,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: c.ink,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    copy.date(now),
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    copy.wealthAtGlance,
                    style: TextStyle(
                      color: c.ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.initial, required this.color});

  final String? initial;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: AppSizes.touchTarget,
    height: AppSizes.touchTarget,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.10),
      border: Border.all(color: color.withValues(alpha: 0.18)),
      borderRadius: BorderRadius.circular(AppRadius.field),
    ),
    child: Text(
      (initial?.isNotEmpty ?? false) ? initial![0].toUpperCase() : '·',
      style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w800),
    ),
  );
}

class _BellButton extends StatelessWidget {
  const _BellButton({
    required this.dot,
    required this.onMasthead,
    required this.canvas,
  });

  final bool dot;
  final Color onMasthead;
  final Color canvas;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Notifications',
      button: true,
      child: Container(
        width: AppSizes.touchTarget,
        height: AppSizes.touchTarget,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: onMasthead.withValues(alpha: 0.10),
          border: Border.all(color: onMasthead.withValues(alpha: 0.18)),
          borderRadius: BorderRadius.circular(AppRadius.field),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Icon(Icons.notifications_none_rounded, size: 22, color: onMasthead),
            if (dot)
              Positioned(
                right: -1,
                top: -1,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: context.colors.artworkGold,
                    shape: BoxShape.circle,
                    border: Border.all(color: canvas, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
