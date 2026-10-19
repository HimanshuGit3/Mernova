import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../providers/session.dart';
import '../../services/api.dart';
import '../../services/issues_service.dart';
import '../../theme/meta.dart';
import '../../theme/tokens.dart';
import '../../widgets/common.dart';
import '../../widgets/live.dart';
import '../common/issue_detail_screen.dart';

const _activeStatuses = ['open', 'assigned', 'in_progress', 'reopened', 'resolved'];

/// Student home: greeting, "Fixed on campus" carousel and My reports (FR-11, FR-59).
class StudentHomeScreen extends StatefulWidget {
  const StudentHomeScreen({super.key, this.onReport, this.onSeeFeed});

  final VoidCallback? onReport;
  final VoidCallback? onSeeFeed;

  @override
  State<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends State<StudentHomeScreen> with LiveRefresh<StudentHomeScreen> {
  bool _showDone = false;
  List<Issue>? _issues;
  List<FeedItem>? _feed;
  String? _error;

  @override
  Future<void> onLiveRefresh() => _load();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final service = context.read<IssuesService>();
    try {
      final results = await Future.wait([
        service.list(status: _showDone ? const ['closed', 'rejected'] : _activeStatuses, limit: 30),
        service.feed(limit: 8),
      ]);
      if (!mounted) return;
      setState(() {
        _issues = (results[0] as Paged<Issue>).items;
        _feed = (results[1] as Paged<FeedItem>).items;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _open(Issue i) => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => IssueDetailScreen(issueId: i.id, preview: i)),
      );

  @override
  Widget build(BuildContext context) {
    final user = context.watch<Session>().user;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
    final issues = _issues;

    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$greeting, ${user?.name.split(' ').first ?? ''}', style: text.headlineSmall),
                  const SizedBox(height: 4),
                  Text('Spotted something broken? Report it in under a minute.', style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
                ],
              ),
            ),
          ),
          if (_feed != null && _feed!.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 8, 8),
                child: Row(
                  children: [
                    Text('Fixed on campus', style: text.titleMedium),
                    const Spacer(),
                    if (widget.onSeeFeed != null) TextButton(onPressed: widget.onSeeFeed, child: const Text('See all')),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 176,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  scrollDirection: Axis.horizontal,
                  itemCount: _feed!.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (_, i) => _FixedCard(item: _feed![i]),
                ),
              ),
            ),
          ],
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
              child: Row(
                children: [
                  Text('My reports', style: text.titleMedium),
                  const Spacer(),
                  SegmentedButton<bool>(
                    segments: const [ButtonSegment(value: false, label: Text('Active')), ButtonSegment(value: true, label: Text('Done'))],
                    selected: {_showDone},
                    showSelectedIcon: false,
                    style: const ButtonStyle(visualDensity: VisualDensity.compact),
                    onSelectionChanged: (v) {
                      setState(() {
                        _showDone = v.first;
                        _issues = null;
                      });
                      _load();
                    },
                  ),
                ],
              ),
            ),
          ),
          if (_error != null && issues == null)
            SliverFillRemaining(hasScrollBody: false, child: ErrorView(message: _error!, onRetry: _load))
          else if (issues == null)
            const SliverToBoxAdapter(child: SizedBox(height: 400, child: SkeletonList(count: 4)))
          else if (issues.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(
                icon: Icons.assignment_outlined,
                title: _showDone ? 'Nothing finished yet' : 'No open reports',
                body: 'Tap Report to tell the estate office about a problem.',
                action: widget.onReport == null ? null : FilledButton.icon(onPressed: widget.onReport, icon: const Icon(Icons.add_a_photo_rounded), label: const Text('Report an issue')),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
              sliver: SliverList.separated(
                itemCount: issues.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (_, i) => _Stagger(index: i, child: IssueCard(issue: issues[i], onTap: () => _open(issues[i]))),
              ),
            ),
        ],
      ),
    );
  }
}

/// Staggered entry animation for list items (off when the OS asks for reduced motion).
class _Stagger extends StatelessWidget {
  const _Stagger({required this.index, required this.child});
  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 200 + 30 * (index.clamp(0, 10))),
      curve: Motion.curve,
      builder: (_, v, c) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 8 * (1 - v)), child: c)),
      child: child,
    );
  }
}

class _FixedCard extends StatelessWidget {
  const _FixedCard({required this.item});
  final FeedItem item;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: 220,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 104,
              child: Row(
                children: [
                  Expanded(child: NetPhoto(path: item.photoPath, category: item.category, semanticLabel: 'Before')),
                  const SizedBox(width: 2),
                  Expanded(child: NetPhoto(path: item.resolutionPhotoPath, category: item.category, semanticLabel: 'After')),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 0),
              child: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleMedium?.copyWith(fontSize: 14)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 2, 10, 0),
              child: Row(
                children: [
                  Icon(Meta.categoryIcon[item.category], size: 13, color: Meta.categoryColor[item.category]),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      item.resolutionHours != null ? 'Fixed in ${_hours(item.resolutionHours!)}' : 'Fixed',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _hours(double h) => h < 48 ? '${h.round()} h' : '${(h / 24).round()} days';
}

/// Full "Fixed on campus" feed with before/after sliders (FR-59).
class FixedFeedScreen extends StatefulWidget {
  const FixedFeedScreen({super.key});

  @override
  State<FixedFeedScreen> createState() => _FixedFeedScreenState();
}

class _FixedFeedScreenState extends State<FixedFeedScreen> with LiveRefresh<FixedFeedScreen> {
  List<FeedItem>? _items;
  String? _error;

  @override
  Set<String> get liveEvents => const {'issue:updated'};

  @override
  Future<void> onLiveRefresh() => _load();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final page = await context.read<IssuesService>().feed(limit: 20);
      if (mounted) {
        setState(() {
          _items = page.items;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    if (items == null) {
      return _error != null ? ErrorView(message: _error!, onRetry: _load) : const SkeletonList(count: 3);
    }
    if (items.isEmpty) {
      return const EmptyState(icon: Icons.auto_awesome_outlined, title: 'No fixes yet', body: 'Resolved issues appear here with before and after photos.');
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 16),
        itemBuilder: (_, i) {
          final item = items[i];
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  BeforeAfterSlider(before: item.photoPath, after: item.resolutionPhotoPath),
                  const SizedBox(height: 10),
                  Text(item.title, style: text.titleMedium),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (item.place != null) item.place!,
                      if (item.resolutionHours != null) 'fixed in ${_FixedCard._hours(item.resolutionHours!)}',
                    ].join(' · '),
                    style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
