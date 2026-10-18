import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/text.js';
import { openLoads } from './assignment.js';
import { disconnectUser } from './realtime.js';

export async function listUsers({ role, q, active, page, limit }) {
  const filter = {};
  if (role) filter.role = role;
  if (active !== undefined) filter.isActive = active;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { department: rx }];
  }
  const [docs, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  const techIds = docs.filter((u) => u.role === 'technician').map((u) => u._id);
  const loads = techIds.length ? await openLoads(techIds) : new Map();
  const items = docs.map((u) => {
    const json = u.toJSON();
    if (u.role === 'technician') json.openLoad = loads.get(String(u._id)) ?? 0;
    return json;
  });
  return { items, total };
}

export async function createStaff({ name, email, password, role, department, skills }) {
  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists', 'CONFLICT', [
      { path: 'email', message: 'Already registered' },
    ]);
  }
  const user = new User({
    name,
    email,
    role,
    department,
    skills: role === 'technician' ? skills : [],
  });
  await user.setPassword(password);
  await user.save();
  return user;
}

export async function updateUser(actor, id, patch) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (patch.isActive === false && String(user._id) === String(actor._id)) {
    throw ApiError.conflict('You cannot deactivate your own account');
  }
  if (patch.skills && user.role !== 'technician') {
    throw ApiError.badRequest('Only technicians have skills', [
      { path: 'skills', message: 'Only technicians have skills' },
    ]);
  }
  Object.assign(user, patch);
  await user.save();
  if (patch.isActive === false) disconnectUser(user._id);
  return user;
}
