import * as authService from '../services/auth.js';

export async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req, res) {
  res.json(await authService.login(req.body));
}

export function me(req, res) {
  res.json({ user: req.user });
}

export async function logout(req, res) {
  if (req.body?.fcmToken) await authService.removeFcmToken(req.user._id, req.body.fcmToken);
  res.status(204).end();
}

export async function saveFcmToken(req, res) {
  await authService.addFcmToken(req.user._id, req.body.token);
  res.status(204).end();
}
