/// Form rules, kept pure so they are easy to unit test. They mirror the server's zod
/// schemas; the server stays the authority (NFR-03).
abstract final class Validators {
  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  static String? email(String? v) {
    final s = v?.trim() ?? '';
    if (s.isEmpty) return 'Enter your email';
    if (!_email.hasMatch(s)) return 'Enter a valid email address';
    return null;
  }

  static String? loginPassword(String? v) => (v == null || v.isEmpty) ? 'Enter your password' : null;

  static String? newPassword(String? v) => (v == null || v.length < 8) ? 'Use at least 8 characters' : null;

  static String? name(String? v) => (v == null || v.trim().length < 2) ? 'Enter your full name' : null;

  static String? title(String? v) {
    final s = v?.trim() ?? '';
    if (s.length < 3) return 'Describe the problem in a few words';
    if (s.length > 100) return 'Keep the title under 100 characters';
    return null;
  }

  static String? reason(String? v) => (v == null || v.trim().isEmpty) ? 'Please give a reason' : null;
}

/// Problems that stop a report from being sent. Empty map = ready.
Map<String, String> validateReport({
  required String title,
  required String? category,
  required bool hasGps,
  required bool hasRoom,
  required String landmark,
  required bool hasPhoto,
}) {
  final errors = <String, String>{};
  final t = Validators.title(title);
  if (t != null) errors['title'] = t;
  if (category == null) errors['category'] = 'Pick a category';
  if (!hasPhoto) errors['photo'] = 'Add a photo of the problem';
  if (!hasGps && !hasRoom && landmark.trim().isEmpty) {
    errors['landmark'] = 'No GPS here. Add a landmark, e.g. "Near the library entrance"';
  }
  return errors;
}
