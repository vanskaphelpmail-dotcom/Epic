import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Shield, Compass, RotateCcw, ArrowRight, Star, Users, Truck } from 'lucide-react';
import { Product, CarouselSlide, AppConfig } from '../types';

interface HeroProps {
  onExplore: (category: string) => void;
  featuredProducts: Product[];
  onSelectProduct: (product: Product) => void;
  setCurrentPage: (page: string) => void;
  slides: CarouselSlide[];
  appConfig: AppConfig;
}

export const Hero: React.FC<HeroProps> = ({
  onExplore,
  featuredProducts,
  onSelectProduct,
  setCurrentPage,
  slides,
  appConfig
}) => {
  const [activeSlide, setActiveSlide] = useState(0);

  // Countdown timer config fields
  const team1 = appConfig?.timerTeam1 || 'ESP';
  const team1Emoji = appConfig?.timerTeam1Emoji || '🇪🇸';
  const team2 = appConfig?.timerTeam2 || 'BEL';
  const team2Emoji = appConfig?.timerTeam2Emoji || '🇧🇪';
  const timerLabel = appConfig?.timerLabel || 'QUARTER-FINAL';
  const targetHours = appConfig?.timerTargetHours !== undefined ? appConfig.timerTargetHours : 20;

  // Live ticking countdown timer state
  const [timer, setTimer] = useState(() => {
    const d = Math.floor(targetHours / 24);
    const h = targetHours % 24;
    return { days: d, hours: h, minutes: 43, seconds: 47 };
  });

  // Update countdown timer whenever target hours from config shifts
  useEffect(() => {
    const d = Math.floor(targetHours / 24);
    const h = targetHours % 24;
    setTimer({
      days: d,
      hours: h,
      minutes: 43,
      seconds: 47
    });
  }, [targetHours]);

  // Clock Ticker Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        } else {
          const d = Math.floor(targetHours / 24);
          const h = targetHours % 24;
          return { days: d, hours: h, minutes: 43, seconds: 47 }; // Loop cleanly
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [targetHours]);

  // Slide navigation
  const nextSlide = () => {
    if (!slides.length) return;
    setActiveSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    if (!slides.length) return;
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  if (!slides || slides.length === 0) return null;

  const currentSlideIdx = activeSlide >= slides.length ? 0 : activeSlide;
  const currentSlide = slides[currentSlideIdx];

  const handleSlideClick = (productId: string) => {
    const found = featuredProducts.find((p) => p.id === productId);
    if (found) {
      onSelectProduct(found);
      setCurrentPage('details');
    } else {
      onExplore('All');
    }
  };

  // Unsplash fallback background images to match the exact football atmosphere
  const getSlideBg = (idx: number, customImage?: string) => {
    if (customImage) return customImage;
    const fallbacks = [
      'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=1600'
    ];
    return fallbacks[idx % fallbacks.length];
  };

  // Double formatting helper
  const pad = (num: number) => String(num).padStart(2, '0');

  // Vector render of classic club jerseys for the Top Selling Club Jerseys row
  const renderClubJersey = (club: string) => {
    switch (club.toLowerCase()) {
      case 'real madrid':
        return (
          <svg viewBox="0 0 100 120" className="w-16 h-20 md:w-20 md:h-24 filter drop-shadow-md mx-auto">
            {/* White Jersey */}
            <path d="M 50 15 Q 40 5, 25 15 L 10 35 L 20 45 L 30 38 L 30 110 Q 50 115, 70 110 L 70 38 L 80 45 L 90 35 L 75 15 Q 60 5, 50 15 Z" fill="#ffffff" stroke="#f1f5f9" strokeWidth="1" />
            {/* Gold shoulder stripes */}
            <path d="M 25 15 L 15 25" stroke="#fbbf24" strokeWidth="3" />
            {/* Gold details */}
            <path d="M 75 15 L 85 25" stroke="#fbbf24" strokeWidth="3" />
            {/* Gold collar/v-neck */}
            <path d="M 40 10 L 50 25 L 60 10 Z" fill="#fbbf24" />
            {/* Gold badge */}
            <circle cx="50" cy="45" r="4" fill="#fbbf24" />
          </svg>
        );
      case 'fc barcelona':
        return (
          <svg viewBox="0 0 100 120" className="w-16 h-20 md:w-20 md:h-24 filter drop-shadow-md mx-auto">
            {/* Base Blue */}
            <path d="M 50 15 Q 40 5, 25 15 L 10 35 L 20 45 L 30 38 L 30 110 Q 50 115, 70 110 L 70 38 L 80 45 L 90 35 L 75 15 Q 60 5, 50 15 Z" fill="#1e3a8a" />
            {/* Red vertical stripes */}
            <rect x="35" y="38" width="8" height="72" fill="#b91c1c" />
            <rect x="57" y="30" width="8" height="80" fill="#b91c1c" />
            {/* Sleeves */}
            <path d="M 10 35 L 20 45 L 25 35 Z" fill="#b91c1c" />
            <path d="M 90 35 L 80 45 L 75 35 Z" fill="#b91c1c" />
            {/* Yellow badge in center */}
            <circle cx="50" cy="50" r="3.5" fill="#facc15" />
          </svg>
        );
      case 'manchester city':
        return (
          <svg viewBox="0 0 100 120" className="w-16 h-20 md:w-20 md:h-24 filter drop-shadow-md mx-auto">
            {/* Sky Blue */}
            <path d="M 50 15 Q 40 5, 25 15 L 10 35 L 20 45 L 30 38 L 30 110 Q 50 115, 70 110 L 70 38 L 80 45 L 90 35 L 75 15 Q 60 5, 50 15 Z" fill="#bae6fd" />
            {/* White trim on sleeves and collar */}
            <rect x="30" y="38" width="2" height="72" fill="#ffffff" />
            <rect x="68" y="38" width="2" height="72" fill="#ffffff" />
            <path d="M 40 10 L 50 25 L 60 10 Z" fill="#ffffff" />
            {/* Navy blue badge detail */}
            <circle cx="50" cy="45" r="4.5" fill="#1e3a8a" />
          </svg>
        );
      case 'manchester united':
        return (
          <svg viewBox="0 0 100 120" className="w-16 h-20 md:w-20 md:h-24 filter drop-shadow-md mx-auto">
            {/* Red Jersey */}
            <path d="M 50 15 Q 40 5, 25 15 L 10 35 L 20 45 L 30 38 L 30 110 Q 50 115, 70 110 L 70 38 L 80 45 L 90 35 L 75 15 Q 60 5, 50 15 Z" fill="#dc2626" />
            {/* White shoulder stripes */}
            <path d="M 25 15 L 15 25 M 75 15 L 85 25" stroke="#ffffff" strokeWidth="2.5" />
            {/* Black Collar */}
            <path d="M 40 10 L 50 25 L 60 10 Z" fill="#111827" />
            {/* Yellow badge in center */}
            <circle cx="50" cy="48" r="3.5" fill="#facc15" />
          </svg>
        );
      case 'liverpool fc':
        return (
          <svg viewBox="0 0 100 120" className="w-16 h-20 md:w-20 md:h-24 filter drop-shadow-md mx-auto">
            {/* Deep Crimson/Red Jersey */}
            <path d="M 50 15 Q 40 5, 25 15 L 10 35 L 20 45 L 30 38 L 30 110 Q 50 115, 70 110 L 70 38 L 80 45 L 90 35 L 75 15 Q 60 5, 50 15 Z" fill="#991b1b" />
            {/* Gold sleeve cuffs */}
            <rect x="10" y="32" width="10" height="3" fill="#facc15" transform="rotate(-30 10 32)" />
            <rect x="80" y="32" width="10" height="3" fill="#facc15" transform="rotate(30 80 32)" />
            {/* Gold collar */}
            <path d="M 40 10 L 50 22 L 60 10 Z" fill="#facc15" />
            {/* Gold Crest */}
            <circle cx="50" cy="46" r="3.5" fill="#facc15" />
          </svg>
        );
      case 'bayern munich':
        return (
          <svg viewBox="0 0 100 120" className="w-16 h-20 md:w-20 md:h-24 filter drop-shadow-md mx-auto">
            {/* Base Red */}
            <path d="M 50 15 Q 40 5, 25 15 L 10 35 L 20 45 L 30 38 L 30 110 Q 50 115, 70 110 L 70 38 L 80 45 L 90 35 L 75 15 Q 60 5, 50 15 Z" fill="#b91c1c" />
            {/* White stripes on body */}
            <rect x="36" y="38" width="5" height="72" fill="#ffffff" />
            <rect x="59" y="30" width="5" height="80" fill="#ffffff" />
            {/* White sleeves trim */}
            <path d="M 10 35 L 20 45 L 25 35 Z" fill="#ffffff" />
            {/* Red Collar */}
            <path d="M 40 10 L 50 25 L 60 10 Z" fill="#ffffff" />
            {/* Club Round Crest */}
            <circle cx="50" cy="48" r="4.5" fill="#1d4ed8" stroke="#ffffff" strokeWidth="1" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 100 120" className="w-16 h-20 md:w-20 md:h-24 filter drop-shadow-md mx-auto">
            <path d="M 50 15 Q 40 5, 25 15 L 10 35 L 20 45 L 30 38 L 30 110 Q 50 115, 70 110 L 70 38 L 80 45 L 90 35 L 75 15 Q 60 5, 50 15 Z" fill="#047857" />
          </svg>
        );
    }
  };

  return (
    <div className="w-full space-y-0">
      
      {/* COUNTDOWN TIMER BAR ABOVE SLIDER */}
      {(appConfig?.timerEnabled !== false) && (
        <div className="w-full bg-slate-50/50 border-b border-emerald-100/50 py-3 px-2 sm:px-4 flex justify-center items-center">
          <div className="inline-flex items-center justify-center gap-1 sm:gap-2.5 bg-white border-2 border-emerald-600/90 text-[9px] min-[480px]:text-[10px] sm:text-xs font-bold text-emerald-950 px-3 py-1.5 sm:px-6 sm:py-2.5 rounded-full shadow-md animate-fadeIn max-w-full">
            <span className="text-emerald-700 font-mono flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <span className="text-xs sm:text-sm leading-none">{team1Emoji}</span> <span className="uppercase tracking-tight">{team1}</span>
            </span>
            <span className="text-emerald-200 font-light mx-0.5 sm:mx-1.5">|</span>
            <span className="text-emerald-800 font-black tracking-wider uppercase text-[8px] sm:text-[10px] truncate max-w-[80px] min-[480px]:max-w-none">
              {timerLabel}
            </span>
            <span className="text-emerald-200 font-light mx-0.5 sm:mx-1.5">|</span>
            <span className="font-mono text-emerald-950 tracking-tight sm:tracking-wider text-[10px] sm:text-xs font-black flex items-center gap-0.5 sm:gap-1 justify-center">
              <span>{pad(timer.days)}</span>
              <span className="text-[8px] sm:text-[9px] text-emerald-600 font-mono font-bold lowercase mr-0.5 sm:mr-1">
                <span className="hidden min-[480px]:inline">days</span><span className="min-[480px]:hidden">d</span>
              </span>
              <span>{pad(timer.hours)}</span>
              <span className="text-[8px] sm:text-[9px] text-emerald-600 font-mono font-bold lowercase mr-0.5 sm:mr-1">
                <span className="hidden min-[480px]:inline">hours</span><span className="min-[480px]:hidden">h</span>
              </span>
              <span>{pad(timer.minutes)}</span>
              <span className="text-[8px] sm:text-[9px] text-emerald-600 font-mono font-bold lowercase mr-0.5 sm:mr-1">
                <span className="hidden min-[480px]:inline">mins</span><span className="min-[480px]:hidden">m</span>
              </span>
              <span>{pad(timer.seconds)}</span>
              <span className="text-[8px] sm:text-[9px] text-emerald-600 font-mono font-bold lowercase">
                <span className="hidden min-[480px]:inline">secs</span><span className="min-[480px]:hidden">s</span>
              </span>
            </span>
            <span className="text-emerald-200 font-light mx-0.5 sm:mx-1.5">|</span>
            <span className="text-emerald-700 font-mono flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <span className="uppercase tracking-tight">{team2}</span> <span className="text-xs sm:text-sm leading-none">{team2Emoji}</span>
            </span>
          </div>
        </div>
      )}
      
      {/* 1. MAIN BANNER BOX SLIDER */}
      <section className="relative w-full overflow-hidden bg-black select-none">
        
        {/* Banner sliding track wrapper */}
        <div className="relative w-full h-[320px] sm:h-[400px] md:h-[480px] lg:h-[550px] transition-all duration-700 ease-in-out">
          
          {/* Active slide container */}
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center transition-all duration-700 flex flex-col justify-between"
            style={{
              backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.75)), url(${getSlideBg(activeSlide, currentSlide.customImage)})`,
            }}
          >
            {/* Top gap */}
            <div />

            {/* Overlaid Banner Text on Bottom-Left and SHOP NOW on Bottom-Right */}
            <div className="w-full max-w-7xl mx-auto px-6 md:px-12 pb-10 md:pb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-white">
              
              {/* Bottom-Left content */}
              <div className="space-y-2 md:space-y-3 animate-fadeIn text-left max-w-2xl">
                <span className="bg-emerald-600 text-white font-mono font-black text-[9px] md:text-[10px] tracking-widest uppercase px-2.5 py-1 rounded inline-block">
                  {currentSlide.badge || 'JERSEY ADDICTS BD ORIGINAL'}
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none uppercase">
                  {currentSlide.title || 'World Cup Classic Clearance'}
                </h1>
                <p className="text-gray-200 text-xs sm:text-sm max-w-xl leading-relaxed">
                  {currentSlide.description || 'Save big on unique Classic 1 of 1s from nations that competed at the World Cup.'}
                </p>
              </div>

              {/* Bottom-Right outline button */}
              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleSlideClick(currentSlide.productId)}
                  className="border border-white hover:bg-white hover:text-black text-white font-extrabold text-[11px] sm:text-xs md:text-sm uppercase tracking-widest px-8 py-3.5 transition-all duration-300 shadow-lg hover:shadow-white/10 cursor-pointer rounded-none font-sans"
                >
                  SHOP NOW
                </button>
              </div>

            </div>
          </div>

          {/* Left slide arrow navigation */}
          <button
            type="button"
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/75 border border-white/10 text-white p-2.5 rounded-full transition-all cursor-pointer z-10"
            aria-label="Previous Slide"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Right slide arrow navigation */}
          <button
            type="button"
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/75 border border-white/10 text-white p-2.5 rounded-full transition-all cursor-pointer z-10"
            aria-label="Next Slide"
          >
            <ChevronRight size={20} />
          </button>

          {/* Indicators bottom center dots */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 z-15">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeSlide === idx ? 'w-8 bg-white' : 'w-1.5 bg-white/40 hover:bg-white'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

        </div>
      </section>

      {/* 2. VALUE PROPS RIBBON (CFS BRAND GREEN BAR) */}
      <section className="bg-emerald-900 border-t border-b border-emerald-800 py-3 text-white text-[11px] md:text-xs font-extrabold uppercase tracking-widest shadow-inner">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-2 text-center text-emerald-100">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Rated Excellent on Trustpilot</span>
          </div>
          <span className="hidden md:inline text-emerald-800">•</span>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-emerald-300" />
            <span>A community of over 2 million</span>
          </div>
          <span className="hidden md:inline text-emerald-800">•</span>
          <div className="flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Free domestic shipping on orders over £50</span>
          </div>
        </div>
      </section>

      {/* 3. TOP SELLING CLUB JERSEYS HORIZONTAL SELECTOR ROW */}
      <section className="bg-white py-12 border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-8">
          
          <div className="text-center md:text-left border-b border-emerald-100 pb-4">
            <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-950 font-sans">
              Top Selling Club Jerseys
            </h2>
            <div className="h-1 w-16 bg-emerald-800 mt-2 mx-auto md:mx-0" />
          </div>

          {/* Horizontally aligned elegant club kit columns */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-6 items-center">
            {[
              { name: 'Real Madrid', cat: 'Classic' },
              { name: 'FC Barcelona', cat: 'Classic' },
              { name: 'Manchester City', cat: 'Classic' },
              { name: 'Manchester United', cat: 'Classic' },
              { name: 'Liverpool FC', cat: 'Classic' },
              { name: 'Bayern Munich', cat: 'Classic' }
            ].map((team, idx) => (
              <div
                key={idx}
                onClick={() => onExplore(team.cat)}
                className="group flex flex-col items-center justify-center space-y-3 cursor-pointer p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 hover:border-emerald-500 transition-all hover:-translate-y-1.5 duration-300"
              >
                {renderClubJersey(team.name)}
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-950 group-hover:text-emerald-700 text-center transition-colors">
                  {team.name}
                </span>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 4. TRENDING SEARCHES SECTION */}
      <section className="bg-emerald-50/30 py-8 border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <span className="text-[10px] font-mono font-black text-emerald-850 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded border border-emerald-200 flex-shrink-0">
              Trending Searches
            </span>
            <div className="flex flex-wrap gap-2.5 justify-center md:justify-start">
              {[
                'Spain 2026 World Cup',
                'Beckham England 2004',
                'Messi Argentina',
                'Ronaldo Brazil 2002',
                'Vintage Nike',
                'Manchester United 1999',
                'Arsenal Highbury',
                'Fiorentina Nintendo'
              ].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onExplore('All')}
                  className="bg-white hover:bg-emerald-800 hover:text-white border border-emerald-100 text-[10px] md:text-xs text-emerald-800 font-bold uppercase px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
