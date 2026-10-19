import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../services/api.dart';
import '../services/realtime_service.dart';

enum SessionStatus { loading, signedOut, signedIn }

/// Who is signed in. Same accounts as the web app (FR-02): the JWT from /auth/login works
/// on both. A 401 anywhere signs out and returns to the login screen.
class Session extends ChangeNotifier {
  Session(this.api, this.realtime) {
    api.onUnauthorized = _expire;
  }

  final ApiClient api;
  final RealtimeService realtime;

  SessionStatus status = SessionStatus.loading;
  AppUser? user;

  /// Shown on the login screen after an expired or revoked session.
  String? notice;

  Future<void> restore() async {
    final token = await api.tokens.read();
    if (token == null) {
      status = SessionStatus.signedOut;
      notifyListeners();
      return;
    }
    try {
      final json = await api.get('/auth/me');
      final fresh = Map<String, dynamic>.from(json['user'] as Map<dynamic, dynamic>);
      user = AppUser.fromJson(fresh);
      await api.tokens.writeUser(fresh);
      status = SessionStatus.signedIn;
      realtime.connect(token);
    } on ApiException catch (e) {
      final cached = await api.tokens.readUser();
      if (e.isNetwork && cached != null) {
        // Offline at start-up: keep the session with the cached profile (offline reports still work).
        user = AppUser.fromJson(cached);
        status = SessionStatus.signedIn;
        realtime.connect(token); // reconnects by itself when the network returns
      } else {
        await api.tokens.clear();
        status = SessionStatus.signedOut;
      }
    }
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final json = await api.post('/auth/login', data: {'email': email.trim(), 'password': password});
    await _accept(json);
  }

  Future<void> register({required String name, required String email, required String password, String department = ''}) async {
    final json = await api.post('/auth/register', data: {
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
      if (department.trim().isNotEmpty) 'department': department.trim(),
    });
    await _accept(json);
  }

  Future<void> _accept(Map<String, dynamic> json) async {
    final token = json['token'] as String;
    await api.tokens.write(token);
    final profile = Map<String, dynamic>.from(json['user'] as Map<dynamic, dynamic>);
    await api.tokens.writeUser(profile);
    user = AppUser.fromJson(profile);
    status = SessionStatus.signedIn;
    notice = null;
    realtime.connect(token);
    notifyListeners();
  }

  /// Supplies this phone's push token so every sign-out path unregisters it (set in main).
  String? Function()? deviceToken;

  Future<void> logout({String? fcmToken}) async {
    final token = fcmToken ?? deviceToken?.call();
    try {
      await api.post('/auth/logout', data: {'fcmToken': ?token});
    } catch (_) {
      // Sign out locally even if the server cannot be reached.
    }
    await _clear();
  }

  void _expire() {
    if (status != SessionStatus.signedIn) return;
    notice = 'Your session ended. Please sign in again.';
    _clear();
  }

  Future<void> _clear() async {
    realtime.disconnect();
    await api.tokens.clear();
    user = null;
    status = SessionStatus.signedOut;
    notifyListeners();
  }
}
