import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../../models/models.dart';
import '../../services/api.dart';
import '../../services/device_services.dart';
import '../../services/issues_service.dart';
import '../../theme/tokens.dart';
import '../common/issue_detail_screen.dart';
import 'report_form.dart';

enum _Step { photo, details, sending, done }

/// Report flow (SPEC 8.3): photo → details (GPS or landmark) → upload with progress → success.
class ReportFlowScreen extends StatefulWidget {
  const ReportFlowScreen({super.key});

  @override
  State<ReportFlowScreen> createState() => _ReportFlowScreenState();
}

class _ReportFlowScreenState extends State<ReportFlowScreen> {
  final _photos = PhotoService();
  final _gps = LocationService();
  final _formKey = GlobalKey<ReportDetailsFormState>();

  _Step _step = _Step.photo;
  String? _photo;
  LocationState _location = const LocatingGps();
  double _progress = 0;
  Issue? _created;

  /// One id per report: retries of the same report can never create a second issue.
  final String _requestId = const Uuid().v4();

  @override
  void initState() {
    super.initState();
    _locate();
  }

  Future<void> _locate() async {
    setState(() => _location = const LocatingGps());
    final result = await _gps.current();
    if (!mounted) return;
    setState(() {
      _location = switch (result) {
        GpsFix fix => GpsReady(fix),
        GpsUnavailable(:final reason, :final canOpenSettings) => NoGps(reason, canOpenSettings: canOpenSettings),
      };
    });
  }

  Future<void> _pick(bool camera) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final raw = await _photos.pick(camera: camera);
      if (raw == null) return;
      final compressed = await _photos.compress(raw);
      await HapticFeedback.selectionClick();
      if (!mounted) return;
      setState(() {
        _photo = compressed;
        _step = _Step.details;
      });
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Could not open the camera. Check the permission or use the gallery.')));
    }
  }

  Future<void> _changePhoto() async {
    final camera = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Take a photo'), onTap: () => Navigator.pop(sheet, true)),
            ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choose from gallery'), onTap: () => Navigator.pop(sheet, false)),
          ],
        ),
      ),
    );
    if (camera != null) await _pick(camera);
  }

  Future<void> _send(ReportDraft d) async {
    final service = context.read<IssuesService>();
    final messenger = ScaffoldMessenger.of(context);
    final loc = _location;
    final report = NewReport(
      title: d.title,
      category: d.category,
      severity: d.severity,
      description: d.description,
      landmark: d.landmark,
      clientRequestId: _requestId,
      photoPath: _photo,
      lat: loc is GpsReady ? loc.fix.lat : null,
      lng: loc is GpsReady ? loc.fix.lng : null,
      locationId: loc is RoomScanned ? loc.id : null,
    );
    setState(() {
      _step = _Step.sending;
      _progress = 0;
    });
    try {
      final issue = await service.create(report, onProgress: (p) {
        if (mounted) setState(() => _progress = p);
      });
      await HapticFeedback.heavyImpact();
      if (!mounted) return;
      setState(() {
        _created = issue;
        _step = _Step.done;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _step = _Step.details);
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report an issue')),
      body: AnimatedSwitcher(
        duration: Motion.normal,
        child: switch (_step) {
          _Step.photo => _PhotoStep(key: const ValueKey('photo'), onPick: _pick),
          _Step.details || _Step.sending => Stack(
              key: const ValueKey('details'),
              children: [
                ReportDetailsForm(
                  key: _formKey,
                  photoPath: _photo,
                  location: _location,
                  busy: _step == _Step.sending,
                  onRetryGps: _locate,
                  onOpenSettings: _gps.openSettings,
                  onChangePhoto: _changePhoto,
                  onSubmit: _send,
                ),
                if (_step == _Step.sending) _UploadOverlay(progress: _progress),
              ],
            ),
          _Step.done => _Success(
              key: const ValueKey('done'),
              onTrack: () => Navigator.of(context).pushReplacement(
                MaterialPageRoute<void>(builder: (_) => IssueDetailScreen(issueId: _created!.id, preview: _created)),
              ),
              onDone: () => Navigator.of(context).pop(),
            ),
        },
      ),
    );
  }
}

class _PhotoStep extends StatelessWidget {
  const _PhotoStep({super.key, required this.onPick});
  final void Function(bool camera) onPick;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Snap the problem', style: text.headlineSmall),
        const SizedBox(height: 6),
        Text('A clear photo helps the technician bring the right tools.', style: text.bodyLarge?.copyWith(color: scheme.onSurfaceVariant)),
        const SizedBox(height: 24),
        _BigOption(
          icon: Icons.photo_camera_rounded,
          title: 'Take a photo',
          subtitle: 'Use the camera now',
          primary: true,
          onTap: () => onPick(true),
        ),
        const SizedBox(height: 12),
        _BigOption(icon: Icons.photo_library_rounded, title: 'Choose from gallery', subtitle: 'Pick a photo you already took', onTap: () => onPick(false)),
      ],
    );
  }
}

class _BigOption extends StatelessWidget {
  const _BigOption({required this.icon, required this.title, required this.subtitle, required this.onTap, this.primary = false});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final bg = primary ? Brand.navy900 : scheme.surface;
    final fg = primary ? Colors.white : scheme.onSurface;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(Radii.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.card),
            border: primary ? null : Border.all(color: scheme.outline),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: primary ? Brand.gold500 : scheme.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: primary ? Brand.navy900 : scheme.primary, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: text.titleMedium?.copyWith(color: fg)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: text.bodyMedium?.copyWith(color: primary ? const Color(0xFFC5CEE2) : scheme.onSurfaceVariant)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: fg),
            ],
          ),
        ),
      ),
    );
  }
}

class _UploadOverlay extends StatelessWidget {
  const _UploadOverlay({required this.progress});
  final double progress;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.45),
        child: Center(
          child: Card(
            margin: const EdgeInsets.all(32),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Sending your report', style: text.titleMedium),
                  const SizedBox(height: 16),
                  LinearProgressIndicator(value: progress > 0 ? progress : null, minHeight: 8, borderRadius: BorderRadius.circular(99)),
                  const SizedBox(height: 8),
                  Text('${(progress * 100).round()}%', style: text.labelLarge),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Success extends StatelessWidget {
  const _Success({super.key, required this.onTrack, required this.onDone});
  final VoidCallback onTrack;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final reduce = MediaQuery.of(context).disableAnimations;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TweenAnimationBuilder<double>(
              tween: Tween(begin: reduce ? 1 : 0.4, end: 1),
              duration: const Duration(milliseconds: 450),
              curve: Curves.elasticOut,
              builder: (_, v, child) => Transform.scale(scale: v, child: child),
              child: Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(color: StatusColors.resolved.withValues(alpha: 0.15), shape: BoxShape.circle),
                child: const Icon(Icons.check_circle_rounded, size: 64, color: StatusColors.resolved),
              ),
            ),
            const SizedBox(height: 20),
            Text('Report sent!', style: text.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'The estate office sees it right now. We will notify you when a technician picks it up.',
              textAlign: TextAlign.center,
              style: text.bodyLarge?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            FilledButton(onPressed: onTrack, child: const Text('Track this report')),
            const SizedBox(height: 8),
            TextButton(onPressed: onDone, child: const Text('Back to home')),
          ],
        ),
      ),
    );
  }
}
