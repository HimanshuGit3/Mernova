import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../config/env.dart';
import '../models/models.dart';
import '../theme/meta.dart';
import '../theme/tokens.dart';
import 'chips.dart';

/// Network photo from an API path, with a shape+icon fallback (no stock art).
class NetPhoto extends StatelessWidget {
  const NetPhoto({super.key, required this.path, this.category, this.fit = BoxFit.cover, this.semanticLabel});

  final String? path;
  final String? category;
  final BoxFit fit;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final url = Env.assetUrl(path);
    final fallback = _Fallback(category: category);
    if (url == null) return fallback;
    return Semantics(
      image: true,
      label: semanticLabel,
      child: CachedNetworkImage(
        imageUrl: url,
        fit: fit,
        fadeInDuration: Motion.normal,
        placeholder: (_, _) => Container(color: Theme.of(context).colorScheme.surfaceContainerHigh),
        errorWidget: (_, _, _) => fallback,
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({this.category});
  final String? category;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      color: scheme.surfaceContainerHigh,
      alignment: Alignment.center,
      child: Icon(Meta.categoryIcon[category] ?? Icons.image_not_supported_outlined, color: scheme.onSurfaceVariant, size: 28),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.body, this.action});

  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(color: Brand.gold300.withValues(alpha: 0.2), shape: BoxShape.circle),
                ),
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: scheme.outline),
                  ),
                  child: Icon(icon, color: scheme.primary, size: 28),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(title, style: text.titleMedium, textAlign: TextAlign.center),
            if (body != null) ...[
              const SizedBox(height: 6),
              Text(body!, style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant), textAlign: TextAlign.center),
            ],
            if (action != null) ...[const SizedBox(height: 16), action!],
          ],
        ),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => EmptyState(
        icon: Icons.cloud_off_rounded,
        title: 'Could not load this',
        body: message,
        action: OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('Try again')),
      );
}

/// Shimmer-free skeleton (a gently pulsing block); respects reduced motion.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 16, this.width, this.radius = 8});

  final double height;
  final double? width;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHigh;
    return FadeTransition(
      opacity: Tween<double>(begin: 0.55, end: 1).animate(_c),
      child: Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(widget.radius)),
      ),
    );
  }
}

class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 5});
  final int count;

  @override
  Widget build(BuildContext context) => ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: count,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (_, _) => const Row(
          children: [
            Skeleton(height: 64, width: 64, radius: 12),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [Skeleton(height: 14), SizedBox(height: 8), Skeleton(height: 12, width: 140), SizedBox(height: 10), Skeleton(height: 22, width: 180, radius: 99)],
              ),
            ),
          ],
        ),
      );
}

/// A tappable issue card used in My reports and Jobs. The photo is a Hero for the
/// shared-element transition into the detail screen.
class IssueCard extends StatelessWidget {
  const IssueCard({super.key, required this.issue, required this.onTap, this.showPriority = false});

  final Issue issue;
  final VoidCallback onTap;
  final bool showPriority;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Hero(
                tag: 'issue-photo-${issue.id}',
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(width: 72, height: 72, child: NetPhoto(path: issue.thumbPath, category: issue.category)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(issue.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: text.titleMedium?.copyWith(fontSize: 15)),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(Icons.place_outlined, size: 13, color: scheme.onSurfaceVariant),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            '${issue.place} · ${timeAgo(issue.createdAt)}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        StatusChip(issue.status),
                        if (showPriority || issue.severity == 'critical' || issue.severity == 'high') SeverityChip(issue.severity),
                        SlaChip(issue),
                        if (issue.supportersCount > 0) SupportersChip(issue.supportersCount),
                      ],
                    ),
                  ],
                ),
              ),
              if (showPriority) ...[
                const SizedBox(width: 8),
                Column(
                  children: [
                    Text('${issue.priorityScore}', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                    Text('PRIORITY', style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant, fontSize: 10, letterSpacing: 0.6)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Drag to compare the before and after photos (FR-57). Keyboard/TalkBack: adjustable slider.
class BeforeAfterSlider extends StatefulWidget {
  const BeforeAfterSlider({super.key, required this.before, required this.after, this.aspectRatio = 4 / 3});

  final String? before;
  final String? after;
  final double aspectRatio;

  @override
  State<BeforeAfterSlider> createState() => _BeforeAfterSliderState();
}

class _BeforeAfterSliderState extends State<BeforeAfterSlider> {
  double _pos = 0.5;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: widget.aspectRatio,
      child: LayoutBuilder(
        builder: (context, box) {
          final w = box.maxWidth;
          void update(double dx) => setState(() => _pos = (dx / w).clamp(0.0, 1.0));
          return Semantics(
            label: 'Before and after comparison',
            value: '${(_pos * 100).round()} percent before',
            increasedValue: '${((_pos + 0.1).clamp(0.0, 1.0) * 100).round()} percent before',
            decreasedValue: '${((_pos - 0.1).clamp(0.0, 1.0) * 100).round()} percent before',
            onIncrease: () => setState(() => _pos = (_pos + 0.1).clamp(0.0, 1.0)),
            onDecrease: () => setState(() => _pos = (_pos - 0.1).clamp(0.0, 1.0)),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onHorizontalDragUpdate: (d) => update(d.localPosition.dx),
              onTapDown: (d) => update(d.localPosition.dx),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(Radii.card),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    NetPhoto(path: widget.after),
                    ClipRect(
                      clipper: _LeftClipper(_pos),
                      child: NetPhoto(path: widget.before),
                    ),
                    Positioned(
                      left: w * _pos - 1,
                      top: 0,
                      bottom: 0,
                      child: Container(width: 2, color: Colors.white),
                    ),
                    Positioned(
                      left: w * _pos - 20,
                      top: box.maxHeight / 2 - 20,
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(blurRadius: 8, color: Color(0x40000000))],
                        ),
                        child: const Icon(Icons.compare_arrows_rounded, color: Brand.navy900),
                      ),
                    ),
                    const Positioned(left: 10, top: 10, child: _Tag('Before', Brand.navy900)),
                    const Positioned(right: 10, top: 10, child: _Tag('After', StatusColors.resolved)),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LeftClipper extends CustomClipper<Rect> {
  _LeftClipper(this.fraction);
  final double fraction;

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width * fraction, size.height);

  @override
  bool shouldReclip(_LeftClipper old) => old.fraction != fraction;
}

class _Tag extends StatelessWidget {
  const _Tag(this.label, this.color);
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(99)),
        child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
      );
}
