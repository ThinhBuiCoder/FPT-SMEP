const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const BLOCKED_PROTOCOLS = ['javascript:', 'file:', 'data:', 'vbscript:'];

const hasProtocol = (value) => /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value);

const normalizeUrl = (rawUrl) => {
  if (typeof rawUrl !== 'string') {
    const error = new Error('URL is required.');
    error.statusCode = 400;
    throw error;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    const error = new Error('URL is required.');
    error.statusCode = 400;
    throw error;
  }

  const lower = trimmed.toLowerCase();
  if (BLOCKED_PROTOCOLS.some((protocol) => lower.startsWith(protocol))) {
    const error = new Error('Invalid URL protocol.');
    error.statusCode = 400;
    throw error;
  }

  const candidate = hasProtocol(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed;

  try {
    parsed = new URL(candidate);
  } catch {
    const error = new Error('Invalid URL.');
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    const error = new Error('Only http:// and https:// URLs are allowed.');
    error.statusCode = 400;
    throw error;
  }

  parsed.hostname = parsed.hostname.toLowerCase();

  const pathname = parsed.pathname === '/'
    ? ''
    : parsed.pathname.replace(/\/+$/, '');

  return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}${parsed.hash}`;
};

module.exports = {
  normalizeUrl,
  ALLOWED_PROTOCOLS,
};
