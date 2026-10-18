import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { MapPin, Pencil, Plus, Power, Printer, QrCode, Search } from 'lucide-react';
import { locationsApi } from '../../api/index.js';
import { apiError, fieldErrors } from '../../api/client.js';
import { useResource } from '../../api/useResource.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { Field, Input, Select, Segmented } from '../../components/ui/Field.jsx';
import { Drawer } from '../../components/ui/Overlay.jsx';
import { Pagination } from '../../components/ui/Misc.jsx';
import { Pill } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/ui/States.jsx';
import { LocationPicker } from '../../components/map/LocationPicker.jsx';
import { useStagger } from '../../components/issues/useStagger.js';
import { useQrSvgs, qrContent } from './useQr.js';
import { CAMPUS_CENTER } from '../../config.js';
import { cn } from '../../components/ui/cn.js';

const EMPTY = {
  code: '',
  building: '',
  floor: '',
  room: '',
  label: '',
  lat: CAMPUS_CENTER[0],
  lng: CAMPUS_CENTER[1],
};

function LocationDrawer({ open, onClose, editing, buildings, onSaved }) {
  // The parent gives this drawer a new `key` each time it opens, so state starts fresh.
  const [form, setForm] = useState(() => (editing ? { ...EMPTY, ...editing } : EMPTY));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(form.code.trim()))
      next.code = 'Use 2–20 letters, digits or dashes, e.g. B-204';
    if (!form.building.trim()) next.building = 'Building is required';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const body = {
      code: form.code.trim().toUpperCase(),
      building: form.building.trim(),
      floor: form.floor.trim(),
      room: form.room.trim(),
      label: form.label.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
    };
    try {
      if (editing) await locationsApi.update(editing.id, body);
      else await locationsApi.create(body);
      toast.success(
        editing ? `${body.code} updated` : `${body.code} added. Print its QR sticker next.`,
      );
      onSaved();
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) toast.error(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.code}` : 'Add a room'}
      description="Each room gets a QR sticker. Scanning it pre-fills the room in the app."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="location-form" loading={busy}>
            {editing ? 'Save changes' : 'Add room'}
          </Button>
        </>
      }
    >
      <form id="location-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code" required error={errors.code} hint="Printed on the sticker">
            {(id, d, invalid) => (
              <Input
                id={id}
                aria-describedby={d}
                invalid={invalid}
                value={form.code}
                onChange={set('code')}
                placeholder="B-204"
                data-autofocus
              />
            )}
          </Field>
          <Field label="Building" required error={errors.building}>
            {(id, d, invalid) => (
              <>
                <Input
                  id={id}
                  aria-describedby={d}
                  invalid={invalid}
                  value={form.building}
                  onChange={set('building')}
                  list="building-names"
                />
                <datalist id="building-names">
                  {buildings.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Floor" error={errors.floor}>
            {(id, d, invalid) => (
              <Input
                id={id}
                aria-describedby={d}
                invalid={invalid}
                value={form.floor}
                onChange={set('floor')}
                placeholder="2"
              />
            )}
          </Field>
          <Field label="Room" error={errors.room}>
            {(id, d, invalid) => (
              <Input
                id={id}
                aria-describedby={d}
                invalid={invalid}
                value={form.room}
                onChange={set('room')}
                placeholder="204"
              />
            )}
          </Field>
        </div>
        <Field label="Label" error={errors.label} hint="e.g. Seminar Hall">
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              value={form.label}
              onChange={set('label')}
            />
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-bold text-text">Position</p>
          <LocationPicker
            lat={Number(form.lat)}
            lng={Number(form.lng)}
            onPick={(lat, lng) =>
              setForm((f) => ({ ...f, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }))
            }
            className="h-52 rounded-[var(--radius-control)] border border-border"
          />
          <p className="mt-1.5 text-xs text-muted tabular">
            Click the map to place the room · {Number(form.lat).toFixed(5)},{' '}
            {Number(form.lng).toFixed(5)}
          </p>
          {errors.lat || errors.lng ? (
            <p className="mt-1 text-sm text-[#DC2626]">{errors.lat ?? errors.lng}</p>
          ) : null}
        </div>
      </form>
    </Drawer>
  );
}

export function LocationsPage() {
  const navigate = useNavigate();
  const [building, setBuilding] = useState('');
  const [active, setActive] = useState('true');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState({ open: false, editing: null, nonce: 0 });
  const openDrawer = (editing) => setDrawer((d) => ({ open: true, editing, nonce: d.nonce + 1 }));
  const [selected, setSelected] = useState([]);
  const stagger = useStagger();
  const list = useResource(
    () => locationsApi.list({ building, active: active || undefined, q: search, page, limit: 20 }),
    [building, active, search, page],
  );
  const buildings = useResource(() => locationsApi.buildings(), []);
  const items = list.data?.items ?? [];
  const qr = useQrSvgs(items.map((l) => l.code));

  async function toggle(l) {
    try {
      await locationsApi.update(l.id, { isActive: !l.isActive });
      toast.success(
        l.isActive
          ? `${l.code} deactivated; its QR now shows "inactive"`
          : `${l.code} is active again`,
      );
      list.reload();
    } catch (err) {
      toast.error(apiError(err).message);
    }
  }

  const allOnPage = items.length > 0 && items.every((l) => selected.includes(l.code));
  const printUrl = () => {
    const sp = new URLSearchParams();
    if (selected.length) sp.set('codes', selected.join(','));
    else if (building) sp.set('building', building);
    return `/locations/print${sp.toString() ? `?${sp}` : ''}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Locations"
        title="Rooms and QR stickers"
        subtitle="Scan-to-report gives room-level accuracy indoors, where GPS is unreliable."
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => navigate(printUrl())}>
              {selected.length
                ? `Print ${selected.length} sticker${selected.length === 1 ? '' : 's'}`
                : building
                  ? `Print ${building}`
                  : 'Print all stickers'}
            </Button>
            <Button icon={Plus} onClick={() => openDrawer(null)}>
              Add room
            </Button>
          </>
        }
      />
      <Card className="mb-4">
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
          <form
            role="search"
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q.trim());
              setPage(1);
            }}
          >
            <label htmlFor="loc-search" className="sr-only">
              Search rooms
            </label>
            <Input
              id="loc-search"
              icon={Search}
              placeholder="Search code, building, room or label"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => q.trim() !== search && (setSearch(q.trim()), setPage(1))}
            />
          </form>
          <label className="sr-only" htmlFor="loc-building">
            Building
          </label>
          <Select
            id="loc-building"
            value={building}
            onChange={(e) => {
              setBuilding(e.target.value);
              setPage(1);
              setSelected([]);
            }}
            className="lg:w-56"
          >
            <option value="">All buildings</option>
            {(buildings.data?.buildings ?? []).map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
          <Segmented
            name="loc-active"
            label="Status"
            value={active}
            onChange={(v) => {
              setActive(v);
              setPage(1);
            }}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
              { value: '', label: 'All' },
            ]}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {list.loading && !list.data ? (
          <SkeletonRows rows={6} className="p-5" />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.retry} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No rooms here"
            body="Add a room to print its QR sticker."
            action={
              <Button icon={Plus} onClick={() => openDrawer(null)}>
                Add room
              </Button>
            }
          />
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                <caption className="sr-only">Rooms</caption>
                <thead>
                  <tr className="text-xs font-bold tracking-wide text-muted uppercase">
                    <th scope="col" className="w-12 border-b border-border px-5 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all rooms on this page"
                        checked={allOnPage}
                        onChange={() =>
                          setSelected(
                            allOnPage
                              ? selected.filter((c) => !items.some((l) => l.code === c))
                              : [...new Set([...selected, ...items.map((l) => l.code)])],
                          )
                        }
                        className="size-4 accent-[#1B3260]"
                      />
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3">
                      QR
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3">
                      Room
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3">
                      Building
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3">
                      Position
                    </th>
                    <th scope="col" className="border-b border-border px-3 py-3">
                      Status
                    </th>
                    <th scope="col" className="border-b border-border px-5 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((l, i) => (
                    <motion.tr
                      key={l.id}
                      {...stagger(i)}
                      className={cn('hover:bg-surface-2', !l.isActive && 'opacity-60')}
                    >
                      <td className="border-b border-border px-5 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${l.code}`}
                          checked={selected.includes(l.code)}
                          onChange={() =>
                            setSelected((s) =>
                              s.includes(l.code) ? s.filter((c) => c !== l.code) : [...s, l.code],
                            )
                          }
                          className="size-4 accent-[#1B3260]"
                        />
                      </td>
                      <td className="border-b border-border px-3 py-2">
                        <div
                          className="size-12 rounded-md bg-white p-0.5 ring-1 ring-border"
                          title={qrContent(l.code)}
                          aria-label={`QR code ${qrContent(l.code)}`}
                          role="img"
                          dangerouslySetInnerHTML={{ __html: qr[l.code] ?? '' }}
                        />
                      </td>
                      <td className="border-b border-border px-3 py-3">
                        <p className="font-bold text-text">{l.code}</p>
                        <p className="text-xs text-muted">
                          {[l.label, l.floor && `Floor ${l.floor}`].filter(Boolean).join(' · ') ||
                            '—'}
                        </p>
                      </td>
                      <td className="border-b border-border px-3 py-3 text-text">{l.building}</td>
                      <td className="border-b border-border px-3 py-3 text-xs text-muted tabular">
                        {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
                      </td>
                      <td className="border-b border-border px-3 py-3">
                        {l.isActive ? (
                          <Pill color="#1F9E89">Active</Pill>
                        ) : (
                          <Pill color="#9CA3AF">Inactive</Pill>
                        )}
                      </td>
                      <td className="border-b border-border px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            icon={Pencil}
                            size="sm"
                            label={`Edit ${l.code}`}
                            onClick={() => openDrawer(l)}
                          />
                          <IconButton
                            icon={QrCode}
                            size="sm"
                            label={`Print sticker for ${l.code}`}
                            onClick={() =>
                              navigate(`/locations/print?codes=${encodeURIComponent(l.code)}`)
                            }
                          />
                          <IconButton
                            icon={Power}
                            size="sm"
                            label={`${l.isActive ? 'Deactivate' : 'Reactivate'} ${l.code}`}
                            onClick={() => toggle(l)}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-4 py-3 sm:px-5">
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                total={list.data.total}
                label="rooms"
                onPage={setPage}
              />
            </div>
          </>
        )}
      </Card>
      <LocationDrawer
        key={drawer.nonce}
        open={drawer.open}
        editing={drawer.editing}
        buildings={buildings.data?.buildings ?? []}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        onSaved={() => {
          list.reload();
          buildings.reload();
        }}
      />
    </>
  );
}
