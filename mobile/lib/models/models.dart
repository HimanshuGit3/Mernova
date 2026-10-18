// Plain data classes parsed from the API's JSON (see docs/API.md).
// Parsing is defensive: missing optional fields become null instead of throwing.

typedef Json = Map<String, dynamic>;

String? _str(Object? v) => v is String ? v : null;
int _int(Object? v) => v is num ? v.toInt() : 0;
double? _double(Object? v) => v is num ? v.toDouble() : null;
DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;
Json? _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : null;
List<Json> _maps(Object? v) =>
    v is List ? v.whereType<Map<dynamic, dynamic>>().map(Map<String, dynamic>.from).toList() : <Json>[];

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.department = '',
    this.skills = const [],
  });

  final String id;
  final String name;
  final String email;
  final String role;
  final String department;
  final List<String> skills;

  bool get isStudent => role == 'student';
  bool get isTechnician => role == 'technician';
  bool get isAdmin => role == 'admin';

  factory AppUser.fromJson(Json j) => AppUser(
        id: _str(j['id']) ?? '',
        name: _str(j['name']) ?? '',
        email: _str(j['email']) ?? '',
        role: _str(j['role']) ?? 'student',
        department: _str(j['department']) ?? '',
        skills: (j['skills'] is List) ? (j['skills'] as List<dynamic>).whereType<String>().toList() : const [],
      );
}

class LocationRef {
  const LocationRef({
    required this.id,
    required this.code,
    required this.building,
    this.floor = '',
    this.room = '',
    this.label = '',
    this.lat,
    this.lng,
  });

  final String id;
  final String code;
  final String building;
  final String floor;
  final String room;
  final String label;
  final double? lat;
  final double? lng;

  String get title => label.isNotEmpty ? '$code · $label' : code;

  factory LocationRef.fromJson(Json j) => LocationRef(
        id: _str(j['id']) ?? '',
        code: _str(j['code']) ?? '',
        building: _str(j['building']) ?? '',
        floor: _str(j['floor']) ?? '',
        room: _str(j['room']) ?? '',
        label: _str(j['label']) ?? '',
        lat: _double(j['lat']),
        lng: _double(j['lng']),
      );
}

class HistoryEntry {
  const HistoryEntry({required this.status, required this.at, this.note = '', this.by});

  final String status;
  final DateTime at;
  final String note;

  /// A display name, a role label, or "FixIt (automatic)".
  final String? by;

  factory HistoryEntry.fromJson(Json j) {
    final changedBy = j['changedBy'];
    String? by;
    if (changedBy == 'system') {
      by = 'FixIt (automatic)';
    } else if (changedBy is Map) {
      final name = _str(changedBy['name']);
      final role = _str(changedBy['role']);
      by = name ?? (role == 'technician' ? 'Maintenance team' : role == 'admin' ? 'Estate office' : 'Reporter');
    }
    return HistoryEntry(
      status: _str(j['status']) ?? 'open',
      at: _date(j['at']) ?? DateTime.now(),
      note: _str(j['note']) ?? '',
      by: by,
    );
  }
}

class AiSuggestion {
  const AiSuggestion({required this.category, required this.confidence, this.accepted});

  final String category;
  final double confidence;
  final bool? accepted;

  static AiSuggestion? fromJson(Json? j) {
    if (j == null) return null;
    final cat = _str(j['suggestedCategory']) ?? _str(j['category']);
    if (cat == null) return null;
    return AiSuggestion(
      category: cat,
      confidence: _double(j['confidence']) ?? 0,
      accepted: j['accepted'] is bool ? j['accepted'] as bool : null,
    );
  }
}

class Issue {
  const Issue({
    required this.id,
    required this.title,
    required this.category,
    required this.severity,
    required this.status,
    required this.createdAt,
    this.description = '',
    this.photoPath,
    this.thumbPath,
    this.resolutionPhotoPath,
    this.resolutionThumbPath,
    this.resolutionNote = '',
    this.lat,
    this.lng,
    this.locationRef,
    this.landmark = '',
    this.assignedToName,
    this.reporterName,
    this.supportersCount = 0,
    this.supportedByMe = false,
    this.reportedByMe = false,
    this.priorityScore = 0,
    this.dueAt,
    this.overdue = false,
    this.resolvedAt,
    this.ai,
    this.rejectionReason = '',
    this.history = const [],
    this.allowedActions = const [],
    this.canSupport = false,
  });

  final String id;
  final String title;
  final String description;
  final String category;
  final String severity;
  final String status;
  final String? photoPath;
  final String? thumbPath;
  final String? resolutionPhotoPath;
  final String? resolutionThumbPath;
  final String resolutionNote;
  final double? lat;
  final double? lng;
  final LocationRef? locationRef;
  final String landmark;
  final String? assignedToName;
  final String? reporterName;
  final int supportersCount;
  final bool supportedByMe;
  final bool reportedByMe;
  final int priorityScore;
  final DateTime? dueAt;
  final bool overdue;
  final DateTime createdAt;
  final DateTime? resolvedAt;
  final AiSuggestion? ai;
  final String rejectionReason;
  final List<HistoryEntry> history;
  final List<String> allowedActions;
  final bool canSupport;

  bool get hasLocation => lat != null && lng != null;
  bool get hasBeforeAfter =>
      photoPath != null && resolutionPhotoPath != null && (status == 'resolved' || status == 'closed');

  String get place {
    final loc = locationRef;
    if (loc != null) return '${loc.code} · ${loc.building}';
    if (landmark.isNotEmpty) return landmark;
    return hasLocation ? 'GPS location' : 'Campus';
  }

