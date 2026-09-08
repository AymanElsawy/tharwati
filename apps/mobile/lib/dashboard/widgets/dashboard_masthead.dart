import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// The green (or dark) header band on the Dashboard artboards (07/08): localized
/// date, personalized greeting, a visual-only notification bell, and an avatar
/// initial. Numeric/date text stays LTR.
class DashboardMasthead extends StatelessWidget {
  const DashboardMasthead({
    super.key,
    required this.name,
    this.hasNotificationDot = true,
    this.welcome = false,
  });

  final String? name;
  final bool hasNotificationDot;

  /// Use the first-run "Welcome" greeting instead of "Good morning/afternoon/
  /// evening" (Dashboard artboard 10).
  final bool welcome;

  static String _partOfDay(int hour) {
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  static const _months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  static const _weekdays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final now = DateTime.now();
    final onBand = c.isDark ? c.ink : Colors.white;
    final bandColor = c.isDark ? const Color(0xFF123227) : c.accent;
    final subtle = c.isDark ? const Color(0xFF8FB6A3) : const Color(0xFFB7DAC8);
    final firstName = (name == null || name!.trim().isEmpty)
        ? null
        : name!.trim().split(RegExp(r'\s+')).first;
    final lead = welcome ? 'Welcome' : _partOfDay(now.hour);
    final greeting = firstName == null ? lead : '$lead, $firstName';

    return Container(
      width: double.infinity,
      color: bandColor,
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.of(context).padding.top + 12,
        20,
        22,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_weekdays[now.weekday - 1]}, ${now.day} ${_months[now.month - 1]}',
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    color: subtle,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  greeting,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: onBand,
                    fontSize: 20,
                    height: 1.2,
                    letterSpacing: -0.4,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          _BellButton(dot: hasNotificationDot, onBand: onBand, band: bandColor),
          const SizedBox(width: 8),
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.isDark ? c.accent : Colors.white,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              (firstName?.isNotEmpty ?? false)
                  ? firstName![0].toUpperCase()
                  : '·',
              style: TextStyle(
                color: c.isDark ? const Color(0xFF0B1210) : c.accent,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BellButton extends StatelessWidget {
  const _BellButton({
    required this.dot,
    required this.onBand,
    required this.band,
  });

  final bool dot;
  final Color onBand;
  final Color band;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Notifications',
      button: true,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: onBand.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Icon(Icons.notifications_none_rounded, size: 22, color: onBand),
            if (dot)
              Positioned(
                right: -1,
                top: -1,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0A040),
                    shape: BoxShape.circle,
                    border: Border.all(color: band, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
