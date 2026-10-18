import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Marker } from 'react-leaflet';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Inbox,
  Maximize,
  Minimize,
  Radio,
  Sparkles,
  Wrench,
  CircleDot,
} from 'lucide-react';
import { insightsApi } from '../../api/index.js';
import { useResource } from '../../api/useResource.js';
import { useLiveRefetch, useSocket, useSocketEvent } from '../../realtime/hooks.js';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber.jsx';
import { Logo } from '../../components/ui/Misc.jsx';
import { BaseMap } from '../../components/map/IssueMap.jsx';
import { statusIcon } from '../../components/map/icons.js';
import { CATEGORY } from '../../theme/meta.js';
import { formatHours, timeAgo } from '../../theme/format.js';
import { useQrSvgs } from '../locations/useQr.js';
import { cn } from '../../components/ui/cn.js';

const NEW_PIN_MS = 90_000; // a new report pulses on the map for 90 s

const KIND = {
  reported: { label: 'New report', icon: Inbox, color: '#3B7BD0' },
  started: { label: 'Work started', icon: Wrench, color: '#E0A030' },
  fixed: { label: 'Fixed', icon: Sparkles, color: '#1F9E89' },
  confirmed: { label: 'Confirmed fixed', icon: CheckCircle2, color: '#1F9E89' },
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Counter({ label, value, icon: Icon, accent, format }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <p className="flex items-center gap-2 text-lg font-bold text-[#C5CEE2]">
        <Icon className="size-6" style={{ color: accent }} aria-hidden /> {label}
      </p>
      <p className="mt-2 text-[64px] leading-none font-extrabold text-white tabular">
        <AnimatedNumber value={value ?? 0} format={format} duration={0.9} />
      </p>
    </div>
  );
}

/** QR for visitors: opens this site's sign-up page on their phone. */
function VisitorQr() {
  const url = `${window.location.origin}/register`;
  const svgs = useQrSvgs([url]);
  return (
    <div className="flex items-center gap-5 rounded-2xl bg-white p-4 text-[#0F1F3D]">
      <div
        className="size-32 shrink-0"
        role="img"
        aria-label="QR code to try FixIt Campus"
        dangerouslySetInnerHTML={{ __html: svgs[url] ?? '' }}
      />
      <div>
        <p className="text-xl leading-tight font-extrabold">Try it now</p>
        <p className="mt-1 text-sm font-medium text-[#3A4660]">
          Scan to create an account and report something on campus.
        </p>
      </div>
    </div>
  );
}

/**
 * Live Booth mode (FR-55): full-screen, readable from 3 m, updates live, shows no personal data.
 * Always dark (the `.dark` class scopes the dark tokens to this page).
 */
