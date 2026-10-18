import 'dart:async';

import 'package:flutter/material.dart';

import '../models/models.dart';
import '../theme/meta.dart';
import '../theme/tokens.dart';

/// A pill: neutral text (AA contrast in both themes) with the meaning carried by a
/// coloured dot or icon, a tint and a border.
class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.color, this.icon, this.semanticsLabel});

  final String label;
  final Color color;
  final IconData? icon;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).colorScheme.onSurface;
    return Semantics(
      label: semanticsLabel,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.13),
          border: Border.all(color: color.withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null)
              Icon(icon, size: 14, color: color)
            else
              Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: text),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) =>
      Pill(label: Meta.status(status), color: StatusColors.of(status), semanticsLabel: 'Status: ${Meta.status(status)}');
}

class SeverityChip extends StatelessWidget {
  const SeverityChip(this.severity, {super.key});
  final String severity;

  @override
  Widget build(BuildContext context) => Pill(
        label: Meta.severity(severity),
        color: SeverityColors.of(severity),
        icon: severity == 'critical' ? Icons.warning_amber_rounded : null,
        semanticsLabel: 'Severity: ${Meta.severity(severity)}',
      );
}

class CategoryChip extends StatelessWidget {
  const CategoryChip(this.category, {super.key});
  final String category;

  @override
  Widget build(BuildContext context) => Pill(
        label: Meta.category(category),
        color: Meta.categoryColor[category] ?? StatusColors.closed,
        icon: Meta.categoryIcon[category],
      );
}

class SupportersChip extends StatelessWidget {
  const SupportersChip(this.count, {super.key});
  final int count;

  @override
  Widget build(BuildContext context) => Pill(
        label: '$count',
        color: Brand.gold500,
        icon: Icons.groups_rounded,
        semanticsLabel: '$count people said me too',
      );
}

/// What the SLA chip should say for an issue at a given moment (pure, unit-tested).
({String label, Color color, IconData icon})? slaState(Issue issue, DateTime now) {
  final due = issue.dueAt;
  if (due == null || issue.status == 'rejected') return null;
  if (issue.status == 'resolved' || issue.status == 'closed') {
    final met = issue.resolvedAt != null && !issue.resolvedAt!.isAfter(due);
    return (label: met ? 'SLA met' : 'Done late', color: met ? StatusColors.resolved : StatusColors.closed, icon: Icons.check_circle_outline);
  }
  final left = due.difference(now);
  if (left.isNegative) {
    return (label: 'Overdue ${formatDuration(left)}', color: SeverityColors.critical, icon: Icons.warning_amber_rounded);
  }
  final total = due.difference(issue.createdAt);
  final tight = total.inSeconds > 0 && left.inSeconds / total.inSeconds < 0.25;
  return (
    label: '${formatDuration(left)} left',
    color: tight ? StatusColors.inProgress : StatusColors.resolved,
    icon: Icons.schedule_rounded,
  );
}

/// Live SLA countdown (ticks every 30 s).
class SlaChip extends StatefulWidget {
  const SlaChip(this.issue, {super.key});
  final Issue issue;

  @override
  State<SlaChip> createState() => _SlaChipState();
}

class _SlaChipState extends State<SlaChip> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = slaState(widget.issue, DateTime.now());
    if (s == null) return const SizedBox.shrink();
    return Pill(label: s.label, color: s.color, icon: s.icon, semanticsLabel: 'SLA: ${s.label}');
  }
}
