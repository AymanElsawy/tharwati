import 'dart:io';

enum MobileEnvironment { development, production }

/// Public build configuration. Validation is local and never contacts a backend.
class MobileEnvironmentConfig {
  const MobileEnvironmentConfig({
    required this.environmentName,
    required this.supabaseUrl,
    required this.supabasePublishableKey,
  });

  final String environmentName;
  final String supabaseUrl;
  final String supabasePublishableKey;

  MobileEnvironment get environment => switch (environmentName) {
    'development' => MobileEnvironment.development,
    'production' => MobileEnvironment.production,
    _ => throw const FormatException(
      'THARWATI_ENVIRONMENT must be development or production.',
    ),
  };

  void validate() {
    // Reading the identity rejects missing/unsupported environments first.
    final selectedEnvironment = environment;
    final uri = Uri.tryParse(supabaseUrl);
    final hostLabel = RegExp(r'^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$');
    if (uri == null ||
        RegExp(r'\s').hasMatch(supabaseUrl) ||
        (uri.scheme != 'https' && uri.scheme != 'http') ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        uri.host.length > 253 ||
        (RegExp(r'^[0-9.]+$').hasMatch(uri.host) &&
            InternetAddress.tryParse(uri.host) == null) ||
        (InternetAddress.tryParse(uri.host) == null &&
            uri.host
                .split('.')
                .any(
                  (label) => label.length > 63 || !hostLabel.hasMatch(label),
                )) ||
        uri.userInfo.isNotEmpty ||
        (uri.hasPort && (uri.port < 1 || uri.port > 65535)) ||
        (uri.path.isNotEmpty && uri.path != '/') ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw const FormatException(
        'SUPABASE_URL must be a valid project base URL.',
      );
    }
    final local = _isLocalEndpoint(uri.host);
    if (selectedEnvironment == MobileEnvironment.production
        ? uri.scheme != 'https' || local
        : uri.scheme == 'http' && !local) {
      throw const FormatException(
        'Production requires non-local HTTPS; development HTTP requires a local endpoint.',
      );
    }
    if (supabasePublishableKey.trim() != supabasePublishableKey ||
        !RegExp(
          r'^sb_publishable_[A-Za-z0-9_-]+$',
        ).hasMatch(supabasePublishableKey)) {
      throw const FormatException(
        'SUPABASE_PUBLISHABLE_KEY must be a public publishable key.',
      );
    }
  }

  static bool _isLocalEndpoint(String host) {
    final normalized = host.toLowerCase().replaceFirst(RegExp(r'\.$'), '');
    final address = InternetAddress.tryParse(normalized);
    if (address == null) {
      return !normalized.contains('.') ||
          normalized == 'localhost' ||
          normalized.endsWith('.localhost') ||
          normalized.endsWith('.local') ||
          normalized.endsWith('.lan') ||
          normalized.endsWith('.home.arpa') ||
          normalized.endsWith('.internal') ||
          normalized.endsWith('.test');
    }
    if (address.isLoopback || address.isLinkLocal) return true;
    final bytes = address.rawAddress;
    if (bytes.length == 16) {
      // Unspecified, unique-local, and IPv4-mapped local addresses.
      if (bytes.every((byte) => byte == 0) || (bytes[0] & 0xfe) == 0xfc) {
        return true;
      }
      if (bytes.take(10).every((byte) => byte == 0) &&
          bytes[10] == 255 &&
          bytes[11] == 255) {
        return _isLocalEndpoint(bytes.skip(12).join('.'));
      }
      return false;
    }
    return bytes[0] == 0 ||
        bytes[0] == 10 ||
        bytes[0] == 127 ||
        (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
        (bytes[0] == 192 && bytes[1] == 168) ||
        (bytes[0] == 100 && bytes[1] >= 64 && bytes[1] <= 127);
  }
}

/// Required Dart defines for every build; absent values stay empty, never default.
class Env {
  static const environmentName = String.fromEnvironment('THARWATI_ENVIRONMENT');
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');

  static const supabasePublishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
  );

  static const configuration = MobileEnvironmentConfig(
    environmentName: environmentName,
    supabaseUrl: supabaseUrl,
    supabasePublishableKey: supabasePublishableKey,
  );

  /// Custom-scheme deep link the Supabase auth emails return to, so the app —
  /// not the web app — handles them. Used for both the signup confirmation and
  /// the password-recovery email. Must be allow-listed in Supabase → Auth →
  /// URL Configuration → Redirect URLs, and is registered natively in
  /// android/app/src/main/AndroidManifest.xml and ios/Runner/Info.plist.
  static const authDeepLink = 'tharwati://auth-callback';

  /// Back-compat alias.
  static const passwordResetRedirect = authDeepLink;
}
