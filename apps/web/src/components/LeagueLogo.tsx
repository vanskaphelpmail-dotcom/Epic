import React, { useState } from 'react';
import { LeagueCatalogItem } from '../data/leaguesData';

interface LeagueLogoProps {
  league: LeagueCatalogItem;
  className?: string;
}

/** Reliable inline league marks — used when logo image is missing */
const InlineMark: React.FC<{ mark: LeagueCatalogItem['mark'] }> = ({ mark }) => {
  switch (mark) {
    case 'premier':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
          <rect width="64" height="64" rx="8" fill="#000" />
          <circle cx="32" cy="32" r="22" fill="#37003c" />
          <path d="M22 40 L32 18 L42 40 Z" fill="#00ff85" />
        </svg>
      );
    case 'laliga':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
          <rect width="64" height="64" rx="8" fill="#000" />
          <path d="M18 16 L28 16 L36 48 L26 48 Z" fill="#ee5270" />
          <path d="M34 12 L44 12 L52 44 L42 44 Z" fill="#ee5270" />
        </svg>
      );
    case 'seriea':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
          <rect width="64" height="64" rx="8" fill="#000" />
          <polygon points="32,8 52,56 12,56" fill="#4da6ff" />
          <polygon points="32,20 42,48 22,48" fill="#024494" />
        </svg>
      );
    case 'bundesliga':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
          <rect width="64" height="64" rx="8" fill="#d20515" />
          <circle cx="40" cy="38" r="6" fill="#fff" />
          <path d="M18 44 L28 22 L36 40 L30 44 Z" fill="#fff" />
        </svg>
      );
    case 'ligue1':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
          <rect width="64" height="64" rx="8" fill="#000" />
          <path d="M18 18 L46 18 L46 28 L36 28 L36 46 L28 46 L28 28 L18 28 Z" fill="#c4ff00" />
          <circle cx="32" cy="32" r="5" fill="#fff" />
        </svg>
      );
    case 'mls':
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
          <rect width="64" height="64" rx="8" fill="#000" />
          <path d="M16 12 L48 12 L52 52 L12 52 Z" fill="#1a2b5c" />
          <path d="M16 12 L48 12 L40 36 L12 36 Z" fill="#e31837" />
          <text x="32" y="28" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="900" fontFamily="sans-serif">
            MLS
          </text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
          <rect width="64" height="64" rx="12" fill="#450a0a" />
          <circle cx="32" cy="32" r="14" fill="#e10600" />
        </svg>
      );
  }
};

export const LeagueLogo: React.FC<LeagueLogoProps> = ({ league, className = '' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showRemote = Boolean(league.logoUrl) && !imgFailed;

  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-lg bg-white ${className || 'h-16 w-16'}`}>
      {showRemote ? (
        <img
          src={league.logoUrl}
          alt={`${league.name} Logo`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="max-h-full max-w-full h-full w-full object-contain p-0.5"
        />
      ) : (
        <InlineMark mark={league.mark} />
      )}
    </div>
  );
};
