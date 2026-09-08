import 'package:flutter_test/flutter_test.dart';
import 'package:tharwati_mobile/auth/password_policy.dart';

void main() {
  test('accepts a 12+ char password with upper, lower, and digit', () {
    expect(PasswordPolicy.problem('Abcdefghij12'), isNull);
  });

  test('rejects on each missing rule', () {
    expect(PasswordPolicy.problem(null), contains('12'));
    expect(PasswordPolicy.problem('Abc123'), contains('12')); // too short
    expect(PasswordPolicy.problem('ABCDEFGHIJ12'), contains('lowercase'));
    expect(PasswordPolicy.problem('abcdefghij12'), contains('uppercase'));
    expect(PasswordPolicy.problem('Abcdefghijkl'), contains('number'));
  });
}
