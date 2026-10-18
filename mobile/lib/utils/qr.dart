/// Room stickers encode `FIXIT:LOC:<code>` (D9), e.g. `FIXIT:LOC:B-204`.
/// Returns the normalised room code, or null for anything that is not a FixIt sticker.
String? parseLocationQr(String? raw) {
  if (raw == null) return null;
  final match = RegExp(r'^FIXIT:LOC:([A-Z0-9][A-Z0-9-]{1,19})$', caseSensitive: false).firstMatch(raw.trim());
  return match?.group(1)?.toUpperCase();
}
