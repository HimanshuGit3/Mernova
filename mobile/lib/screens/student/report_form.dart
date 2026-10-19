import 'dart:io';

import 'package:flutter/material.dart';

import '../../services/device_services.dart';
import '../../theme/meta.dart';
import '../../theme/tokens.dart';
import '../../utils/validators.dart';

/// What the user filled in (the flow adds the photo, GPS, room and request id).
class ReportDraft {
  const ReportDraft({required this.title, required this.category, required this.severity, required this.description, required this.landmark});

  final String title;
  final String category;
  final String severity;
  final String description;
  final String landmark;
}

/// Location state shown in the form.
sealed class LocationState {
  const LocationState();
}

class LocatingGps extends LocationState {
  const LocatingGps();
}

class GpsReady extends LocationState {
  const GpsReady(this.fix);
  final GpsFix fix;
}

class NoGps extends LocationState {
  const NoGps(this.reason, {this.canOpenSettings = false});
  final String reason;
  final bool canOpenSettings;
}

class RoomScanned extends LocationState {
  const RoomScanned({required this.id, required this.code, required this.building, required this.label});
  final String id;
  final String code;
  final String building;
  final String label;
}

/// The details step of the report flow (FR-10). Pure UI: the parent supplies the photo
/// and location and receives a [ReportDraft] once everything validates.
class ReportDetailsForm extends StatefulWidget {
  const ReportDetailsForm({
    super.key,
    required this.photoPath,
    required this.location,
    required this.onSubmit,
    this.initialCategory,
    this.aiChip,
    this.onRetryGps,
    this.onOpenSettings,
    this.onChangePhoto,
    this.busy = false,
  });

  final String? photoPath;
  final LocationState location;
  final ValueChanged<ReportDraft> onSubmit;
  final String? initialCategory;
  final Widget? aiChip;
  final VoidCallback? onRetryGps;
  final VoidCallback? onOpenSettings;
  final VoidCallback? onChangePhoto;
  final bool busy;

  @override
  State<ReportDetailsForm> createState() => ReportDetailsFormState();
}

class ReportDetailsFormState extends State<ReportDetailsForm> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _landmark = TextEditingController();
  String? _category;
  String _severity = 'medium';
  Map<String, String> _errors = const {};

  @override
  void initState() {
    super.initState();
    _category = widget.initialCategory;
  }

  @override
  void didUpdateWidget(covariant ReportDetailsForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Apply a late AI suggestion only if the user has not chosen yet.
    if (widget.initialCategory != null && oldWidget.initialCategory != widget.initialCategory && _category == null) {
      _category = widget.initialCategory;
    }
  }

  /// Let the AI chip apply its suggestion.
  void setCategory(String c) => setState(() => _category = c);

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _landmark.dispose();
    super.dispose();
  }

  void _submit() {
    final loc = widget.location;
    final errors = validateReport(
      title: _title.text,
      category: _category,
      hasGps: loc is GpsReady,
      hasRoom: loc is RoomScanned,
      landmark: _landmark.text,
      hasPhoto: widget.photoPath != null,
    );
    setState(() => _errors = errors);
    if (errors.isNotEmpty) return;
    widget.onSubmit(ReportDraft(
      title: _title.text.trim(),
      category: _category!,
      severity: _severity,
      description: _description.text.trim(),
      landmark: _landmark.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final needsLandmark = widget.location is NoGps;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        _PhotoStrip(path: widget.photoPath, onChange: widget.onChangePhoto, error: _errors['photo']),
        const SizedBox(height: 20),
        TextField(
          key: const Key('report-title'),
          controller: _title,
          maxLength: 100,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(labelText: "What's the problem?", hintText: 'e.g. Projector flickering', errorText: _errors['title']),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Text('Category', style: text.titleMedium),
            const Spacer(),
            if (widget.aiChip != null) widget.aiChip!,
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final c in Meta.categories)
              ChoiceChip(
                avatar: Icon(Meta.categoryIcon[c], size: 18, color: _category == c ? scheme.onPrimary : Meta.categoryColor[c]),
                label: Text(Meta.category(c)),
                selected: _category == c,
                showCheckmark: false,
                selectedColor: scheme.primary,
                labelStyle: TextStyle(color: _category == c ? scheme.onPrimary : scheme.onSurface, fontWeight: FontWeight.w600),
                onSelected: (_) => setState(() => _category = c),
              ),
          ],
        ),
        if (_errors['category'] != null)
          Padding(padding: const EdgeInsets.only(top: 6), child: Text(_errors['category']!, style: TextStyle(color: scheme.error, fontSize: 12))),
        const SizedBox(height: 20),
        Text('How serious is it?', style: text.titleMedium),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: SegmentedButton<String>(
            segments: [for (final s in Meta.severities) ButtonSegment(value: s, label: Text(Meta.severity(s)))],
            selected: {_severity},
            showSelectedIcon: false,
            onSelectionChanged: (v) => setState(() => _severity = v.first),
          ),
        ),
        const SizedBox(height: 20),
        Text('Where is it?', style: text.titleMedium),
        const SizedBox(height: 8),
        _LocationCard(state: widget.location, onRetry: widget.onRetryGps, onOpenSettings: widget.onOpenSettings),
        const SizedBox(height: 12),
        TextField(
          key: const Key('report-landmark'),
          controller: _landmark,
          maxLength: 120,
          decoration: InputDecoration(
            labelText: needsLandmark ? 'Landmark (required)' : 'Landmark (optional)',
            hintText: 'e.g. Next to the library entrance',
            prefixIcon: const Icon(Icons.signpost_outlined),
            errorText: _errors['landmark'],
            errorMaxLines: 2,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _description,
          maxLines: 3,
          maxLength: 1000,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Details (optional)'),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          key: const Key('report-submit'),
          onPressed: widget.busy ? null : _submit,
          icon: const Icon(Icons.send_rounded),
          label: const Text('Send report'),
        ),
      ],
    );
  }
}

