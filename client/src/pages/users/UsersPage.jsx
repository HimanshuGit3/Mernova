import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Search, UserPlus, Users as UsersIcon, Power } from 'lucide-react';
import { usersApi } from '../../api/index.js';
import { apiError, fieldErrors } from '../../api/client.js';
import { useResource } from '../../api/useResource.js';
import { useAuth } from '../../context/auth.js';
import { PageHeader } from '../../components/layout/AppShell.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, Input, Segmented, ChipToggleGroup } from '../../components/ui/Field.jsx';
import { Drawer, Modal } from '../../components/ui/Overlay.jsx';
import { Avatar, Pagination } from '../../components/ui/Misc.jsx';
import { Pill, CategoryChip } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState, SkeletonRows } from '../../components/ui/States.jsx';
import { useStagger } from '../../components/issues/useStagger.js';
import { CATEGORY, CATEGORY_ORDER, ROLE_LABEL } from '../../theme/meta.js';
import { formatDate } from '../../theme/format.js';
import { cn } from '../../components/ui/cn.js';

const TABS = [
  { value: '', label: 'Everyone' },
  { value: 'student', label: 'Students' },
  { value: 'technician', label: 'Technicians' },
  { value: 'admin', label: 'Admins' },
];
const ROLE_COLOR = { student: '#3B7BD0', technician: '#E0A030', admin: '#7C5CD6' };

function AddStaffDrawer({ open, onClose, onCreated }) {
  const empty = {
    name: '',
    email: '',
    password: '',
    role: 'technician',
    department: '',
    skills: [],
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter a name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email';
    if (form.password.length < 8) next.password = 'At least 8 characters';
    if (form.role === 'technician' && form.skills.length === 0)
      next.skills = 'Pick at least one skill';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const user = await usersApi.create(form);
      toast.success(`${user.name} can now sign in on web and mobile`);
      setForm(empty);
      onCreated();
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
      title="Add a staff account"
      description="Students register themselves. Create technicians and admins here."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" loading={busy} icon={UserPlus}>
            Create account
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Role" required>
          {() => (
            <Segmented
              name="role"
              label="Role"
              value={form.role}
              onChange={(role) => setForm((f) => ({ ...f, role }))}
              options={[
                { value: 'technician', label: 'Technician' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          )}
        </Field>
        <Field label="Full name" required error={errors.name}>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              value={form.name}
              onChange={set('name')}
              data-autofocus
            />
          )}
        </Field>
        <Field label="Email" required error={errors.email}>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              type="email"
              value={form.email}
              onChange={set('email')}
            />
          )}
        </Field>
        <Field
          label="Temporary password"
          required
          hint="At least 8 characters. Share it securely."
          error={errors.password}
        >
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              type="text"
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
            />
          )}
        </Field>
        <Field label="Department" error={errors.department}>
          {(id, d, invalid) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={invalid}
              value={form.department}
              onChange={set('department')}
              placeholder="e.g. Maintenance"
            />
          )}
        </Field>
        {form.role === 'technician' ? (
          <Field
            label="Skills"
            required
            hint="Issues in these categories are suggested to this technician."
            error={errors.skills}
          >
            {() => (
              <ChipToggleGroup
                label="Skills"
                values={form.skills}
                onChange={(skills) => setForm((f) => ({ ...f, skills }))}
                options={CATEGORY_ORDER.map((c) => ({
                  value: c,
                  label: CATEGORY[c].label,
                  color: CATEGORY[c].color,
                }))}
              />
            )}
          </Field>
        ) : null}
      </form>
    </Drawer>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const stagger = useStagger();
  const list = useResource(
    () => usersApi.list({ role, q: search, page, limit: 20 }),
    [role, search, page],
  );

  async function toggleActive(u) {
    setBusy(true);
    try {
      await usersApi.update(u.id, { isActive: !u.isActive });
      toast.success(
        u.isActive ? `${u.name} was deactivated and signed out` : `${u.name} can sign in again`,
      );
      setConfirm(null);
      list.reload();
    } catch (err) {
      toast.error(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Users"
        title="People"
        subtitle="Students, technicians and admins. Every account works on both apps."
        actions={
          <Button icon={UserPlus} onClick={() => setAdding(true)}>
            Add staff
          </Button>
        }
      />
      <Card className="mb-4">
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            name="role-filter"
            label="Filter by role"
            value={role}
            onChange={(v) => {
              setRole(v);
              setPage(1);
            }}
            options={TABS}
          />
          <form
            role="search"
            className="lg:w-80"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q.trim());
              setPage(1);
            }}
          >
            <label htmlFor="user-search" className="sr-only">
              Search people
            </label>
            <Input
              id="user-search"
              icon={Search}
              placeholder="Search name, email, department"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => q.trim() !== search && (setSearch(q.trim()), setPage(1))}
            />
          </form>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {list.loading && !list.data ? (
          <SkeletonRows rows={6} className="p-5" />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.retry} />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Nobody here"
            body={search ? 'No one matches that search.' : 'Add a staff account to get started.'}
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {list.data.items.map((u, i) => (
                <motion.li
                  key={u.id}
                  {...stagger(i)}
                  className={cn(
                    'flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5',
                    !u.isActive && 'opacity-60',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={u.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-text">
                        {u.name}
                        {u.id === me.id ? (
                          <span className="ml-1.5 text-xs font-medium text-muted">(you)</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {u.email}
                        {u.department ? ` · ${u.department}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[44%] sm:justify-end">
                    <Pill color={ROLE_COLOR[u.role]}>{ROLE_LABEL[u.role]}</Pill>
                    {u.role === 'technician' ? (
                      <>
                        {u.skills.map((s) => (
                          <CategoryChip key={s} category={s} />
                        ))}
                        <span className="text-xs font-bold text-muted tabular">
                          · {u.openLoad} open
                        </span>
                      </>
                    ) : null}
                    {!u.isActive ? <Pill color="#9CA3AF">Deactivated</Pill> : null}
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:w-60 sm:shrink-0 sm:justify-end">
                    <span className="text-xs whitespace-nowrap text-muted">
                      Joined {formatDate(u.createdAt)}
                    </span>
                    {u.id !== me.id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Power}
                        onClick={() => setConfirm(u)}
                        aria-label={`${u.isActive ? 'Deactivate' : 'Reactivate'} ${u.name}`}
                      >
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    ) : null}
                  </div>
                </motion.li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3 sm:px-5">
              <Pagination
                page={list.data.page}
                totalPages={list.data.totalPages}
                total={list.data.total}
                label="people"
                onPage={setPage}
              />
            </div>
          </>
        )}
      </Card>

      <AddStaffDrawer open={adding} onClose={() => setAdding(false)} onCreated={list.reload} />
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.isActive ? `Deactivate ${confirm?.name}?` : `Reactivate ${confirm?.name}?`}
        description={
          confirm?.isActive
            ? 'They will be signed out on every device and cannot sign in until reactivated.'
            : 'They will be able to sign in again.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.isActive ? 'danger' : 'primary'}
              loading={busy}
              onClick={() => toggleActive(confirm)}
            >
              {confirm?.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{confirm?.email}</p>
      </Modal>
    </>
  );
}
