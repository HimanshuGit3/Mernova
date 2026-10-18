import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  History,
  MapPin,
  RotateCcw,
  Sparkles,
  Tag,
  UserRound,
  Users,
  Wrench,
  XCircle,
  Play,
  SearchX,
  HeartHandshake,
} from 'lucide-react';
import { issuesApi } from '../../api/index.js';
import { apiError } from '../../api/client.js';
import { useResource } from '../../api/useResource.js';
import { useSocketEvent, useReconnect } from '../../realtime/hooks.js';
import { useAuth } from '../../context/auth.js';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Select, Textarea, Input } from '../../components/ui/Field.jsx';
import { Modal } from '../../components/ui/Overlay.jsx';
import { BeforeAfter, Lightbox, Photo } from '../../components/ui/Media.jsx';
import {
  AiChip,
  CategoryChip,
  SeverityPill,
  SlaChip,
  StatusPill,
  SupportersChip,
} from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States.jsx';
import { Avatar } from '../../components/ui/Misc.jsx';
import { PointMap } from '../../components/map/IssueMap.jsx';
import { StatusTimeline } from '../../components/issues/IssueBits.jsx';
import { CATEGORY, CATEGORY_ORDER, SEVERITY, SEVERITY_ORDER } from '../../theme/meta.js';
import { formatDateTime, timeAgo } from '../../theme/format.js';

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-wide text-muted uppercase">{label}</p>
        <div className="mt-0.5 text-sm text-text">{children}</div>
      </div>
    </div>
  );
}

