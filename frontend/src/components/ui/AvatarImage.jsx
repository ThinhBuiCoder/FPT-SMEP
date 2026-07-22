import { useMemo, useState } from 'react';
import { resolveMediaUrl } from '../../utils/mediaUrl';

const getInitials = (name = '') => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'U';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return `${words[0].charAt(0)}${words.at(-1).charAt(0)}`.toUpperCase();
};

export default function AvatarImage({
  src,
  name,
  imageClassName = 'h-full w-full object-cover',
  fallbackClassName = '',
}) {
  const resolvedSrc = useMemo(() => resolveMediaUrl(src), [src]);
  const [failedSrc, setFailedSrc] = useState('');
  const failed = Boolean(resolvedSrc && failedSrc === resolvedSrc);

  if (!resolvedSrc || failed) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center font-bold ${fallbackClassName}`}
        aria-label={`${name || 'User'} avatar fallback`}
      >
        {getInitials(name)}
      </span>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={`${name || 'User'} avatar`}
      className={imageClassName}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(resolvedSrc)}
    />
  );
}
