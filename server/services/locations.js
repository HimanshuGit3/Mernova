import { Location, QR_PREFIX } from '../models/Location.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/text.js';

export async function listLocations({ q, building, active, page, limit }) {
  const filter = {};
  if (building) filter.building = building;
  if (active !== undefined) filter.isActive = active;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ code: rx }, { building: rx }, { room: rx }, { label: rx }];
  }
  const [items, total] = await Promise.all([
    Location.find(filter)
      .sort({ building: 1, code: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Location.countDocuments(filter),
  ]);
  return { items, total };
}

export async function buildings() {
  const names = await Location.distinct('building', { isActive: true });
  return names.sort((a, b) => a.localeCompare(b));
}

/** Accepts a bare code (`B-204`) or full QR content (`FIXIT:LOC:B-204`). Inactive → 404. */
export async function byCode(raw) {
  const code = String(raw).trim().toUpperCase().replace(QR_PREFIX, '');
  const loc = await Location.findOne({ code, isActive: true });
  if (!loc) throw ApiError.notFound('Unknown or inactive location');
  return loc;
}

export async function createLocation({ lat, lng, ...rest }) {
  return Location.create({ ...rest, point: { type: 'Point', coordinates: [lng, lat] } });
}

export async function updateLocation(id, { lat, lng, ...rest }) {
  const loc = await Location.findById(id);
  if (!loc) throw ApiError.notFound('Location not found');
  Object.assign(loc, rest);
  if (lat !== undefined || lng !== undefined) {
    const [oldLng, oldLat] = loc.point.coordinates;
    loc.point = { type: 'Point', coordinates: [lng ?? oldLng, lat ?? oldLat] };
  }
  await loc.save();
  return loc;
}
