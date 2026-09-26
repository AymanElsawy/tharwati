import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/account_exit_coordinator.dart';
import '../errors/safe_app_error.dart';
import '../main.dart';
import '../i18n/app_language.dart';
import '../i18n/settings_copy.dart';
import '../theme/tokens.dart';
import '../theme/app_theme_controller.dart';
import '../widgets/primary_button.dart';
import 'account_deletion_controller.dart';
import 'delete_account_dialog.dart';
import 'settings_profile_repository.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    super.key,
    this.email,
    this.onSignOut,
    this.profileStore,
    this.deletionGateway,
    this.deletionExit,
  });

  final String? email;
  final Future<void> Function()? onSignOut;
  final SettingsProfileStore? profileStore;
  final AccountDeletionGateway? deletionGateway;
  final AccountDeletionExit? deletionExit;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final SettingsProfileStore _profileStore;
  final _fullName = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _loadError;
  String? _saveError;
  bool _saved = false;
  int _loadVersion = 0;

  @override
  void initState() {
    super.initState();
    _profileStore = widget.profileStore ?? SettingsProfileRepository();
    _loadProfile();
  }

  @override
  void dispose() {
    _loadVersion++;
    _fullName.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final version = ++_loadVersion;
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final fullName = await _profileStore.loadFullName();
      if (!mounted || version != _loadVersion) return;
      _fullName.text = fullName ?? '';
      if (mounted) {
        setState(() => _loading = false);
      }
    } catch (error) {
      if (!mounted || version != _loadVersion) return;
      setState(() {
        _loading = false;
        _loadError = safeAppErrorMessage(
          error,
          AppLanguageScope.of(context).language,
        );
      });
    }
  }

  Future<void> _saveProfile() async {
    setState(() {
      _saving = true;
      _saveError = null;
      _saved = false;
    });
    try {
      _fullName.text = await _profileStore.updateFullName(_fullName.text) ?? '';
      if (mounted) {
        setState(() {
          _saving = false;
          _saved = true;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _saveError = SettingsCopy.of(
          AppLanguageScope.of(context).language,
        ).saveError;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final copy = SettingsCopy.of(AppLanguageScope.of(context).language);
    final email = widget.email ?? authService.currentUser?.email ?? '';
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                AppSpacing.gutter,
                AppSpacing.gutter,
                0,
              ),
              sliver: SliverList.list(
                children: [
                  Text(
                    copy.title,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: c.ink,
                      fontSize: 31,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.section),
                  _SectionLabel(copy.profile),
                  const SizedBox(height: AppSpacing.rowGap),
                  _ProfileCard(
                    fullName: _fullName,
                    email: email,
                    loading: _loading,
                    saving: _saving,
                    loadError: _loadError,
                    saveError: _saveError,
                    saved: _saved,
                    onRetry: _loadProfile,
                    onSave: _saveProfile,
                    copy: copy,
                  ),
                  const SizedBox(height: AppSpacing.section),
                  _SectionLabel(copy.preferences),
                  const SizedBox(height: AppSpacing.rowGap),
                  _LanguagePreferenceCard(copy: copy),
                  const SizedBox(height: AppSpacing.section),
                  _SectionLabel(copy.appearance),
                  const SizedBox(height: AppSpacing.rowGap),
                  _AppearancePreferenceCard(copy: copy),
                  const SizedBox(height: AppSpacing.section),
                  _SectionLabel(copy.dangerZone),
                  const SizedBox(height: AppSpacing.rowGap),
                  _DangerZoneCard(
                    copy: copy,
                    onDeleteAccount: email.isEmpty
                        ? null
                        : () => _openDeleteAccount(email, copy),
                  ),
                ],
              ),
            ),
            SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter,
                  AppSpacing.section,
                  AppSpacing.gutter,
                  AppSpacing.gutter,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _SectionLabel(copy.session),
                    const SizedBox(height: AppSpacing.rowGap),
                    SizedBox(
                      height: AppSizes.button,
                      child: OutlinedButton.icon(
                        onPressed: _saving ? null : _signOut,
                        icon: const Icon(Icons.logout_rounded, size: 20),
                        label: Text(copy.signOut),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: c.negative,
                          side: BorderSide(color: c.dangerBorder),
                          backgroundColor: c.negativeSoft,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _signOut() => widget.onSignOut?.call() ?? authService.signOut();

  Future<void> _openDeleteAccount(String email, SettingsCopy copy) async {
    final controller = AccountDeletionController(
      gateway:
          widget.deletionGateway ??
          SupabaseAccountDeletionGateway(Supabase.instance.client),
      exit: widget.deletionExit ?? accountExitCoordinator,
      email: email,
    )..open();
    try {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => DeleteAccountDialog(controller: controller, copy: copy),
      );
    } finally {
      controller.dispose();
    }
  }
}

class _DangerZoneCard extends StatelessWidget {
  const _DangerZoneCard({required this.copy, required this.onDeleteAccount});

  final SettingsCopy copy;
  final VoidCallback? onDeleteAccount;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.card),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.negative.withValues(alpha: 0.45)),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            copy.deleteAccount,
            style: TextStyle(
              color: c.negative,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(copy.deleteAccountSummary, style: TextStyle(color: c.inkMuted)),
          const SizedBox(height: 16),
          OutlinedButton(
            key: const Key('open-delete-account'),
            onPressed: onDeleteAccount,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(AppSizes.touchTarget),
              foregroundColor: c.negative,
              side: BorderSide(color: c.negative),
            ),
            child: Text(copy.deleteAccount),
          ),
        ],
      ),
    );
  }
}

