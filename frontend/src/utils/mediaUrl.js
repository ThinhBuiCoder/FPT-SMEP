const getApiOrigin = () => {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (!apiUrl || apiUrl.startsWith('/')) return window.location.origin;

  try {
    return new URL(apiUrl, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

/**
 * Resolve media saved as either an absolute URL or a backend-relative path.
 * Older records may contain values such as `/uploads/avatar.png`; those must
 * point to the API host instead of Vite's frontend origin.
 */
export const resolveMediaUrl = (value) => {
  if (typeof value !== 'string') return '';

  const url = value.trim();
  if (!url) return '';

  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('//')) return `${window.location.protocol}${url}`;

  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${getApiOrigin()}${normalizedPath}`;
};

