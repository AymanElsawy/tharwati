import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/accounts/records/record_category_picker.dart';
import 'package:tharwati_mobile/accounts/records/records_models.dart';
import 'package:tharwati_mobile/i18n/app_language.dart';
import 'package:tharwati_mobile/theme/app_theme.dart';
import 'package:tharwati_mobile/theme/tokens.dart';

void main() {
  const categories = [
    VisibleRecordMainCategory(
      id: 'living',
      name: 'Living',
      sortOrder: 1,
      subcategories: [
        VisibleRecordSubcategory(id: 'groceries', name: 'Groceries'),
        VisibleRecordSubcategory(id: 'rent', name: 'Rent'),
      ],
    ),
    VisibleRecordMainCategory(
      id: 'empty',
      name: 'No children',
      sortOrder: 2,
      subcategories: [],
    ),
  ];

  Future<void> pumpPicker(
    WidgetTester tester, {
    AppLanguage language = AppLanguage.en,
    ThemeData? theme,
  }) async {
    final controller = AppLanguageController(store: _LanguageStore(language));
    await controller.load();
    await tester.pumpWidget(
      MaterialApp(
        theme: theme ?? AppTheme.light(),
        builder: (context, child) => AppLanguageScope(
          controller: controller,
          child: Directionality(
            textDirection: language.direction,
            child: child ?? const SizedBox.shrink(),
          ),
        ),
        home: Scaffold(
          body: RecordCategoryField(
            categories: categories,
            mainCategoryId: '',
            subcategoryId: '',
            onChanged: (_, _) {},
            onManage: () {},
          ),
        ),
      ),
    );
    await tester.tap(
      find.byKey(const ValueKey('record-category-field-trigger')),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('subcategory hierarchy is collapsed until its parent expands', (
    tester,
  ) async {
    await pumpPicker(tester);

    expect(
      find.byKey(const ValueKey('record-category-children-living')),
      findsNothing,
    );
    expect(
      find.byKey(const ValueKey('record-category-chevron-living')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('record-category-chevron-empty')),
      findsNothing,
    );

    await tester.tap(find.byKey(const ValueKey('record-category-main-living')));
    await tester.pumpAndSettle();

    final parentText = tester.getRect(find.text('Living'));
    final childText = tester.getRect(find.text('Groceries'));
    expect(find.text('Groceries'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('record-category-chevron-living')),
      findsOneWidget,
    );
    expect(childText.left, greaterThan(parentText.left));
    final group = tester.widget<Container>(
      find.descendant(
        of: find.byKey(const ValueKey('record-category-children-living')),
        matching: find.byType(Container),
      ),
    );
    expect(
      (group.decoration! as BoxDecoration).color,
      AppColors.light.fieldFill,
    );
  });

  testWidgets('nested hierarchy mirrors its indentation in RTL', (
    tester,
  ) async {
    await pumpPicker(tester, language: AppLanguage.ar, theme: AppTheme.dark());

    await tester.tap(find.byKey(const ValueKey('record-category-main-living')));
    await tester.pumpAndSettle();

    final parentText = tester.getRect(find.text('Living'));
    final childText = tester.getRect(find.text('Groceries'));
    expect(childText.right, lessThan(parentText.right));
    final group = tester.widget<Container>(
      find.descendant(
        of: find.byKey(const ValueKey('record-category-children-living')),
        matching: find.byType(Container),
      ),
    );
    expect(
      (group.decoration! as BoxDecoration).color,
      AppColors.dark.fieldFill,
    );
  });
}

class _LanguageStore implements LanguageStore {
  const _LanguageStore(this.language);

  final AppLanguage language;

  @override
  Future<String?> readLanguage() async => language.code;

  @override
  Future<void> writeLanguage(String code) async {}
}
