import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/api.dart';
import '../../services/device_services.dart';
import '../../services/issues_service.dart';
import '../../services/realtime_service.dart';
import '../../theme/meta.dart';
import '../../theme/tokens.dart';
import '../../utils/validators.dart';
import '../../widgets/chips.dart';
import '../../widgets/common.dart';
import '../../widgets/live.dart';

/// Issue detail for every role: hero photo, status timeline, before/after slider and the
/// actions this user may take now (from `allowedActions`, decided by the server).
class IssueDetailScreen extends StatefulWidget {
  const IssueDetailScreen({super.key, required this.issueId, this.preview});

  final String issueId;

  /// List item shown instantly while the full detail loads (smooth Hero transition).
  final Issue? preview;

  @override
  State<IssueDetailScreen> createState() => _IssueDetailScreenState();
}

class _IssueDetailScreenState extends State<IssueDetailScreen> with LiveRefresh<IssueDetailScreen> {
  Issue? _issue;
  String? _error;
  bool _busy = false;

  IssuesService get _service => context.read<IssuesService>();

  @override
  Set<String> get liveEvents => const {'issue:updated'};

  @override
  bool acceptLive(RealtimeEvent e) => e.issueId == widget.issueId;

  @override
  Future<void> onLiveRefresh() => _load();

  @override
  void initState() {
    super.initState();
    _issue = widget.preview;
    _load();
  }

