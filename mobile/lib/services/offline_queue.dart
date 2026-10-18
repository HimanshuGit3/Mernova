import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;

import 'api.dart';
import 'issues_service.dart';

/// A report waiting to be sent (FR-58). Holds only what is needed to send it (NFR-08).
class QueuedReport {
  QueuedReport({required this.report, required this.queuedAt, this.ownerId, this.attempts = 0, this.nextAttemptAt, this.lastError});

  final NewReport report;

  /// The user who queued it; only that user's session sends it (never filed under someone else).
  final String? ownerId;
  final DateTime queuedAt;
  int attempts;
  DateTime? nextAttemptAt;
  String? lastError;

  String get id => report.clientRequestId;

  Map<String, dynamic> toJson() => {
        'report': report.toJson(),
        'ownerId': ownerId,
        'queuedAt': queuedAt.toIso8601String(),
        'attempts': attempts,
        'nextAttemptAt': nextAttemptAt?.toIso8601String(),
        'lastError': lastError,
      };

  static QueuedReport fromJson(Map<String, dynamic> j) => QueuedReport(
        report: NewReport.fromJson(Map<String, dynamic>.from(j['report'] as Map<dynamic, dynamic>)),
        ownerId: j['ownerId'] as String?,
        queuedAt: DateTime.parse(j['queuedAt'] as String),
        attempts: (j['attempts'] as num?)?.toInt() ?? 0,
        nextAttemptAt: j['nextAttemptAt'] is String ? DateTime.parse(j['nextAttemptAt'] as String) : null,
        lastError: j['lastError'] as String?,
      );
}

/// Where the queue lives. The file implementation keeps a JSON list plus copies of the photos.
abstract class QueueStorage {
  Future<List<Map<String, dynamic>>> load();
  Future<void> save(List<Map<String, dynamic>> items);

  /// Copy the photo somewhere that survives the temp folder being cleaned; returns the new path.
  Future<String?> keepPhoto(String? path, String id);
  Future<void> deletePhoto(String? path);
}

class FileQueueStorage implements QueueStorage {
  FileQueueStorage(this.dir);
  final Directory dir;

  File get _file => File(p.join(dir.path, 'offline_queue.json'));

  @override
  Future<List<Map<String, dynamic>>> load() async {
    if (!await _file.exists()) return [];
    try {
      final decoded = jsonDecode(await _file.readAsString());
      if (decoded is! List) return [];
      return decoded.whereType<Map<dynamic, dynamic>>().map(Map<String, dynamic>.from).toList();
    } catch (_) {
      return [];
    }
  }

  @override
  Future<void> save(List<Map<String, dynamic>> items) async {
    await dir.create(recursive: true);
    // write-then-rename so a crash never leaves a half-written queue
    final tmp = File('${_file.path}.tmp');
    await tmp.writeAsString(jsonEncode(items), flush: true);
    await tmp.rename(_file.path);
  }

  @override
  Future<String?> keepPhoto(String? path, String id) async {
    if (path == null) return null;
    final photos = Directory(p.join(dir.path, 'queue_photos'));
    await photos.create(recursive: true);
    final target = p.join(photos.path, '$id.jpg');
    if (p.equals(path, target)) return target;
    await File(path).copy(target);
    return target;
  }

  @override
  Future<void> deletePhoto(String? path) async {
    if (path == null) return;
    final f = File(path);
    if (await f.exists()) await f.delete();
  }
}

/// Result of one flush.
class FlushResult {
  const FlushResult({this.sent = 0, this.retrying = 0, this.dropped = const []});
  final int sent;
  final int retrying;

  /// Reports the server refused for good (e.g. validation); shown to the user.
  final List<QueuedReport> dropped;
}

/// Offline report queue (FR-58): save when offline, send automatically when back online
/// with exponential backoff. Every report keeps its `clientRequestId`, so a retry after a
/// lost response returns the issue that was already created instead of a duplicate.
class OfflineQueue extends ChangeNotifier {
  OfflineQueue({
    required this.send,
    required this.storage,
    Duration Function(int attempt)? backoff,
    DateTime Function()? clock,
  })  : backoff = backoff ?? defaultBackoff,
        clock = clock ?? DateTime.now;

  final Future<void> Function(NewReport report) send;
  final QueueStorage storage;
  final Duration Function(int attempt) backoff;
  final DateTime Function() clock;

  final List<QueuedReport> _items = [];
  bool _flushing = false;

  List<QueuedReport> get items => List.unmodifiable(_items);
  int get pending => _items.length;

  /// Reports this user may see and send (their own, plus legacy ones without an owner).
  List<QueuedReport> itemsFor(String? ownerId) =>
      _items.where((q) => q.ownerId == null || q.ownerId == ownerId).toList(growable: false);
  int pendingFor(String? ownerId) => itemsFor(ownerId).length;

  /// 5 s, 10 s, 20 s, 40 s … capped at 5 minutes.
  static Duration defaultBackoff(int attempt) =>
      Duration(seconds: math.min(300, 5 * math.pow(2, math.max(0, attempt - 1)).toInt()));

  /// Network failures, server hiccups and an expired session (401: wait until the user signs
  /// in again; never lose their report) are retried; any other 4xx answer is final.
  static bool isRetryable(Object error) {
    if (error is! ApiException) return true;
    if (error.isNetwork) return true;
    return error.status >= 500 || const {401, 408, 429}.contains(error.status);
  }

  Future<void> load() async {
    _items
      ..clear()
      ..addAll((await storage.load()).map(QueuedReport.fromJson));
    notifyListeners();
  }

  Future<void> add(NewReport report, {String? ownerId}) async {
    final kept = await storage.keepPhoto(report.photoPath, report.clientRequestId);
    final stored = NewReport.fromJson({...report.toJson(), 'photoPath': kept});
    _items.removeWhere((q) => q.id == stored.clientRequestId);
    _items.add(QueuedReport(report: stored, queuedAt: clock(), ownerId: ownerId));
    await _persist();
    notifyListeners();
  }

  /// Try every report that is due. Safe to call often (it never runs twice at once).
  /// [ownerId]: the signed-in user; other users' reports wait for their owner to sign in.
  Future<FlushResult> flush({bool force = false, String? ownerId}) async {
    if (_flushing) return const FlushResult();
    _flushing = true;
    var sent = 0;
    var retrying = 0;
    final dropped = <QueuedReport>[];
    try {
      for (final item in List<QueuedReport>.of(_items)) {
        if (item.ownerId != null && item.ownerId != ownerId) continue;
        final due = item.nextAttemptAt;
        if (!force && due != null && due.isAfter(clock())) {
          retrying += 1;
          continue;
        }
        try {
          await send(item.report);
          _items.remove(item);
          await storage.deletePhoto(item.report.photoPath);
          sent += 1;
        } catch (e) {
          if (isRetryable(e)) {
            item.attempts += 1;
            item.nextAttemptAt = clock().add(backoff(item.attempts));
            item.lastError = e.toString();
            retrying += 1;
          } else {
            _items.remove(item);
            await storage.deletePhoto(item.report.photoPath);
            item.lastError = e.toString();
            dropped.add(item);
          }
        }
      }
      await _persist();
    } finally {
      _flushing = false;
      notifyListeners();
    }
    return FlushResult(sent: sent, retrying: retrying, dropped: dropped);
  }

  Future<void> _persist() => storage.save(_items.map((q) => q.toJson()).toList());
}
