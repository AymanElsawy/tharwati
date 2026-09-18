import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/auth/reset_password_page.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

void main() {
  testWidgets('recovery completion reports success and exits explicitly', (
    tester,
  ) async {
    var updated = false;
    var signedOut = false;
    var finished = false;

    await tester.pumpWidget(
      _host(
        ResetPasswordPage(
          updatePassword: (_) async => updated = true,
          signOut: () async => signedOut = true,
          onRecoveryFinished: () => finished = true,
          onRecoveryCancelled: () {},
        ),
      ),
    );

    await _submitValidPassword(tester);

    expect(updated, isTrue);
    expect(signedOut, isTrue);
    expect(find.text('Password updated'), findsOneWidget);
    expect(finished, isFalse);

    await tester.tap(find.text('Go to sign in'));
    expect(finished, isTrue);
  });

  testWidgets(
    'password update success is not reported as failure if logout fails',
    (tester) async {
      var finished = false;

      await tester.pumpWidget(
        _host(
          ResetPasswordPage(
            updatePassword: (_) async {},
            signOut: () async => throw Exception('network failure'),
            onRecoveryFinished: () => finished = true,
            onRecoveryCancelled: () {},
          ),
        ),
      );

      await _submitValidPassword(tester);

      expect(find.text('Password updated'), findsOneWidget);
      expect(
        find.text('Something went wrong. Please try again.'),
        findsNothing,
      );

      await tester.tap(find.text('Go to sign in'));
      expect(finished, isTrue);
    },
  );
}

Widget _host(Widget child) => MaterialApp(theme: AppTheme.light(), home: child);

Future<void> _submitValidPassword(WidgetTester tester) async {
  final fields = find.byType(TextFormField);
  await tester.enterText(fields.at(0), 'Abcdefghij12');
  await tester.enterText(fields.at(1), 'Abcdefghij12');
  await tester.tap(find.text('Save new password'));
  await tester.pumpAndSettle();
}
