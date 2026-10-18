import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, Maximize2, X, MoveHorizontal } from 'lucide-react';
import { assetUrl } from '../../config.js';
import { CATEGORY } from '../../theme/meta.js';
import { cn } from './cn.js';

/** Photo with a graceful fallback (shapes + category icon) when missing or broken. */
export function Photo({ path, alt, category, className, imgClassName, loading = 'lazy' }) {
  const [failed, setFailed] = useState(false);
  const src = assetUrl(path);
  if (!src || failed) {
    const Icon = CATEGORY[category]?.icon ?? ImageOff;
    return (
      <div
        className={cn('grid place-items-center bg-surface-2 text-muted', className)}
        role="img"
        aria-label={alt}
      >
        <Icon className="size-1/3 max-h-10 max-w-10 opacity-60" aria-hidden />
      </div>
    );
  }
  return (
    <div className={cn('overflow-hidden bg-surface-2', className)}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        onError={() => setFailed(true)}
        className={cn('size-full object-cover', imgClassName)}
      />
    </div>
  );
}

/** Click to open the full photo; Escape or the close button closes it. */
export function Lightbox({ path, alt, children, className }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!path) return children;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('group relative block w-full text-left', className)}
        aria-label={`Open photo: ${alt}`}
      >
        {children}
        <span className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-navy-900/70 text-white opacity-90 transition-opacity group-hover:opacity-100">
          <Maximize2 className="size-4" aria-hidden />
        </span>
      </button>
      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
              onClick={() => setOpen(false)}
            >
              <img
                src={assetUrl(path)}
                alt={alt}
                className="max-h-[90dvh] max-w-full rounded-lg object-contain shadow-2xl"
              />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Close photo"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Before/after comparison: drag the handle, or use ←/→ on the slider (keyboard accessible).
 */
export function BeforeAfter({ before, after, alt = 'Before and after', className }) {
  const [pos, setPos] = useState(50);
  const box = useRef(null);
  const dragging = useRef(false);

  const fromEvent = useCallback((clientX) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <div
      ref={box}
      className={cn(
        'relative aspect-[4/3] w-full touch-none overflow-hidden rounded-[var(--radius-card)] bg-surface-2 select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
        className,
      )}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromEvent(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && fromEvent(e.clientX)}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <img
        src={assetUrl(after)}
        alt={`${alt}: after`}
        className="absolute inset-0 size-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img
          src={assetUrl(before)}
          alt={`${alt}: before`}
          className="absolute inset-0 size-full object-cover"
          draggable={false}
        />
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-navy-900/75 px-2.5 py-1 text-xs font-bold text-white">
        Before
      </span>
      <span className="absolute top-3 right-3 rounded-full bg-[#1F9E89] px-2.5 py-1 text-xs font-bold text-white">
        After
      </span>
      <div
        className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
        style={{ left: `${pos}%` }}
        aria-hidden
      >
        <span className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-navy-900 shadow-lg">
          <MoveHorizontal className="size-5" />
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="absolute inset-x-0 bottom-0 h-full w-full cursor-ew-resize opacity-0 focus-visible:opacity-0"
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
