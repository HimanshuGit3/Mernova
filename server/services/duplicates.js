import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Issue } from '../models/Issue.js';
import { Location } from '../models/Location.js';
import { ACTIVE_STATUSES } from '../utils/constants.js';
import { cosineSimilarity } from './ai.js';

export const DUPLICATE_WINDOW_DAYS = 7;
const SAME_CATEGORY_BOOST = 0.05;

/**
 * Duplicate candidates (D7): active issues from the last 7 days within DUPLICATE_RADIUS_M of the
 * point (2dsphere $geoNear) or in the same room, ranked by CLIP image similarity (same category
 * gets a small boost). Without an embedding (AI off, or no photo yet) only same-category issues
 * nearby are offered, ranked by distance. Returns at most 3, never with reporter identity.
 */
export async function findDuplicates({
  lat,
  lng,
  locationId,
  embedding,
  category,
  viewerId,
  limit = 3,
  now = new Date(),
}) {
  const since = new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 24 * 36e5);
  const base = { status: { $in: ACTIVE_STATUSES }, createdAt: { $gte: since } };
  if (viewerId) base.reportedBy = { $ne: new mongoose.Types.ObjectId(String(viewerId)) };

  let point = lat !== undefined && lng !== undefined ? [lng, lat] : null;
  if (locationId) {
    const loc = await Location.findById(locationId).select('point').lean();
    if (loc) point = loc.point.coordinates;
  }

  const found = new Map(); // id → { doc, distanceM }
  if (point) {
    const near = await Issue.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: point },
          distanceField: 'distanceM',
          maxDistance: env.DUPLICATE_RADIUS_M,
          spherical: true,
          query: base,
          key: 'point',
        },
      },
      { $limit: 50 },
      { $project: { _id: 1, distanceM: 1 } },
    ]);
    for (const n of near) found.set(String(n._id), { distanceM: n.distanceM });
  }
  if (locationId) {
    const sameRoom = await Issue.find({ ...base, locationRef: locationId })
      .select('_id')
      .limit(50)
      .lean();
    for (const s of sameRoom)
      if (!found.has(String(s._id))) found.set(String(s._id), { distanceM: 0 });
  }
  if (found.size === 0) return [];

  const docs = await Issue.find({ _id: { $in: [...found.keys()] } })
    .select('+embedding title category status thumbPath supporters createdAt locationRef')
    .populate({ path: 'locationRef', select: 'code building room label' })
    .lean();

  const threshold = env.DUPLICATE_SIMILARITY;
  const scored = docs
    .map((d) => {
      const sameCategory = category ? d.category === category : false;
      let similarity = null;
      if (embedding?.length && d.embedding?.length) {
        similarity = Math.min(
          1,
          cosineSimilarity(embedding, d.embedding) + (sameCategory ? SAME_CATEGORY_BOOST : 0),
        );
      }
      return { d, similarity, sameCategory, distanceM: found.get(String(d._id)).distanceM };
    })
    .filter((x) => (x.similarity !== null ? x.similarity >= threshold : x.sameCategory))
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0) || a.distanceM - b.distanceM);

  return scored.slice(0, limit).map(({ d, similarity, distanceM }) => ({
    id: String(d._id),
    title: d.title,
    category: d.category,
    status: d.status,
    thumbPath: d.thumbPath,
    distanceM: Math.round(distanceM),
    similarity: similarity === null ? null : Math.round(similarity * 1000) / 1000,
    supportersCount: d.supporters?.length ?? 0,
    supportedByMe: viewerId
      ? (d.supporters ?? []).some((s) => String(s) === String(viewerId))
      : false,
    createdAt: d.createdAt,
    locationRef: d.locationRef
      ? {
          id: String(d.locationRef._id),
          code: d.locationRef.code,
          building: d.locationRef.building,
          room: d.locationRef.room,
          label: d.locationRef.label,
        }
      : null,
  }));
}