  factory Issue.fromJson(Json j) {
    final location = _map(j['location']);
    final loc = _map(j['locationRef']);
    return Issue(
      id: _str(j['id']) ?? '',
      title: _str(j['title']) ?? '',
      description: _str(j['description']) ?? '',
      category: _str(j['category']) ?? 'other',
      severity: _str(j['severity']) ?? 'medium',
      status: _str(j['status']) ?? 'open',
      photoPath: _str(j['photoPath']),
      thumbPath: _str(j['thumbPath']),
      resolutionPhotoPath: _str(j['resolutionPhotoPath']),
      resolutionThumbPath: _str(j['resolutionThumbPath']),
      resolutionNote: _str(j['resolutionNote']) ?? '',
      lat: _double(location?['lat']),
      lng: _double(location?['lng']),
      locationRef: loc == null ? null : LocationRef.fromJson(loc),
      landmark: _str(j['landmark']) ?? '',
      assignedToName: _str(_map(j['assignedTo'])?['name']),
      reporterName: _str(_map(j['reporter'])?['name']),
      supportersCount: _int(j['supportersCount']),
      supportedByMe: j['supportedByMe'] == true,
      reportedByMe: j['reportedByMe'] == true,
      priorityScore: _int(j['priorityScore']),
      dueAt: _date(j['dueAt']),
      overdue: j['overdue'] == true,
      createdAt: _date(j['createdAt']) ?? DateTime.now(),
      resolvedAt: _date(j['resolvedAt']),
      ai: AiSuggestion.fromJson(_map(j['ai'])),
      rejectionReason: _str(j['rejectionReason']) ?? '',
      history: _maps(j['statusHistory']).map(HistoryEntry.fromJson).toList(),
      allowedActions: (j['allowedActions'] is List)
          ? (j['allowedActions'] as List<dynamic>).whereType<String>().toList()
          : const [],
      canSupport: j['canSupport'] == true,
    );
  }
}

class FeedItem {
  const FeedItem({
    required this.id,
    required this.title,
    required this.category,
    this.place,
    this.photoPath,
    this.resolutionPhotoPath,
    this.resolutionHours,
    this.resolvedAt,
  });

  final String id;
  final String title;
  final String category;
  final String? place;
  final String? photoPath;
  final String? resolutionPhotoPath;
  final double? resolutionHours;
  final DateTime? resolvedAt;

  factory FeedItem.fromJson(Json j) => FeedItem(
        id: _str(j['id']) ?? '',
        title: _str(j['title']) ?? '',
        category: _str(j['category']) ?? 'other',
        place: _str(j['place']),
        photoPath: _str(j['photoPath']),
        resolutionPhotoPath: _str(j['resolutionPhotoPath']),
        resolutionHours: _double(j['resolutionHours']),
        resolvedAt: _date(j['resolvedAt']),
      );
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.createdAt,
    this.body = '',
    this.issueId,
    this.read = false,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String? issueId;
  final DateTime createdAt;
  final bool read;

  AppNotification markedRead() => AppNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        issueId: issueId,
        createdAt: createdAt,
        read: true,
      );

  factory AppNotification.fromJson(Json j) => AppNotification(
        id: _str(j['id']) ?? '',
        type: _str(j['type']) ?? 'status_changed',
        title: _str(j['title']) ?? '',
        body: _str(j['body']) ?? '',
        issueId: _str(j['issue']),
        createdAt: _date(j['createdAt']) ?? DateTime.now(),
        read: j['readAt'] != null,
      );
}

class Paged<T> {
  const Paged({required this.items, required this.page, required this.totalPages, required this.total});

  final List<T> items;
  final int page;
  final int totalPages;
  final int total;

  static Paged<T> fromJson<T>(Json j, T Function(Json) parse) => Paged<T>(
        items: _maps(j['items']).map(parse).toList(),
        page: _int(j['page']),
        totalPages: _int(j['totalPages']),
        total: _int(j['total']),
      );
}

class DuplicateCandidate {
  const DuplicateCandidate({
    required this.id,
    required this.title,
    required this.category,
    required this.status,
    this.thumbPath,
    this.distanceM = 0,
    this.similarity,
    this.supportersCount = 0,
    this.supportedByMe = false,
  });

  final String id;
  final String title;
  final String category;
  final String status;
  final String? thumbPath;
  final int distanceM;
  final double? similarity;
  final int supportersCount;
  final bool supportedByMe;

  factory DuplicateCandidate.fromJson(Json j) => DuplicateCandidate(
        id: _str(j['id']) ?? '',
        title: _str(j['title']) ?? '',
        category: _str(j['category']) ?? 'other',
        status: _str(j['status']) ?? 'open',
        thumbPath: _str(j['thumbPath']),
        distanceM: _int(j['distanceM']),
        similarity: _double(j['similarity']),
        supportersCount: _int(j['supportersCount']),
        supportedByMe: j['supportedByMe'] == true,
      );
}

/// Result of POST /issues/analyse: AI suggestion (may be null) + duplicate candidates.
class Analysis {
  const Analysis({this.suggestion, this.duplicates = const []});

  final AiSuggestion? suggestion;
  final List<DuplicateCandidate> duplicates;

  factory Analysis.fromJson(Json j) => Analysis(
        suggestion: AiSuggestion.fromJson(_map(j['suggestion'])),
        duplicates: _maps(j['duplicates']).map(DuplicateCandidate.fromJson).toList(),
      );
}
