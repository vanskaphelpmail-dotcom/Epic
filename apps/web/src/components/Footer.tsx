import React from 'react';
import { ShieldCheck, HelpCircle, Phone, Globe, Instagram, Facebook, Shirt, Trophy, Star, Flame, Sparkles, Tag, Box, Award, ShoppingBag, Compass, Heart, MapPin } from 'lucide-react';
import { STORE_LOCATIONS } from '../data/storeData';
import { AppConfig } from '../types';
import { BrandMark } from './BrandMark';
import { BrandWordmark } from './BrandWordmark';

const DEFAULT_SOCIAL = {
  facebook: 'https://www.facebook.com/share/19N5mZgVt4/?mibextid=wwXIfr',
  instagram: 'https://www.instagram.com/retro._.walaa?stkn=ZXQwYzl1anF5eGR6',
  tiktok: 'https://www.tiktok.com/@epic_vanskap?_r=1&_t=ZS-99rOqRbSjx7',
};

/** Outline TikTok mark — stroke style to match Lucide Facebook / Instagram. */
const TikTokIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={className}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

interface FooterProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  appConfig: AppConfig;
  /** Less vertical padding (About page). */
  compact?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ currentPage, setCurrentPage, appConfig, compact = false }) => {
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
    .filter(
      (m) =>
        m.placement === 'Footer Menu' &&
        (m.status === 'Active' || m.status === 'active') &&
        !/seller|sell\s*your/i.test(`${m.url || ''} ${m.name || ''}`),
    )
    .sort((a, b) => a.order - b.order);

  return (
    <footer className="bg-[#F8F8F7] text-[#0A0A0A] border-t border-[#E5E5E5] w-full min-w-0 overflow-x-hidden">
      
      {/* Main Multi-Column Footer Grid */}
      <div
        className={`max-w-7xl mx-auto px-4 sm:px-6 md:px-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 text-xs ${
          compact
            ? 'py-6 sm:py-8 gap-6 sm:gap-8'
            : 'py-10 sm:py-16 gap-8 sm:gap-12'
        }`}
      >
        
        {/* Brand Information Column */}
        <div className="space-y-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setCurrentPage('home');
            }}
            className="flex items-center gap-3 no-underline text-inherit"
            aria-label="Epic Vanskap home"
          >
            <BrandMark tone="red" imgClassName="w-7 h-7" />
            <BrandWordmark text={appConfig.logoText || 'Epic Vanskap'} wordClassName="text-sm" />
          </a>
          <p className="text-[#0A0A0A]/70 leading-relaxed">
            {appConfig.footerAbout}
          </p>
          <div className="flex gap-3 text-[#0A0A0A]/60">
            {(() => {
              const links = {
                facebook: (appConfig.socialLinks?.facebook || DEFAULT_SOCIAL.facebook).trim(),
                instagram: (appConfig.socialLinks?.instagram || DEFAULT_SOCIAL.instagram).trim(),
                tiktok: (appConfig.socialLinks?.tiktok || DEFAULT_SOCIAL.tiktok).trim(),
              };
              const items: { key: string; href: string; label: string; icon: React.ReactNode }[] = [
                { key: 'facebook', href: links.facebook, label: 'Facebook', icon: <Facebook size={18} /> },
                { key: 'instagram', href: links.instagram, label: 'Instagram', icon: <Instagram size={18} /> },
                { key: 'tiktok', href: links.tiktok, label: 'TikTok', icon: <TikTokIcon size={18} /> },
              ];
              return items
                .filter((i) => i.href && i.href !== '#')
                .map((i) => (
                  <a
                    key={i.key}
                    href={i.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={i.label}
                    title={i.label}
                    className="hover:text-[#E30613] transition-colors"
                  >
                    {i.icon}
                  </a>
                ));
            })()}
          </div>
        </div>

        {/* Store Locations Column */}
        <div className="space-y-4">
          <h4 className="font-mono uppercase tracking-widest text-xs font-black text-[#0A0A0A]/50">
            Store Locations
          </h4>
          <div className="space-y-3">
            {appConfig.footerLocations.map((loc) => (
              <div key={`${loc.city}-${loc.address}`} className="border-l border-[#E5E5E5] pl-3 space-y-1">
                <p className="font-bold text-[#0A0A0A] uppercase">{loc.city}</p>
                <p className="text-[#0A0A0A]/70 text-[11px]">{loc.address}</p>
                {loc.phone ? (
                  <p className="text-[10px] text-[#0A0A0A]/40 font-mono">{loc.phone}</p>
                ) : null}
                {loc.email ? (
                  <p className="text-[10px] text-[#0A0A0A]/40 font-mono">{loc.email}</p>
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
      <div
        className={`bg-white border-t border-[#E5E5E5] text-center text-[10px] text-[#0A0A0A]/60 tracking-wider uppercase font-mono px-6 ${
          compact ? 'py-4' : 'py-6'
        }`}
      >
        <p>{appConfig.footerCopyright}</p>
        <p className="mt-1 text-[#0A0A0A]/40">This platform has NO affiliation with Nike, Adidas, Umbro, or FIFA. All designs are completely original vectors.</p>
      </div>

    </footer>
  );
};
