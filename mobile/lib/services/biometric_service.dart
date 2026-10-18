import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Biometric unlock (FR-57): when enabled, the app asks for a fingerprint/face (or the device
/// PIN) when it opens and after it has been in the background for a while.
class BiometricService extends ChangeNotifier {
  BiometricService(this._prefs, [LocalAuthentication? auth]) : _auth = auth ?? LocalAuthentication();

  static const _key = 'biometric_enabled';
  static const lockAfter = Duration(seconds: 30);

  final SharedPreferences _prefs;
  final LocalAuthentication _auth;

  bool get enabled => _prefs.getBool(_key) ?? false;

  /// True while the app is locked and waiting for the user.
  bool locked = false;
  DateTime? _backgroundedAt;

  Future<bool> available() async {
    try {
      return await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  /// Turn on only after a successful check, so nobody locks themselves out.
  Future<bool> setEnabled(bool value) async {
    if (value) {
      final ok = await authenticate(reason: 'Confirm to turn on biometric unlock');
      if (!ok) return false;
    }
    await _prefs.setBool(_key, value);
    locked = false;
    notifyListeners();
    return true;
  }

  Future<bool> authenticate({String reason = 'Unlock FixIt Campus'}) async {
    try {
      return await _auth.authenticate(localizedReason: reason);
    } catch (_) {
      return false;
    }
  }

  /// Lock on cold start (if enabled).
  void lockOnStart() {
    if (enabled) {
      locked = true;
      notifyListeners();
    }
  }

  void onBackground() => _backgroundedAt = DateTime.now();

  void onResume() {
    final since = _backgroundedAt;
    _backgroundedAt = null;
    if (enabled && since != null && DateTime.now().difference(since) > lockAfter) {
      locked = true;
      notifyListeners();
    }
  }

  Future<void> unlock() async {
    if (await authenticate()) {
      locked = false;
      notifyListeners();
    }
  }

  /// Sign-out must never leave a lock screen behind.
  void reset() {
    locked = false;
    notifyListeners();
  }
}
