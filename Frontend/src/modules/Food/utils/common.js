import { API_BASE_URL } from "@food/api/config";

const defaultBackendOrigin = (API_BASE_URL || "").replace(/\/api\/v1\/?$/i, "").replace(/\/api\/?$/i, "").replace(/\/+$/, "");
const ASSET_BASE_URL = String(
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_ASSET_BASE_URL) || ""
).replace(/\/+$/, "");

/**
 * Returns the best origin to use for /uploads/ asset URLs.
 * If the baked-in API_BASE_URL points at localhost but the browser
 * is on a real domain (e.g. onrender.com), we ignore the baked-in
 * value and use the browser's own origin instead.
 */
const isLocalhostOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(origin);

const getActiveOrigin = (customOrigin = "") => {
  if (customOrigin) return customOrigin.replace(/\/+$/, "");
  if (ASSET_BASE_URL) return ASSET_BASE_URL;

  // If the baked-in backend origin is localhost but we're deployed on a real
  // domain, fall back to the browser's origin so images load from the live server.
  if (defaultBackendOrigin && typeof window !== "undefined") {
    const onLocalhost = isLocalhostOrigin(defaultBackendOrigin);
    const browserOnLocalhost =
      window.location?.hostname === "localhost" ||
      window.location?.hostname === "127.0.0.1";

    if (!onLocalhost || browserOnLocalhost) {
      // Either the baked-in origin is a real domain, OR both are localhost (dev)
      return defaultBackendOrigin;
    }
    // Baked-in is localhost but browser is on a real domain → use browser origin
    return window.location.origin.replace(/\/+$/, "");
  }

  if (defaultBackendOrigin) return defaultBackendOrigin;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "";
};

const rewriteUploadsUrl = (absoluteUrl, customOrigin = "") => {
  try {
    const parsed = new URL(absoluteUrl);
    const match = parsed.pathname.match(/\/uploads\/(.+)$/i);
    if (!match) return absoluteUrl;
    const filename = match[1];
    if (!filename || filename.includes("..")) return absoluteUrl;

    const activeOrigin = getActiveOrigin(customOrigin);
    const isLegacyDomain = /ometto|localhost|127\.0\.0\.1/i.test(parsed.hostname);

    if ((isLegacyDomain || ASSET_BASE_URL) && activeOrigin) {
      return `${activeOrigin}/uploads/${filename}${parsed.search || ""}`;
    }
    return absoluteUrl;
  } catch {
    return absoluteUrl;
  }
};

/**
 * Common utility functions for the Food module
 */

/**
 * Normalizes an image URL to handle relative paths and always load /uploads from the live server.
 */
export const normalizeImageUrl = (imageUrl, backendOrigin = "") => {
  if (typeof imageUrl !== "string") return "";
  const trimmed = imageUrl.trim();
  if (!trimmed || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;

  const appProtocol = typeof window !== "undefined" ? window.location?.protocol : "";
  const originToUse = getActiveOrigin(backendOrigin);

  let normalized = trimmed
    .replace(/\\/g, "/")
    .replace(/^(https?):\/(?!\/)/i, "$1://")
    .replace(/^(https?:\/\/)(https?:\/\/)/i, "$1");

  // Strip legacy domains (e.g. omettofood.com, ometto.com, localhost) so the path resolves to active origin
  if (/^https?:\/\/(www\.)?(omettofood\.com|ometto\.com|localhost|127\.0\.0\.1)(:\d+)?/i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      normalized = parsed.pathname + (parsed.search || "");
    } catch {}
  }

  if (/^\/\//.test(normalized)) normalized = `${appProtocol || "https:"}${normalized}`;

  if (/^(https?:)?\/\//i.test(normalized)) {
    return rewriteUploadsUrl(normalized, backendOrigin);
  }

  if (/uploads\//i.test(normalized) || normalized.startsWith("/uploads")) {
    const filename = normalized.replace(/^.*\/uploads\//i, "").replace(/^\/+/, "");
    if (filename && !filename.includes("..")) {
      return originToUse ? `${originToUse}/uploads/${filename}` : `/uploads/${filename}`;
    }
  }

  const absolutePath = normalized.startsWith("/")
    ? `${originToUse}${normalized}`
    : `${originToUse}/${normalized.replace(/^\.?\/*/, "")}`;
  return rewriteUploadsUrl(absolutePath, backendOrigin);
};

/**
 * Extracts a list of image URLs from a source (string, array of strings, or object with image properties)
 */
export const extractImages = (source, backendOrigin = "") => {
  if (!source) return [];
  const normalize = (val) => {
    if (!val) return "";
    if (typeof val === "string") return normalizeImageUrl(val, backendOrigin);
    if (typeof val === "object") {
      const src = val.url || val.secure_url || val.imageUrl || val.image || val.src || "";
      return typeof src === "string" ? normalizeImageUrl(src, backendOrigin) : "";
    }
    return "";
  };

  const candidates = Array.isArray(source) ? source.map(normalize) : [normalize(source)];
  return candidates.filter(Boolean);
};

/**
 * Calculates distance between two coordinates in kilometers using Haversine formula
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Formats distance for display
 */
export const formatDistance = (distanceInKm) => {
  if (distanceInKm === null || distanceInKm === undefined) return "1.2 km";
  if (distanceInKm >= 1) {
    return `${distanceInKm.toFixed(1)} km`;
  } else {
    return `${Math.round(distanceInKm * 1000)} m`;
  }
};

/**
 * Slugifies a string for use in URLs or as identifiers
 */
export const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * Removes Google Plus Codes (e.g. RW52+FGM, W2XM+VCP) from address strings
 */
export const removePlusCode = (addressStr) => {
  if (!addressStr || typeof addressStr !== 'string') return addressStr;
  return addressStr
    // Remove the plus code and optional trailing commas/spaces
    .replace(/\b[A-Z0-9]{2,8}\+[A-Z0-9]{2,5}[,\s]*/ig, '')
    // Also remove if it's at the very beginning without a word boundary
    .replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,5}[,\s]*/ig, '')
    .trim()
    // Clean up any leading or trailing commas that might be left over
    .replace(/^,\s*/, '')
    .replace(/,\s*,/g, ', ')
    .replace(/,\s*$/, '');
};
