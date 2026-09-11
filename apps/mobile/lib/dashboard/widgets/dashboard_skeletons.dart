import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../../i18n/app_language.dart';
import '../../i18n/dashboard_copy.dart';
import 'dashboard_card.dart';

/// Full-screen loading state (Dashboard artboard 09). Fades only — no sliding
/// sheen — and holds still under reduced motion.
class DashboardLoadingBody extends StatelessWidget {
  const DashboardLoadingBody({super.key});

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    return _Shimmer(
      enabled: !reduceMotion,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _Block(height: 150),
          const SizedBox(height: 14),
          DashboardCard(
            child: Row(
              children: [
                const _Circle(size: 96),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    children: const [
                      _Block(height: 11),
                      SizedBox(height: 10),
                      _Block(height: 11, widthFactor: 0.8),
                      SizedBox(height: 10),
                      _Block(height: 11, widthFactor: 0.6),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const _Block(height: 120),
          const SizedBox(height: 14),
          const _Block(height: 120),
          const SizedBox(height: 20),
          Center(
            child: Text(
              DashboardCopy.of(AppLanguageScope.of(context).language).loadingNetWorth,
              style: TextStyle(color: context.colors.inkMuted, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.height, this.widthFactor = 1});

  final double height;
  final double widthFactor;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: widthFactor,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: context.colors.line,
          borderRadius: BorderRadius.circular(height > 40 ? 20 : 6),
        ),
      ),
    );
  }
}

class _Circle extends StatelessWidget {
  const _Circle({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: context.colors.line,
      shape: BoxShape.circle,
    ),
  );
}

class _Shimmer extends StatefulWidget {
  const _Shimmer({required this.child, required this.enabled});

  final Widget child;
  final bool enabled;

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  @override
  void initState() {
    super.initState();
    if (widget.enabled) _ctrl.repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) {
      return Opacity(opacity: 0.7, child: widget.child);
    }
    return FadeTransition(
      opacity: Tween(begin: 0.45, end: 0.9).animate(_ctrl),
      child: widget.child,
    );
  }
}
