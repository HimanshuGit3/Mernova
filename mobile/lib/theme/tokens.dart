import 'package:flutter/material.dart';

/// Brand and semantic colours shared with the web app (SPEC 8.1).
abstract final class Brand {
  static const navy900 = Color(0xFF0F1F3D);
  static const navy700 = Color(0xFF1B3260);
  static const gold500 = Color(0xFFC9962B);
  static const gold300 = Color(0xFFE4BC63);

  static const lightBg = Color(0xFFF5F6F9);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightText = Color(0xFF1A2233);
  static const lightMuted = Color(0xFF5B667C);
  static const lightBorder = Color(0xFFDFE3EC);

  static const darkBg = Color(0xFF0B1223);
  static const darkSurface = Color(0xFF131D36);
  static const darkText = Color(0xFFE8ECF6);
  static const darkMuted = Color(0xFF9AA6C3);
  static const darkBorder = Color(0xFF26345A);
}

abstract final class StatusColors {
  static const open = Color(0xFF3B7BD0);
  static const assigned = Color(0xFF7C5CD6);
  static const inProgress = Color(0xFFE0A030);
  static const resolved = Color(0xFF1F9E89);
  static const closed = Color(0xFF64748B);
  static const reopened = Color(0xFFE2654B);
  static const rejected = Color(0xFF9CA3AF);

  static Color of(String status) => switch (status) {
        'open' => open,
        'assigned' => assigned,
        'in_progress' => inProgress,
        'resolved' => resolved,
        'closed' => closed,
        'reopened' => reopened,
        'rejected' => rejected,
        _ => closed,
      };
}

abstract final class SeverityColors {
  static const low = Color(0xFF64748B);
  static const medium = Color(0xFF3B7BD0);
  static const high = Color(0xFFE0A030);
  static const critical = Color(0xFFDC2626);

  static Color of(String severity) => switch (severity) {
        'low' => low,
        'medium' => medium,
        'high' => high,
        'critical' => critical,
        _ => medium,
      };
}

abstract final class Radii {
  static const card = 12.0;
  static const control = 10.0;
}

abstract final class Motion {
  static const fast = Duration(milliseconds: 150);
  static const normal = Duration(milliseconds: 220);
  static const curve = Curves.easeOutCubic;
}
