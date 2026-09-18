import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/auth/account_exit_coordinator.dart';

void main() {
  testWidgets('forced account exit replaces authenticated content with Login', (
    tester,
  ) async {
    final coordinator = AccountExitCoordinator();
    await tester.pumpWidget(
      MaterialApp(
        home: ListenableBuilder(
          listenable: coordinator,
          builder: (_, _) => Text(
            coordinator.forceSignedOutActive
                ? 'Login'
                : 'Authenticated content',
          ),
        ),
      ),
    );
    expect(find.text('Authenticated content'), findsOneWidget);

    coordinator.forceSignedOut();
    await tester.pump();

    expect(find.text('Login'), findsOneWidget);
    expect(find.text('Authenticated content'), findsNothing);
  });
}
