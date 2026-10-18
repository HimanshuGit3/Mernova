import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../../widgets/brand.dart';

class _Page {
  const _Page(this.icon, this.accent, this.title, this.body);
  final IconData icon;
  final Color accent;
  final String title;
  final String body;
}

const _pages = [
  _Page(Icons.photo_camera_rounded, Brand.gold300, 'Spot it. Snap it.', 'See something broken on campus? Take a photo. AI suggests the category, and a room QR sticker fills in exactly where you are.'),
  _Page(Icons.volunteer_activism_rounded, StatusColors.resolved, 'Say "Me too"', 'If someone already reported it, add your voice instead of a duplicate. Every "Me too" raises its priority.'),
  _Page(Icons.notifications_active_rounded, StatusColors.open, 'Sorted, live', 'Follow the fix in real time, from assigned to fixed, and confirm it with a before/after photo.'),
];

/// First-run onboarding (FR-57): three pages, shown once.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone});
  final VoidCallback onDone;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (_index == _pages.length - 1) {
      widget.onDone();
    } else {
      _controller.nextPage(duration: Motion.normal, curve: Motion.curve);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final last = _index == _pages.length - 1;
    return Scaffold(
      backgroundColor: Brand.navy900,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 8, 0),
              child: Row(
                children: [
                  const BrandLogo(light: true, size: 32),
                  const Spacer(),
                  if (!last)
                    TextButton(
                      onPressed: widget.onDone,
                      style: TextButton.styleFrom(foregroundColor: const Color(0xFFC5CEE2)),
                      child: const Text('Skip'),
                    ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) {
                  final page = _pages[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _Illustration(icon: page.icon, accent: page.accent),
                        const SizedBox(height: 40),
                        Text(page.title, textAlign: TextAlign.center, style: text.headlineSmall?.copyWith(color: Colors.white, fontSize: 28)),
                        const SizedBox(height: 12),
                        Text(page.body, textAlign: TextAlign.center, style: text.bodyLarge?.copyWith(color: const Color(0xFFC5CEE2))),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: Row(
                children: [
                  Semantics(
                    label: 'Page ${_index + 1} of ${_pages.length}',
                    child: Row(
                      children: [
                        for (var i = 0; i < _pages.length; i++)
                          AnimatedContainer(
                            duration: Motion.fast,
                            margin: const EdgeInsets.only(right: 6),
                            width: i == _index ? 24 : 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: i == _index ? Brand.gold300 : Colors.white24,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: Brand.gold500, foregroundColor: Brand.navy900),
                    onPressed: _next,
                    child: Text(last ? 'Get started' : 'Next'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Abstract illustration built from shapes and an icon (no stock art).
class _Illustration extends StatelessWidget {
  const _Illustration({required this.icon, required this.accent});
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      height: 220,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(width: 220, height: 220, decoration: BoxDecoration(shape: BoxShape.circle, color: accent.withValues(alpha: 0.10))),
          Container(width: 160, height: 160, decoration: BoxDecoration(shape: BoxShape.circle, color: accent.withValues(alpha: 0.18))),
          Positioned(top: 18, right: 30, child: _Dot(color: StatusColors.open)),
          Positioned(bottom: 26, left: 22, child: _Dot(color: StatusColors.resolved)),
          Positioned(bottom: 40, right: 16, child: _Dot(color: StatusColors.inProgress)),
          Container(
            width: 104,
            height: 104,
            decoration: BoxDecoration(color: Brand.navy700, borderRadius: BorderRadius.circular(28), border: Border.all(color: accent, width: 3)),
            child: Icon(icon, size: 52, color: accent),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3)),
      );
}
