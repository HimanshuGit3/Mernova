import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/env.dart';
import '../../models/models.dart';
import '../../providers/app_state.dart';
import '../../providers/session.dart';
import '../../theme/meta.dart';
import '../../theme/tokens.dart';
import '../../widgets/brand.dart';
import '../../widgets/common.dart';
import 'issue_detail_screen.dart';

/// Shared inbox (FR-50): the same notifications as the web bell.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<NotificationsController>().refresh();
    });
  }

  static IconData _icon(String type) => switch (type) {
        'issue_created' => Icons.add_alert_outlined,
        'issue_assigned' => Icons.engineering_outlined,
        'sla_overdue' => Icons.timer_off_outlined,
        'me_too' => Icons.volunteer_activism_outlined,
        _ => Icons.sync_alt_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final n = context.watch<NotificationsController>();
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    if (n.items.isEmpty) {
      if (n.loading) return const SkeletonList();
      if (n.error != null) return ErrorView(message: n.error!, onRetry: n.refresh);
      return const EmptyState(icon: Icons.notifications_none_rounded, title: "You're all caught up", body: 'Updates about your issues appear here.');
    }
    return RefreshIndicator(
      onRefresh: n.refresh,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 100),
        children: [
          if (n.unread > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 8, 4),
              child: Row(
                children: [
                  Text('${n.unread} unread', style: text.titleMedium),
                  const Spacer(),
                  TextButton.icon(onPressed: n.markAllRead, icon: const Icon(Icons.done_all_rounded), label: const Text('Mark all read')),
                ],
              ),
            ),
          for (final item in n.items)
            ListTile(
              minVerticalPadding: 12,
              leading: CircleAvatar(
                backgroundColor: item.read ? scheme.surfaceContainerHigh : Brand.gold300.withValues(alpha: 0.3),
                foregroundColor: scheme.onSurface,
                child: Icon(_icon(item.type)),
              ),
              title: Text(item.title, style: TextStyle(fontWeight: item.read ? FontWeight.w500 : FontWeight.w800)),
              subtitle: Text(
                [if (item.body.isNotEmpty) item.body, timeAgo(item.createdAt)].join('\n'),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: item.read
                  ? null
                  : Semantics(label: 'Unread', child: Container(width: 10, height: 10, decoration: const BoxDecoration(color: Brand.gold500, shape: BoxShape.circle))),
              onTap: () {
                n.markRead(item);
                final id = item.issueId;
                if (id != null) {
                  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => IssueDetailScreen(issueId: id)));
                }
              },
            ),
        ],
      ),
    );
  }
}

/// Profile: account, theme, sign out. (Biometric unlock is added in phase 10.)
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, this.extra = const []});

  /// Extra settings rows supplied by later features (biometrics, offline queue).
  final List<Widget> extra;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    final theme = context.watch<ThemeController>();
    final user = session.user;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    if (user == null) return const SizedBox.shrink();
    final initials = user.name.split(' ').where((p) => p.isNotEmpty).take(2).map((p) => p[0].toUpperCase()).join();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(radius: 28, backgroundColor: Brand.navy700, foregroundColor: Colors.white, child: Text(initials, style: const TextStyle(fontWeight: FontWeight.w800))),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.name, style: text.titleLarge),
                      Text(user.email, style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
                      const SizedBox(height: 4),
                      Text(
                        [_roleLabel(user.role), if (user.department.isNotEmpty) user.department].join(' · '),
                        style: text.labelLarge,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (user.isTechnician && user.skills.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 6, children: [for (final s in user.skills) Chip(label: Text(Meta.category(s)), avatar: Icon(Meta.categoryIcon[s], size: 16))]),
        ],
        const SizedBox(height: 20),
        Text('Appearance', style: text.titleMedium),
        const SizedBox(height: 8),
        SegmentedButton<ThemeMode>(
          segments: const [
            ButtonSegment(value: ThemeMode.system, label: Text('System'), icon: Icon(Icons.brightness_auto_outlined)),
            ButtonSegment(value: ThemeMode.light, label: Text('Light'), icon: Icon(Icons.light_mode_outlined)),
            ButtonSegment(value: ThemeMode.dark, label: Text('Dark'), icon: Icon(Icons.dark_mode_outlined)),
          ],
          selected: {theme.mode},
          onSelectionChanged: (v) => theme.set(v.first),
        ),
        ...extra,
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: () async {
            context.read<NotificationsController>().clear();
            await session.logout();
          },
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Sign out'),
        ),
        const SizedBox(height: 24),
        Center(
          child: Text(
            'FixIt Campus · connected to ${Env.apiBaseUrl}',
            style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  static String _roleLabel(String role) => switch (role) {
        'technician' => 'Technician',
        'admin' => 'Admin',
        _ => 'Student',
      };
}

/// Admins manage everything on the web (SPEC 2); the app points them there.
class AdminRedirectScreen extends StatelessWidget {
  const AdminRedirectScreen({super.key, required this.user});
  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final webUrl = Env.apiBaseUrl.replaceFirst(':5000', ':5173');
    return Scaffold(
      backgroundColor: Brand.navy900,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const BrandLogo(light: true),
              const Spacer(),
              const Icon(Icons.desktop_windows_rounded, color: Brand.gold300, size: 56),
              const SizedBox(height: 20),
              Text('Hi ${user.name.split(' ').first}, the admin dashboard is on the web',
                  style: text.headlineSmall?.copyWith(color: Colors.white)),
              const SizedBox(height: 10),
              Text(
                'Triage, assignment, insights, QR stickers and Live Booth mode are built for a big screen. Sign in there with the same account.',
                style: text.bodyLarge?.copyWith(color: const Color(0xFFC5CEE2)),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: Brand.gold500, foregroundColor: Brand.navy900),
                onPressed: () => launchUrl(Uri.parse(webUrl), mode: LaunchMode.externalApplication),
                icon: const Icon(Icons.open_in_new_rounded),
                label: const Text('Open the web dashboard'),
              ),
              const SizedBox(height: 8),
              TextButton(
                style: TextButton.styleFrom(foregroundColor: Colors.white),
                onPressed: () => context.read<Session>().logout(),
                child: const Text('Sign out'),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
