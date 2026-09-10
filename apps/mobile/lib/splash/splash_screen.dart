import 'dart:async';

import 'package:flutter/material.dart';

/// Presentation-only bridge between the native launch screen and the existing
/// auth gate. It has no session, routing, or Supabase responsibilities.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.onComplete});

  final VoidCallback onComplete;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  static const _duration = Duration(milliseconds: 1000);
  static const _finalLogoSize = 132.0;
  static const _initialLogoSize = 200.0;
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _duration,
  );
  late final Timer _completion;
  late final Animation<double> _fade = Tween<double>(begin: 0.82, end: 1).animate(
    CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.50, curve: Curves.easeOutCubic),
    ),
  );
  late final Animation<double> _scale = Tween<double>(
    begin: _initialLogoSize / _finalLogoSize,
    end: 1,
  ).animate(
    CurvedAnimation(
      parent: _controller,
      curve: const Cubic(0.22, 1, 0.36, 1),
    ),
  );
  late final Animation<Offset> _settle = Tween<Offset>(
    begin: const Offset(0, 0.045),
    end: Offset.zero,
  ).animate(
    CurvedAnimation(
      parent: _controller,
      curve: const Cubic(0.22, 1, 0.36, 1),
    ),
  );

  @override
  void initState() {
    super.initState();
    _controller.forward();
    _completion = Timer(_duration, () {
      if (mounted) {
        widget.onComplete();
      }
    });
  }

  @override
  void dispose() {
    _completion.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF071C17),
    body: SafeArea(
      child: Center(
        child: FadeTransition(
          opacity: _fade,
          child: SlideTransition(
            position: _settle,
            child: ScaleTransition(
              scale: _scale,
              child: Image.asset(
                'assets/branding/tharwati-app-icon.png',
                width: _finalLogoSize,
                height: _finalLogoSize,
                semanticLabel: 'Tharwati',
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
