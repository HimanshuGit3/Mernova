import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../services/api.dart';
import '../../services/issues_service.dart';
import '../../theme/tokens.dart';
import '../../utils/qr.dart';

/// Scan a room's FixIt sticker (FR-53). Pops with the [LocationRef] of an active room.
class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_busy) return;
    final raw = capture.barcodes.isEmpty ? null : capture.barcodes.first.rawValue;
    final code = parseLocationQr(raw);
    if (code == null) {
      setState(() => _message = 'That is not a FixIt Campus room sticker. Look for "Scan in FixIt Campus".');
      return;
    }
    setState(() {
      _busy = true;
      _message = 'Found $code…';
    });
    final service = context.read<IssuesService>();
    final navigator = Navigator.of(context);
    try {
      final room = await service.room(code);
      await HapticFeedback.mediumImpact();
      navigator.pop(room);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = e.status == 404 ? 'Room $code is not in service any more. Add a landmark instead.' : e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan room QR'),
        actions: [
          ValueListenableBuilder<MobileScannerState>(
            valueListenable: _controller,
            builder: (_, state, _) {
              final on = state.torchState == TorchState.on;
              return IconButton(
                tooltip: on ? 'Turn torch off' : 'Turn torch on',
                icon: Icon(on ? Icons.flashlight_off_rounded : Icons.flashlight_on_rounded),
                onPressed: state.torchState == TorchState.unavailable ? null : _controller.toggleTorch,
              );
            },
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (_, error) => _ScannerError(error: error),
          ),
          // viewfinder
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(color: Brand.gold300, width: 4),
                borderRadius: BorderRadius.circular(24),
              ),
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 32,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(Radii.card)),
              child: Semantics(
                liveRegion: true,
                child: Row(
                  children: [
                    if (_busy)
                      const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Brand.gold300))
                    else
                      const Icon(Icons.qr_code_scanner_rounded, color: Brand.gold300),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _message ?? 'Point the camera at the sticker on the door or wall. It fills in the room for you.',
                        style: text.bodyMedium?.copyWith(color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScannerError extends StatelessWidget {
  const _ScannerError({required this.error});
  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.no_photography_outlined, color: Colors.white, size: 48),
              const SizedBox(height: 16),
              Text(
                denied
                    ? 'FixIt needs the camera to scan room stickers. Allow camera access in Settings, or go back and add a landmark.'
                    : 'The camera could not start. Go back and add a landmark instead.',
                style: const TextStyle(color: Colors.white, fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white54)),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Go back'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
