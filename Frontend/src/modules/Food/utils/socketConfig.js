import { API_BASE_URL } from "@food/api/config";

/**
 * Resolves the Socket.IO server URL dynamically:
 * 1. Uses VITE_SOCKET_URL from environment if provided (e.g., http://localhost:5001)
 * 2. Defaults to API_BASE_URL origin (e.g., http://localhost:5000)
 * 
 * @returns {string} Socket server URL
 */
export function getSocketUrl() {
  const customSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (customSocketUrl && typeof customSocketUrl === "string" && customSocketUrl.trim()) {
    return customSocketUrl.trim().replace(/\/+$/, "");
  }

  let backendUrl = API_BASE_URL;
  try {
    return new URL(backendUrl).origin;
  } catch {
    return String(backendUrl || "")
      .replace(/\/api\/v\d+\/?$/i, "")
      .replace(/\/api\/?$/i, "")
      .replace(/\/+$/, "");
  }
}
