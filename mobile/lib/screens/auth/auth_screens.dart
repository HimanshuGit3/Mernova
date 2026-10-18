import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/session.dart';
import '../../services/api.dart';
import '../../theme/tokens.dart';
import '../../utils/validators.dart';
import '../../widgets/brand.dart';

/// Shared layout: navy brand header with the logo and tagline, then a form card.
class _AuthScaffold extends StatelessWidget {
  const _AuthScaffold({required this.title, required this.subtitle, required this.child});

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                color: Brand.navy900,
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const BrandLogo(light: true),
                      const SizedBox(height: 28),
                      Text.rich(
                        TextSpan(
                          children: const [
                            TextSpan(text: 'Spot it. Snap it. '),
                            TextSpan(text: 'Sorted.', style: TextStyle(color: Brand.gold300)),
                          ],
                          style: text.headlineSmall?.copyWith(color: Colors.white, fontSize: 28),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Report campus problems with a photo and follow the fix live.',
                        style: text.bodyMedium?.copyWith(color: const Color(0xFFC5CEE2)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: text.headlineSmall),
                  const SizedBox(height: 4),
                  Text(subtitle, style: text.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 20),
                  child,
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: SeverityColors.critical.withValues(alpha: 0.1),
          border: Border.all(color: SeverityColors.critical.withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(Radii.control),
        ),
        child: Semantics(liveRegion: true, child: Text(message)),
      );
}

class _PasswordField extends StatefulWidget {
  const _PasswordField({required this.controller, required this.label, required this.validator, this.newPassword = false});

  final TextEditingController controller;
  final String label;
  final String? Function(String?) validator;
  final bool newPassword;

  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<_PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: widget.controller,
        obscureText: _obscure,
        validator: widget.validator,
        autofillHints: [widget.newPassword ? AutofillHints.newPassword : AutofillHints.password],
        decoration: InputDecoration(
          labelText: widget.label,
          prefixIcon: const Icon(Icons.lock_outline_rounded),
          suffixIcon: IconButton(
            tooltip: _obscure ? 'Show password' : 'Hide password',
            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        ),
      );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final session = context.read<Session>();
    setState(() => _error = null);
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      await session.login(_email.text, _password.text);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notice = context.select<Session, String?>((s) => s.notice);
    return _AuthScaffold(
      title: 'Welcome back',
      subtitle: 'Use the same account as the FixIt Campus website.',
      child: AutofillGroup(
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null || notice != null) _ErrorBanner(_error ?? notice!),
              TextFormField(
                key: const Key('login-email'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                validator: Validators.email,
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline_rounded)),
              ),
              const SizedBox(height: 14),
              _PasswordField(controller: _password, label: 'Password', validator: Validators.loginPassword),
              const SizedBox(height: 22),
              FilledButton(
                key: const Key('login-submit'),
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                    : const Text('Sign in'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const RegisterScreen())),
                child: const Text('New student? Create an account'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _department = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  Map<String, String> _fieldErrors = const {};

  @override
  void dispose() {
    for (final c in [_name, _email, _department, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final session = context.read<Session>();
    final navigator = Navigator.of(context);
    setState(() {
      _error = null;
      _fieldErrors = const {};
    });
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      await session.register(name: _name.text, email: _email.text, password: _password.text, department: _department.text);
      if (navigator.canPop()) navigator.pop();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _fieldErrors = e.fields;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _AuthScaffold(
      title: 'Create your account',
      subtitle: 'For students. Your account also works on the website.',
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) _ErrorBanner(_error!),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
              validator: Validators.name,
              decoration: InputDecoration(labelText: 'Full name', prefixIcon: const Icon(Icons.person_outline_rounded), errorText: _fieldErrors['name']),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              validator: Validators.email,
              decoration: InputDecoration(labelText: 'College email', prefixIcon: const Icon(Icons.mail_outline_rounded), errorText: _fieldErrors['email']),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _department,
              decoration: const InputDecoration(labelText: 'Department (optional)', prefixIcon: Icon(Icons.school_outlined)),
            ),
            const SizedBox(height: 14),
            _PasswordField(controller: _password, label: 'Password (8+ characters)', validator: Validators.newPassword, newPassword: true),
            const SizedBox(height: 22),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                  : const Text('Create account'),
            ),
          ],
        ),
      ),
    );
  }
}
