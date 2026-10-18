import 'package:dio/dio.dart';

import '../models/models.dart';
import 'api.dart';

/// Fields of a new report. Only one of [locationId] / GPS / [landmark] is required.
class NewReport {
  NewReport({
    required this.title,
    required this.category,
    required this.severity,
    required this.clientRequestId,
    this.description = '',
    this.photoPath,
    this.lat,
    this.lng,
    this.locationId,
    this.landmark = '',
    this.aiCategory,
    this.aiConfidence,
  });

  final String title;
  final String category;
  final String severity;
  final String description;
  final String clientRequestId;
  final String? photoPath;
  final double? lat;
  final double? lng;
  final String? locationId;
  final String landmark;
  final String? aiCategory;
  final double? aiConfidence;

  Map<String, dynamic> toJson() => {
        'title': title,
        'category': category,
        'severity': severity,
        'description': description,
        'clientRequestId': clientRequestId,
        'photoPath': photoPath,
        'lat': lat,
        'lng': lng,
        'locationId': locationId,
        'landmark': landmark,
        'aiCategory': aiCategory,
        'aiConfidence': aiConfidence,
      };

  static NewReport fromJson(Map<String, dynamic> j) => NewReport(
        title: j['title'] as String,
        category: j['category'] as String,
        severity: j['severity'] as String,
        description: (j['description'] as String?) ?? '',
        clientRequestId: j['clientRequestId'] as String,
        photoPath: j['photoPath'] as String?,
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
        locationId: j['locationId'] as String?,
        landmark: (j['landmark'] as String?) ?? '',
        aiCategory: j['aiCategory'] as String?,
        aiConfidence: (j['aiConfidence'] as num?)?.toDouble(),
      );
}

class IssuesService {
  IssuesService(this.api);

  final ApiClient api;

  Future<Paged<Issue>> list({List<String>? status, String sort = 'newest', int page = 1, int limit = 20}) async {
    final json = await api.get('/issues', query: {
      if (status != null && status.isNotEmpty) 'status': status.join(','),
      'sort': sort,
      'page': page,
      'limit': limit,
    });
    return Paged.fromJson(json, Issue.fromJson);
  }

  Future<Issue> get(String id) async => Issue.fromJson(await api.get('/issues/$id'));

  Future<Paged<FeedItem>> feed({int page = 1, int limit = 10}) async =>
      Paged.fromJson(await api.get('/issues/feed', query: {'page': page, 'limit': limit}), FeedItem.fromJson);

  /// Multipart upload with progress. Repeating the same [NewReport.clientRequestId]
  /// returns the existing issue (idempotent offline retries, FR-58).
  Future<Issue> create(NewReport r, {void Function(double progress)? onProgress}) async {
    final form = FormData.fromMap({
      'title': r.title,
      'category': r.category,
      'severity': r.severity,
      'clientRequestId': r.clientRequestId,
      if (r.description.isNotEmpty) 'description': r.description,
      if (r.lat != null && r.lng != null) 'lat': r.lat.toString(),
      if (r.lat != null && r.lng != null) 'lng': r.lng.toString(),
      if (r.locationId != null) 'locationId': r.locationId,
      if (r.landmark.isNotEmpty) 'landmark': r.landmark,
      if (r.aiCategory != null) 'aiSuggestedCategory': r.aiCategory,
      if (r.aiConfidence != null) 'aiConfidence': r.aiConfidence.toString(),
      if (r.photoPath != null)
        'photo': await MultipartFile.fromFile(
          r.photoPath!,
          filename: 'report.jpg',
          contentType: DioMediaType('image', 'jpeg'),
        ),
    });
    final json = await api.post(
      '/issues',
      data: form,
      onSendProgress: (sent, total) {
        if (total > 0) onProgress?.call(sent / total);
      },
    );
    return Issue.fromJson(json);
  }

  Future<Issue> transition(String id, String to, {String? note, String? reason, String? photoPath}) async {
    final Object data;
    if (photoPath != null) {
      data = FormData.fromMap({
        'to': to,
        if (note != null && note.isNotEmpty) 'note': note,
        'photo': await MultipartFile.fromFile(
          photoPath,
          filename: 'after.jpg',
          contentType: DioMediaType('image', 'jpeg'),
        ),
      });
    } else {
      data = {
        'to': to,
        if (note != null && note.isNotEmpty) 'note': note,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      };
    }
    return Issue.fromJson(await api.post('/issues/$id/transition', data: data));
  }

  Future<Issue> support(String id) async => Issue.fromJson(await api.post('/issues/$id/support'));

  /// Look up a scanned room. Unknown or deactivated rooms throw ApiException(404).
  Future<LocationRef> room(String code) async =>
      LocationRef.fromJson(await api.get('/locations/code/${Uri.encodeComponent(code)}'));

  /// AI category suggestion + duplicate candidates for a photo, before reporting (FR-51/52).
  Future<Analysis> analyse({required String photoPath, double? lat, double? lng, String? locationId}) async {
    final form = FormData.fromMap({
      if (lat != null && lng != null) 'lat': lat.toString(),
      if (lat != null && lng != null) 'lng': lng.toString(),
      if (locationId != null) 'locationId': locationId,
      'photo': await MultipartFile.fromFile(photoPath, filename: 'photo.jpg', contentType: DioMediaType('image', 'jpeg')),
    });
    return Analysis.fromJson(await api.post('/issues/analyse', data: form));
  }
}

class NotificationsService {
  NotificationsService(this.api);

  final ApiClient api;

  Future<({List<AppNotification> items, int unread})> list({int limit = 30}) async {
    final json = await api.get('/notifications', query: {'limit': limit});
    final page = Paged.fromJson(json, AppNotification.fromJson);
    final unread = json['unreadCount'];
    return (items: page.items, unread: unread is num ? unread.toInt() : 0);
  }

  Future<void> markRead(String id) => api.post('/notifications/$id/read');

  Future<void> markAllRead() => api.post('/notifications/read-all');
}
