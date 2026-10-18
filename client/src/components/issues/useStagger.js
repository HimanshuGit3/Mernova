import { useReducedMotion } from 'motion/react';

/** Staggered list entry (SPEC 8.1 motion), disabled for reduced motion. */
export function useStagger() {
  const reduce = useReducedMotion();
  return (i) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.2, ease: 'easeOut', delay: Math.min(i, 10) * 0.03 },
        };
}
