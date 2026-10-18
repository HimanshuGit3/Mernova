import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  UserRound,
  ShieldCheck,
  Wrench,
  GraduationCap,
} from 'lucide-react';
import { useAuth, homeFor } from '../../context/auth.js';
import { apiError, fieldErrors } from '../../api/client.js';
import { AuthLayout } from '../../components/layout/AuthLayout.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input } from '../../components/ui/Field.jsx';

const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? 'FixIt@2026';
const DEMO_ACCOUNTS = [
  { label: 'Admin', icon: ShieldCheck, email: 'admin@fixit.campus' },
  { label: 'Technician', icon: Wrench, email: 'ravi.tech@fixit.campus' },
  { label: 'Student', icon: GraduationCap, email: 'asha@student.fixit.campus' },
];

function PasswordInput({ id, describedBy, invalid, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        aria-describedby={describedBy}
        invalid={invalid}
        icon={Lock}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="pr-12"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-text"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-control)] border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2.5 text-sm font-medium text-text"
    >
      {message}
    </p>
  );
}

export function LoginPage() {
  const { login, status, user, expired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(
    expired ? 'Your session ended. Please sign in again.' : '',
  );
  const [busy, setBusy] = useState(false);

  if (status === 'signed-in' && user)
    return <Navigate to={location.state?.from ?? homeFor(user)} replace />;

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Enter your password';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFormError('');
    try {
      const u = await login(email, password);
      navigate(location.state?.from ?? homeFor(u), { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with the same account you use in the FixIt Campus app."
      footer={
        <>
          New here?{' '}
          <Link
            to="/register"
            className="font-bold text-primary underline-offset-4 hover:underline"
          >
            Create a student account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Email" error={errors.email} required>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              icon={Mail}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="Password" error={errors.password} required>
          {(id, d, invalid) => (
            <PasswordInput
              id={id}
              describedBy={d}
              invalid={invalid}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
          Sign in
        </Button>
      </form>

      {import.meta.env.DEV ? (
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">
            Demo accounts (development only)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map(({ label, icon: Icon, email: demoEmail }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setEmail(demoEmail);
                  setPassword(DEMO_PASSWORD);
                  setErrors({});
                }}
                className="flex h-16 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border border-dashed border-border text-xs font-bold text-text hover:border-primary hover:bg-surface-2"
              >
                <Icon className="size-4 text-muted" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register, status, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', department: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'signed-in' && user) return <Navigate to={homeFor(user)} replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (form.password.length < 8) next.password = 'Use at least 8 characters';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFormError('');
    try {
      const u = await register(form);
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Students sign up here. The same account works in the mobile app."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <Field label="Full name" error={errors.name} required>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              icon={UserRound}
              autoComplete="name"
              value={form.name}
              onChange={set('name')}
            />
          )}
        </Field>
        <Field label="College email" error={errors.email} required>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              icon={Mail}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
            />
          )}
        </Field>
        <Field label="Department" hint="Optional, e.g. MCA" error={errors.department}>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              value={form.department}
              onChange={set('department')}
            />
          )}
        </Field>
        <Field label="Password" hint="At least 8 characters" error={errors.password} required>
          {(id, d, invalid) => (
            <PasswordInput
              id={id}
              describedBy={d}
              invalid={invalid}
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
            />
          )}
        </Field>
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
