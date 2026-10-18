import 'package:fixit_campus/services/api.dart';
import 'package:fixit_campus/services/issues_service.dart';
import 'package:fixit_campus/services/offline_queue.dart';
import 'package:flutter_test/flutter_test.dart';

class MemoryStorage implements QueueStorage {
  List<Map<String, dynamic>> saved = [];
  final deleted = <String>[];

  @override
  Future<List<Map<String, dynamic>>> load() async => saved;
  @override
  Future<void> save(List<Map<String, dynamic>> items) async => saved = items;
  @override
  Future<String?> keepPhoto(String? path, String id) async => path == null ? null : 'kept/$id.jpg';
  @override
  Future<void> deletePhoto(String? path) async {
    if (path != null) deleted.add(path);
  }
}

NewReport report(String id) => NewReport(
      title: 'Leak $id',
      category: 'plumbing',
      severity: 'high',
      clientRequestId: id,
      photoPath: '/tmp/$id.jpg',
      landmark: 'Library',
    );

void main() {
  late DateTime now;
  late MemoryStorage storage;
  late List<String> sentIds;
  late Object? failWith;

  OfflineQueue makeQueue() => OfflineQueue(
        storage: storage,
        clock: () => now,
        send: (r) async {
          if (failWith != null) throw failWith!;
          sentIds.add(r.clientRequestId);
        },
      );

  setUp(() {
    now = DateTime(2026, 10, 18, 9);
    storage = MemoryStorage();
    sentIds = [];
    failWith = null;
  });

  test('saves reports with their photo and persists them', () async {
    final q = makeQueue();
    await q.add(report('a'));
    expect(q.pending, 1);
    expect(q.items.single.report.photoPath, 'kept/a.jpg');
    expect(storage.saved, hasLength(1));
    // a fresh queue (app restart) loads it back
    final reloaded = makeQueue();
    await reloaded.load();
    expect(reloaded.items.single.id, 'a');
  });

  test('sends everything when online and cleans up photos', () async {
    final q = makeQueue();
    await q.add(report('a'));
    await q.add(report('b'));
    final res = await q.flush();
    expect(res.sent, 2);
    expect(sentIds, ['a', 'b']);
    expect(q.pending, 0);
    expect(storage.deleted, ['kept/a.jpg', 'kept/b.jpg']);
  });

  test('network failures back off exponentially and keep the same clientRequestId', () async {
    final q = makeQueue();
    await q.add(report('a'));
    failWith = ApiException(0, 'NETWORK', 'offline');

    await q.flush();
    expect(q.items.single.attempts, 1);
    expect(q.items.single.nextAttemptAt, now.add(const Duration(seconds: 5)));

    // not due yet: no attempt is made
    now = now.add(const Duration(seconds: 3));
    final early = await q.flush();
    expect(early.retrying, 1);
    expect(q.items.single.attempts, 1);

    now = now.add(const Duration(seconds: 3));
    await q.flush();
    expect(q.items.single.attempts, 2);
    expect(q.items.single.nextAttemptAt, now.add(const Duration(seconds: 10)));

    // back online: the same request id is sent, so the server can de-duplicate
    failWith = null;
    now = now.add(const Duration(seconds: 11));
    final res = await q.flush();
    expect(res.sent, 1);
    expect(sentIds, ['a']);
    expect(q.pending, 0);
  });

  test('force sends immediately (reconnect) even before the backoff expires', () async {
    final q = makeQueue();
    await q.add(report('a'));
    failWith = ApiException(0, 'NETWORK', 'offline');
    await q.flush();
    failWith = null;
    final res = await q.flush(force: true);
    expect(res.sent, 1);
  });

  test('server errors retry; validation errors are dropped and reported', () async {
    final q = makeQueue();
    await q.add(report('a'));
    failWith = ApiException(503, 'UNAVAILABLE', 'try later');
    expect((await q.flush()).retrying, 1);
    expect(q.pending, 1);

    failWith = ApiException(400, 'VALIDATION_ERROR', 'Title too short');
    final res = await q.flush(force: true);
    expect(res.dropped.single.id, 'a');
    expect(res.dropped.single.lastError, 'Title too short');
    expect(q.pending, 0);
  });

  test("only the owner's session sends (and sees) a queued report", () async {
    final q = makeQueue();
    await q.add(report('a'), ownerId: 'student-A');
    await q.add(report('b'), ownerId: 'student-B');
    expect(q.pendingFor('student-B'), 1);
    expect(q.itemsFor('student-B').single.id, 'b');

    final res = await q.flush(ownerId: 'student-B');
    expect(res.sent, 1);
    expect(sentIds, ['b']);
    expect(q.items.single.id, 'a', reason: "A's report waits for A");

    await q.flush(ownerId: 'student-A');
    expect(sentIds, ['b', 'a']);
    expect(q.pending, 0);
  });

  test('adding the same report twice keeps one entry', () async {
    final q = makeQueue();
    await q.add(report('a'));
    await q.add(report('a'));
    expect(q.pending, 1);
  });

  test('backoff is capped at 5 minutes', () {
    expect(OfflineQueue.defaultBackoff(1), const Duration(seconds: 5));
    expect(OfflineQueue.defaultBackoff(4), const Duration(seconds: 40));
    expect(OfflineQueue.defaultBackoff(20), const Duration(minutes: 5));
  });

  test('retryable errors', () {
    expect(OfflineQueue.isRetryable(ApiException(0, 'NETWORK', '')), isTrue);
    expect(OfflineQueue.isRetryable(ApiException(500, 'INTERNAL', '')), isTrue);
    expect(OfflineQueue.isRetryable(ApiException(429, 'RATE_LIMITED', '')), isTrue);
    expect(OfflineQueue.isRetryable(ApiException(401, 'UNAUTHENTICATED', '')), isTrue, reason: 'keep it until the user signs in again');
    expect(OfflineQueue.isRetryable(ApiException(400, 'VALIDATION_ERROR', '')), isFalse);
    expect(OfflineQueue.isRetryable(ApiException(409, 'DUPLICATE', '')), isFalse);
    expect(OfflineQueue.isRetryable(StateError('socket closed')), isTrue);
  });
}
