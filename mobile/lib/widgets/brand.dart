import 'package:flutter/material.dart';

import '../theme/tokens.dart';

/// The FixIt Campus mark (pin + wrench), painted natively so it is crisp at any size.
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 36});
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox.square(
        dimension: size,
        child: const CustomPaint(painter: _LogoPainter()),
      );
}

class _LogoPainter extends CustomPainter {
  const _LogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 64;
    canvas.scale(s, s);
    final bg = RRect.fromRectAndRadius(const Rect.fromLTWH(0, 0, 64, 64), const Radius.circular(14));
    canvas.drawRRect(bg, Paint()..color = Brand.navy900);

    final pin = Path()
      ..moveTo(32, 9)
      ..cubicTo(22.6, 9, 15, 16.4, 15, 25.6)
      ..cubicTo(15, 38, 32, 55, 32, 55)
      ..cubicTo(32, 55, 49, 38, 49, 25.6)
      ..cubicTo(49, 16.4, 41.4, 9, 32, 9)
      ..close();
    final gold = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Brand.gold300, Brand.gold500],
      ).createShader(const Rect.fromLTWH(15, 9, 34, 46));
    canvas.drawPath(pin, gold);
    canvas.drawCircle(const Offset(32, 25.5), 9.5, Paint()..color = Brand.navy900);

    // wrench: a short handle with a round jaw
    final wrench = Paint()
      ..color = Brand.gold300
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(27, 31), const Offset(33.5, 24.5), wrench);
    canvas.drawCircle(const Offset(35.3, 22.7), 3.6, Paint()..color = Brand.gold300);
    canvas.drawCircle(const Offset(36.8, 21.2), 1.6, Paint()..color = Brand.navy900);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.light = false, this.size = 36});
  final bool light;
  final double size;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final textColor = light ? Colors.white : Theme.of(context).colorScheme.onSurface;
    final accent = light || dark ? Brand.gold300 : const Color(0xFF94690F);
    return Semantics(
      label: 'FixIt Campus',
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            LogoMark(size: size),
            const SizedBox(width: 10),
            Text.rich(
              TextSpan(
                text: 'FixIt ',
                children: [TextSpan(text: 'Campus', style: TextStyle(color: accent))],
              ),
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: textColor, letterSpacing: -0.3),
            ),
          ],
        ),
      ),
    );
  }
}
