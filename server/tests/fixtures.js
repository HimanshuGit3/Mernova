import sharp from 'sharp';
import { Location } from '../models/Location.js';
import { Issue } from '../models/Issue.js';
import { computeDueAt } from '../services/sla.js';

/** A small real JPEG (solid colour). */
export function jpeg({ width = 64, height = 48, color = '#3b7bd0' } = {}) {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
}

export function png({ width = 32, height = 32, color = '#1f9e89' } = {}) {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .png()
    .toBuffer();
}

export const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n',
);

let codeCounter = 0;
export async function makeLocation(overrides = {}) {
  codeCounter += 1;
  return Location.create({
    code: overrides.code ?? `T-${100 + codeCounter}`,
    building: overrides.building ?? 'Test Block',
    floor: overrides.floor ?? '1',
    room: overrides.room ?? String(100 + codeCounter),
    label: overrides.label ?? 'Test room',
    point: { type: 'Point', coordinates: [overrides.lng ?? 77.5362, overrides.lat ?? 13.1718] },
    isActive: overrides.isActive ?? true,
  });
}

/** Insert an issue directly (bypasses the API) in any state. */
export async function makeIssue(reporter, overrides = {}) {
  const createdAt = overrides.createdAt ?? new Date();
  const severity = overrides.severity ?? 'medium';
  const doc = new Issue({
    title: 'Test issue',
    category: 'electrical',
    severity,
    status: 'open',
    reportedBy: reporter._id,
    landmark: 'Near the main gate',
    slaStartedAt: createdAt,
    dueAt: computeDueAt(createdAt, severity),
    statusHistory: [{ status: 'open', changedBy: reporter._id, at: createdAt, note: 'Reported' }],
    ...overrides,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
  });
  await doc.save({ timestamps: !overrides.createdAt });
  return doc;
}
