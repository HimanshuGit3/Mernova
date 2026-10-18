import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/env.dart';

/// A realtime event from the server (SPEC section 10).
class RealtimeEvent {
  const RealtimeEvent(this.name, this.data);

  final String name;
  final Object? data;

  /// The issue id in `issue:updated` / `issue:created` / `notification:new` payloads.
  String? get issueId {
    final d = data;
    if (d is! Map) return null;
    final issue = d['issue'];
    if (issue is Map && issue['id'] is String) return issue['id'] as String;
    if (issue is String) return issue;
    if (d['id'] is String && name == 'issue:created') return d['id'] as String;
    return null;
  }
}

/// One Socket.IO connection with the JWT in the handshake (D4). Screens listen to [events]
/// and refetch; after a reconnect a `reconnected` event tells them to refetch everything.
class RealtimeService {
  io.Socket? _socket;
  final _events = StreamController<RealtimeEvent>.broadcast();
  bool _connected = false;

  Stream<RealtimeEvent> get events => _events.stream;
  bool get connected => _connected;

  static const _forwarded = ['issue:created', 'issue:updated', 'notification:new', 'stats:changed'];

  void connect(String token) {
    disconnect();
    final socket = io.io(
      Env.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(8000)
          .disableAutoConnect()
          .enableForceNew()
          .build(),
    );
    for (final name in _forwarded) {
      socket.on(name, (dynamic data) => _events.add(RealtimeEvent(name, data)));
    }
    socket.onConnect((_) {
      final wasReconnect = _hasConnectedBefore;
      _hasConnectedBefore = true;
      _connected = true;
      _events.add(RealtimeEvent(wasReconnect ? 'reconnected' : 'connected', null));
    });
    socket.onDisconnect((_) {
      _connected = false;
      _events.add(const RealtimeEvent('disconnected', null));
    });
    _socket = socket;
    socket.connect();
  }

  bool _hasConnectedBefore = false;

  void disconnect() {
    _socket?.dispose();
    _socket = null;
    _connected = false;
    _hasConnectedBefore = false;
  }

  void dispose() {
    disconnect();
    _events.close();
  }
}
