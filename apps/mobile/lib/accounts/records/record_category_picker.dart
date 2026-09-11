import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../../widgets/app_sheet.dart';
import '../../widgets/primary_button.dart';
import '../accounts_repository.dart' show AccountsException;
import 'records_models.dart';
import 'records_repository.dart';
import 'records_service.dart';

/// Searchable category picker — port of the web `RecordCategoryPicker`. Shows
/// the selected `Main → Sub` pair, opens a search sheet, and links to the
/// category manager.
class RecordCategoryField extends StatelessWidget {
  const RecordCategoryField({
    super.key,
    required this.categories,
    required this.mainCategoryId,
    required this.subcategoryId,
    required this.onChanged,
    required this.onManage,
    this.error,
  });

  final List<VisibleRecordMainCategory> categories;
  final String mainCategoryId;
  final String subcategoryId;
  final void Function(String mainId, String subId) onChanged;
  final VoidCallback onManage;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    VisibleRecordMainCategory? main;
    for (final m in categories) {
      if (m.id == mainCategoryId) main = m;
    }
    VisibleRecordSubcategory? sub;
    for (final s in main?.subcategories ?? const <VisibleRecordSubcategory>[]) {
      if (s.id == subcategoryId) sub = s;
    }
    final label = (main != null && sub != null)
        ? '${main.name} → ${sub.name}'
        : 'Choose a category';

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Category',
                  style: TextStyle(
                    color: c.ink.withValues(alpha: 0.85),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: onManage,
                icon: Icon(
                  Icons.settings_outlined,
                  size: 14,
                  color: c.inkMuted,
                ),
                label: Text(
                  'Manage categories',
                  style: TextStyle(color: c.inkMuted, fontSize: 12),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minimumSize: const Size(0, 32),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          InkWell(
            onTap: () async {
              final picked =
                  await showModalBottomSheet<RecordCategorySearchResult>(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: c.surface,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(26),
                      ),
                    ),
                    builder: (_) => _CategoryPickerSheet(
                      categories: categories,
                      selectedSubcategoryId: subcategoryId,
                    ),
                  );
              if (picked != null) {
                onChanged(picked.mainCategoryId, picked.subcategoryId);
              }
            },
            borderRadius: BorderRadius.circular(AppRadius.field),
            child: SheetBox(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: (main != null && sub != null)
                            ? c.ink
                            : c.disabledFg,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Icon(Icons.expand_more, size: 18, color: c.inkMuted),
                ],
              ),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 4),
            Text(error!, style: TextStyle(color: c.negative, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}

class _CategoryPickerSheet extends StatefulWidget {
  const _CategoryPickerSheet({
    required this.categories,
    required this.selectedSubcategoryId,
  });
  final List<VisibleRecordMainCategory> categories;
  final String selectedSubcategoryId;

  @override
  State<_CategoryPickerSheet> createState() => _CategoryPickerSheetState();
}

class _CategoryPickerSheetState extends State<_CategoryPickerSheet> {
  final _query = TextEditingController();
  final _expanded = <String>{};

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final q = _query.text.trim();
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        top: false,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.85,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: c.line,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
                child: SheetBox(
                  child: Row(
                    children: [
                      Icon(Icons.search, size: 17, color: c.inkMuted),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _query,
                          autofocus: true,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            isCollapsed: true,
                            hintText: 'Search categories',
                          ),
                          style: TextStyle(color: c.ink, fontSize: 15),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Flexible(child: _list(context, q)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _list(BuildContext context, String q) {
    final c = context.colors;
    if (q.isNotEmpty) {
      final matches = searchVisibleRecordCategories(widget.categories, q);
      if (matches.isEmpty) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Text(
            'No matching categories.',
            style: TextStyle(color: c.inkMuted, fontSize: 14),
          ),
        );
      }
      return ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
        children: [
          for (final m in matches)
            _row(
              context,
              '${m.mainCategoryName} → ${m.subcategoryName}',
              m.subcategoryId == widget.selectedSubcategoryId,
              () => Navigator.of(context).pop(m),
            ),
        ],
      );
    }
    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
      children: [
        for (final main in widget.categories) ...[
          _MainRow(
            name: main.name,
            expanded: _expanded.contains(main.id),
            onTap: () => setState(() {
              _expanded.contains(main.id)
                  ? _expanded.remove(main.id)
                  : _expanded.add(main.id);
            }),
          ),
          if (_expanded.contains(main.id))
            for (final sub in main.subcategories)
              Padding(
                padding: const EdgeInsets.only(left: 16),
                child: _row(
                  context,
                  sub.name,
                  sub.id == widget.selectedSubcategoryId,
                  () => Navigator.of(context).pop(
                    RecordCategorySearchResult(
                      mainCategoryId: main.id,
                      mainCategoryName: main.name,
                      subcategoryId: sub.id,
                      subcategoryName: sub.name,
                    ),
                  ),
                ),
              ),
        ],
      ],
    );
  }

  Widget _row(
    BuildContext context,
    String label,
    bool selected,
    VoidCallback onTap,
  ) {
    final c = context.colors;
    return ListTile(
      dense: true,
      title: Text(
        label,
        style: TextStyle(
          color: selected ? c.accent : c.ink,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      trailing: selected ? Icon(Icons.check, size: 18, color: c.accent) : null,
      onTap: onTap,
    );
  }
}

class _MainRow extends StatelessWidget {
  const _MainRow({
    required this.name,
    required this.expanded,
    required this.onTap,
  });
  final String name;
  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ListTile(
      dense: true,
      onTap: onTap,
      title: Text(
        name,
        style: TextStyle(
          color: c.ink,
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
      trailing: Icon(
        expanded ? Icons.expand_more : Icons.chevron_right,
        size: 18,
        color: c.inkMuted,
      ),
    );
  }
}

/// Category manager — port of `RecordCategoryManagerDialog`. Add main/sub
/// categories, rename, hide/restore defaults, archive custom ones.
class RecordCategoryManagerSheet extends StatefulWidget {
  const RecordCategoryManagerSheet({super.key, this.repository});
  final RecordsRepository? repository;

  @override
  State<RecordCategoryManagerSheet> createState() =>
      _RecordCategoryManagerSheetState();
}

class _RecordCategoryManagerSheetState
    extends State<RecordCategoryManagerSheet> {
  late final RecordsRepository _repo = widget.repository ?? RecordsRepository();
  final _name = TextEditingController();
  String _parentId = '';
  List<RecordCategory> _categories = const [];
  Map<String, RecordCategoryOverride> _overrides = const {};
  bool _loading = true;
  bool _error = false;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final cats = await _repo.getCategories();
      final overrides = await _repo.getOverrides();
      setState(() {
        _categories = cats;
        _overrides = {for (final o in overrides) o.categoryId: o};
        _error = false;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = true;
        _loading = false;
      });
    }
  }

  Future<void> _perform(Future<void> Function() action) async {
    try {
      await action();
      _changed = true;
      await _load();
    } on AccountsException {
      setState(() => _error = true);
    } catch (_) {
      setState(() => _error = true);
    }
  }

  String _displayName(RecordCategory c) => _overrides[c.id]?.name ?? c.name;

  List<RecordCategory> get _ordered {
    final mains = _categories.where((c) => c.isMain).toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return [
      for (final main in mains) ...[
        main,
        ...(_categories.where((c) => c.parentId == main.id).toList()
          ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder))),
      ],
    ];
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final mains = _categories.where((cat) => cat.isMain).toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

    return AppSheet(
      title: 'Manage categories',
      children: [
        SheetField(
          label: 'Category name',
          child: SheetBox(
            child: TextField(
              controller: _name,
              decoration: const InputDecoration(
                border: InputBorder.none,
                isCollapsed: true,
                hintText: 'Category name',
              ),
              style: TextStyle(color: c.ink, fontSize: 15),
            ),
          ),
        ),
        SheetField(
          label: 'Add under',
          child: SheetBox(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _parentId,
                isDense: true,
                isExpanded: true,
                onChanged: (v) => setState(() => _parentId = v ?? ''),
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('Add main category'),
                  ),
                  for (final m in mains)
                    DropdownMenuItem(
                      value: m.id,
                      child: Text(
                        'Add subcategory: ${_displayName(m)}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                style: TextStyle(
                  color: c.ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
        PrimaryButton(
          label: 'Save',
          onPressed: () {
            final name = _name.text.trim();
            if (name.isEmpty) return;
            final parent = _parentId.isEmpty ? null : _parentId;
            _perform(() async {
              await _repo.createCustomCategory(
                parentId: parent,
                level: parent == null ? 'main' : 'subcategory',
                name: name,
                sortOrder: nextRecordCategorySortOrder(_categories, parent),
              );
              _name.clear();
            });
          },
        ),
        const SizedBox(height: 14),
        if (_error)
          Text(
            'We couldn’t load categories.',
            style: TextStyle(color: c.negative, fontSize: 13),
          ),
        if (_loading)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          )
        else
          for (final cat in _ordered)
            _ManagerRow(
              key: ValueKey(cat.id),
              name: _displayName(cat),
              isMain: cat.isMain,
              isDefault: cat.isDefault,
              isHidden:
                  (_overrides[cat.id]?.isHidden ?? false) || cat.isArchived,
              hasOverride: _overrides.containsKey(cat.id),
              onRename: (newName) => _perform(() async {
                if (cat.userId != null) {
                  await _repo.updateCustomCategory(cat.id, name: newName);
                } else {
                  await _repo.setDefaultOverride(
                    cat.id,
                    name: newName,
                    isHidden: _overrides[cat.id]?.isHidden ?? false,
                  );
                }
              }),
              onHide: () => _perform(
                () => _repo.setDefaultOverride(
                  cat.id,
                  name: _overrides[cat.id]?.name,
                  isHidden: true,
                ),
              ),
              onRestore: () => _perform(() => _repo.restoreDefault(cat.id)),
              onArchive: () => _perform(
                () => _repo.updateCustomCategory(cat.id, isArchived: true),
              ),
            ),
        const SizedBox(height: 8),
        NeutralButton(
          label: 'Close',
          onPressed: () => Navigator.of(context).pop(_changed),
        ),
      ],
    );
  }
}

class _ManagerRow extends StatefulWidget {
  const _ManagerRow({
    super.key,
    required this.name,
    required this.isMain,
    required this.isDefault,
    required this.isHidden,
    required this.hasOverride,
    required this.onRename,
    required this.onHide,
    required this.onRestore,
    required this.onArchive,
  });

  final String name;
  final bool isMain;
  final bool isDefault;
  final bool isHidden;
  final bool hasOverride;
  final ValueChanged<String> onRename;
  final VoidCallback onHide;
  final VoidCallback onRestore;
  final VoidCallback onArchive;

  @override
  State<_ManagerRow> createState() => _ManagerRowState();
}

class _ManagerRowState extends State<_ManagerRow> {
  bool _editing = false;
  late final _ctl = TextEditingController(text: widget.name);

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: EdgeInsets.fromLTRB(widget.isMain ? 12 : 26, 8, 6, 8),
      decoration: BoxDecoration(
        color: widget.isMain ? c.fieldFill : null,
        border: Border(bottom: BorderSide(color: c.line)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _editing
                ? TextField(
                    controller: _ctl,
                    autofocus: true,
                    decoration: const InputDecoration(isDense: true),
                    style: TextStyle(color: c.ink, fontSize: 14),
                  )
                : Text.rich(
                    TextSpan(
                      text: widget.name,
                      style: TextStyle(
                        color: c.ink,
                        fontSize: widget.isMain ? 14 : 13,
                        fontWeight: widget.isMain
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                      children: [
                        if (widget.isHidden)
                          TextSpan(
                            text: '  (Hidden)',
                            style: TextStyle(
                              color: c.disabledFg,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                      ],
                    ),
                  ),
          ),
          if (_editing)
            TextButton(
              onPressed: () {
                final v = _ctl.text.trim();
                if (v.isEmpty) return;
                widget.onRename(v);
                setState(() => _editing = false);
              },
              child: const Text('Save'),
            )
          else
            PopupMenuButton<String>(
              icon: Icon(Icons.more_horiz, size: 18, color: c.inkMuted),
              onSelected: (v) {
                switch (v) {
                  case 'rename':
                    _ctl.text = widget.name;
                    setState(() => _editing = true);
                  case 'hide':
                    widget.onHide();
                  case 'restore':
                    widget.onRestore();
                  case 'archive':
                    widget.onArchive();
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'rename', child: Text('Rename')),
                if (widget.isDefault && !widget.isHidden)
                  const PopupMenuItem(value: 'hide', child: Text('Hide')),
                if (widget.isDefault && widget.hasOverride)
                  const PopupMenuItem(
                    value: 'restore',
                    child: Text('Restore default'),
                  ),
                if (!widget.isDefault)
                  const PopupMenuItem(value: 'archive', child: Text('Archive')),
              ],
            ),
        ],
      ),
    );
  }
}
