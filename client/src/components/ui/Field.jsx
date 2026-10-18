import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn.js';

const control =
  'w-full rounded-[var(--radius-control)] border bg-surface text-text placeholder:text-muted transition-colors duration-150 focus:outline-none focus-visible:outline-none focus:border-primary focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60';

/** Label + control + hint/error, wired for screen readers. `children(id, describedBy)` renders the control. */
export function Field({ label, error, hint, required, children, className, labelAction }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-bold text-text">
            {label}
            {required ? (
              <span className="ml-0.5 text-[#DC2626]" aria-hidden>
                {' '}
                *
              </span>
            ) : null}
          </label>
          {labelAction}
        </div>
      ) : null}
      {children(id, describedBy, Boolean(error))}
      {error ? (
        <p
          id={errId}
          className="text-sm font-medium text-[#DC2626] dark:text-[#F87171]"
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, icon: Icon, ...props }, ref) {
  return (
    <div className="relative">
      {Icon ? (
        <Icon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
      ) : null}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          control,
          'h-11 px-3.5 text-sm',
          Icon && 'pl-10',
          invalid ? 'border-[#DC2626]' : 'border-border',
          className,
        )}
        {...props}
      />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        'min-h-24 px-3.5 py-3 text-sm',
        invalid ? 'border-[#DC2626]' : 'border-border',
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          control,
          'h-11 appearance-none pr-10 pl-3.5 text-sm',
          invalid ? 'border-[#DC2626]' : 'border-border',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
});

/** Single-choice segmented control (radio group). */
export function Segmented({ options, value, onChange, name, label, className, renderOption }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              'relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              selected
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-border bg-surface text-text hover:bg-surface-2',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {renderOption ? renderOption(opt, selected) : opt.label}
          </label>
        );
      })}
    </div>
  );
}

/** Multi-select chips (filters). */
export function ChipToggleGroup({ options, values, onChange, label }) {
  const toggle = (v) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(opt.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors duration-150',
              on
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-border bg-surface text-text hover:bg-surface-2',
            )}
          >
            {opt.color ? (
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: opt.color }}
                aria-hidden
              />
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
