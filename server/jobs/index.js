import cron from 'node-cron';
import { runSlaSweep } from './sla.js';
import { runAutoClose } from './autoClose.js';

/** Run a job without overlapping itself; log the result, never crash the server. */
function guarded(name, fn) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      const result = await fn();
      if (Object.values(result).some((v) => v > 0)) console.log(`[job:${name}]`, result);
    } catch (err) {
      console.error(`[job:${name}] failed:`, err.message);
    } finally {
      running = false;
    }
  };
}

/** Start background jobs. Returns a stop function (used on shutdown). */
export function startJobs() {
  const sla = guarded('sla', () => runSlaSweep());
  const autoClose = guarded('auto-close', () => runAutoClose());
  const tasks = [
    cron.schedule('0 * * * *', sla), // hourly priority recompute + escalation
    cron.schedule('*/15 * * * *', autoClose), // auto-close check every 15 minutes
  ];
  // Catch up once at start-up (e.g. the laptop was asleep during the booth night).
  setTimeout(() => {
    sla();
    autoClose();
  }, 3000).unref();
  return () => tasks.forEach((t) => t.stop());
}
