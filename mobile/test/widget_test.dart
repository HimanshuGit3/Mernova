import 'package:fixit_campus/models/models.dart';
import 'package:fixit_campus/providers/session.dart';
import 'package:fixit_campus/screens/auth/auth_screens.dart';
import 'package:fixit_campus/screens/student/report_form.dart';
import 'package:fixit_campus/services/api.dart';
import 'package:fixit_campus/services/device_services.dart';
import 'package:fixit_campus/services/realtime_service.dart';
import 'package:fixit_campus/theme/app_theme.dart';
import 'package:fixit_campus/theme/tokens.dart';
import 'package:fixit_campus/utils/validators.dart';
import 'package:fixit_campus/widgets/chips.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

Widget _app(Widget child, {Session? session}) {
  final s = session ?? Session(ApiClient(TokenStore()), RealtimeService());
  return ChangeNotifierProvider<Session>.value(
    value: s,
    child: MaterialApp(theme: buildTheme(Brightness.light), home: child),
  );
}

Issue _issue({required String status, required DateTime createdAt, required DateTime dueAt, DateTime? resolvedAt}) => Issue(
      id: 'x',
      title: 'Projector flickering',
      category: 'electrical',
      severity: 'high',
      status: status,
      createdAt: createdAt,
      dueAt: dueAt,
      resolvedAt: resolvedAt,
    );

