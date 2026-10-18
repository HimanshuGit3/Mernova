import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../providers/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/brand.dart';
import 'common/common_screens.dart';
import 'common/issue_detail_screen.dart';
import 'student/home_screen.dart';
import 'student/report_flow_screen.dart';
import 'technician/jobs_screen.dart';

/// Shows an in-app banner (with "View") for notifications that arrive while the app is open.
mixin NotificationBanner<T extends StatefulWidget> on State<T> {
  StreamSubscription<AppNotification>? _bannerSub;

  @override
  void initState() {
    super.initState();
    _bannerSub = context.read<NotificationsController>().incoming.listen((n) {
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      messenger.hideCurrentSnackBar();
      messenger.showSnackBar(
        SnackBar(
          content: Text(n.body.isNotEmpty ? '${n.title}\n${n.body}' : n.title),
          action: n.issueId == null
              ? null
              : SnackBarAction(
                  label: 'View',
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => IssueDetailScreen(issueId: n.issueId!)),
                  ),
                ),
        ),
      );
    });
  }

  @override
  void dispose() {
    _bannerSub?.cancel();
    super.dispose();
  }
}

Widget _badge(int count, Widget icon) =>
    count > 0 ? Badge(label: Text(count > 99 ? '99+' : '$count'), child: icon) : icon;

/// Student: Home, Fixed on campus, centre Report button, Notifications, Profile.
class StudentShell extends StatefulWidget {
  const StudentShell({super.key, this.profileExtras = const []});
  final List<Widget> profileExtras;

  @override
  State<StudentShell> createState() => _StudentShellState();
}

class _StudentShellState extends State<StudentShell> with NotificationBanner<StudentShell> {
  int _tab = 0;

  void _report() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const ReportFlowScreen()));

  static const _titles = ['FixIt Campus', 'Fixed on campus', 'Notifications', 'Profile'];

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<NotificationsController>().unread;
    final body = switch (_tab) {
      0 => StudentHomeScreen(onReport: _report, onSeeFeed: () => setState(() => _tab = 1)),
      1 => const FixedFeedScreen(),
      2 => const NotificationsScreen(),
      _ => ProfileScreen(extra: widget.profileExtras),
    };
    return Scaffold(
      appBar: AppBar(
        title: _tab == 0 ? const BrandLogo(size: 30) : Text(_titles[_tab]),
      ),
      body: AnimatedSwitcher(duration: Motion.fast, child: KeyedSubtree(key: ValueKey(_tab), child: body)),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: FloatingActionButton.large(
        heroTag: 'report-fab',
        tooltip: 'Report an issue',
        backgroundColor: Brand.gold500,
        foregroundColor: Brand.navy900,
        shape: const CircleBorder(),
        onPressed: _report,
        child: const Icon(Icons.add_a_photo_rounded, size: 32),
      ),
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        height: 72,
        padding: EdgeInsets.zero,
        child: Row(
          children: [
            _NavItem(icon: Icons.home_outlined, active: Icons.home_rounded, label: 'Home', selected: _tab == 0, onTap: () => setState(() => _tab = 0)),
            _NavItem(icon: Icons.auto_awesome_outlined, active: Icons.auto_awesome, label: 'Fixed', selected: _tab == 1, onTap: () => setState(() => _tab = 1)),
            const SizedBox(width: 96),
            _NavItem(
              icon: Icons.notifications_none_rounded,
              active: Icons.notifications_rounded,
              label: 'Alerts',
              badge: unread,
              selected: _tab == 2,
              onTap: () => setState(() => _tab = 2),
            ),
            _NavItem(icon: Icons.person_outline_rounded, active: Icons.person_rounded, label: 'Profile', selected: _tab == 3, onTap: () => setState(() => _tab = 3)),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.icon, required this.active, required this.label, required this.selected, required this.onTap, this.badge = 0});

  final IconData icon;
  final IconData active;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = selected ? scheme.primary : scheme.onSurfaceVariant;
    return Expanded(
      child: Semantics(
        selected: selected,
        button: true,
        label: badge > 0 ? '$label, $badge unread' : label,
        child: InkResponse(
          onTap: onTap,
          child: ExcludeSemantics(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _badge(badge, Icon(selected ? active : icon, color: color)),
                const SizedBox(height: 4),
                Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Technician: Jobs, Notifications, Profile.
class TechnicianShell extends StatefulWidget {
  const TechnicianShell({super.key, this.profileExtras = const []});
  final List<Widget> profileExtras;

  @override
  State<TechnicianShell> createState() => _TechnicianShellState();
}

class _TechnicianShellState extends State<TechnicianShell> with NotificationBanner<TechnicianShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<NotificationsController>().unread;
    final body = switch (_tab) {
      0 => const JobsScreen(),
      1 => const NotificationsScreen(),
      _ => ProfileScreen(extra: widget.profileExtras),
    };
    return Scaffold(
      appBar: AppBar(title: Text(const ['My jobs', 'Notifications', 'Profile'][_tab])),
      body: AnimatedSwitcher(duration: Motion.fast, child: KeyedSubtree(key: ValueKey(_tab), child: body)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.work_outline_rounded), selectedIcon: Icon(Icons.work_rounded), label: 'Jobs'),
          NavigationDestination(
            icon: _badge(unread, const Icon(Icons.notifications_none_rounded)),
            selectedIcon: _badge(unread, const Icon(Icons.notifications_rounded)),
            label: 'Alerts',
          ),
          const NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
