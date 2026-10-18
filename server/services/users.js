import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/text.js';

export async function listUsers({ role, q, active, page, limit }) {
  const filter = {};
  if (role) filter.role = role;
  if (active !== undefined) filter.isActive = active;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { department: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
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
  return user;
}
