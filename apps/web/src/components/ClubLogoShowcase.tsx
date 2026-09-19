import React, { useEffect, useMemo, useState } from 'react';
import {
  predictClubsFromJerseys,
  type ClubCatalogItem,
} from '../data/clubsData';
import type { Product } from '../types';

interface ClubLogoShowcaseProps {
  /** Admin / default club logo catalog (logos + names) */
  clubs: ClubCatalogItem[];
  products: Product[];
  onSelectClub: (club: ClubCatalogItem) => void;
}

const ANIM_START_DELAY_MS = 700;

/** Logo beside name — no white card box (Sevora-style) */
function ClubCard({
  club,
  onSelect,
}: {
  club: ClubCatalogItem;
  onSelect: () => void;
}) {
  const [imgFailed, setImgFailed] = React.useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      title={club.name}
      className="club-logo-card group flex shrink-0 items-center gap-2 bg-transparent px-1 py-1.5 cursor-pointer"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden sm:h-9 sm:w-9">
        {club.logoUrl && !imgFailed ? (
          <img
            src={club.logoUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-[8px] font-black uppercase text-[#0A0A0A]/35">Logo</span>
        )}
      </span>
      <span className="max-w-[10.5rem] truncate text-left text-[11px] font-black uppercase tracking-tight text-[#0A0A0A] transition-colors group-hover:text-[#E30613] sm:max-w-[12rem] sm:text-xs">
        {club.name}
      </span>
    </button>
  );
}

/** Build one marquee half wide enough for a seamless -50% loop */
function buildMarqueeHalf(clubs: ClubCatalogItem[]): ClubCatalogItem[] {
  if (clubs.length === 0) return [];
  const minCards = 10;
  const half: ClubCatalogItem[] = [];
  while (half.length < minCards) {
    half.push(...clubs);
  }
  return half;
}

export const ClubLogoShowcase: React.FC<ClubLogoShowcaseProps> = ({
  clubs,
  products,
  onSelectClub,
}) => {
  const [animReady, setAnimReady] = useState(false);

  const predictedClubs = useMemo(
    () => predictClubsFromJerseys(products, clubs),
    [products, clubs],
  );

  const halfClubs = useMemo(() => buildMarqueeHalf(predictedClubs), [predictedClubs]);
  const loopClubs = useMemo(() => [...halfClubs, ...halfClubs], [halfClubs]);

  const durationSec = Math.max(36, Math.round(halfClubs.length * 3.8));

  useEffect(() => {
    setAnimReady(false);
    if (predictedClubs.length === 0) return;
    const t = window.setTimeout(() => setAnimReady(true), ANIM_START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [predictedClubs.length, durationSec]);

  if (predictedClubs.length === 0) return null;

  return (
    <section
      className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6 pt-2 sm:pt-4 pb-0 md:pb-2"
      aria-label="Football club logo showcase"
    >
      <div className="club-logo-marquee relative w-full overflow-hidden py-1.5">
        <div
          className={`club-logo-marquee-track flex w-max items-center gap-6 sm:gap-8 ${
            animReady ? 'is-running' : 'is-waiting'
          }`}
          style={{ animationDuration: `${durationSec}s` }}
        >
          {loopClubs.map((club, idx) => (
            <ClubCard
              key={`${club.id}-${idx}`}
              club={club}
              onSelect={() => onSelectClub(club)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
