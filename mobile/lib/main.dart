import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'providers/app_state.dart';
import 'providers/session.dart';
import 'screens/auth/auth_screens.dart';
import 'screens/common/common_screens.dart';
import 'screens/shells.dart';
import 'services/api.dart';
import 'services/issues_service.dart';
import 'services/realtime_service.dart';
import 'theme/app_theme.dart';
import 'theme/tokens.dart';
import 'widgets/brand.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final api = ApiClient(TokenStore());
  final realtime = RealtimeService();
  final session = Session(api, realtime);
  runApp(FixItApp(prefs: prefs, api: api, realtime: realtime, session: session));
  await session.restore();
}

class FixItApp extends StatelessWidget {
  const FixItApp({super.key, required this.prefs, required this.api, required this.realtime, required this.session});

  final SharedPreferences prefs;
  final ApiClient api;
  final RealtimeService realtime;
  final Session session;

  static final navigatorKey = GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        Provider<RealtimeService>.value(value: realtime),
        Provider<IssuesService>(create: (_) => IssuesService(api)),
        ChangeNotifierProvider<Session>.value(value: session),
        ChangeNotifierProvider<ThemeController>(create: (_) => ThemeController(prefs)),
        ChangeNotifierProvider<NotificationsController>(create: (_) => NotificationsController(NotificationsService(api), realtime)),
      ],
      child: Consumer<ThemeController>(
        builder: (context, theme, _) => MaterialApp(
          title: 'FixIt Campus',
          debugShowCheckedModeBanner: false,
          navigatorKey: navigatorKey,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: theme.mode,
          home: const RootGate(),
        ),
      ),
    );
  }
}

/// Picks the first screen from the session: splash, login, or the role's home.
/// Signing out (or a 401) pops everything back to this gate.
class RootGate extends StatefulWidget {
  const RootGate({super.key});

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  SessionStatus? _last;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    if (_last == SessionStatus.signedIn && session.status == SessionStatus.signedOut) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        FixItApp.navigatorKey.currentState?.popUntil((r) => r.isFirst);
      });
    }
    _last = session.status;
    final user = session.user;
    final Widget screen;
    if (session.status == SessionStatus.signedOut) {
      screen = const LoginScreen();
    } else if (session.status == SessionStatus.loading || user == null) {
      screen = const SplashScreen();
    } else if (user.isAdmin) {
      screen = AdminRedirectScreen(user: user);
    } else if (user.isTechnician) {
      screen = const TechnicianShell();
    } else {
      screen = const StudentShell();
    }
    return AnimatedSwitcher(duration: Motion.normal, child: KeyedSubtree(key: ValueKey('${session.status}-${user?.id}'), child: screen));
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
