import 'dart:async';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'providers/app_state.dart';
import 'providers/session.dart';
import 'screens/auth/auth_screens.dart';
import 'screens/common/common_screens.dart';
import 'screens/common/issue_detail_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'screens/shells.dart';
import 'services/api.dart';
import 'services/biometric_service.dart';
import 'services/issues_service.dart';
import 'services/offline_queue.dart';
import 'services/push_service.dart';
import 'services/realtime_service.dart';
import 'theme/app_theme.dart';
import 'theme/tokens.dart';
import 'widgets/brand.dart';
import 'widgets/offline.dart';

final navigatorKey = GlobalKey<NavigatorState>();
final messengerKey = GlobalKey<ScaffoldMessengerState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final docs = await getApplicationDocumentsDirectory();

  final api = ApiClient(TokenStore());
  final realtime = RealtimeService();
  final session = Session(api, realtime);
  final issues = IssuesService(api);
  final queue = OfflineQueue(send: (r) => issues.create(r), storage: FileQueueStorage(docs));
  final biometric = BiometricService(prefs);
  final push = PushService(api);
  final connectivity = ConnectivityStatus();
  session.deviceToken = () => push.token;

  push.onOpenIssue = (id) => navigatorKey.currentState?.push(
        MaterialPageRoute<void>(builder: (_) => IssueDetailScreen(issueId: id)),
      );
  push.onForeground = (title, body, _) {
    // While the socket is connected the in-app banner already shows it.
    if (!realtime.connected) messengerKey.currentState?.showSnackBar(SnackBar(content: Text(body.isEmpty ? title : '$title\n$body')));
  };

  runApp(FixItApp(
    prefs: prefs,
    api: api,
    realtime: realtime,
    session: session,
    issues: issues,
    queue: queue,
    biometric: biometric,
    connectivity: connectivity,
    push: push,
  ));

  await queue.load();
  await push.init();
  await session.restore();
  biometric.lockOnStart();

  // Offline queue (FR-58): send on reconnect, and retry due items every 30 s.
  Future<void> flush({bool force = false}) async {
    final me = session.user?.id;
    if (session.status != SessionStatus.signedIn || queue.pendingFor(me) == 0) return;
    final res = await queue.flush(force: force, ownerId: me);
    if (res.sent > 0) {
      messengerKey.currentState?.showSnackBar(SnackBar(content: Text('${res.sent} saved ${res.sent == 1 ? 'report was' : 'reports were'} sent')));
    }
    for (final d in res.dropped) {
      messengerKey.currentState?.showSnackBar(SnackBar(content: Text('"${d.report.title}" could not be sent: ${d.lastError}')));
    }
  }

  connectivity.backOnline.listen((_) => flush(force: true));
  Timer.periodic(const Duration(seconds: 30), (_) => flush());
  session.addListener(() {
    if (session.status == SessionStatus.signedIn) {
      push.registerDevice();
      flush(force: true);
    } else {
      // Banners live on the app-wide messenger and outlive the screens: never show
      // the previous user's notification (and its "View" link) on the login screen.
      messengerKey.currentState?.clearSnackBars();
      biometric.reset();
    }
  });
  if (session.status == SessionStatus.signedIn) {
    await push.registerDevice();
    await flush(force: true);
  }
}

class FixItApp extends StatelessWidget {
  const FixItApp({
    super.key,
    required this.prefs,
    required this.api,
    required this.realtime,
    required this.session,
    required this.issues,
    required this.queue,
    required this.biometric,
    required this.connectivity,
    required this.push,
  });

  final SharedPreferences prefs;
  final ApiClient api;
  final RealtimeService realtime;
  final Session session;
  final IssuesService issues;
  final OfflineQueue queue;
  final BiometricService biometric;
  final ConnectivityStatus connectivity;
  final PushService push;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        Provider<RealtimeService>.value(value: realtime),
        Provider<IssuesService>.value(value: issues),
        Provider<PushService>.value(value: push),
        Provider<SharedPreferences>.value(value: prefs),
        ChangeNotifierProvider<Session>.value(value: session),
        ChangeNotifierProvider<OfflineQueue>.value(value: queue),
        ChangeNotifierProvider<BiometricService>.value(value: biometric),
        ChangeNotifierProvider<ConnectivityStatus>.value(value: connectivity),
        ChangeNotifierProvider<ThemeController>(create: (_) => ThemeController(prefs)),
        ChangeNotifierProvider<NotificationsController>(create: (_) => NotificationsController(NotificationsService(api), realtime)),
      ],
      child: Consumer<ThemeController>(
        builder: (context, theme, _) => MaterialApp(
          title: 'FixIt Campus',
          debugShowCheckedModeBanner: false,
          navigatorKey: navigatorKey,
          scaffoldMessengerKey: messengerKey,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: theme.mode,
          home: const RootGate(),
        ),
      ),
    );
  }
}