class _LanguagePreferenceCard extends StatelessWidget {
  const _LanguagePreferenceCard({required this.copy});

  final SettingsCopy copy;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final controller = AppLanguageScope.of(context);
    final language = controller.language;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.card),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.language_rounded, color: c.inkMuted, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  copy.languageLabel,
                  style: TextStyle(
                    color: c.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                language.displayName,
                style: TextStyle(color: c.inkMuted, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _LanguageOption(
                  label: AppLanguage.en.displayName,
                  selected: language == AppLanguage.en,
                  onPressed: () => controller.setLanguage(AppLanguage.en),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _LanguageOption(
                  label: AppLanguage.ar.displayName,
                  selected: language == AppLanguage.ar,
                  onPressed: () => controller.setLanguage(AppLanguage.ar),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LanguageOption extends StatelessWidget {
  const _LanguageOption({
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(AppSizes.touchTarget),
        foregroundColor: selected ? c.accent : c.inkMuted,
        backgroundColor: selected ? c.accentSoft : c.surface,
        side: BorderSide(color: selected ? c.accent : c.line),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      ),
      child: Text(label),
    );
  }
}

class _AppearancePreferenceCard extends StatelessWidget {
  const _AppearancePreferenceCard({required this.copy});

  final SettingsCopy copy;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final controller = AppThemeScope.of(context);
    final themeMode = controller.themeMode;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.card),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.brightness_6_rounded, color: c.inkMuted, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  copy.appearanceLabel,
                  style: TextStyle(
                    color: c.ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Text(
                themeMode == ThemeMode.dark ? copy.dark : copy.light,
                style: TextStyle(color: c.inkMuted, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _AppearanceOption(
                  label: copy.light,
                  selected: themeMode == ThemeMode.light,
                  onPressed: () => controller.setThemeMode(ThemeMode.light),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _AppearanceOption(
                  label: copy.dark,
                  selected: themeMode == ThemeMode.dark,
                  onPressed: () => controller.setThemeMode(ThemeMode.dark),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AppearanceOption extends StatelessWidget {
  const _AppearanceOption({
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(AppSizes.touchTarget),
        foregroundColor: selected ? c.accent : c.inkMuted,
        backgroundColor: selected ? c.accentSoft : c.surface,
        side: BorderSide(color: selected ? c.accent : c.line),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      ),
      child: Text(label),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Text(
    label,
    style: TextStyle(
      color: context.colors.inkMuted,
      fontSize: 10,
      fontWeight: FontWeight.w700,
      letterSpacing: 1.8,
    ),
  );
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.fullName,
    required this.email,
    required this.loading,
    required this.saving,
    required this.loadError,
    required this.saveError,
    required this.saved,
    required this.onRetry,
    required this.onSave,
    required this.copy,
  });

  final TextEditingController fullName;
  final String email;
  final bool loading;
  final bool saving;
  final String? loadError;
  final String? saveError;
  final bool saved;
  final VoidCallback onRetry;
  final VoidCallback onSave;
  final SettingsCopy copy;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.card),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.line),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: loading
          ? const SizedBox(
              height: 112,
              child: Center(child: CircularProgressIndicator()),
            )
          : loadError != null
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(loadError!, style: TextStyle(color: c.negative)),
                TextButton(onPressed: onRetry, child: Text(copy.tryAgain)),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  copy.fullName,
                  style: TextStyle(color: c.ink, fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: fullName,
                  enabled: !saving,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  decoration: InputDecoration(hintText: copy.fullNameHint),
                ),
                const SizedBox(height: 16),
                Text(copy.email, style: TextStyle(color: c.ink, fontSize: 13)),
                const SizedBox(height: 6),
                Container(
                  height: AppSizes.field,
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: c.fieldFill,
                    border: Border.all(color: c.line),
                    borderRadius: BorderRadius.circular(AppRadius.field),
                  ),
                  child: Text(
                    email.isEmpty ? copy.emailUnavailable : email,
                    overflow: TextOverflow.ellipsis,
                    textDirection: TextDirection.ltr,
                    style: TextStyle(color: c.inkMuted, fontSize: 14),
                  ),
                ),
                const SizedBox(height: 16),
                if (saveError != null) ...[
                  Text(saveError!, style: TextStyle(color: c.negative)),
                  const SizedBox(height: 12),
                ],
                if (saved) ...[
                  Text(copy.profileUpdated, style: TextStyle(color: c.accent)),
                  const SizedBox(height: 12),
                ],
                PrimaryButton(
                  label: saving ? copy.saving : copy.saveChanges,
                  busy: saving,
                  onPressed: onSave,
                ),
              ],
            ),
    );
  }
}
