import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../services/tokens.js';
import { User } from '../models/User.js';

/** Resolve a JWT into an active user, or throw an ApiError. Shared by HTTP and Socket.IO. */
export async function userFromToken(token) {
  if (!token) throw ApiError.unauthenticated();
  const payload = verifyToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthenticated();
  if (!user.isActive)
    throw ApiError.unauthenticated('This account has been deactivated', 'ACCOUNT_DISABLED');
  return user;
}

/** Require a valid bearer token and load the user (NFR-02). */
export async function auth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return next(ApiError.unauthenticated());
  req.user = await userFromToken(token);
  next();
}

/** Allow only the given roles. Always used after `auth`. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthenticated());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}
