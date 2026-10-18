import 'dart:async';
import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Result of asking for the current position.
sealed class GpsResult {
  const GpsResult();
}

class GpsFix extends GpsResult {
  const GpsFix(this.lat, this.lng, this.accuracyM);
  final double lat;
  final double lng;
  final double accuracyM;
}

class GpsUnavailable extends GpsResult {
  const GpsUnavailable(this.reason, {this.canOpenSettings = false});
  final String reason;
  final bool canOpenSettings;
}

class LocationService {
  /// Ask permission if needed and get one fix, giving up after [timeout] (indoors GPS can hang).
  Future<GpsResult> current({Duration timeout = const Duration(seconds: 12)}) async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return const GpsUnavailable('Location is turned off. Add a landmark or scan a room QR.', canOpenSettings: true);
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied) {
        return const GpsUnavailable('Location permission denied. Add a landmark instead.');
      }
      if (perm == LocationPermission.deniedForever) {
        return const GpsUnavailable('Location is blocked for FixIt. Allow it in Settings or add a landmark.', canOpenSettings: true);
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(accuracy: LocationAccuracy.high, timeLimit: timeout),
      );
      return GpsFix(pos.latitude, pos.longitude, pos.accuracy);
    } on TimeoutException {
      return const GpsUnavailable('No GPS signal (common indoors). Add a landmark or scan a room QR.');
    } catch (_) {
      return const GpsUnavailable('Could not get your location. Add a landmark instead.');
    }
  }

  Future<void> openSettings() => Geolocator.openAppSettings();
}

class PhotoService {
  PhotoService([ImagePicker? picker]) : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;

  Future<String?> pick({required bool camera}) async {
    final file = await _picker.pickImage(
      source: camera ? ImageSource.camera : ImageSource.gallery,
      maxWidth: 2400,
      maxHeight: 2400,
      imageQuality: 92,
    );
    return file?.path;
  }

  /// NFR-12: compress on the phone before upload (≈ 200–500 KB instead of several MB).
  /// The server still re-encodes, so this only saves data and time.
  Future<String> compress(String path) async {
    final dir = await getTemporaryDirectory();
    final target = p.join(dir.path, 'fixit_${DateTime.now().microsecondsSinceEpoch}.jpg');
    final out = await FlutterImageCompress.compressAndGetFile(
      path,
      target,
      quality: 72,
      minWidth: 1600,
      minHeight: 1600,
      format: CompressFormat.jpeg,
    );
    return out?.path ?? path;
  }

  Future<int> sizeOf(String path) async => File(path).length();
}

/// FR-23: open the issue location in the phone's maps app.
Future<bool> openInMaps(double lat, double lng, String label) async {
  final geo = Uri.parse('geo:$lat,$lng?q=$lat,$lng(${Uri.encodeComponent(label)})');
  if (await canLaunchUrl(geo)) return launchUrl(geo, mode: LaunchMode.externalApplication);
  final web = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
  return launchUrl(web, mode: LaunchMode.externalApplication);
}
