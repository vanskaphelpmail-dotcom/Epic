import React from 'react';
import { ShieldCheck, HelpCircle, Phone, Globe, Instagram, Twitter, Facebook, Shirt, Trophy, Star, Flame, Sparkles, Tag, Box, Award, ShoppingBag, Compass, Heart, MapPin } from 'lucide-react';
import { STORE_LOCATIONS } from '../data/storeData';
import { AppConfig } from '../types';
import { BrandMark } from './BrandMark';

interface FooterProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  appConfig: AppConfig;
}

export const Footer: React.FC<FooterProps> = ({ currentPage, setCurrentPage, appConfig }) => {
  const renderNavIcon = (iconName?: string, size = 13) => {
    switch (iconName) {
      case 'Shirt': return <Shirt size={size} />;
      case 'Trophy': return <Trophy size={size} />;
      case 'Star': return <Star size={size} />;
      case 'Flame': return <Flame size={size} />;
      case 'Sparkles': return <Sparkles size={size} />;
      case 'Tag': return <Tag size={size} />;
      case 'Box': return <Box size={size} />;
      case 'Globe': return <Globe size={size} />;
      case 'ShieldCheck': return <ShieldCheck size={size} />;
      case 'Award': return <Award size={size} />;
      case 'ShoppingBag': return <ShoppingBag size={size} />;
      case 'HelpCircle': return <HelpCircle size={size} />;
      case 'Phone': return <Phone size={size} />;
      case 'Compass': return <Compass size={size} />;
      case 'Heart': return <Heart size={size} />;
      default: return null;
    }
  };

  const handleFooterLinkClick = (url: string) => {
    if (!url) return;
    const normalized = url.replace(/^#/, '').toLowerCase().trim();
    if (
      normalized === 'admin' ||
      normalized === 'auth' ||
      normalized.startsWith('admin/') ||
      normalized.includes('admin/account')
    ) {
      return;
    }
    if (url.startsWith('#')) {
      const anchor = url.replace('#', '');
      if (['seller', 'faq', 'about', 'contact', 'dashboard', 'authenticity', 'privacy', 'refund', 'terms', 'shipping'].includes(anchor)) {
        setCurrentPage(anchor);
      } else if (anchor === 'listing' || anchor === 'shop') {
        setCurrentPage('listing');
      } else {
        setCurrentPage(anchor || 'listing');
      }
    } else if (['seller', 'faq', 'about', 'contact', 'dashboard', 'authenticity', 'privacy', 'refund', 'terms', 'shipping', 'home', 'listing'].includes(url.toLowerCase())) {
      setCurrentPage(url.toLowerCase());
    } else {
      setCurrentPage(url);
    }
  };

  const footerMenuItems = (appConfig?.menuItems || [])
    .filter(m => m.placement === 'Footer Menu' && (m.status === 'Active' || m.status === 'active'))
    .sort((a, b) => a.order - b.order);

  const reviews = [
    {
      id: 1,
      name: 'Siyam Rahman',
      quote:
        'The AC Milan 1996 shirt has absolute perfect manufacturer stitching tags. Authentic holographic stamps included. Highly recommended for premium kit collectors in Dhaka.',
      rating: 5,
    },
    {
      id: 2,
      name: 'Fahim Chowdhury',
      quote:
        'Been looking for the Spain 2026 Yamal jersey for literal years. Finally secured it at Epic Vanskap BD with custom physics certificates. Unrivaled experience.',
      rating: 5,
    },
    {
      id: 3,
      name: 'Anika Bushra',
      quote:
        'Extremely fast delivery inside Dhaka (secured within 24 hours). The vacuum packaging smelled wonderful, complete with care instructions.',
      rating: 5,
    },
  ];

  return (
    <footer className="bg-[#F8F8F7] text-[#0A0A0A] border-t border-[#E5E5E5] w-full min-w-0 overflow-x-hidden">

      {/* Verified buyer reviews */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-12 sm:pt-16 pb-10 sm:pb-12 border-b border-[#E5E5E5]">
        <h3 className="text-center text-sm sm:text-base font-medium text-[#0A0A0A] mb-8 sm:mb-10">
          Genuine reviews from verified buyers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {reviews.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-[#E5E5E5] p-5 rounded-2xl space-y-3"
            >
              <div className="flex gap-1 text-amber-400">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-[#0A0A0A]/70 text-[12px] italic leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="border-t border-[#E5E5E5] pt-3 flex justify-between items-center gap-3 text-[10px] font-mono">
                <span className="text-[#0A0A0A] font-bold uppercase tracking-wide">{t.name}</span>
                <span className="text-[#0A0A0A]/50 font-bold uppercase whitespace-nowrap">
                  ✓ Verified Collector
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Main Multi-Column Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 sm:py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 text-xs">
        
        {/* Brand Information Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <BrandMark className="p-1 rounded-lg" imgClassName="w-7 h-7" />
            <div className="flex items-center gap-1.5">
              <span className="text-[#E30613] font-sans font-black text-sm uppercase">
                Epic
              </span>
              <span className="text-[#0A0A0A] font-sans font-black text-sm uppercase">
                Vanskap
              </span>
            </div>
          </div>
          <p className="text-[#0A0A0A]/70 leading-relaxed">
            {appConfig.footerAbout}
          </p>
          <div className="flex gap-3 text-[#0A0A0A]/60">
            <a href="#" className="hover:text-[#E30613] transition-colors"><Instagram size={18} /></a>
            <a href="#" className="hover:text-[#E30613] transition-colors"><Twitter size={18} /></a>
            <a href="#" className="hover:text-[#E30613] transition-colors"><Facebook size={18} /></a>
          </div>
        </div>

        {/* Store Locations Column */}
        <div className="space-y-4">
          <h4 className="font-mono uppercase tracking-widest text-xs font-black text-[#0A0A0A]/50">
            Store Locations
          </h4>
          <div className="space-y-3">
            {appConfig.footerLocations.map((loc) => (
              <div key={loc.city} className="border-l border-[#E5E5E5] pl-3 space-y-1">
                <p className="font-bold text-[#0A0A0A] uppercase">{loc.city}</p>
                <p className="text-[#0A0A0A]/70 text-[11px]">{loc.address}</p>
                {loc.phone ? (
                  <p className="text-[10px] text-[#0A0A0A]/40 font-mono">{loc.phone}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Helpful Resources Column (Dynamic Navigation Builder Menu) */}
        <div className="space-y-4">
          <h4 className="font-mono uppercase tracking-widest text-xs font-black text-[#0A0A0A]/50">
            Useful Links
          </h4>
          <ul className="space-y-2.5 font-medium text-xs text-[#0A0A0A]">
            {footerMenuItems.length > 0 ? (
              footerMenuItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleFooterLinkClick(item.url)}
                    className="hover:text-[#E30613] text-left transition-colors hover:underline flex items-center gap-2"
                  >
                    {renderNavIcon(item.icon, 13)}
                    <span>{item.name}</span>
                    {item.badgeText && (
                      <span className="bg-[#0A0A0A] text-white font-mono text-[8px] font-black px-1.5 py-0.2 rounded">
                        {item.badgeText}
                      </span>
                    )}
                  </button>
                </li>
              ))
            ) : (
              <>
                <li>
                  <button onClick={() => setCurrentPage('seller')} className="hover:text-[#E30613] text-left transition-colors hover:underline">
                    Sell Your Shirts (Submit Details)
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentPage('faq')} className="hover:text-[#E30613] text-left transition-colors hover:underline">
                    Frequently Asked Questions (FAQ)
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentPage('about')} className="hover:text-[#E30613] text-left transition-colors hover:underline">
                    About Epic Vanskap
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentPage('contact')} className="hover:text-[#E30613] text-left transition-colors hover:underline">
                    Contact Customer Care Desk
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>

        {/* Policy & Security Column */}
        <div className="space-y-4">
          <h4 className="font-mono uppercase tracking-widest text-xs font-black text-[#0A0A0A]/50">
            Policy & Security
          </h4>
          <ul className="space-y-2.5 font-medium text-[#0A0A0A]/70">
            <li>
              <button onClick={() => setCurrentPage('privacy')} className="hover:text-[#E30613] text-left transition-colors hover:underline">
                Privacy & Data Encryption Policy
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentPage('refund')} className="hover:text-[#E30613] text-left transition-colors hover:underline">
                Refunds & Return Guidelines
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentPage('terms')} className="hover:text-[#E30613] text-left transition-colors hover:underline">
                Terms of Service & Licensing
              </button>
            </li>
            <li>
              <button onClick={() => setCurrentPage('shipping')} className="hover:text-[#E30613] text-left transition-colors hover:underline">
                Shipping Rates & Customs Info
              </button>
            </li>
          </ul>
          <div className="pt-2 border-t border-[#E5E5E5] flex items-center gap-2 text-[10px] text-[#0A0A0A]/40 font-mono">
            <ShieldCheck size={14} />
            <span>SSL Secured checkout environment</span>
          </div>
        </div>

      </div>

      {/* Trademark Legal Bar */}
      <div className="bg-white py-6 border-t border-[#E5E5E5] text-center text-[10px] text-[#0A0A0A]/60 tracking-wider uppercase font-mono px-6">
        <p>{appConfig.footerCopyright}</p>
        <p className="mt-1 text-[#0A0A0A]/40">This platform has NO affiliation with Nike, Adidas, Umbro, or FIFA. All designs are completely original vectors.</p>
      </div>

    </footer>
  );
};
