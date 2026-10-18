import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

const defaultFormat = (v) => Math.round(v).toLocaleString('en-IN');

/**
 * Counts from the previous value to the new one (respects reduced motion).
 * React renders the first text once; afterwards the animation writes the text node directly,
 * so counting does not re-render the component on every frame.
 */
export function AnimatedNumber({ value, format = defaultFormat, duration = 0.6, className }) {
  const ref = useRef(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });
  const [initialText] = useState(() =>
    value === null || value === undefined ? '—' : format(reduce ? value : 0),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || value === null || value === undefined) return undefined;
    const fmt = (v) => formatRef.current(v);
    if (reduce) {
      el.textContent = fmt(value);
      prev.current = value;
      return undefined;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => {
        el.textContent = fmt(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {initialText}
    </span>
  );
}
