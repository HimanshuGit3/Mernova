import { useCallback, useEffect, useRef, useState } from 'react';
import { apiError } from './client.js';

/**
 * Load data with explicit loading / error / empty states (NFR-10).
 * Results are stored with the key (deps) they were loaded for, so "loading" is derived:
 * the result belongs to an older key. `reload()` refetches quietly (realtime refreshes)
 * and keeps the current data on screen meanwhile.
 */
export function useResource(fetcher, deps = []) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const fetchRef = useRef(fetcher);
  useEffect(() => {
    fetchRef.current = fetcher;
  });
  const seq = useRef(0);

  const load = useCallback((k) => {
    const id = ++seq.current;
    return Promise.resolve()
      .then(() => fetchRef.current())
      .then(
        (data) => {
          if (id === seq.current) setState({ key: k, data, error: null });
        },
        (err) => {
          if (id === seq.current)
            setState((s) => ({ key: k, data: s.key === k ? s.data : null, error: apiError(err) }));
        },
      );
  }, []);

  useEffect(() => {
    load(key);
  }, [key, load]);

  const reload = useCallback(() => load(key), [load, key]);
  const retry = useCallback(() => {
    setState((s) => ({ ...s, key: null, error: null }));
    return load(key);
  }, [load, key]);
  const setData = useCallback(
    (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })),
    [],
  );

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current,
    reload,
    retry,
    setData,
  };
}