class _PhotoStrip extends StatelessWidget {
  const _PhotoStrip({required this.path, this.onChange, this.error});
  final String? path;
  final VoidCallback? onChange;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(Radii.card),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (path != null)
                  Image.file(File(path!), fit: BoxFit.cover, semanticLabel: 'Photo of the problem')
                else
                  Container(
                    color: scheme.surfaceContainerHigh,
                    child: Icon(Icons.add_a_photo_outlined, size: 40, color: scheme.onSurfaceVariant),
                  ),
                if (onChange != null)
                  Positioned(
                    right: 10,
                    bottom: 10,
                    child: FilledButton.tonalIcon(
                      onPressed: onChange,
                      icon: const Icon(Icons.photo_camera_outlined, size: 18),
                      label: Text(path == null ? 'Add photo' : 'Retake'),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(error!, style: TextStyle(color: scheme.error, fontSize: 12))),
      ],
    );
  }
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.state, this.onRetry, this.onOpenSettings});
  final LocationState state;
  final VoidCallback? onRetry;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final (IconData icon, Color color, String title, String body) = switch (state) {
      LocatingGps() => (Icons.gps_not_fixed_rounded, StatusColors.open, 'Finding your location…', 'Stand near a window for a faster fix.'),
      GpsReady(:final fix) => (
          Icons.gps_fixed_rounded,
          StatusColors.resolved,
          'GPS location added',
          'Accurate to about ${fix.accuracyM.round()} m (${fix.lat.toStringAsFixed(5)}, ${fix.lng.toStringAsFixed(5)})',
        ),
      NoGps(:final reason) => (Icons.gps_off_rounded, StatusColors.inProgress, 'No GPS location', reason),
      RoomScanned(:final code, :final building, :final label) => (
          Icons.qr_code_2_rounded,
          StatusColors.resolved,
          'Room $code',
          '$building${label.isNotEmpty ? ' · $label' : ''}',
        ),
    };
    final s = state;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(Radii.card),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          if (s is LocatingGps)
            const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5))
          else
            Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.titleMedium?.copyWith(fontSize: 15)),
                const SizedBox(height: 2),
                Text(body, style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
              ],
            ),
          ),
          if (s is NoGps && s.canOpenSettings && onOpenSettings != null)
            TextButton(onPressed: onOpenSettings, child: const Text('Settings'))
          else if (s is NoGps && onRetry != null)
            TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

