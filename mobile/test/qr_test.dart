import 'package:fixit_campus/utils/qr.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseLocationQr (D9: FIXIT:LOC:<code>)', () {
    test('accepts FixIt room stickers and normalises the code', () {
      expect(parseLocationQr('FIXIT:LOC:B-204'), 'B-204');
      expect(parseLocationQr('  fixit:loc:lib-101 \n'), 'LIB-101');
      expect(parseLocationQr('FIXIT:LOC:E2'), 'E2');
    });

    test('rejects anything else', () {
      for (final raw in [
        null,
        '',
        'B-204',
        'https://example.com/FIXIT:LOC:B-204',
        'FIXIT:LOC:',
        'FIXIT:LOC:-204',
        'FIXIT:LOC:B 204',
        'FIXIT:LOC:B-204; DROP TABLE',
        'FIXIT:LOC:${'A' * 30}',
        'WIFI:S:campus;T:WPA;P:secret;;',
      ]) {
        expect(parseLocationQr(raw), isNull, reason: 'should reject "$raw"');
      }
    });
  });
}
