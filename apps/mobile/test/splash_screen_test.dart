import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/splash/splash_screen.dart';

void main() {
  testWidgets('completes after the short presentation animation', (
    tester,
  ) async {
    var completed = false;

    await tester.pumpWidget(
      MaterialApp(home: SplashScreen(onComplete: () => completed = true)),
    );

    await tester.pump(const Duration(milliseconds: 999));
    expect(completed, isFalse);

    await tester.pump(const Duration(milliseconds: 1));
    await tester.pump();
    expect(completed, isTrue);
  });
}
