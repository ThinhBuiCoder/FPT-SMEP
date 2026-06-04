const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF]/g;

const isEmptyValue = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.replace(INVISIBLE_CHARS, '').trim() === '';
  return false;
};

const normalizeRollNumber = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(INVISIBLE_CHARS, '').trim().toUpperCase();
};

const normalizeColumnKey = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(INVISIBLE_CHARS, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
};

const toSafeKey = (value) => {
  const raw = String(value || '').replace(INVISIBLE_CHARS, '').trim();
  if (!raw) return '';
  const compact = raw
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
  if (!compact) return '';
  return compact.charAt(0).toUpperCase() + compact.slice(1);
};

const stringifyValue = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

module.exports = {
  isEmptyValue,
  normalizeRollNumber,
  normalizeColumnKey,
  stringifyValue,
  toSafeKey,
};
