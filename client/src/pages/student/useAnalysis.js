import { useEffect, useState } from 'react';
import { issuesApi } from '../../api/index.js';

/**
 * Run AI triage + duplicate detection whenever the photo (or room) changes (FR-51, FR-52).
 * State is only written when a request finishes; results are keyed by the input that produced
 * them, so a stale answer for an old photo is never shown.
 */
export function useAnalysis(photo, locationId) {
  const [result, setResult] = useState({ key: null, data: null, failed: false });
  const key = photo
    ? `${photo.name}-${photo.size}-${photo.lastModified}-${locationId ?? ''}`
    : null;

  useEffect(() => {
    if (!photo) return undefined;
    let cancelled = false;
    issuesApi.analyse({ photo, locationId: locationId || undefined }).then(
      (data) => !cancelled && setResult({ key, data, failed: false }),
      () => !cancelled && setResult({ key, data: null, failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [photo, locationId, key]);

  const current = result.key === key;
  return {
    analysing: Boolean(photo) && !current,
    suggestion: current ? (result.data?.suggestion ?? null) : null,
    duplicates: current ? (result.data?.duplicates ?? []) : [],
    failed: current && result.failed,
  };
}