/** Smart assignment (D3): top 3 skilled technicians by open workload; admin chooses. */
function AssignPanel({ issue, onDone }) {
  const sug = useResource(
    () => issuesApi.suggestions(issue.id),
    [issue.id, issue.status, issue.assignedTo?.id],
  );
  const [busy, setBusy] = useState(null);
  async function assign(t) {
    setBusy(t.id);
    try {
      await issuesApi.assign(issue.id, t.id);
      toast.success(`Assigned to ${t.name}`);
      onDone();
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(null);
    }
  }
  const isReassign = ['assigned', 'in_progress'].includes(issue.status);
  return (
    <Card aria-labelledby="assign-title">
      <CardHeader
        id="assign-title"
        icon={Wrench}
        title={isReassign ? 'Reassign' : 'Assign a technician'}
        subtitle="Suggested by skill and current workload"
      />
      <div className="px-5 pb-5">
        {sug.loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : sug.error ? (
          <ErrorState error={sug.error} onRetry={sug.retry} />
        ) : sug.data.suggestions.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No active technicians"
            body="Add a technician on the Users page."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {sug.data.suggestions.map((t, i) => {
              const current = issue.assignedTo?.id === t.id;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border p-3"
                >
                  <Avatar name={t.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-bold text-text">
                      {t.name}
                      {i === 0 && !current ? (
                        <span className="rounded-full bg-gold-300/25 px-2 py-0.5 text-[11px] font-bold text-text">
                          Best match
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {t.openLoad} open {t.openLoad === 1 ? 'job' : 'jobs'}
                      {t.skillMatch ? '' : ' · no matching skill'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={i === 0 ? 'primary' : 'secondary'}
                    disabled={current}
                    loading={busy === t.id}
                    onClick={() => assign(t)}
                  >
                    {current ? 'Assigned' : 'Assign'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

const DIALOGS = {
  rejected: {
    title: 'Reject this report',
    description: 'The reporter will see your reason.',
    field: 'reason',
    confirm: 'Reject report',
    variant: 'danger',
  },
  reopened: {
    title: 'Reopen this issue',
    description: 'Tell the team what is still wrong. You can reopen within 7 days of the fix.',
    field: 'reason',
    confirm: 'Reopen issue',
    variant: 'primary',
  },
  resolved: {
    title: 'Mark as resolved',
    description: 'Add an after photo so the reporter can confirm the fix.',
    field: 'note',
    photo: true,
    confirm: 'Mark resolved',
    variant: 'primary',
  },
};

function TransitionDialog({ issue, to, onClose, onDone }) {
  const cfg = DIALOGS[to];
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (cfg.field === 'reason' && !text.trim()) return setError('Please give a reason');
    if (cfg.photo && !photo) return setError('An after photo is required');
    setBusy(true);
    try {
      await issuesApi.transition(issue.id, { to, [cfg.field]: text.trim(), photo });
      toast.success(cfg.confirm.replace(/^(\w)/, (c) => c.toUpperCase()) + ': done');
      onDone();
      onClose();
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={cfg.title}
      description={cfg.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="transition-form" variant={cfg.variant} loading={busy}>
            {cfg.confirm}
          </Button>
        </>
      }
    >
      <form id="transition-form" onSubmit={submit} className="flex flex-col gap-4">
        {cfg.photo ? (
          <Field label="After photo" required hint="JPEG or PNG, up to 5 MB">
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="h-auto py-2.5"
                data-autofocus
              />
            )}
          </Field>
        ) : null}
        <Field
          label={cfg.field === 'reason' ? 'Reason' : 'Note (optional)'}
          required={cfg.field === 'reason'}
          error={error || undefined}
        >
          {(id, d, invalid) => (
            <Textarea
              id={id}
              aria-describedby={d}
              invalid={invalid}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              data-autofocus={!cfg.photo || undefined}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

function ActionsCard({ issue, user, reload }) {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(null);
  const actions = issue.allowedActions ?? [];
  async function quick(to, message) {
    setBusy(to);
    try {
      await issuesApi.transition(issue.id, { to });
      toast.success(message);
      reload();
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(null);
    }
  }
  async function support() {
    setBusy('support');
    try {
      await issuesApi.support(issue.id);
      toast.success('Added your "Me too"');
      reload();
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(null);
    }
  }
  const buttons = [];
  if (actions.includes('in_progress'))
    buttons.push(
      <Button
        key="start"
        icon={Play}
        loading={busy === 'in_progress'}
        onClick={() => quick('in_progress', 'Work started')}
        className="w-full"
      >
        Start work
      </Button>,
    );
  if (actions.includes('resolved'))
    buttons.push(
      <Button key="resolve" icon={Camera} onClick={() => setDialog('resolved')} className="w-full">
        Resolve with after photo
      </Button>,
    );
  if (actions.includes('closed'))
    buttons.push(
      <Button
        key="close"
        icon={CheckCircle2}
        loading={busy === 'closed'}
        onClick={() => quick('closed', 'Fix confirmed. Thank you!')}
        className="w-full"
      >
        {user.role === 'admin' && !issue.reportedByMe ? 'Close issue' : 'Confirm the fix'}
      </Button>,
    );
  if (actions.includes('reopened'))
    buttons.push(
      <Button
        key="reopen"
        variant="secondary"
        icon={RotateCcw}
        onClick={() => setDialog('reopened')}
        className="w-full"
      >
        Not fixed? Reopen
      </Button>,
    );
  if (actions.includes('rejected'))
    buttons.push(
      <Button
        key="reject"
        variant="secondary"
        icon={XCircle}
        onClick={() => setDialog('rejected')}
        className="w-full"
      >
        Reject report
      </Button>,
    );
  if (issue.canSupport)
    buttons.push(
      <Button
        key="support"
        variant="gold"
        icon={HeartHandshake}
        loading={busy === 'support'}
        onClick={support}
        className="w-full"
      >
        Me too
      </Button>,
    );

  if (buttons.length === 0 && !issue.supportedByMe) return null;
  return (
    <Card aria-labelledby="actions-title">
      <CardHeader
        id="actions-title"
        icon={CheckCircle2}
        title="Next step"
        subtitle={
          issue.status === 'resolved' && issue.reportedByMe ? 'Was it fixed properly?' : undefined
        }
      />
      <div className="flex flex-col gap-2 px-5 pb-5">
        {buttons}
        {issue.supportedByMe ? (
          <p className="rounded-[var(--radius-control)] bg-gold-300/15 px-3 py-2.5 text-sm text-text">
            You said "Me too". You will get updates on this issue.
          </p>
        ) : null}
      </div>
      {dialog ? (
        <TransitionDialog
          issue={issue}
          to={dialog}
          onClose={() => setDialog(null)}
          onDone={reload}
        />
      ) : null}
    </Card>
  );
}

function AdminEdit({ issue, reload }) {
  const [busy, setBusy] = useState(false);
  async function change(field, value) {
    setBusy(true);
    try {
      await issuesApi.patch(issue.id, { [field]: value });
      toast.success(`${field === 'severity' ? 'Severity' : 'Category'} updated; SLA recalculated`);
      reload();
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }
  const editable = !['closed', 'rejected'].includes(issue.status);
  if (!editable) return null;
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-border px-5 py-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold tracking-wide text-muted uppercase">Severity</span>
        <Select
          value={issue.severity}
          disabled={busy}
          onChange={(e) => change('severity', e.target.value)}
        >
          {SEVERITY_ORDER.map((s) => (
            <option key={s} value={s}>
              {SEVERITY[s].label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold tracking-wide text-muted uppercase">Category</span>
        <Select
          value={issue.category}
          disabled={busy}
          onChange={(e) => change('category', e.target.value)}
        >
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORY[c].label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

export function IssueDetailPage({ backTo = '/issues', backLabel = 'All issues' }) {
  const { id } = useParams();
  const { user } = useAuth();
  const res = useResource(() => issuesApi.get(id), [id]);
  useSocketEvent('issue:updated', (p) => p.issue?.id === id && res.reload());
  useReconnect(res.reload);

  if (res.loading && !res.data) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="aspect-[4/3] w-full rounded-[var(--radius-card)]" />
        </div>
        <Skeleton className="h-96 w-full rounded-[var(--radius-card)]" />
      </div>
    );
  }
  if (res.error) {
    return res.error.status === 404 ? (
      <EmptyState
        icon={SearchX}
        title="Issue not found"
        body="It may not exist, or you do not have access to it."
        action={
          <Link to={backTo} className="font-bold text-primary underline">
            Back to {backLabel.toLowerCase()}
          </Link>
        }
      />
    ) : (
      <ErrorState error={res.error} onRetry={res.retry} />
    );
  }
  const issue = res.data;
  const showBeforeAfter =
    issue.photoPath && issue.resolutionPhotoPath && ['resolved', 'closed'].includes(issue.status);
  const isAdmin = user.role === 'admin';
  const canAssign =
    isAdmin && ['open', 'reopened', 'assigned', 'in_progress'].includes(issue.status);

  return (
    <>
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm font-bold text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> {backLabel}
      </Link>
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap gap-2">
          <StatusPill status={issue.status} />
          <SeverityPill severity={issue.severity} />
          <SlaChip issue={issue} />
          <SupportersChip count={issue.supportersCount} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-[28px]">
          {issue.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Reported {timeAgo(issue.createdAt)}
          {issue.reporter ? ` by ${issue.reportedByMe ? 'you' : issue.reporter.name}` : ''}
          {issue.locationRef
            ? ` · ${issue.locationRef.code}, ${issue.locationRef.building}`
            : issue.landmark
              ? ` · ${issue.landmark}`
              : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* On mobile the left column dissolves (contents) so actions come right after the photo. */}
        <div className="contents lg:col-span-2 lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <Card className="order-1 min-w-0 overflow-hidden lg:order-none">
            {showBeforeAfter ? (
              <div className="p-4 sm:p-5">
                <BeforeAfter
                  before={issue.photoPath}
                  after={issue.resolutionPhotoPath}
                  alt={issue.title}
                />
                {issue.resolutionNote ? (
                  <p className="mt-3 rounded-[var(--radius-control)] bg-[#1F9E89]/12 px-3 py-2.5 text-sm text-text">
                    <span className="font-bold">Technician's note:</span> {issue.resolutionNote}
                  </p>
                ) : null}
              </div>
            ) : issue.photoPath ? (
              <Lightbox path={issue.photoPath} alt={issue.title}>
                <Photo
                  path={issue.photoPath}
                  alt={issue.title}
                  category={issue.category}
                  className="aspect-[4/3] w-full sm:aspect-[16/9]"
                  loading="eager"
                />
              </Lightbox>
            ) : (
              <Photo
                path={null}
                alt="No photo attached"
                category={issue.category}
                className="aspect-[16/9] w-full"
              />
            )}
            {issue.description ? (
              <div className="border-t border-border px-5 py-4">
                <h2 className="text-xs font-bold tracking-wide text-muted uppercase">
                  Description
                </h2>
                <p className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-line text-text">
                  {issue.description}
                </p>
              </div>
            ) : null}
            {issue.status === 'rejected' && issue.rejectionReason ? (
              <div className="border-t border-border px-5 py-4 text-sm text-text">
                <span className="font-bold">Not actioned:</span> {issue.rejectionReason}
                {issue.duplicateOf && isAdmin ? (
                  <>
                    {' '}
                    (
                    <Link
                      className="font-bold text-primary underline"
                      to={`/issues/${issue.duplicateOf}`}
                    >
                      see original
                    </Link>
                    )
                  </>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card aria-labelledby="timeline-title" className="order-3 min-w-0 lg:order-none">
            <CardHeader
              id="timeline-title"
              icon={History}
              title="Status timeline"
              subtitle={`${issue.statusHistory.length} ${issue.statusHistory.length === 1 ? 'update' : 'updates'}`}
            />
            <div className="px-5 pb-5">
              <StatusTimeline history={issue.statusHistory} />
            </div>
          </Card>
        </div>

        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-none">
          <ActionsCard issue={issue} user={user} reload={res.reload} />
          {canAssign ? <AssignPanel issue={issue} onDone={res.reload} /> : null}

          <Card aria-labelledby="details-title">
            <CardHeader id="details-title" icon={Tag} title="Details" />
            <div className="divide-y divide-border px-5 pb-2">
              <DetailRow icon={Tag} label="Category">
                <div className="flex flex-wrap gap-2">
                  <CategoryChip category={issue.category} />
                  <AiChip ai={issue.ai} />
                </div>
              </DetailRow>
              <DetailRow icon={MapPin} label="Location">
                {issue.locationRef ? (
                  <>
                    <span className="font-bold">{issue.locationRef.code}</span> ·{' '}
                    {issue.locationRef.building}
                    {issue.locationRef.label ? (
                      <span className="block text-muted">
                        {issue.locationRef.label}, floor {issue.locationRef.floor}
                      </span>
                    ) : null}
                  </>
                ) : (
                  issue.landmark || (issue.location ? 'GPS location' : '—')
                )}
              </DetailRow>
              <DetailRow icon={Wrench} label="Assigned to">
                {issue.assignedTo?.name ?? <span className="text-muted">Not assigned yet</span>}
              </DetailRow>
              {issue.reporter ? (
                <DetailRow icon={UserRound} label="Reporter">
                  {issue.reportedByMe ? 'You' : issue.reporter.name}
                </DetailRow>
              ) : null}
              <DetailRow icon={CalendarClock} label="SLA">
                Due {formatDateTime(issue.dueAt)}
                <span className="block text-muted">Priority score {issue.priorityScore}</span>
              </DetailRow>
              {issue.ai ? (
                <DetailRow icon={Sparkles} label="AI triage">
                  Suggested {CATEGORY[issue.ai.suggestedCategory]?.label} with{' '}
                  {Math.round((issue.ai.confidence ?? 0) * 100)}% confidence
                  {issue.ai.accepted === false ? '; the reporter picked another category' : ''}
                </DetailRow>
              ) : null}
            </div>
            {isAdmin ? <AdminEdit issue={issue} reload={res.reload} /> : null}
            {issue.location ? (
              <div className="px-5 pt-2 pb-5">
                <PointMap
                  lat={issue.location.lat}
                  lng={issue.location.lng}
                  status={issue.status}
                  className="h-48 rounded-[var(--radius-control)] border border-border"
                  label={`Map of ${issue.title}`}
                />
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