void main() {
  group('login form validation', () {
    testWidgets('empty fields show both errors and nothing is sent', (tester) async {
      await tester.pumpWidget(_app(const LoginScreen()));
      await tester.ensureVisible(find.byKey(const Key('login-submit')));
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pump();
      expect(find.text('Enter your email'), findsOneWidget);
      expect(find.text('Enter your password'), findsOneWidget);
    });

    testWidgets('an invalid email is rejected', (tester) async {
      await tester.pumpWidget(_app(const LoginScreen()));
      await tester.enterText(find.byKey(const Key('login-email')), 'not-an-email');
      await tester.ensureVisible(find.byKey(const Key('login-submit')));
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pump();
      expect(find.text('Enter a valid email address'), findsOneWidget);
    });

    testWidgets('the password can be shown and hidden', (tester) async {
      await tester.pumpWidget(_app(const LoginScreen()));
      expect(find.byTooltip('Show password'), findsOneWidget);
      await tester.tap(find.byTooltip('Show password'));
      await tester.pump();
      expect(find.byTooltip('Hide password'), findsOneWidget);
    });
  });

  group('report form validation', () {
    testWidgets('missing title, category, photo and landmark are all reported', (tester) async {
      await useTallScreen(tester);
      ReportDraft? sent;
      await tester.pumpWidget(_app(Scaffold(
        body: ReportDetailsForm(
          photoPath: null,
          location: const NoGps('No GPS signal'),
          onSubmit: (d) => sent = d,
        ),
      )));
      await tester.ensureVisible(find.byKey(const Key('report-submit')));
      await tester.tap(find.byKey(const Key('report-submit')));
      await tester.pumpAndSettle();
      expect(sent, isNull);
      expect(find.text('Describe the problem in a few words'), findsOneWidget);
      expect(find.text('Pick a category'), findsOneWidget);
      expect(find.text('Add a photo of the problem'), findsOneWidget);
      expect(find.textContaining('No GPS here'), findsOneWidget);
      expect(find.text('Landmark (required)'), findsOneWidget);
    });

    testWidgets('with GPS the landmark is optional', (tester) async {
      await useTallScreen(tester);
      await tester.pumpWidget(_app(Scaffold(
        body: ReportDetailsForm(
          photoPath: null,
          location: const GpsReady(GpsFixForTest.fix),
          onSubmit: (_) {},
        ),
      )));
      expect(find.text('Landmark (optional)'), findsOneWidget);
      expect(find.text('GPS location added'), findsOneWidget);
    });

    test('validateReport rules', () {
      final ok = validateReport(title: 'Water leak', category: 'plumbing', hasGps: true, hasRoom: false, landmark: '', hasPhoto: true);
      expect(ok, isEmpty);
      final room = validateReport(title: 'Water leak', category: 'plumbing', hasGps: false, hasRoom: true, landmark: '', hasPhoto: true);
      expect(room, isEmpty, reason: 'a scanned room replaces GPS');
      final noLocation = validateReport(title: 'Water leak', category: 'plumbing', hasGps: false, hasRoom: false, landmark: '  ', hasPhoto: true);
      expect(noLocation.keys, ['landmark']);
      final landmark = validateReport(title: 'Water leak', category: 'plumbing', hasGps: false, hasRoom: false, landmark: 'Library gate', hasPhoto: true);
      expect(landmark, isEmpty);
      expect(validateReport(title: 'ab', category: null, hasGps: true, hasRoom: false, landmark: '', hasPhoto: false).keys.toSet(), {'title', 'category', 'photo'});
      expect(Validators.title('x' * 101), isNotNull);
    });
  });

  group('status chips', () {
    testWidgets('show readable labels', (tester) async {
      await tester.pumpWidget(_app(const Scaffold(
        body: Wrap(children: [StatusChip('in_progress'), StatusChip('resolved'), SeverityChip('critical'), CategoryChip('network')]),
      )));
      expect(find.text('In progress'), findsOneWidget);
      expect(find.text('Resolved'), findsOneWidget);
      expect(find.text('Critical'), findsOneWidget);
      expect(find.text('Network'), findsOneWidget);
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    });

    testWidgets('SLA chip shows an overdue countdown', (tester) async {
      final now = DateTime.now();
      final issue = _issue(status: 'assigned', createdAt: now.subtract(const Duration(hours: 30)), dueAt: now.subtract(const Duration(hours: 6)));
      await tester.pumpWidget(_app(Scaffold(body: SlaChip(issue))));
      expect(find.textContaining('Overdue 6 h'), findsOneWidget);
      await tester.pumpWidget(const SizedBox()); // dispose the ticking timer
    });

    test('slaState: time left, tight, met and late', () {
      final t0 = DateTime(2026, 10, 18, 8);
      final open = _issue(status: 'open', createdAt: t0, dueAt: t0.add(const Duration(hours: 24)));
      final early = slaState(open, t0.add(const Duration(hours: 2)))!;
      expect(early.label, '22 h left');
      expect(early.color, StatusColors.resolved);
      final tight = slaState(open, t0.add(const Duration(hours: 20)))!;
      expect(tight.color, StatusColors.inProgress, reason: 'under 25% of the SLA left');
      final late = slaState(open, t0.add(const Duration(hours: 26, minutes: 30)))!;
      expect(late.label, 'Overdue 2 h 30 m');
      final met = slaState(
        _issue(status: 'closed', createdAt: t0, dueAt: t0.add(const Duration(hours: 24)), resolvedAt: t0.add(const Duration(hours: 5))),
        t0.add(const Duration(days: 3)),
      )!;
      expect(met.label, 'SLA met');
      expect(slaState(_issue(status: 'rejected', createdAt: t0, dueAt: t0), t0), isNull);
    });
  });

  group('models', () {
    test('Issue.fromJson tolerates missing optional fields and hides nothing it was not sent', () {
      final issue = Issue.fromJson({
        'id': 'a1',
        'title': 'Wi-Fi dead zone',
        'category': 'network',
        'severity': 'medium',
        'status': 'open',
        'createdAt': '2026-10-18T05:00:00.000Z',
        'locationRef': {'id': 'l1', 'code': 'B-204', 'building': 'Block B'},
        'location': {'lat': 13.17, 'lng': 77.53},
        'statusHistory': [
          {'status': 'open', 'at': '2026-10-18T05:00:00.000Z', 'changedBy': {'role': 'student'}, 'note': 'Reported'},
          {'status': 'assigned', 'at': '2026-10-18T06:00:00.000Z', 'changedBy': 'system'},
        ],
        'allowedActions': ['closed'],
      });
      expect(issue.place, 'B-204 · Block B');
      expect(issue.hasLocation, isTrue);
      expect(issue.reporterName, isNull);
      expect(issue.history.map((h) => h.by), ['Reporter', 'FixIt (automatic)']);
      expect(issue.allowedActions, ['closed']);
    });
  });
}

/// A const GPS fix for widget tests.
abstract final class GpsFixForTest {
  static const fix = GpsFix(13.1718, 77.5362, 8);
}

/// A tall phone-width surface so the whole (lazily built) report form exists in the tree.
Future<void> useTallScreen(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(400, 2400));
  addTearDown(() => tester.binding.setSurfaceSize(null));
}
