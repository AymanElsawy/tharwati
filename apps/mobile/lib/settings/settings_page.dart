import 'package:flutter/material.dart';

import '../main.dart';
import '../theme/tokens.dart';
import '../widgets/primary_button.dart';
import 'settings_profile_repository.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    super.key,
    this.email,
    this.onSignOut,
    this.profileStore,
  });

  final String? email;
  final Future<void> Function()? onSignOut;
  final SettingsProfileStore? profileStore;

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

  @override
  void initState() {
    super.initState();
    _profileStore = widget.profileStore ?? SettingsProfileRepository();
    _loadProfile();
  }

  @override
  void dispose() {
    _fullName.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      _fullName.text = await _profileStore.loadFullName() ?? '';
      if (mounted) {
        setState(() => _loading = false);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = 'We couldn\'t load your profile. Try again.';
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
        _saveError = 'We couldn\'t save your profile. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final email = widget.email ?? authService.currentUser?.email ?? '';
    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, viewport) => SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.gutter),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: viewport.maxHeight - (AppSpacing.gutter * 2),
              ),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Settings',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: c.ink,
                        fontSize: 31,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.section),
                    _SectionLabel('PROFILE'),
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
                    ),
                    const Spacer(),
                    const SizedBox(height: AppSpacing.section),
                    _SectionLabel('SESSION'),
                    const SizedBox(height: AppSpacing.rowGap),
                    SizedBox(
                      height: AppSizes.button,
                      child: OutlinedButton.icon(
                        onPressed: _saving ? null : _signOut,
                        icon: const Icon(Icons.logout_rounded, size: 20),
                        label: const Text('Sign out'),
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
          ),
        ),
      ),
    );
  }

  Future<void> _signOut() => widget.onSignOut?.call() ?? authService.signOut();
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
          ? const SizedBox(height: 112, child: Center(child: CircularProgressIndicator()))
          : loadError != null
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(loadError!, style: TextStyle(color: c.negative)),
                TextButton(onPressed: onRetry, child: const Text('Try again')),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Full name', style: TextStyle(color: c.ink, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: fullName,
                  enabled: !saving,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  decoration: const InputDecoration(hintText: 'Your full name'),
                ),
                const SizedBox(height: 16),
                Text('Email', style: TextStyle(color: c.ink, fontSize: 13)),
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
                    email.isEmpty ? 'Email unavailable' : email,
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
                  Text('Profile updated.', style: TextStyle(color: c.accent)),
                  const SizedBox(height: 12),
                ],
                PrimaryButton(
                  label: saving ? 'Saving…' : 'Save changes',
                  busy: saving,
                  onPressed: onSave,
                ),
              ],
            ),
    );
  }
}
