import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { IconButton } from './Button.jsx';
import { cn } from './cn.js';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Escape to close, focus trapped inside, focus restored on close. */
function useDialog(open, onClose, panelRef) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector('[data-autofocus]') ?? panel?.querySelector(FOCUSABLE);
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) return;
        const [a, z] = [items[0], items.at(-1)];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose, panelRef]);
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const reduce = useReducedMotion();
  useDialog(open, onClose, panelRef);
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end p-0 sm:place-items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-navy-900/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-[var(--shadow-pop)] sm:rounded-[var(--radius-card)] dark:border dark:border-border',
              size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id={titleId} className="text-lg font-bold text-text">
                  {title}
                </h2>
                {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
              </div>
              <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, description, children, footer }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const reduce = useReducedMotion();
  useDialog(open, onClose, panelRef);
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-navy-900/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-[var(--shadow-pop)] dark:border-l dark:border-border"
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id={titleId} className="text-lg font-bold text-text">
                  {title}
                </h2>
                {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
              </div>
              <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                {footer}
              </div>
            ) : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