/// Picks the first screen: onboarding (once), splash, login, the lock screen, or the role's home.
/// Signing out (or a 401) pops everything back to this gate.
class RootGate extends StatefulWidget {
  const RootGate({super.key});

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> with WidgetsBindingObserver {
  SessionStatus? _last;
  bool _onboarded = true;

  @override
  void initState() {
    super.initState();
    _onboarded = context.read<SharedPreferences>().getBool('onboarded') ?? false;
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final bio = context.read<BiometricService>();
    if (state == AppLifecycleState.paused) bio.onBackground();
    if (state == AppLifecycleState.resumed) bio.onResume();
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final locked = context.watch<BiometricService>().locked;
    if (_last == SessionStatus.signedIn && session.status == SessionStatus.signedOut) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        navigatorKey.currentState?.popUntil((r) => r.isFirst);
      });
    }
    _last = session.status;
    final user = session.user;

    final Widget screen;
    if (!_onboarded) {
      screen = OnboardingScreen(
        onDone: () {
          context.read<SharedPreferences>().setBool('onboarded', true);
          setState(() => _onboarded = true);
        },
      );
    } else if (session.status == SessionStatus.signedOut) {
      screen = const LoginScreen();
    } else if (session.status == SessionStatus.loading || user == null) {
      screen = const SplashScreen();
    } else if (locked) {
      screen = const LockScreen();
    } else if (user.isAdmin) {
      screen = AdminRedirectScreen(user: user);
    } else if (user.isTechnician) {
      screen = const _WithBanner(child: TechnicianShell(profileExtras: [DeviceSettings()]));
    } else {
      screen = const _WithBanner(child: StudentShell(profileExtras: [DeviceSettings()]));
    }
    final key = !_onboarded ? 'onboarding' : '${session.status}-${user?.id}-$locked';
    return AnimatedSwitcher(duration: Motion.normal, child: KeyedSubtree(key: ValueKey(key), child: screen));
  }
}

/// Puts the offline banner above a shell.
class _WithBanner extends StatelessWidget {
  const _WithBanner({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final me = context.watch<Session>().user?.id;
    final visible = !context.watch<ConnectivityStatus>().online || context.watch<OfflineQueue>().pendingFor(me) > 0;
    // Same widget structure whether or not the banner shows, so the shell keeps its state
    // (selected tab, scroll). When shown, the banner takes the status-bar inset instead of the shell.
    return Column(
      children: [
        AnimatedSize(
          duration: Motion.normal,
          child: visible
              ? const Material(child: SafeArea(bottom: false, child: OfflineBanner()))
              : const SizedBox(width: double.infinity),
        ),
        Expanded(child: MediaQuery.removePadding(context: context, removeTop: visible, child: child)),
      ],
    );
  }
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: Brand.navy900,
        body: Center(child: LogoMark(size: 88)),
      );
}

/// Biometric lock (FR-57).
class LockScreen extends StatelessWidget {
  const LockScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final bio = context.read<BiometricService>();
    final text = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: Brand.navy900,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              const Spacer(),
              const LogoMark(size: 72),
              const SizedBox(height: 24),
              Text('FixIt Campus is locked', style: text.headlineSmall?.copyWith(color: Colors.white)),
              const SizedBox(height: 8),
              Text('Use your fingerprint, face or device PIN.', style: text.bodyLarge?.copyWith(color: const Color(0xFFC5CEE2))),
              const SizedBox(height: 32),
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: Brand.gold500, foregroundColor: Brand.navy900),
                onPressed: bio.unlock,
                icon: const Icon(Icons.fingerprint_rounded),
                label: const Text('Unlock'),
              ),
              const SizedBox(height: 8),
              TextButton(
                style: TextButton.styleFrom(foregroundColor: Colors.white),
                onPressed: () => context.read<Session>().logout(),
                child: const Text('Sign out instead'),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
