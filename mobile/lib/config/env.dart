/// Build-time configuration (D8).
///
/// Emulator:        --dart-define=API_BASE_URL=http://10.0.2.2:5000
/// Phone on Wi-Fi:  --dart-define=API_BASE_URL=http://<laptop LAN IPv4>:5000
abstract final class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5000',
  );

  /// REST base: `<origin>/api`.
  static String get apiUrl => '${_trimmed(apiBaseUrl)}/api';

  /// Socket.IO lives on the same origin as the API.
  static String get socketUrl => _trimmed(apiBaseUrl);

  /// The API stores paths like `/uploads/x.jpg`; each client builds the URL from its own origin.
  static String? assetUrl(String? path) {
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '${_trimmed(apiBaseUrl)}$path';
  }

  static String _trimmed(String s) => s.endsWith('/') ? s.substring(0, s.length - 1) : s;
}