  Future<void> _load() async {
    try {
      final issue = await _service.get(widget.issueId);
      if (mounted) setState(() => (_issue, _error) = (issue, null));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.status == 404 ? 'This issue does not exist or you no longer have access to it.' : e.message);
    }
  }

  Future<void> _run(Future<Issue> Function() action, String success) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final updated = await action();
      await HapticFeedback.mediumImpact();
      if (mounted) setState(() => _issue = updated);
      messenger.showSnackBar(SnackBar(content: Text(success)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reopen() async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ReasonSheet(),
    );
    if (reason == null || !mounted) return;
    await _run(() => _service.transition(widget.issueId, 'reopened', reason: reason), 'Reopened. The team has been told.');
  }

  Future<void> _resolve() async {
    final result = await showModalBottomSheet<({String photo, String note})>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ResolveSheet(),
    );
    if (result == null || !mounted) return;
    await _run(
      () => _service.transition(widget.issueId, 'resolved', note: result.note, photoPath: result.photo),
      'Marked resolved. The reporter will confirm.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final issue = _issue;
    if (issue == null) {
      return Scaffold(
        appBar: AppBar(),
        body: _error != null ? ErrorView(message: _error!, onRetry: _load) : const SkeletonList(count: 3),
      );
    }
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final actions = issue.allowedActions;

    final buttons = <Widget>[
      if (actions.contains('in_progress'))
        FilledButton.icon(
          onPressed: _busy ? null : () => _run(() => _service.transition(issue.id, 'in_progress'), 'Work started. Good luck!'),
          icon: const Icon(Icons.play_arrow_rounded),
          label: const Text('Start work'),
        ),
      if (actions.contains('resolved'))
        FilledButton.icon(onPressed: _busy ? null : _resolve, icon: const Icon(Icons.photo_camera_rounded), label: const Text('Resolve with after photo')),
      if (actions.contains('closed'))
        FilledButton.icon(
          onPressed: _busy ? null : () => _run(() => _service.transition(issue.id, 'closed'), 'Thanks for confirming the fix!'),
          icon: const Icon(Icons.check_circle_rounded),
          label: const Text('Confirm the fix'),
        ),
      if (actions.contains('reopened'))
        OutlinedButton.icon(onPressed: _busy ? null : _reopen, icon: const Icon(Icons.replay_rounded), label: const Text('Not fixed? Reopen')),
      if (issue.canSupport)
        FilledButton.tonalIcon(
          onPressed: _busy ? null : () => _run(() => _service.support(issue.id), 'Added your "Me too"'),
          icon: const Icon(Icons.volunteer_activism_rounded),
          label: const Text('Me too'),
        ),
    ];

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              expandedHeight: 280,
              backgroundColor: Brand.navy900,
              foregroundColor: Colors.white,
              flexibleSpace: FlexibleSpaceBar(
                background: Hero(
                  tag: 'issue-photo-${issue.id}',
                  child: NetPhoto(path: issue.photoPath ?? issue.thumbPath, category: issue.category, semanticLabel: 'Photo of ${issue.title}'),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              sliver: SliverList.list(
                children: [
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [StatusChip(issue.status), SeverityChip(issue.severity), SlaChip(issue), if (issue.supportersCount > 0) SupportersChip(issue.supportersCount)],
                  ),
                  const SizedBox(height: 10),
                  Text(issue.title, style: text.headlineSmall),
                  const SizedBox(height: 4),
                  Text(
                    'Reported ${timeAgo(issue.createdAt)}${issue.reportedByMe ? ' by you' : ''} · ${issue.place}',
                    style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                  if (buttons.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    for (final b in buttons) Padding(padding: const EdgeInsets.only(bottom: 8), child: b),
                  ],
                  if (issue.supportedByMe)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text('You said "Me too". You will get updates on this issue.', style: text.bodyMedium),
                    ),
                  if (issue.hasBeforeAfter) ...[
                    const SizedBox(height: 12),
                    Text('Before and after', style: text.titleMedium),
                    const SizedBox(height: 8),
                    BeforeAfterSlider(before: issue.photoPath, after: issue.resolutionPhotoPath),
                    if (issue.resolutionNote.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text('Technician: ${issue.resolutionNote}', style: text.bodyMedium),
                    ],
                  ],
                  if (issue.description.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text('Description', style: text.titleMedium),
                    const SizedBox(height: 6),
                    Text(issue.description, style: text.bodyLarge),
                  ],
                  if (issue.status == 'rejected' && issue.rejectionReason.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text('Not actioned: ${issue.rejectionReason}', style: text.bodyMedium),
                  ],
                  const SizedBox(height: 20),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _Row(icon: Meta.categoryIcon[issue.category] ?? Icons.label_outline, label: 'Category', value: Meta.category(issue.category)),
                          if (issue.ai != null)
                            _Row(
                              icon: Icons.auto_awesome_rounded,
                              label: 'AI suggestion',
                              value: '${Meta.category(issue.ai!.category)} · ${(issue.ai!.confidence * 100).round()}%',
                            ),
                          _Row(icon: Icons.place_outlined, label: 'Location', value: issue.locationRef?.title ?? issue.place),
                          _Row(icon: Icons.engineering_outlined, label: 'Assigned to', value: issue.assignedToName ?? 'Not assigned yet'),
                          if (issue.dueAt != null)
                            _Row(icon: Icons.schedule_rounded, label: 'Due', value: _formatDue(issue.dueAt!)),
                        ],
                      ),
                    ),
                  ),
                  if (issue.hasLocation) ...[
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => openInMaps(issue.lat!, issue.lng!, issue.title),
                      icon: const Icon(Icons.directions_rounded),
                      label: const Text('Open in Maps'),
                    ),
                  ],
                  const SizedBox(height: 24),
                  Text('Status timeline', style: text.titleMedium),
                  const SizedBox(height: 12),
                  _Timeline(history: issue.history),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatDue(DateTime d) {
    final local = d.toLocal();
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    return '${local.day}/${local.month} at $hh:$mm';
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: scheme.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label.toUpperCase(), style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant, letterSpacing: 0.6)),
                const SizedBox(height: 2),
                Text(value, style: text.bodyLarge),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.history});
  final List<HistoryEntry> history;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      children: [
        for (var i = 0; i < history.length; i++)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: 24,
                  child: Column(
                    children: [
                      Container(
                        width: 14,
                        height: 14,
                        margin: const EdgeInsets.only(top: 3),
                        decoration: BoxDecoration(color: StatusColors.of(history[i].status), shape: BoxShape.circle),
                      ),
                      if (i < history.length - 1) Expanded(child: Container(width: 2, color: scheme.outline)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(Meta.status(history[i].status), style: text.titleMedium?.copyWith(fontSize: 15)),
                        Text(
                          '${history[i].by ?? ''}${history[i].by != null ? ' · ' : ''}${timeAgo(history[i].at)}',
                          style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
                        ),
                        if (history[i].note.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(history[i].note, style: text.bodyMedium),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _ReasonSheet extends StatefulWidget {
  const _ReasonSheet();

  @override
  State<_ReasonSheet> createState() => _ReasonSheetState();
}

class _ReasonSheetState extends State<_ReasonSheet> {
  final _form = GlobalKey<FormState>();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('What is still wrong?', style: text.titleLarge),
            const SizedBox(height: 4),
            Text('You can reopen within 7 days of the fix.', style: text.bodyMedium),
            const SizedBox(height: 16),
            TextFormField(
              controller: _reason,
              autofocus: true,
              maxLines: 3,
              maxLength: 500,
              validator: Validators.reason,
              decoration: const InputDecoration(labelText: 'Reason'),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () {
                if (_form.currentState?.validate() ?? false) Navigator.pop(context, _reason.text.trim());
              },
              child: const Text('Reopen issue'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResolveSheet extends StatefulWidget {
  const _ResolveSheet();

  @override
  State<_ResolveSheet> createState() => _ResolveSheetState();
}

class _ResolveSheetState extends State<_ResolveSheet> {
  final _note = TextEditingController();
  final _photos = PhotoService();
  String? _photo;
  bool _working = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _take(bool camera) async {
    setState(() => _working = true);
    try {
      final raw = await _photos.pick(camera: camera);
      if (raw != null) {
        final compressed = await _photos.compress(raw);
        if (mounted) setState(() => (_photo, _error) = (compressed, null));
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not open the camera. Try the gallery.');
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Resolve with an after photo', style: text.titleLarge),
          const SizedBox(height: 4),
          Text('The reporter sees it next to the before photo.', style: text.bodyMedium),
          const SizedBox(height: 16),
          if (_photo != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(Radii.card),
              child: AspectRatio(aspectRatio: 16 / 9, child: Image.file(File(_photo!), fit: BoxFit.cover)),
            )
          else
            Container(
              height: 120,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(Radii.card),
                border: Border.all(color: scheme.outline),
              ),
              child: _working ? const CircularProgressIndicator() : Icon(Icons.add_a_photo_outlined, size: 36, color: scheme.onSurfaceVariant),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: OutlinedButton.icon(onPressed: _working ? null : () => _take(true), icon: const Icon(Icons.photo_camera_outlined), label: const Text('Camera'))),
              const SizedBox(width: 10),
              Expanded(child: OutlinedButton.icon(onPressed: _working ? null : () => _take(false), icon: const Icon(Icons.photo_library_outlined), label: const Text('Gallery'))),
            ],
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: TextStyle(color: scheme.error))),
          const SizedBox(height: 12),
          TextField(controller: _note, maxLength: 500, decoration: const InputDecoration(labelText: 'Note (optional)', hintText: 'e.g. Replaced the HDMI cable')),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _photo == null ? null : () => Navigator.pop(context, (photo: _photo!, note: _note.text.trim())),
            child: const Text('Mark resolved'),
          ),
        ],
      ),
    );
  }
}
