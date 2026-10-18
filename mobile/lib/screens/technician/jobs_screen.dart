import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/api.dart';
import '../../services/issues_service.dart';
import '../../widgets/common.dart';
import '../../widgets/live.dart';
import '../common/issue_detail_screen.dart';

/// Technician jobs (FR-20): highest priority first, SLA countdown, overdue in red.
class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> with LiveRefresh<JobsScreen> {
  bool _done = false;
  List<Issue>? _jobs;
  String? _error;

  @override
  Future<void> onLiveRefresh() => _load();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final page = await context.read<IssuesService>().list(
            status: _done ? const ['resolved', 'closed'] : const ['assigned', 'in_progress'],
            sort: _done ? 'newest' : 'priority',
            limit: 50,
          );
      if (mounted) setState(() => (_jobs, _error) = (page.items, null));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final jobs = _jobs;
    final overdue = jobs?.where((j) => j.overdue).length ?? 0;
    final text = Theme.of(context).textTheme;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  jobs == null
                      ? 'Loading jobs…'
                      : _done
                          ? '${jobs.length} finished'
                          : '${jobs.length} to do${overdue > 0 ? ' · $overdue overdue' : ''}',
                  style: text.titleMedium,
                ),
              ),
              SegmentedButton<bool>(
                segments: const [ButtonSegment(value: false, label: Text('To do')), ButtonSegment(value: true, label: Text('Done'))],
                selected: {_done},
                showSelectedIcon: false,
                style: const ButtonStyle(visualDensity: VisualDensity.compact),
                onSelectionChanged: (v) {
                  setState(() {
                    _done = v.first;
                    _jobs = null;
                  });
                  _load();
                },
              ),
            ],
          ),
        ),
        Expanded(
          child: jobs == null
              ? (_error != null ? ErrorView(message: _error!, onRetry: _load) : const SkeletonList())
              : jobs.isEmpty
                  ? EmptyState(
                      icon: Icons.task_alt_rounded,
                      title: _done ? 'Nothing finished yet' : 'All clear!',
                      body: _done ? null : 'New jobs appear here the moment they are assigned to you.',
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        itemCount: jobs.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => IssueCard(
                          issue: jobs[i],
                          showPriority: !_done,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => IssueDetailScreen(issueId: jobs[i].id, preview: jobs[i])),
                          ),
                        ),
                      ),
                    ),
        ),
      ],
    );
  }
}
