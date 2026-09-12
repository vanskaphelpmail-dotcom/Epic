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

/** Fixed logo card size (px) — matches storefront request */
const CLUB_CARD_PX = 120;
const ANIM_START_DELAY_MS = 700;

function ClubCard({
  club,
  displayCount,
  onSelect,
}: {
  club: ClubCatalogItem;
  displayCount: number;
  onSelect: () => void;
}) {
  const [imgFailed, setImgFailed] = React.useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ width: CLUB_CARD_PX, height: CLUB_CARD_PX, minWidth: CLUB_CARD_PX, minHeight: CLUB_CARD_PX }}
      className="club-logo-card group box-border flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#D8E8DF] bg-white px-1.5 py-2 text-center transition-colors hover:bg-[#F8FBF9] cursor-pointer"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden">
        {club.logoUrl && !imgFailed ? (
          <img
            src={club.logoUrl}
            alt={`${club.name} logo`}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-[9px] font-black uppercase text-[#0A0A0A]/35">Logo</span>
        )}
      </div>
      <div className="min-w-0 w-full space-y-0 px-0.5">
        <h4 className="text-[9px] font-black uppercase leading-tight tracking-tight text-[#0A0A0A] line-clamp-2">
          {club.name}
        </h4>
        <p className="text-[8px] font-medium text-[#5FA88A] leading-tight truncate">
          {displayCount} jerseys
        </p>
      </div>
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

  // Smooth continuous speed (~38–55px/sec feel)
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
      className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6 pt-3 sm:pt-4 pb-2"
      aria-label="Football club logo showcase"
    >
      <div className="club-logo-marquee relative w-full overflow-hidden">
        <div
          className={`club-logo-marquee-track flex w-max items-stretch gap-2.5 ${
            animReady ? 'is-running' : 'is-waiting'
          }`}
          style={{ animationDuration: `${durationSec}s` }}
        >
          {loopClubs.map((club, idx) => (
            <ClubCard
              key={`${club.id}-${idx}`}
              club={club}
              displayCount={club.count}
              onSelect={() => onSelectClub(club)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
