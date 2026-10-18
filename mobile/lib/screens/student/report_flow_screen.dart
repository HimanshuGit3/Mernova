import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';

import '../../models/models.dart';
import '../../services/api.dart';
import '../../services/device_services.dart';
import '../../services/issues_service.dart';
import '../../services/offline_queue.dart';
import '../../theme/tokens.dart';
import '../../widgets/chips.dart';
import '../../widgets/common.dart';
import '../common/issue_detail_screen.dart';
import 'qr_scanner_screen.dart';
import 'report_form.dart';

enum _Step { photo, analysing, details, sending, done }

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
  Analysis? _analysis;
  bool _analysedWithLocation = false;
  bool _duplicateSheetShown = false;
  bool _savedOffline = false;

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
    if (!mounted || _location is RoomScanned) return; // a scanned room beats GPS indoors (D9)
    setState(() {
      _location = switch (result) {
        GpsFix fix => GpsReady(fix),
        GpsUnavailable(:final reason, :final canOpenSettings) => NoGps(reason, canOpenSettings: canOpenSettings),
      };
    });
    // The photo was analysed before GPS arrived: check for nearby duplicates again.
    if (result is GpsFix && _photo != null && !_analysedWithLocation && _step == _Step.details) {
      await _analyse();
      _maybeShowDuplicates();
    }
  }

  /// "Analysing…": AI category + duplicate candidates for the photo and current location.
  Future<void> _analyse() async {
    final photo = _photo;
    if (photo == null) return;
    final loc = _location;
    try {
      final analysis = await context.read<IssuesService>().analyse(
            photoPath: photo,
            lat: loc is GpsReady ? loc.fix.lat : null,
            lng: loc is GpsReady ? loc.fix.lng : null,
            locationId: loc is RoomScanned ? loc.id : null,
          );
      if (!mounted) return;
      setState(() {
        _analysis = analysis;
        _analysedWithLocation = loc is GpsReady || loc is RoomScanned;
      });
    } on ApiException {
      // AI is a helper: on any failure the student simply picks the category.
    }
  }

  /// FR-52: "Similar issue nearby — Me too?" before filing a duplicate.
  Future<void> _maybeShowDuplicates() async {
    final dups = _analysis?.duplicates ?? const <DuplicateCandidate>[];
    if (dups.isEmpty || _duplicateSheetShown || !mounted) return;
    _duplicateSheetShown = true;
    final chosen = await showModalBottomSheet<DuplicateCandidate>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _DuplicateSheet(duplicates: dups),
    );
    if (chosen == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final service = context.read<IssuesService>();
    try {
      final issue = chosen.supportedByMe ? await service.get(chosen.id) : await service.support(chosen.id);
      await HapticFeedback.mediumImpact();
      messenger.showSnackBar(const SnackBar(content: Text('Thanks! You will get updates on this issue.')));
      await navigator.pushReplacement(
        MaterialPageRoute<void>(builder: (_) => IssueDetailScreen(issueId: issue.id, preview: issue)),
      );
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
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
        _analysis = null;
        _analysedWithLocation = false;
        _step = _Step.analysing;
      });
      await _analyse();
      if (!mounted) return;
      setState(() => _step = _Step.details);
      await _maybeShowDuplicates();
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Could not open the camera. Check the permission or use the gallery.')));
    }
  }

  /// FR-53: scan the room sticker; the room's building, name and coordinates fill in.
  Future<void> _scanRoom() async {
    final messenger = ScaffoldMessenger.of(context);
    final room = await Navigator.of(context).push<LocationRef>(
      MaterialPageRoute<LocationRef>(builder: (_) => const QrScannerScreen()),
    );
    if (room == null || !mounted) return;
    setState(() {
      _location = RoomScanned(id: room.id, code: room.code, building: room.building, label: room.label);
      _analysedWithLocation = false;
    });
    messenger.showSnackBar(SnackBar(content: Text('Room ${room.code} added. Now snap the problem.')));
    if (_photo != null && _step == _Step.details) {
      await _analyse();
      await _maybeShowDuplicates();
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
      aiCategory: _analysis?.suggestion?.category,
      aiConfidence: _analysis?.suggestion?.confidence,
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
      if (OfflineQueue.isRetryable(e)) {
        // FR-58: no signal (or the server is down) → keep it on the phone and send it later.
        // The same clientRequestId is reused, so a report that did reach the server is never duplicated.
        await context.read<OfflineQueue>().add(report);
        await HapticFeedback.mediumImpact();
        if (!mounted) return;
        setState(() {
          _savedOffline = true;
          _step = _Step.done;
        });
        return;
      }
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
          _Step.photo => _PhotoStep(
              key: const ValueKey('photo'),
              onPick: _pick,
              onScan: _scanRoom,
              room: _location is RoomScanned ? (_location as RoomScanned).code : null,
            ),
          _Step.analysing => _Analysing(key: const ValueKey('analysing'), photoPath: _photo),
          _Step.details || _Step.sending => Stack(
              key: const ValueKey('details'),
              children: [
                ReportDetailsForm(
                  key: _formKey,
                  photoPath: _photo,
                  location: _location,
                  initialCategory: _analysis?.suggestion?.category,
                  aiChip: _analysis?.suggestion == null
                      ? null
                      : AiChip(
                          suggestion: _analysis!.suggestion!,
                          onApply: () => _formKey.currentState?.setCategory(_analysis!.suggestion!.category),
                        ),
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
              offline: _savedOffline,
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
  const _PhotoStep({super.key, required this.onPick, required this.onScan, this.room});
  final void Function(bool camera) onPick;
  final VoidCallback onScan;

  /// Code of the scanned room, if any.
  final String? room;

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
        const SizedBox(height: 24),
        Text('Indoors?', style: text.titleMedium),
        const SizedBox(height: 8),
        _BigOption(
          icon: room == null ? Icons.qr_code_scanner_rounded : Icons.check_circle_rounded,
          title: room == null ? 'Scan room QR' : 'Room $room added',
          subtitle: room == null ? 'The sticker on the door fills in the exact room' : 'Tap to scan a different room',
          onTap: onScan,
        ),
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
  const _Success({super.key, required this.onTrack, required this.onDone, this.offline = false});
  final bool offline;
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
            Text(offline ? 'Saved on your phone' : 'Report sent!', style: text.headlineSmall),
            const SizedBox(height: 8),
            Text(
              offline
                  ? 'No connection right now. Your report will be sent automatically as soon as you are back online.'
                  : 'The estate office sees it right now. We will notify you when a technician picks it up.',
              textAlign: TextAlign.center,
              style: text.bodyLarge?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            if (!offline) FilledButton(onPressed: onTrack, child: const Text('Track this report')),
            const SizedBox(height: 8),
            TextButton(onPressed: onDone, child: const Text('Back to home')),
          ],
        ),
      ),
    );
  }
}

