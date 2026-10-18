import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';
import '../services/issues_service.dart';
import '../services/realtime_service.dart';

/// Light / dark / system theme, remembered on the device.
class ThemeController extends ChangeNotifier {
  ThemeController(this._prefs) : mode = _read(_prefs);

  final SharedPreferences _prefs;
  ThemeMode mode;

  static ThemeMode _read(SharedPreferences p) => switch (p.getString('theme')) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };

  Future<void> set(ThemeMode m) async {
    mode = m;
    notifyListeners();
    await _prefs.setString('theme', m.name);
  }
}

/// The shared notification inbox (FR-50): REST for history, Socket.IO for new items.
class NotificationsController extends ChangeNotifier {
  NotificationsController(this.service, RealtimeService realtime) {
    _sub = realtime.events.listen((e) {
      if (e.name == 'notification:new' && e.data is Map) {
        final n = AppNotification.fromJson(Map<String, dynamic>.from(e.data! as Map<dynamic, dynamic>));
        items = [n, ...items.where((x) => x.id != n.id)];
        unread += 1;
        _latest.add(n);
        notifyListeners();
      } else if (e.name == 'reconnected' || e.name == 'connected') {
        refresh();
      }
    });
  }

  final NotificationsService service;
  late final StreamSubscription<RealtimeEvent> _sub;
  final _latest = StreamController<AppNotification>.broadcast();

  List<AppNotification> items = [];
  int unread = 0;
  bool loading = false;
  String? error;

  /// New notifications as they arrive (the home shell shows a banner).
  Stream<AppNotification> get incoming => _latest.stream;

  Future<void> refresh() async {
    loading = true;
    notifyListeners();
    try {
      final res = await service.list();
      items = res.items;
      unread = res.unread;
      error = null;
    } catch (e) {
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> markRead(AppNotification n) async {
    if (n.read) return;
    items = [for (final x in items) x.id == n.id ? x.markedRead() : x];
    unread = unread > 0 ? unread - 1 : 0;
    notifyListeners();
    try {
      await service.markRead(n.id);
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    items = [for (final x in items) x.markedRead()];
    unread = 0;
    notifyListeners();
    try {
      await service.markAllRead();
    } catch (_) {}
  }

  void clear() {
    items = [];
    unread = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    _sub.cancel();
    _latest.close();
    super.dispose();
  }
}
