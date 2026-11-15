import { FoodZone } from '../admin/models/zone.model.js';

const toFinite = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const distToSegmentKm = (pLat, pLng, aLat, aLng, bLat, bLng) => {
  const l2 = (bLat - aLat) ** 2 + (bLng - aLng) ** 2;
  if (l2 === 0) return haversineKm(pLat, pLng, aLat, aLng);
  let t = ((pLat - aLat) * (bLat - aLat) + (pLng - aLng) * (bLng - aLng)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projLat = aLat + t * (bLat - aLat);
  const projLng = aLng + t * (bLng - aLng);
  return haversineKm(pLat, pLng, projLat, projLng);
};

export const distToPolygonKm = (lat, lng, polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return Infinity;
  let minDist = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const d = distToSegmentKm(
      lat,
      lng,
      polygon[j].latitude,
      polygon[j].longitude,
      polygon[i].latitude,
      polygon[i].longitude
    );
    if (d < minDist) minDist = d;
  }
  return minDist;
};

/** Ray-casting point-in-polygon for zone.coordinates [{latitude, longitude}, ...] with optional buffer tolerance in km */
export function isPointInZonePolygon(lat, lng, polygon, bufferKm = 10) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  if (inside) return true;

  // Buffer tolerance for boundary edges & neighboring localities
  if (bufferKm > 0) {
    const dist = distToPolygonKm(lat, lng, polygon);
    if (dist <= bufferKm) return true;
  }

  return false;
}

/**
 * Resolve active zone id for a lat/lng point.
 * Checks exact polygon containment first, then proximity buffer (default 10 km).
 * @returns {Promise<string|null>} zone ObjectId string or null
 */
export async function detectZoneIdForPoint(lat, lng, bufferKm = 10) {
  const parsedLat = toFinite(lat);
  const parsedLng = toFinite(lng);
  if (parsedLat === null || parsedLng === null) return null;

  const zones = await FoodZone.find({ isActive: true })
    .select('_id coordinates')
    .lean();

  // Pass 1: exact polygon containment
  for (const zone of zones) {
    const coords = Array.isArray(zone.coordinates) ? zone.coordinates : [];
    if (coords.length < 3) continue;
    if (isPointInZonePolygon(parsedLat, parsedLng, coords, 0)) {
      return String(zone._id);
    }
  }

  // Pass 2: nearest zone within bufferKm
  if (bufferKm > 0) {
    let closestZoneId = null;
    let minDistance = Infinity;
    for (const zone of zones) {
      const coords = Array.isArray(zone.coordinates) ? zone.coordinates : [];
      if (coords.length < 3) continue;
      const dist = distToPolygonKm(parsedLat, parsedLng, coords);
      if (dist <= bufferKm && dist < minDistance) {
        minDistance = dist;
        closestZoneId = String(zone._id);
      }
    }
    if (closestZoneId) return closestZoneId;
  }

  return null;
}

export async function getActiveZoneById(zoneId) {
  if (!zoneId) return null;
  return FoodZone.findOne({ _id: zoneId, isActive: true })
    .select('_id coordinates name zoneName')
    .lean();
}

/** True if partner GPS is inside the given zone document polygon or buffer. */
export function isPartnerInsideZone(partner, zoneDoc, bufferKm = 10) {
  if (!zoneDoc) return false;
  const lat = toFinite(partner?.lastLat);
  const lng = toFinite(partner?.lastLng);
  if (lat === null || lng === null) return false;
  const coords = Array.isArray(zoneDoc.coordinates) ? zoneDoc.coordinates : [];
  return isPointInZonePolygon(lat, lng, coords, bufferKm);
}
