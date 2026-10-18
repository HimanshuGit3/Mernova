import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/env.dart';

/// An API failure in the server's one error shape: `{ error: { code, message, details } }`.
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message, [this.fields = const {}]);

  final int status;
  final String code;
  final String message;

  /// Field name → message, from `details`.
  final Map<String, String> fields;

  bool get isNetwork => status == 0;

  @override
  String toString() => message;

  static ApiException from(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) {
      final res = error.response;
      final data = res?.data;
      if (res != null && data is Map && data['error'] is Map) {
        final e = Map<String, dynamic>.from(data['error'] as Map<dynamic, dynamic>);
        final fields = <String, String>{};
        final details = e['details'];
        if (details is List) {
          for (final d in details.whereType<Map<dynamic, dynamic>>()) {
            final path = d['path'];
            final msg = d['message'];
            if (path is String && msg is String) fields.putIfAbsent(path, () => msg);
          }
        }
        return ApiException(
          res.statusCode ?? 500,
          e['code'] is String ? e['code'] as String : 'ERROR',
          e['message'] is String ? e['message'] as String : 'Something went wrong',
          fields,
        );
      }
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return ApiException(0, 'TIMEOUT', 'The server is taking too long. Check your connection.');
        case DioExceptionType.connectionError:
          return ApiException(0, 'NETWORK', 'Cannot reach FixIt Campus. Check Wi-Fi and try again.');
        default:
          return ApiException(res?.statusCode ?? 0, 'NETWORK', 'Network error. Please try again.');
      }
    }
    return ApiException(500, 'UNKNOWN', 'Something went wrong');
  }
}

/// Stores the JWT in the Android Keystore-backed secure storage, never in plain prefs.
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'fixit_token';
  final FlutterSecureStorage _storage;
  String? _cached;

  String? get current => _cached;

  Future<String?> read() async => _cached = await _storage.read(key: _key);

  Future<void> write(String token) async {
    _cached = token;
    await _storage.write(key: _key, value: token);
  }

  Future<void> clear() async {
    _cached = null;
    await _storage.delete(key: _key);
    await _storage.delete(key: _userKey);
  }

  static const _userKey = 'fixit_user';

  /// The signed-in profile, so the app can open offline.
  Future<void> writeUser(Map<String, dynamic> user) =>
      _storage.write(key: _userKey, value: jsonEncode(user));

  Future<Map<String, dynamic>?> readUser() async {
    final raw = await _storage.read(key: _userKey);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map ? Map<String, dynamic>.from(decoded) : null;
    } catch (_) {
      return null;
    }
  }
}

/// One Dio client for the whole app: attaches the token, turns every failure into an
/// [ApiException], and reports 401s so the session can sign out.
class ApiClient {
  ApiClient(this.tokens, {Dio? dio})
      : dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: Env.apiUrl,
                connectTimeout: const Duration(seconds: 10),
                receiveTimeout: const Duration(seconds: 30),
                sendTimeout: const Duration(seconds: 60),
              ),
            ) {
    this.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              final token = tokens.current;
              if (token != null) options.headers['Authorization'] = 'Bearer $token';
              handler.next(options);
            },
            onError: (error, handler) {
              final path = error.requestOptions.path;
              final isAuthCall = path.endsWith('/auth/login') || path.endsWith('/auth/register');
              if (error.response?.statusCode == 401 && !isAuthCall) onUnauthorized?.call();
              handler.next(error);
            },
          ),
        );
  }

  final TokenStore tokens;
  final Dio dio;

  /// Set by the session: called when the server says the token is no longer valid.
  void Function()? onUnauthorized;

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) =>
      _wrap(() => dio.get<dynamic>(path, queryParameters: query));

  Future<Map<String, dynamic>> post(
    String path, {
    Object? data,
    void Function(int sent, int total)? onSendProgress,
  }) =>
      _wrap(() => dio.post<dynamic>(path, data: data, onSendProgress: onSendProgress));

  Future<Map<String, dynamic>> _wrap(Future<Response<dynamic>> Function() call) async {
    try {
      final res = await call();
      final data = res.data;
      if (data is Map) return Map<String, dynamic>.from(data);
      return <String, dynamic>{};
    } catch (e) {
      throw ApiException.from(e);
    }
  }
}