/// "Analysing…" step: the photo with a soft pulsing overlay while AI looks at it.
class _Analysing extends StatelessWidget {
  const _Analysing({super.key, required this.photoPath});
  final String? photoPath;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(Radii.card),
          child: AspectRatio(
            aspectRatio: 4 / 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (photoPath != null) Image.file(File(photoPath!), fit: BoxFit.cover),
                const _Shimmer(),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            const Icon(Icons.auto_awesome_rounded, color: StatusColors.assigned),
            const SizedBox(width: 8),
            Text('Analysing…', style: text.titleLarge),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          'Suggesting a category and checking for the same problem nearby.',
          style: text.bodyLarge?.copyWith(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        const LinearProgressIndicator(minHeight: 6),
      ],
    );
  }
}

class _Shimmer extends StatefulWidget {
  const _Shimmer();

  @override
  State<_Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<_Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, _) => DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment(-1.5 + 3 * _c.value, -0.3),
            end: Alignment(-0.5 + 3 * _c.value, 0.3),
            colors: [
              Colors.white.withValues(alpha: 0),
              Colors.white.withValues(alpha: 0.35),
              Colors.white.withValues(alpha: 0),
            ],
          ),
        ),
      ),
    );
  }
}

/// FR-52: "Similar issue nearby — Me too?" Returns the chosen candidate, or null to continue.
class _DuplicateSheet extends StatelessWidget {
  const _DuplicateSheet({required this.duplicates});
  final List<DuplicateCandidate> duplicates;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Similar issue nearby', style: text.titleLarge),
            const SizedBox(height: 4),
            Text(
              'Is it the same problem? Say "Me too" to raise its priority instead of filing a new report.',
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: 14),
            for (final d in duplicates)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(width: 60, height: 60, child: NetPhoto(path: d.thumbPath, category: d.category)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(d.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: text.titleMedium?.copyWith(fontSize: 15)),
                            const SizedBox(height: 4),
                            Text(
                              [
                                '${d.distanceM} m away',
                                if (d.similarity != null) '${(d.similarity! * 100).round()}% similar',
                                if (d.supportersCount > 0) '${d.supportersCount} said me too',
                              ].join(' · '),
                              style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Brand.gold500,
                          foregroundColor: Brand.navy900,
                          minimumSize: const Size(48, 44),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                        ),
                        onPressed: () => Navigator.pop(context, d),
                        child: Text(d.supportedByMe ? 'Open' : 'Me too'),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 4),
            OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text("No, it's a different problem")),
          ],
        ),
      ),
    );
  }
}
