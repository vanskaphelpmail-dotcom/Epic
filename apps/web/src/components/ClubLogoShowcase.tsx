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

const CLUB_CARD_PX = 160;
/** Start scrolling after layout/images settle — then never stop */
const ANIM_START_DELAY_MS = 900;

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
      className="club-logo-card group box-border flex shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-[#B8D9C8] bg-white px-2.5 py-3 text-center transition-colors hover:bg-[#F8FBF9] cursor-pointer"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden">
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
          <span className="text-[10px] font-black uppercase text-[#0A0A0A]/40">Logo</span>
        )}
      </div>
      <div className="min-w-0 w-full space-y-0.5 px-0.5">
        <h4 className="text-[11px] font-black uppercase leading-tight tracking-tight text-[#0A0A0A] line-clamp-2">
          {club.name}
        </h4>
        <p className="text-[10px] font-medium text-[#5FA88A] leading-tight">
          {displayCount} verified jerseys
        </p>
      </div>
    </button>
  );
}

/** Build one marquee half wide enough for a seamless -50% loop */
function buildMarqueeHalf(clubs: ClubCatalogItem[]): ClubCatalogItem[] {
  if (clubs.length === 0) return [];
  const minCards = 8;
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

  // Exactly two identical halves → translateX(-50%) loops seamlessly forever
  const halfClubs = useMemo(() => buildMarqueeHalf(predictedClubs), [predictedClubs]);
  const loopClubs = useMemo(() => [...halfClubs, ...halfClubs], [halfClubs]);

  const durationSec = Math.max(32, Math.round(halfClubs.length * 4.5));

  useEffect(() => {
    setAnimReady(false);
    if (predictedClubs.length === 0) return;
    const t = window.setTimeout(() => setAnimReady(true), ANIM_START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [predictedClubs.length, durationSec]);

  if (predictedClubs.length === 0) return null;

  return (
    <section
      className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6 pt-4 sm:pt-5 pb-2 sm:pb-3"
      aria-label="Football club logo showcase"
    >
      <div className="club-logo-marquee relative w-full overflow-hidden">
        <div
          className={`club-logo-marquee-track flex w-max items-stretch gap-3 ${
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
