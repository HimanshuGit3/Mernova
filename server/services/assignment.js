import { Issue } from '../models/Issue.js';
import { User } from '../models/User.js';

export const OPEN_LOAD_STATUSES = ['assigned', 'in_progress'];

/** Map technicianId → number of open jobs (assigned + in_progress). */
export async function openLoads(technicianIds) {
  const rows = await Issue.aggregate([
    { $match: { status: { $in: OPEN_LOAD_STATUSES }, assignedTo: { $in: technicianIds } } },
    { $group: { _id: '$assignedTo', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

/**
 * Smart assignment (D3): active technicians whose skills include the category,
 * sorted by open workload ascending, top 3. If nobody has the skill, fall back to
 * all active technicians (flagged `skillMatch: false`) so the admin is never stuck.
 */
export async function suggestTechnicians(category, { limit = 3 } = {}) {
  let techs = await User.find({ role: 'technician', isActive: true, skills: category }).lean();
  let skillMatch = true;
  if (techs.length === 0) {
    techs = await User.find({ role: 'technician', isActive: true }).lean();
    skillMatch = false;
  }
  const loads = await openLoads(techs.map((t) => t._id));
  return techs
    .map((t) => ({
      id: String(t._id),
      name: t.name,
      skills: t.skills,
      openLoad: loads.get(String(t._id)) ?? 0,
      skillMatch,
    }))
    .sort((a, b) => a.openLoad - b.openLoad || a.name.localeCompare(b.name))
    .slice(0, limit);
}
