import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import '../services/realtime_service.dart';

/// Refetch a screen when relevant realtime events arrive (debounced) and after a reconnect
/// (FR-34): events are hints; the screen always reloads from the API.
mixin LiveRefresh<T extends StatefulWidget> on State<T> {
  StreamSubscription<RealtimeEvent>? _liveSub;
  Timer? _liveTimer;

  /// Events this screen cares about.
  Set<String> get liveEvents => const {'issue:updated', 'issue:created'};

  /// Optional extra filter (e.g. only events for one issue).
  bool acceptLive(RealtimeEvent e) => true;

  /// Called (debounced) when something changed.
  Future<void> onLiveRefresh();

  @override
  void initState() {
    super.initState();
    final realtime = context.read<RealtimeService>();
    _liveSub = realtime.events.listen((e) {
      final relevant = e.name == 'reconnected' || (liveEvents.contains(e.name) && acceptLive(e));
      if (!relevant) return;
      _liveTimer?.cancel();
      _liveTimer = Timer(const Duration(milliseconds: 300), () {
        if (mounted) onLiveRefresh();
      });
    });
  }

  @override
  void dispose() {
    _liveTimer?.cancel();
    _liveSub?.cancel();
    super.dispose();
  }
}
