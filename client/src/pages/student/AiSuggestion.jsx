import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { HeartHandshake, Loader2, Sparkles, Check } from 'lucide-react';
import { issuesApi } from '../../api/index.js';
import { apiError } from '../../api/client.js';
import { Photo } from '../../components/ui/Media.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { CATEGORY } from '../../theme/meta.js';
import { cn } from '../../components/ui/cn.js';

/** "AI suggests Electrical · 94%" chip next to the category picker (FR-51). */
export function AiSuggestion({ analysing, suggestion, current, onApply }) {
  if (analysing) {
    return (
      <span
        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#7C5CD6]/12 px-2.5 text-xs font-bold text-text"
        role="status"
      >
        <Loader2 className="size-3.5 animate-spin text-[#7C5CD6]" aria-hidden /> Analysing photo…
      </span>
    );
  }
  if (!suggestion) return null;
  const label = CATEGORY[suggestion.category]?.label ?? suggestion.category;
  const pct = Math.round(suggestion.confidence * 100);
  const applied = current === suggestion.category;
  return (
    <button
      type="button"
      onClick={() => onApply(suggestion.category)}
      disabled={applied}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold text-text transition-colors',
        applied
          ? 'border-[#7C5CD6]/40 bg-[#7C5CD6]/12'
          : 'border-[#7C5CD6]/50 bg-surface hover:bg-[#7C5CD6]/12',
      )}
      aria-label={
        applied
          ? `AI suggestion ${label} applied`
          : `Use AI suggestion: ${label}, ${pct} percent confidence`
      }
    >
      {applied ? (
        <Check className="size-3.5 text-[#7C5CD6]" aria-hidden />
      ) : (
        <Sparkles className="size-3.5 text-[#7C5CD6]" aria-hidden />
      )}
      AI: {label} · {pct}%{applied ? '' : ' · Use'}
    </button>
  );
}

/** Similar issues nearby, with "Me too" instead of a new report (FR-52). */
export function DuplicatesPanel({ duplicates, onSupported }) {
  const [busy, setBusy] = useState(null);
  if (!duplicates.length) return null;
  async function support(d) {
    setBusy(d.id);
    try {
      await issuesApi.support(d.id);
      toast.success('Added your "Me too". Thanks for not duplicating!');
      onSupported(d);
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div
      className="rounded-[var(--radius-card)] border border-gold-500/50 bg-gold-300/12 p-4"
      role="region"
      aria-label="Similar issues nearby"
    >
      <p className="text-sm font-bold text-text">Similar issue nearby. Is it the same problem?</p>
      <p className="mt-0.5 text-xs text-muted">
        Saying "Me too" raises its priority and keeps you updated.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {duplicates.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-[var(--radius-control)] bg-surface p-2.5"
          >
            <Photo
              path={d.thumbPath}
              alt=""
              category={d.category}
              className="size-12 shrink-0 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-text">{d.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <StatusPill status={d.status} />
                <span>{d.distanceM} m away</span>
                {d.similarity !== null ? (
                  <span>· {Math.round(d.similarity * 100)}% similar</span>
                ) : null}
              </div>
            </div>
            {d.supportedByMe ? (
              <Link to={`/my-reports/${d.id}`} className="text-xs font-bold text-primary underline">
                Following
              </Link>
            ) : (
              <Button
                size="sm"
                variant="gold"
                icon={HeartHandshake}
                loading={busy === d.id}
                onClick={() => support(d)}
              >
                Me too
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
