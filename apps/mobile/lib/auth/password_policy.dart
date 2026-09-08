/// Shared client-side password rule used on Sign up and Reset password:
/// at least 12 chars, with one lowercase, one uppercase, and one digit.
/// Matches the confirmed hosted Supabase policy (docs/auth.md).
class PasswordPolicy {
  static const minLength = 12;

  static bool isValid(String? value) => problem(value) == null;

  /// Returns a human-readable problem, or null when the password is acceptable.
  /// Signature matches Flutter's `FormFieldValidator<String>`.
  static String? problem(String? value) {
    value ??= '';
    if (value.length < minLength) {
      return 'Use at least $minLength characters.';
    }
    if (!RegExp(r'[a-z]').hasMatch(value)) {
      return 'Add a lowercase letter.';
    }
    if (!RegExp(r'[A-Z]').hasMatch(value)) {
      return 'Add an uppercase letter.';
    }
    if (!RegExp(r'[0-9]').hasMatch(value)) {
      return 'Add a number.';
    }
    return null;
  }

  static const helperText =
      'At least 12 characters, with an uppercase letter, a lowercase letter, and a number.';
}
