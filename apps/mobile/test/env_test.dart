import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/env.dart';

MobileEnvironmentConfig _config({
  String environment = 'development',
  String url = 'https://development.example.supabase.co',
  String key = 'sb_publishable_development_test',
}) => MobileEnvironmentConfig(
  environmentName: environment,
  supabaseUrl: url,
  supabasePublishableKey: key,
);

void main() {
  test('valid development configuration selects the explicit project', () {
    final config = _config();
    expect(config.validate, returnsNormally);
    expect(config.environment, MobileEnvironment.development);
    expect(config.supabaseUrl, 'https://development.example.supabase.co');
  });

  test('valid production configuration preserves the supplied project', () {
    final config = _config(
      environment: 'production',
      url: 'https://production.example.supabase.co/',
      key: 'sb_publishable_production_test',
    );
    expect(config.validate, returnsNormally);
    expect(config.environment, MobileEnvironment.production);
    expect(config.supabaseUrl, 'https://production.example.supabase.co/');
    expect(config.supabasePublishableKey, 'sb_publishable_production_test');
  });

  for (final environment in ['', 'staging', 'Development', ' production ']) {
    test('missing or unsupported identity "$environment" is rejected', () {
      expect(_config(environment: environment).validate, throwsFormatException);
    });
  }

  for (final url in [
    '',
    'not-a-url',
    'https://',
    'http://hosted.example.supabase.co',
    'ftp://example.supabase.co',
    'https://bad host.supabase.co',
    'https://-bad.supabase.co',
    'https://127.1',
    'https://999.999.999.999',
    'https://example.supabase.co:0',
    'https://example.supabase.co:70000',
    'https://user:password@example.supabase.co',
    'https://example.supabase.co/rest/v1',
    'https://example.supabase.co?key=value',
    'https://example.supabase.co#fragment',
    ' https://example.supabase.co',
  ]) {
    test('missing or malformed URL "$url" is rejected', () {
      expect(_config(url: url).validate, throwsFormatException);
    });
  }

  for (final host in [
    'localhost',
    '127.0.0.1',
    '127.1.2.3',
    '10.0.2.2',
    '192.168.1.20',
    '172.16.0.2',
    '169.254.1.2',
    '[::1]',
    '[fc00::1]',
    '[::ffff:127.0.0.1]',
    'supabase.local',
    'api.localhost',
    'supabase.internal',
    'supabase',
  ]) {
    test('development explicitly accepts local HTTP $host', () {
      final config = _config(url: 'http://$host:54321');
      expect(config.validate, returnsNormally);
      expect(config.environment, MobileEnvironment.development);
      expect(config.supabaseUrl, 'http://$host:54321');
    });
    for (final scheme in ['http', 'https']) {
      test('production rejects $scheme local endpoint $host', () {
        expect(
          _config(
            environment: 'production',
            url: '$scheme://$host:54321',
          ).validate,
          throwsFormatException,
        );
      });
    }
  }
  test('production rejects hosted HTTP without inferring development', () {
    expect(
      _config(
        environment: 'production',
        url: 'http://production.example.supabase.co',
      ).validate,
      throwsFormatException,
    );
  });

  for (final key in [
    '',
    'sb_publishable_',
    'sb_secret_privileged_test',
    'eyJhbGciOiJIUzI1NiJ9.legacy-jwt.signature',
    'sb_publishable_bad/key',
    ' sb_publishable_test',
    'sb_publishable_test\n',
  ]) {
    test('missing, malformed or privileged client key is rejected', () {
      expect(_config(key: key).validate, throwsFormatException);
    });
  }
}
