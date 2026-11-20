import 'package:fixit_campus/theme/meta.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime(2026, 11, 20, 12);
  String ago(Duration d) => timeAgo(now.subtract(d), now: now);

  test('anything under a minute is "just now", never "0 min ago"', () {
    expect(ago(const Duration(seconds: 5)), 'just now');
    expect(ago(const Duration(seconds: 50)), 'just now');
    expect(ago(const Duration(seconds: 59)), 'just now');
  });

  test('minutes, hours and days', () {
    expect(ago(const Duration(seconds: 60)), '1 min ago');
    expect(ago(const Duration(minutes: 59)), '59 min ago');
    expect(ago(const Duration(hours: 3)), '3 h ago');
    expect(ago(const Duration(days: 1)), 'yesterday');
    expect(ago(const Duration(days: 3)), '3 days ago');
  });
}
