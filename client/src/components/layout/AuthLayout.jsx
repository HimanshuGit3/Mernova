import { Camera, Radio, Sparkles } from 'lucide-react';
import { Logo } from '../ui/Misc.jsx';
import { ThemeToggle } from './TopbarItems.jsx';

const FEATURES = [
  {
    icon: Camera,
    title: 'Snap and report in seconds',
    body: 'Photo, GPS or a room QR sticker. AI suggests the category for you.',
  },
  {
    icon: Radio,
    title: 'Live from report to fix',
    body: 'Admins triage on a live dashboard; technicians work against SLA deadlines.',
  },
  {
    icon: Sparkles,
    title: 'See campus get better',
    body: 'Say "Me too" instead of duplicating, and watch fixes land in the feed.',
  },
];

/** Abstract campus grid: blocks, paths and pins, drawn with shapes (no stock art). */
function CampusArt() {
  return (
    <svg viewBox="0 0 400 260" className="w-full max-w-md" aria-hidden>
      <defs>
        <linearGradient id="auth-pin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E4BC63" />
          <stop offset="1" stopColor="#C9962B" />
        </linearGradient>
      </defs>
      <path
        d="M0 150 H400 M200 0 V260 M40 0 L360 260"
        stroke="#E4BC63"
        strokeOpacity=".18"
        strokeWidth="10"
      />
      {[
        [30, 30, 110, 80],
        [230, 25, 130, 70],
        [40, 175, 90, 60],
        [255, 170, 110, 70],
        [140, 105, 45, 30],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx="10"
          fill="#1B3260"
          stroke="#E4BC63"
          strokeOpacity=".25"
        />
      ))}
      {[
        [85, 55, '#3B7BD0'],
        [300, 60, '#1F9E89'],
        [300, 200, '#E0A030'],
        [80, 200, '#1F9E89'],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="14" fill={c} opacity=".25" />
          <circle cx={x} cy={y} r="6" fill={c} stroke="#fff" strokeWidth="2" />
        </g>
      ))}
      <g transform="translate(176 96)">
        <path
          d="M24 0C10.7 0 0 10.4 0 23.4 0 41 24 64 24 64s24-23 24-40.6C48 10.4 37.3 0 24 0z"
          fill="url(#auth-pin)"
        />
        <circle cx="24" cy="23" r="10" fill="#0F1F3D" />
      </g>
    </svg>
  );
}

/** Split screen: brand panel (navy, gold accents, campus grid, tagline, highlights) + form card. */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="campus-grid relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-10 text-white lg:flex xl:p-14">
        <div
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-gold-500/15 blur-3xl"
          aria-hidden
        />
        <Logo light />
        <div className="relative">
          <CampusArt />
          <h2 className="mt-8 text-[40px] leading-[1.1] font-extrabold tracking-tight">
            Spot it. Snap it. <span className="text-gold-300">Sorted.</span>
          </h2>
          <p className="mt-3 max-w-md text-base text-[#C5CEE2]">
            The campus issue tracker that closes the loop between students, admins and technicians,
            in real time.
          </p>
          <ul className="mt-8 grid gap-4">
            {FEATURES.map(({ icon: Icon, title: t, body }) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-white/10 text-gold-300">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold">{t}</span>
                  <span className="block text-sm text-[#B9C3DA]">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#9AA6C3]">
          MERNOVA X 2026 · Presidency University, Bengaluru
        </p>
      </aside>

      <main className="relative flex flex-col bg-bg">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center sm:px-6">
          <div className="w-full max-w-md rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8 dark:border dark:border-border">
            <h1 className="text-2xl font-extrabold tracking-tight text-text">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
            {footer ? (
              <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
