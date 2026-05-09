/**
 * Absolute base for public profile links and QR codes (no trailing slash).
 * Production: set REACT_APP_PUBLIC_SITE_URL (e.g. https://competition-registrations.web.app).
 * If unset, uses the current browser origin (localhost in dev).
 */
export function getPublicSiteOrigin() {
  const fromEnv = (process.env.REACT_APP_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function buildPublicProfileUrl(uid) {
  const base = getPublicSiteOrigin();
  const path = `/u/${encodeURIComponent(uid)}`;
  if (!base) return path;
  return `${base}${path}`;
}
