import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'api.dart';

/// Firebase options come from --dart-define (see docs/FIREBASE_SETUP.md), so the app builds
/// and runs without google-services.json or the Google Services Gradle plugin.
abstract final class FirebaseConfig {
  static const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const senderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

  static bool get configured => apiKey.isNotEmpty && appId.isNotEmpty && senderId.isNotEmpty && projectId.isNotEmpty;

  static FirebaseOptions get options => const FirebaseOptions(
        apiKey: apiKey,
        appId: appId,
        messagingSenderId: senderId,
        projectId: projectId,
      );
}

/// Optional push notifications (D5). Without Firebase config every method is a no-op and
/// notifications still arrive in-app over Socket.IO while the app is open.
class PushService {
  PushService(this.api);

  final ApiClient api;
  bool _ready = false;
  String? _token;
  StreamSubscription<String>? _refreshSub;

  bool get enabled => _ready;
  String? get token => _token;

  /// Called with the issue id when the user taps a notification.
  void Function(String issueId)? onOpenIssue;

  /// Called for messages that arrive while the app is in the foreground.
  void Function(String title, String body, String? issueId)? onForeground;

  Future<void> init() async {
    if (!FirebaseConfig.configured) {
      debugPrint('[push] Firebase not configured: push disabled (in-app notifications still work)');
      return;
    }
    try {
      await Firebase.initializeApp(options: FirebaseConfig.options);
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      FirebaseMessaging.onMessage.listen((m) {
        final n = m.notification;
        if (n != null) onForeground?.call(n.title ?? 'FixIt Campus', n.body ?? '', _issueOf(m));
      });
      FirebaseMessaging.onMessageOpenedApp.listen((m) {
        final id = _issueOf(m);
        if (id != null) onOpenIssue?.call(id);
      });
      final initial = await messaging.getInitialMessage();
      final initialId = initial == null ? null : _issueOf(initial);
      if (initialId != null) {
        // let the first screen build before navigating
        scheduleMicrotask(() => onOpenIssue?.call(initialId));
      }
      _ready = true;
    } catch (e) {
      debugPrint('[push] Firebase failed to start: $e');
    }
  }

  static String? _issueOf(RemoteMessage m) {
    final id = m.data['issueId'];
    return id is String && id.isNotEmpty ? id : null;
  }

  /// Register this device for the signed-in user (POST /auth/fcm-token).
  /// `onRegistered` delivers the first token and every refresh; each one is sent to the server.
  Future<void> registerDevice() async {
    if (!_ready) return;
    try {
      _refreshSub ??= FirebaseMessaging.instance.onRegistered.listen((t) {
        _token = t;
        api.post('/auth/fcm-token', data: {'token': t}).ignore();
      });
      // A token we already know (e.g. a new user signed in on this phone) is sent right away.
      final known = _token;
      if (known != null) await api.post('/auth/fcm-token', data: {'token': known});
      await FirebaseMessaging.instance.register();
    } catch (e) {
      debugPrint('[push] token registration failed: $e');
    }
  }
}
