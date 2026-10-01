import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/bootstrap/app_bootstrap_controller.dart';
import 'package:tharwati_mobile/env.dart';

void main() {
  // Run without defines, then with explicit development/production defines.
  // EXPECTED_ENVIRONMENT is test-only and never selects the app environment.
  const expected = String.fromEnvironment('EXPECTED_ENVIRONMENT');
  test('compiled Dart defines have no implicit project or environment', () {
    final platform = DefaultAppBootstrapPlatform();
    if (expected.isEmpty) {
      expect(Env.environmentName, isEmpty);
      expect(Env.supabaseUrl, isEmpty);
      expect(Env.supabasePublishableKey, isEmpty);
      expect(platform.validateConfiguration, throwsFormatException);
    } else {
      expect(Env.environmentName, expected);
      expect(platform.validateConfiguration, returnsNormally);
      expect(Env.configuration.environment.name, expected);
      expect(Env.supabaseUrl, const String.fromEnvironment('SUPABASE_URL'));
    }
  });

  if (expected.isEmpty) {
    test('direct SDK initialization also rejects a build without defines', () {
      expect(
        DefaultAppBootstrapPlatform().initializeSupabase(),
        throwsFormatException,
      );
    });
  }
}
