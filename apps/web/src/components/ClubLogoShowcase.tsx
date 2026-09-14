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

/** Logo + name together inside one white box (no jersey-count line) */
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
      className="club-logo-card group box-border flex shrink-0 items-center gap-2.5 overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-[#C8C8C8] hover:bg-[#FAFAFA] cursor-pointer"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#EEEEEE] bg-white sm:h-10 sm:w-10">
        {club.logoUrl && !imgFailed ? (
          <img
            src={club.logoUrl}
            alt=""
            aria-hidden="true"
            className="h-[80%] w-[80%] object-contain"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-[8px] font-black uppercase text-[#0A0A0A]/35">Logo</span>
        )}
      </span>
      <span className="max-w-[10.5rem] truncate text-left text-[11px] font-black uppercase tracking-tight text-[#0A0A0A] sm:max-w-[12rem] sm:text-xs">
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
      className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6 pt-3 sm:pt-4 pb-2"
      aria-label="Football club logo showcase"
    >
      <div className="club-logo-marquee relative w-full overflow-hidden py-1.5">
        <div
          className={`club-logo-marquee-track flex w-max items-center gap-3 sm:gap-3.5 ${
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