export function LivePage() {
  const now = useClock();
  const reduce = useReducedMotion();
  const { connected } = useSocket();
  const live = useResource(() => insightsApi.live(), []);
  const [fresh, setFresh] = useState({}); // issueId → time first seen via socket
  const [fullscreen, setFullscreen] = useState(false);

  useLiveRefetch(['issue:created', 'issue:updated', 'stats:changed'], live.reload, { delay: 150 });
  useSocketEvent('issue:created', (issue) => setFresh((f) => ({ ...f, [issue.id]: Date.now() })));

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const data = live.data;
  const pins = useMemo(() => data?.pins ?? [], [data]);
  const counters = data?.counters;
  const isFresh = (id, createdAt) => {
    const seen = fresh[id] ?? new Date(createdAt).getTime();
    return now.getTime() - seen < NEW_PIN_MS;
  };

  return (
    <div className="dark campus-grid min-h-dvh bg-[#0B1223] text-white">
      <h1 className="sr-only">FixIt Campus live booth</h1>
      <header className="flex flex-wrap items-center gap-4 px-6 pt-5 lg:px-10">
        <Link
          to="/dashboard"
          className="rounded-md text-[#9AA6C3] hover:text-white"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-6" aria-hidden />
        </Link>
        <Logo light />
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-extrabold tracking-widest',
            connected ? 'bg-[#DC2626] text-white' : 'bg-white/10 text-[#C5CEE2]',
          )}
          role="status"
        >
          <Radio className={cn('size-4', connected && !reduce && 'animate-pulse')} aria-hidden />{' '}
          {connected ? 'LIVE' : 'RECONNECTING'}
        </span>
        <p className="hidden text-2xl font-extrabold text-[#E4BC63] md:block">
          Spot it. Snap it. Sorted.
        </p>
        <div className="ml-auto flex items-center gap-4">
          <p className="text-3xl font-extrabold tabular">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button
            type="button"
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen?.()
            }
            className="grid size-11 place-items-center rounded-lg bg-white/10 hover:bg-white/20"
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {fullscreen ? (
              <Minimize className="size-5" aria-hidden />
            ) : (
              <Maximize className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-6 px-6 py-6 lg:px-10 xl:h-[calc(100dvh-76px)] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-6">
          <section aria-label="Today in numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Counter
              label="Reported today"
              value={counters?.reportedToday}
              icon={Inbox}
              accent="#5B93DD"
            />
            <Counter
              label="Fixed today"
              value={counters?.resolvedToday}
              icon={Sparkles}
              accent="#2DB39C"
            />
            <Counter
              label="Open right now"
              value={counters?.openNow}
              icon={CircleDot}
              accent="#E4BC63"
            />
            <Counter
              label="Avg time to fix"
              value={counters?.avgResolutionHours ?? 0}
              icon={Clock}
              accent="#E4BC63"
              format={(v) => (counters?.avgResolutionHours == null ? '—' : formatHours(v))}
            />
          </section>

          <section
            aria-label="Live campus map"
            className="relative min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-white/10"
          >
            <BaseMap dark className="h-[56dvh] min-h-[360px] xl:h-full" zoom={17} label="Live map of issues">
              {pins.map((p) => (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={statusIcon(p.status, {
                    pulse: isFresh(p.id, p.createdAt),
                    size: isFresh(p.id, p.createdAt) ? 24 : 16,
                  })}
                />
              ))}
            </BaseMap>
            <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex flex-wrap gap-3 rounded-xl bg-[#0B1223]/85 px-4 py-3 text-sm font-bold">
              {[
                ['open', 'Open', '#3B7BD0'],
                ['assigned', 'Assigned', '#7C5CD6'],
                ['in_progress', 'Being fixed', '#E0A030'],
                ['reopened', 'Reopened', '#E2654B'],
                ['resolved', 'Fixed', '#1F9E89'],
              ].map(([k, label, color]) => (
                <span key={k} className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  {label}
                </span>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col gap-6">
          <section
            aria-label="Live feed"
            className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <h2 className="mb-3 text-xl font-extrabold">Happening now</h2>
            <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" aria-live="polite">
              <AnimatePresence initial={false}>
                {(data?.feed ?? []).slice(0, 8).map((f) => {
                  const kind = KIND[f.kind] ?? KIND.reported;
                  const Icon = kind.icon;
                  return (
                    <motion.li
                      key={`${f.issueId}-${f.kind}-${f.at}`}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduce ? undefined : { opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="flex gap-3 rounded-xl bg-white/[0.05] p-3"
                    >
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-lg"
                        style={{ backgroundColor: `${kind.color}33`, color: kind.color }}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-[#C5CEE2]">
                          {kind.label} · {CATEGORY[f.category]?.label}
                        </span>
                        <span className="block truncate text-lg font-bold text-white">
                          {f.title}
                        </span>
                        <span className="block text-sm text-[#9AA6C3]">
                          {f.building ? `${f.building} · ` : ''}
                          {timeAgo(f.at, now.getTime())}
                        </span>
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            {data && data.feed.length === 0 ? (
              <p className="text-[#9AA6C3]">Waiting for the first report…</p>
            ) : null}
          </section>
          <VisitorQr />
          {counters ? (
            <p className="text-center text-sm text-[#9AA6C3]">
              {counters.fixedTotal} of {counters.total} reports fixed so far
            </p>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
