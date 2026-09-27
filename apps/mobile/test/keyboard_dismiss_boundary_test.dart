import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';
import 'package:tharwati_mobile/widgets/app_sheet.dart';
import 'package:tharwati_mobile/widgets/keyboard_dismiss_boundary.dart';

Widget _app(Widget home) => MaterialApp(
  theme: AppTheme.light(),
  builder: (_, child) => AppKeyboardDismissBoundary(child: child!),
  home: Scaffold(body: home),
);

void main() {
  void testOnIos(String description, WidgetTesterCallback body) {
    testWidgets(description, (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      try {
        await body(tester);
      } finally {
        debugDefaultTargetPlatformOverride = null;
      }
    });
  }

  testOnIos('touch outside a numeric field dismisses without changing it', (
    tester,
  ) async {
    final focus = FocusNode();
    final value = TextEditingController();
    addTearDown(focus.dispose);
    addTearDown(value.dispose);
    const blank = Key('blank-area');
    await tester.pumpWidget(
      _app(
        AppSheet(
          title: 'Transfer',
          children: [
            TextField(
              focusNode: focus,
              controller: value,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
            ),
            const SizedBox(key: blank, height: 100),
          ],
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), '1000.50');
    expect(focus.hasFocus, isTrue);
    await tester.tapAt(tester.getCenter(find.byKey(blank)));
    await tester.pump();
    expect(focus.hasFocus, isFalse);
    expect(value.text, '1000.50');
  });

  testOnIos('dragging a form dismisses the keyboard without changing values', (
    tester,
  ) async {
    final focus = FocusNode();
    final value = TextEditingController();
    addTearDown(focus.dispose);
    addTearDown(value.dispose);
    await tester.pumpWidget(
      _app(
        AppSheet(
          title: 'Brokerage trade',
          children: [
            TextField(focusNode: focus, controller: value),
            for (var index = 0; index < 8; index++)
              SizedBox(height: 130, child: Text('Section $index')),
          ],
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), '1.25');
    expect(focus.hasFocus, isTrue);
    await tester.drag(
      find.byType(SingleChildScrollView),
      const Offset(0, -240),
    );
    await tester.pump();
    expect(focus.hasFocus, isFalse);
    expect(value.text, '1.25');
  });

  testOnIos('another field, selector, Save, Cancel and navigation keep taps', (
    tester,
  ) async {
    final first = FocusNode();
    final second = FocusNode();
    final firstValue = TextEditingController();
    final secondValue = TextEditingController();
    addTearDown(first.dispose);
    addTearDown(second.dispose);
    addTearDown(firstValue.dispose);
    addTearDown(secondValue.dispose);
    var selected = 'One';
    var saves = 0;
    var cancels = 0;
    await tester.pumpWidget(
      _app(
        StatefulBuilder(
          builder: (context, setState) => AppSheet(
            title: 'Account form',
            children: [
              TextField(focusNode: first, controller: firstValue),
              TextField(focusNode: second, controller: secondValue),
              DropdownButton<String>(
                value: selected,
                items: const [
                  DropdownMenuItem(value: 'One', child: Text('One')),
                  DropdownMenuItem(value: 'Two', child: Text('Two')),
                ],
                onChanged: (value) => setState(() => selected = value!),
              ),
              TextButton(onPressed: () => saves++, child: const Text('Save')),
              TextButton(
                onPressed: () => cancels++,
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const Scaffold(body: Text('Next screen')),
                  ),
                ),
                child: const Text('Navigate'),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField).at(0), '1000');
    await tester.tap(find.byType(TextField).at(1));
    await tester.pump();
    expect(first.hasFocus, isFalse);
    expect(second.hasFocus, isTrue);
    await tester.enterText(find.byType(TextField).at(1), 'actual');
    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Two').last);
    await tester.pumpAndSettle();
    expect(selected, 'Two');
    await tester.tap(find.text('Save'));
    await tester.tap(find.text('Cancel'));
    expect(saves, 1);
    expect(cancels, 1);
    expect(firstValue.text, '1000');
    expect(secondValue.text, 'actual');
    await tester.tap(find.text('Navigate'));
    await tester.pumpAndSettle();
    expect(find.text('Next screen'), findsOneWidget);
  });

  testOnIos('standalone page fields share outside-tap dismissal', (
    tester,
  ) async {
    final focus = FocusNode();
    addTearDown(focus.dispose);
    const blank = Key('page-blank');
    await tester.pumpWidget(
      _app(
        Column(
          children: [
            TextField(focusNode: focus),
            const ColoredBox(
              color: Colors.transparent,
              child: SizedBox(key: blank, height: 120),
            ),
          ],
        ),
      ),
    );
    await tester.tap(find.byType(TextField));
    expect(focus.hasFocus, isTrue);
    await tester.tapAt(tester.getCenter(find.byKey(blank)));
    await tester.pump();
    expect(focus.hasFocus, isFalse);
  });

  testOnIos('standalone page drag dismisses without changing input', (
    tester,
  ) async {
    final focus = FocusNode();
    final value = TextEditingController();
    addTearDown(focus.dispose);
    addTearDown(value.dispose);
    await tester.pumpWidget(
      _app(
        ListView(
          children: [
            TextField(focusNode: focus, controller: value),
            for (var index = 0; index < 8; index++)
              SizedBox(height: 140, child: Text('Item $index')),
          ],
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), 'preserved');
    await tester.drag(find.byType(ListView), const Offset(0, -240));
    await tester.pump();
    expect(focus.hasFocus, isFalse);
    expect(value.text, 'preserved');
  });

  testOnIos('modal sheet keeps Save working after a blank-area tap', (
    tester,
  ) async {
    final focus = FocusNode();
    final value = TextEditingController();
    addTearDown(focus.dispose);
    addTearDown(value.dispose);
    bool? result;
    const blank = Key('modal-blank');
    await tester.pumpWidget(
      _app(
        Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              result = await showAppSheet<bool>(
                context,
                builder: (_) => AppSheet(
                  title: 'Record',
                  children: [
                    TextField(focusNode: focus, controller: value),
                    const SizedBox(key: blank, height: 80),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      child: const Text('Save record'),
                    ),
                  ],
                ),
              );
            },
            child: const Text('Open sheet'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open sheet'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'amount');
    await tester.tapAt(tester.getCenter(find.byKey(blank)));
    await tester.pump();
    expect(focus.hasFocus, isFalse);
    await tester.tap(find.text('Save record'));
    await tester.pumpAndSettle();
    expect(result, isTrue);
    expect(value.text, 'amount');
  });
}
