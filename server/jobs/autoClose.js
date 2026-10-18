import { env } from '../config/env.js';
import { Issue } from '../models/Issue.js';
import { applyTransition } from '../services/issues.js';
import { POPULATE } from '../services/issueView.js';

/**
 * Auto-close (D1, last row): a resolved issue with no reporter action for AUTO_CLOSE_HOURS
 * is closed by the system, through the same transition rules as every other change.
 */
export async function runAutoClose(now = new Date(), hours = env.AUTO_CLOSE_HOURS) {
  const cutoff = new Date(now.getTime() - hours * 36e5);
  const due = await Issue.find({ status: 'resolved', resolvedAt: { $lte: cutoff } }).populate(
    POPULATE,
  );
  let closed = 0;
  for (const issue of due) {
    try {
      await applyTransition(issue, 'system', 'closed', {
        note: `Closed automatically after ${hours} h without reporter action`,
      });
      closed += 1;
    } catch (err) {
      console.warn(`[auto-close] ${issue._id}: ${err.message}`);
    }
  }
  return { closed };
}
