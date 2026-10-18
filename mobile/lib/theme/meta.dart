import 'package:flutter/material.dart';

/// Labels and icons shared by every screen (same vocabulary as the web app).
abstract final class Meta {
  static const statusLabel = {
    'open': 'Open',
    'assigned': 'Assigned',
    'in_progress': 'In progress',
    'resolved': 'Resolved',
    'closed': 'Closed',
    'reopened': 'Reopened',
    'rejected': 'Rejected',
  };

  static const severityLabel = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical',
  };

  static const categories = ['electrical', 'plumbing', 'furniture', 'network', 'cleanliness', 'safety', 'other'];
  static const severities = ['low', 'medium', 'high', 'critical'];

  static const categoryLabel = {
    'electrical': 'Electrical',
    'plumbing': 'Plumbing',
    'furniture': 'Furniture',
    'network': 'Network',
    'cleanliness': 'Cleanliness',
    'safety': 'Safety',
    'other': 'Other',
  };

  static const categoryIcon = <String, IconData>{
    'electrical': Icons.bolt_rounded,
    'plumbing': Icons.water_drop_rounded,
    'furniture': Icons.chair_rounded,
    'network': Icons.wifi_rounded,
    'cleanliness': Icons.delete_outline_rounded,
    'safety': Icons.health_and_safety_rounded,
    'other': Icons.help_outline_rounded,
  };

  static const categoryColor = <String, Color>{
    'electrical': Color(0xFFE0A030),
    'plumbing': Color(0xFF3B7BD0),
    'furniture': Color(0xFF9C6B3F),
    'network': Color(0xFF7C5CD6),
    'cleanliness': Color(0xFF1F9E89),
    'safety': Color(0xFFDC2626),
    'other': Color(0xFF64748B),
  };

  static String status(String s) => statusLabel[s] ?? s;
  static String severity(String s) => severityLabel[s] ?? s;
  static String category(String c) => categoryLabel[c] ?? c;
}

String formatDuration(Duration d) {
  final m = d.inMinutes.abs();
  final days = m ~/ 1440;
  final hours = (m % 1440) ~/ 60;
  final mins = m % 60;
  if (days > 0) return hours > 0 ? '$days d $hours h' : '$days d';
  if (hours > 0) return mins > 0 ? '$hours h $mins m' : '$hours h';
  return '$mins m';
}

String timeAgo(DateTime t, {DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(t);
  if (diff.inSeconds < 45) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
  if (diff.inHours < 24) return '${diff.inHours} h ago';
  if (diff.inDays == 1) return 'yesterday';
  if (diff.inDays < 7) return '${diff.inDays} days ago';
  return '${t.day}/${t.month}/${t.year}';
}
