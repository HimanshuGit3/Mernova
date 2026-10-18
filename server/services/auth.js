import bcrypt from 'bcryptjs';
import { User, DUMMY_HASH } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from './tokens.js';

export async function register({ name, email, password, department }) {
  const exists = await User.exists({ email: email.toLowerCase() });
  if (exists)
    throw ApiError.conflict('An account with this email already exists', 'CONFLICT', [
      { path: 'email', message: 'Already registered' },
    ]);
  // Self-registration always creates a student, whatever the body says.
  const user = new User({ name, email, department, role: 'student' });
  await user.setPassword(password);
  await user.save();
  return { token: signToken(user), user };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthenticated('Email or password is incorrect', 'INVALID_CREDENTIALS');
  }
  const ok = await user.checkPassword(password);
  if (!ok) throw ApiError.unauthenticated('Email or password is incorrect', 'INVALID_CREDENTIALS');
  if (!user.isActive)
    throw ApiError.forbidden('This account has been deactivated', 'ACCOUNT_DISABLED');
  return { token: signToken(user), user };
}

/**
 * A device token belongs to one phone, so it can belong to one account at a time: move it off
 * any previous account (e.g. student A signed out without the app reaching the server, then
 * student B signed in on the same phone) so A's pushes never reach B.
 */
export async function addFcmToken(userId, token) {
  await User.updateMany(
    { _id: { $ne: userId }, fcmTokens: token },
    { $pull: { fcmTokens: token } },
  );
  await User.updateOne({ _id: userId }, { $addToSet: { fcmTokens: token } });
}

export async function removeFcmToken(userId, token) {
  await User.updateOne({ _id: userId }, { $pull: { fcmTokens: token } });
}
