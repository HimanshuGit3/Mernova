import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Timer, MapPin, Users } from 'lucide-react';
import { issuesApi } from '../../api/index.js';
import { apiError } from '../../api/client.js';
import { useLiveRefetch } from '../../realtime/hooks.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { BeforeAfter } from '../../components/ui/Media.jsx';
import { CategoryChip } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { useStagger } from '../../components/issues/useStagger.js';
import { formatDate, formatHours } from '../../theme/format.js';

/** FR-59: resolved issues with before/after photos, no reporter or technician identity. */
export function FixedFeedPage({ embedded = false }) {
  // State is only written after a request finishes, so first paint shows skeletons.
  const [feed, setFeed] = useState({ items: null, page: 0, totalPages: 1, error: null });
  const [more, setMore] = useState(false);
  const stagger = useStagger();

  const load = useCallback(async (p) => {
    try {
      const res = await issuesApi.feed({ page: p, limit: 9 });
      setFeed((f) => ({
        items:
          p === 1 || !f.items
            ? res.items
            : [...f.items, ...res.items.filter((n) => !f.items.some((x) => x.id === n.id))],
        page: p,
        totalPages: res.totalPages,
        error: null,
      }));
    } catch (err) {
      setFeed((f) => ({ ...f, error: apiError(err) }));
    }
  }, []);
  useEffect(() => {
    load(1);
  }, [load]);
  useLiveRefetch(['issue:updated'], () => load(1), {
    filter: (_e, p) => ['resolved', 'closed'].includes(p?.issue?.status),
  });

  const { items: loaded, page, totalPages, error } = feed;
  const items = loaded ?? [];
  const loading = loaded === null && !error;

  return (
    <>
      {!embedded ? (
        <PageHeader
          eyebrow="Transparency"
          title="Fixed on campus"
          subtitle="Every fix, with before and after photos. Drag the slider to compare."
        />
      ) : null}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <Card>
          <ErrorState error={error} onRetry={() => load(1)} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="No fixes to show yet"
            body="When technicians fix reported issues, they appear here with before and after photos."
          />
        </Card>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, i) => (
              <motion.li key={item.id} {...stagger(i)}>
                <Card as="article" className="flex h-full flex-col overflow-hidden">
                  <BeforeAfter
                    before={item.photoPath}
                    after={item.resolutionPhotoPath}
                    alt={item.title}
                    className="rounded-none"
                  />
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 font-bold text-text">{item.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <CategoryChip category={item.category} />
                    </div>
                    <dl className="mt-auto grid grid-cols-2 gap-2 pt-1 text-xs text-muted">
                      {item.place ? (
                        <div className="col-span-2 flex items-center gap-1.5">
                          <MapPin className="size-3.5" aria-hidden />
                          <dt className="sr-only">Place</dt>
                          <dd className="truncate">{item.place}</dd>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1.5">
                        <Timer className="size-3.5" aria-hidden />
                        <dt className="sr-only">Time to fix</dt>
                        <dd>Fixed in {formatHours(item.resolutionHours)}</dd>
                      </div>
                      <div className="flex items-center gap-1.5 justify-self-end">
                        <dt className="sr-only">Date</dt>
                        <dd>{formatDate(item.resolvedAt)}</dd>
                      </div>
                      {item.supportersCount ? (
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Users className="size-3.5" aria-hidden />
                          <dt className="sr-only">Supporters</dt>
                          <dd>{item.supportersCount + 1} people had this problem</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </Card>
              </motion.li>
            ))}
          </ul>
          {page < totalPages ? (
            <div className="mt-6 flex justify-center">
              <Button
                variant="secondary"
                loading={more}
                onClick={async () => {
                  setMore(true);
                  await load(page + 1);
                  setMore(false);
                }}
              >
                Show more fixes
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
