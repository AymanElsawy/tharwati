import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/settings/settings_page.dart';
import 'package:tharwati_mobile/settings/settings_profile_repository.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';

void main() {
  testWidgets('loads, saves the canonical name, and shows session email', (
    tester,
  ) async {
    final store = _FakeProfileStore('Ada Lovelace');
    var signedOut = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: SettingsPage(
          email: 'investor@example.com',
          profileStore: store,
          onSignOut: () async => signedOut = true,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Ada Lovelace'), findsOneWidget);
    expect(find.text('investor@example.com'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '  Grace Hopper  ');
    await tester.tap(find.text('Save changes'));
    await tester.pump();

    expect(store.savedName, '  Grace Hopper  ');
    expect(find.text('Profile updated.'), findsOneWidget);

    await tester.tap(find.text('Sign out'));
    await tester.pump();
    expect(signedOut, isTrue);
  });
}

class _FakeProfileStore implements SettingsProfileStore {
  _FakeProfileStore(this.fullName);

  String? fullName;
  String? savedName;

  @override
  Future<String?> loadFullName() async => fullName;

  @override
  Future<String?> updateFullName(String value) async {
    savedName = value;
    fullName = normalizeFullName(value);
    return fullName;
  }
}
