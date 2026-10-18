import * as users from '../services/users.js';
import { pageOf } from '../utils/paginate.js';

export async function list(req, res) {
  const q = req.valid.query;
  const { items, total } = await users.listUsers(q);
  res.json(pageOf(items, total, q));
}

export async function create(req, res) {
  res.status(201).json(await users.createStaff(req.body));
}

export async function update(req, res) {
  res.json(await users.updateUser(req.user, req.valid.params.id, req.body));
}
