import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';
import 'package:tharwati_mobile/widgets/app_sheet.dart';
import 'package:tharwati_mobile/widgets/form_controls.dart';

/// The decoration `TextField` actually resolves after merging the inherited
/// `inputDecorationTheme` — what gets painted, not what the call site asked for.
InputDecoration resolvedDecoration(WidgetTester tester) =>
    tester.widget<InputDecorator>(find.byType(InputDecorator)).decoration;

Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
  MaterialApp(
    theme: AppTheme.light(),
    home: Scaffold(body: Center(child: child)),
  ),
);

void main() {
  // A shell paints the fill, border and focus ring itself. If the field inside
  // also draws the themed chrome you get a rounded box nested in a rounded box.
  group('shells neutralise the themed field chrome', () {
    for (final (name, build) in <(String, Widget Function())>[
      ('SheetBox', () => const SheetBox(child: TextField())),
      ('ControlBox', () => const ControlBox(child: TextField())),
    ]) {
      testWidgets(name, (tester) async {
        await pump(tester, build());
        final d = resolvedDecoration(tester);

        expect(d.filled, isFalse, reason: 'a second fill inside the shell');
        expect(d.enabledBorder, InputBorder.none);
        expect(d.focusedBorder, InputBorder.none);
        expect(d.errorBorder, InputBorder.none);
        expect(d.focusedErrorBorder, InputBorder.none);
        expect(d.contentPadding, EdgeInsets.zero);

        // Typography still comes from the app theme.
        expect(d.hintStyle, isNotNull);
      });
    }

    testWidgets('SearchField renders no nested box', (tester) async {
      await pump(
        tester,
        SearchField(
          controller: TextEditingController(),
          hintText: 'Search by account name',
          onChanged: (_) {},
        ),
      );
      final d = resolvedDecoration(tester);
      expect(d.filled, isFalse);
      expect(d.enabledBorder, InputBorder.none);
      expect(d.hintText, 'Search by account name');
    });
  });

  // The override must be scoped to the shell, not leak into the whole app.
  testWidgets('a bare TextField outside a shell keeps the app chrome', (
    tester,
  ) async {
    await pump(tester, const TextField());
    final d = resolvedDecoration(tester);
    expect(d.filled, isTrue);
    expect(d.enabledBorder, isNot(InputBorder.none));
  });

  testWidgets('SearchField shows a clear affordance only once non-empty', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await pump(
      tester,
      SearchField(
        controller: controller,
        hintText: 'Search',
        onChanged: (_) {},
      ),
    );
    expect(find.byIcon(Icons.close), findsNothing);

    await tester.enterText(find.byType(TextField), 'wallet');
    await tester.pump();
    expect(find.byIcon(Icons.close), findsOneWidget);
  });
}
