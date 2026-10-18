import * as issues from '../services/issues.js';
import { suggestTechnicians } from '../services/assignment.js';
import { pageOf } from '../utils/paginate.js';
import { ApiError } from '../utils/ApiError.js';
import { Issue } from '../models/Issue.js';
import { scopeFilter } from '../services/issues.js';

export async function create(req, res) {
  const { issue, created } = await issues.createIssue(req.user, req.body, req.file);
  res.status(created ? 201 : 200).json(issue);
}

export async function list(req, res) {
  const q = req.valid.query;
  const { items, total } = await issues.listIssues(req.user, q);
  res.json(pageOf(items, total, q));
}

export async function feed(req, res) {
  const q = req.valid.query;
  const { items, total } = await issues.feed(q);
  res.json(pageOf(items, total, q));
}

export async function get(req, res) {
  res.json(await issues.getIssue(req.user, req.valid.params.id));
}

export async function patch(req, res) {
  res.json(await issues.patchIssue(req.user, req.valid.params.id, req.body));
}

export async function support(req, res) {
  res.json(await issues.supportIssue(req.user, req.valid.params.id));
}

export async function suggestions(req, res) {
  const issue = await Issue.findOne({ _id: req.valid.params.id, ...scopeFilter(req.user) }).select(
    'category',
  );
  if (!issue) throw ApiError.notFound('Issue not found');
  res.json({ category: issue.category, suggestions: await suggestTechnicians(issue.category) });
}

export async function assign(req, res) {
  res.json(await issues.assignIssue(req.user, req.valid.params.id, req.body));
}

export async function transition(req, res) {
  res.json(await issues.transitionIssue(req.user, req.valid.params.id, req.body, req.file));
}
