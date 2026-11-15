import { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'LK';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass =
    size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
        ? 'h-12 w-12 text-sm'
        : 'h-9 w-9 text-xs';

  if (!src || imgFailed) {
    return (
      <div
        aria-hidden="true"
        className={`${sizeClass} shrink-0 rounded-lg bg-slate-200 text-slate-700 font-semibold flex items-center justify-center select-none border border-slate-300/70`}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`${sizeClass} shrink-0 rounded-lg object-cover border border-slate-200 bg-slate-100`}
    />
  );
}
