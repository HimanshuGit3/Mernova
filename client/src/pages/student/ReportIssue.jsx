import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ImagePlus, MapPin, Send, Trash2 } from 'lucide-react';
import { issuesApi, locationsApi } from '../../api/index.js';
import { apiError, fieldErrors } from '../../api/client.js';
import { useResource } from '../../api/useResource.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input, Segmented, Select, Textarea } from '../../components/ui/Field.jsx';
import { CATEGORY, CATEGORY_ORDER, SEVERITY, SEVERITY_ORDER } from '../../theme/meta.js';
import { AiSuggestion, DuplicatesPanel } from './AiSuggestion.jsx';
import { useAnalysis } from './useAnalysis.js';

const MAX_BYTES = 5 * 1024 * 1024;

function PhotoPicker({ file, onChange, error }) {
  const inputRef = useRef(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  return (
    <div>
      {preview ? (
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border">
          <img src={preview} alt="Selected photo" className="aspect-[16/9] w-full object-cover" />
          <Button
            variant="secondary"
            size="sm"
            icon={Trash2}
            className="absolute top-3 right-3"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-border bg-surface-2/50 text-muted transition-colors hover:border-primary hover:text-text"
        >
          <ImagePlus className="size-8" aria-hidden />
          <span className="text-sm font-bold">Add a photo</span>
          <span className="text-xs">JPEG or PNG, up to 5 MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label="Photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (!['image/jpeg', 'image/png'].includes(f.type))
            return toast.error('Use a JPEG or PNG photo');
          if (f.size > MAX_BYTES) return toast.error('That photo is over 5 MB');
          onChange(f);
        }}
      />
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-[#DC2626] dark:text-[#F87171]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** FR-14: report from the web with a typed location (building → room, or a landmark). */
export function ReportIssuePage() {
  const navigate = useNavigate();
  const buildings = useResource(() => locationsApi.buildings(), []);
  const [form, setForm] = useState({
    title: '',
    category: '',
    severity: 'medium',
    building: '',
    locationId: '',
    landmark: '',
    description: '',
  });
  const [photo, setPhoto] = useState(null);
  const analysis = useAnalysis(photo, form.locationId);
  const ai = analysis.suggestion;
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(null);
  const [created, setCreated] = useState(null);
  const rooms = useResource(
    () =>
      form.building
        ? locationsApi.list({ building: form.building, active: true, limit: 50 })
        : Promise.resolve({ items: [] }),
    [form.building],
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (form.title.trim().length < 3) next.title = 'Give it a short title (at least 3 characters)';
    if (!form.category) next.category = 'Pick a category';
    if (!form.locationId && !form.landmark.trim())
      next.landmark = 'Pick a room or describe where it is';
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    setProgress(0);
    try {
      const issue = await issuesApi.create(
        {
          title: form.title.trim(),
          category: form.category,
          severity: form.severity,
          locationId: form.locationId || undefined,
          landmark: form.landmark.trim() || undefined,
          description: form.description.trim() || undefined,
          aiSuggestedCategory: ai?.category,
          aiConfidence: ai?.confidence,
          clientRequestId: crypto.randomUUID(),
          photo: photo ?? undefined,
        },
        (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)),
      );
      setCreated(issue);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(apiError(err).message);
    } finally {
      setProgress(null);
    }
  }

  if (created) {
    return (
      <Card className="mx-auto max-w-lg">
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="grid size-16 place-items-center rounded-full bg-[#1F9E89]/15 text-[#1F9E89]"
          >
            <CheckCircle2 className="size-9" aria-hidden />
          </motion.div>
          <h1 className="text-xl font-extrabold text-text">Report sent</h1>
          <p className="max-w-sm text-sm text-muted">
            The estate office can see it now. You will get a notification when a technician picks it
            up.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate(`/my-reports/${created.id}`)}>Track this report</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setForm({
                  title: '',
                  category: '',
                  severity: 'medium',
                  building: '',
                  locationId: '',
                  landmark: '',
                  description: '',
                });
                setPhoto(null);
              }}
            >
              Report another
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Report"
        title="Report an issue"
        subtitle="Tell us what is wrong and where. On your phone you can also scan the room's QR sticker."
      />
      <form
        onSubmit={submit}
        noValidate
        className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      >
        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          <Field
            label="What is the problem?"
            required
            error={errors.title}
            hint="e.g. Projector flickering in B-204"
          >
            {(id, d, invalid) => (
              <Input
                id={id}
                aria-describedby={d}
                invalid={invalid}
                maxLength={100}
                value={form.title}
                onChange={set('title')}
              />
            )}
          </Field>
          <Field
            label="Category"
            required
            error={errors.category}
            labelAction={
              <AiSuggestion
                analysing={analysis.analysing}
                suggestion={analysis.suggestion}
                onApply={(category) => setForm((f) => ({ ...f, category }))}
                current={form.category}
              />
            }
          >
            {() => (
              <Segmented
                name="category"
                label="Category"
                value={form.category}
                onChange={(category) => setForm((f) => ({ ...f, category }))}
                options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY[c].label }))}
                renderOption={(opt, selected) => {
                  const Icon = CATEGORY[opt.value].icon;
                  return (
                    <>
                      <Icon
                        className="size-4"
                        style={selected ? undefined : { color: CATEGORY[opt.value].color }}
                        aria-hidden
                      />
                      {opt.label}
                    </>
                  );
                }}
              />
            )}
          </Field>
          <Field label="How serious is it?" required>
            {() => (
              <Segmented
                name="severity"
                label="Severity"
                value={form.severity}
                onChange={(severity) => setForm((f) => ({ ...f, severity }))}
                options={SEVERITY_ORDER.map((s) => ({ value: s, label: SEVERITY[s].label }))}
              />
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Building">
              {(id) => (
                <Select
                  id={id}
                  value={form.building}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, building: e.target.value, locationId: '' }))
                  }
                >
                  <option value="">Choose a building</option>
                  {(buildings.data?.buildings ?? []).map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Room" error={errors.locationId}>
              {(id, d, invalid) => (
                <Select
                  id={id}
                  aria-describedby={d}
                  invalid={invalid}
                  value={form.locationId}
                  onChange={set('locationId')}
                  disabled={!form.building || rooms.loading}
                >
                  <option value="">
                    {form.building ? 'Choose a room' : 'Pick a building first'}
                  </option>
                  {(rooms.data?.items ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} · {r.label || `Room ${r.room}`}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field
            label="Landmark"
            error={errors.landmark}
            hint={
              form.locationId
                ? 'Optional: anything that helps find it'
                : 'Required if you did not pick a room, e.g. "Near the main gate"'
            }
          >
            {(id, d, invalid) => (
              <Input
                id={id}
                aria-describedby={d}
                invalid={invalid}
                icon={MapPin}
                maxLength={120}
                value={form.landmark}
                onChange={set('landmark')}
              />
            )}
          </Field>
          <Field label="Details" hint="Optional, up to 1000 characters">
            {(id, d) => (
              <Textarea
                id={id}
                aria-describedby={d}
                maxLength={1000}
                value={form.description}
                onChange={set('description')}
              />
            )}
          </Field>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-bold text-text">Photo</h2>
            <PhotoPicker file={photo} onChange={setPhoto} error={errors.photo} />
            <p className="mt-3 text-xs text-muted">
              A photo helps the technician bring the right tools. AI suggests a category from it.
            </p>
          </Card>
          <DuplicatesPanel
            duplicates={analysis.duplicates}
            onSupported={(d) => navigate(`/my-reports/${d.id}`)}
          />
          <Card className="sticky top-20 p-5 sm:p-6">
            <AnimatePresence>
              {progress !== null ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-4"
                >
                  <div
                    className="h-2 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Upload progress"
                  >
                    <div
                      className="h-full rounded-full bg-gold-500 transition-[width] duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted tabular">Uploading… {progress}%</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <Button
              type="submit"
              size="lg"
              icon={Send}
              loading={progress !== null}
              className="w-full"
            >
              Send report
            </Button>
            <p className="mt-3 text-center text-xs text-muted">
              Already reported? Check{' '}
              <Link to="/my-reports" className="font-bold text-primary underline">
                My reports
              </Link>
              .
            </p>
          </Card>
        </div>
      </form>
    </>
  );
}
