import React from 'react';
import { isRenderableImageSrc, resolveJerseyStyleId } from '../lib/productImage';

interface JerseyRendererProps {
  productId: string;
  isBackView?: boolean;
  customName?: string;
  customNumber?: number;
  selectedSize?: string;
  showBadge?: boolean;
  uploadedImage?: string;
  /** Catalog image key (e.g. argentina_home_1990) when no remote upload exists */
  imageKey?: string;
}

export const JerseyRenderer: React.FC<JerseyRendererProps> = ({
  productId,
  isBackView = false,
  customName,
  customNumber,
  showBadge = false,
  uploadedImage,
  imageKey,
}) => {
  if (isRenderableImageSrc(uploadedImage)) {
    return (
      <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden">
        <img
          src={uploadedImage}
          alt="Custom Jersey"
          loading="lazy"
          decoding="async"
          className="max-w-full max-h-[180px] md:max-h-[220px] w-auto object-contain rounded-lg filter drop-shadow-lg"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  const styleId = resolveJerseyStyleId(productId, imageKey || uploadedImage);

  // Determine colours and styles based on productId / catalog image key
  let primaryColor = '#1d4ed8'; // Default blue
  let accentColor = '#ef4444'; // Red
  let detailsColor = '#ffffff'; // White
  let stripes: 'none' | 'argentina' | 'juventus' | 'redcurrant' = 'none';
  let sponsorText = '';
  let collarColor = '#ffffff';
  let sleeveColor = '';

  if (styleId === 'shirt-1') {
    // Spain 2026 World Cup Home
    primaryColor = '#c60b1e'; // Spanish red
    accentColor = '#fbbf24'; // Gold trim
    detailsColor = '#ffffff';
    collarColor = '#fbbf24';
  } else if (styleId === 'shirt-2') {
    // England 2004
    primaryColor = '#ffffff';
    accentColor = '#b91c1c'; // Red
    detailsColor = '#1e3a8a'; // Blue
    collarColor = '#1e3a8a';
    sleeveColor = '#ffffff';
  } else if (styleId === 'shirt-3') {
    // Argentina 1990
    primaryColor = '#7dd3fc'; // Sky blue
    accentColor = '#ffffff';
    stripes = 'argentina';
    collarColor = '#1e3a8a'; // Navy collar
  } else if (styleId === 'shirt-4') {
    // Brazil 2002 Away
    primaryColor = '#1d4ed8'; // Cobalt Blue
    accentColor = '#fbbf24'; // Yellow
    detailsColor = '#1e40af';
    collarColor = '#1d4ed8';
  } else if (styleId === 'shirt-5') {
    // Man United 1999
    primaryColor = '#b91c1c'; // Red
    accentColor = '#111827'; // Black
    detailsColor = '#ffffff'; // White
    collarColor = '#ffffff';
    sponsorText = 'SHARP';
  } else if (styleId === 'shirt-6') {
    // Juventus 2026-27
    primaryColor = '#ffffff';
    accentColor = '#000000';
    stripes = 'juventus';
    collarColor = '#000000';
    sponsorText = 'SAVE THE CHILDREN';
  } else if (styleId === 'shirt-8') {
    // Arsenal Highbury 2005
    primaryColor = '#581c2f'; // Deep redcurrant
    accentColor = '#fbbf24'; // Gold
    collarColor = '#fbbf24';
    stripes = 'redcurrant';
    sponsorText = 'O²';
  } else if (styleId === 'brazil-2002-home') {
    // Brazil 2002 Home
    primaryColor = '#eab308'; // Golden yellow
    accentColor = '#22c55e'; // Green
    detailsColor = '#22c55e';
    collarColor = '#22c55e';
    sleeveColor = '#eab308';
  } else if (styleId === 'bulgaria-1994-home') {
    // Bulgaria 1994 Home
    primaryColor = '#ffffff';
    accentColor = '#22c55e'; // Green
    detailsColor = '#dc2626'; // Red
    collarColor = '#16a34a'; // Green collar
    sleeveColor = '#ffffff';
  }

  // Draw Jersey
  return (
    <svg
      viewBox="0 0 200 240"
      className="w-full h-full max-w-[300px] mx-auto filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)] transition-all duration-500"
    >
      <defs>
        {/* Argentina Stripes */}
        {stripes === 'argentina' && (
          <pattern id="argStripes" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#ffffff" />
            <rect x="0" width="20" height="40" fill="#7dd3fc" />
          </pattern>
        )}
        {/* Juventus Stripes */}
        {stripes === 'juventus' && (
          <pattern id="juvStripes" width="30" height="40" patternUnits="userSpaceOnUse">
            <rect width="30" height="40" fill="#ffffff" />
            <rect x="0" width="15" height="40" fill="#111827" />
          </pattern>
        )}
        {/* Gold Gradient for Arsenal/Juventus elements */}
        <linearGradient id="goldMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Shirt Base Path */}
      <g>
        {/* Sleeves Left and Right */}
        <path
          d="M 50 60 L 10 90 L 30 120 L 55 90 Z"
          fill={sleeveColor || (stripes === 'argentina' ? '#7dd3fc' : stripes === 'juventus' ? '#111827' : primaryColor)}
          stroke="#e5e7eb"
          strokeWidth="0.5"
        />
        {/* Left Sleeve Trim */}
        <path d="M 10 90 L 30 120 L 25 125 L 5 95 Z" fill={accentColor} />

        <path
          d="M 150 60 L 190 90 L 170 120 L 145 90 Z"
          fill={sleeveColor || (stripes === 'argentina' ? '#7dd3fc' : stripes === 'juventus' ? '#111827' : primaryColor)}
          stroke="#e5e7eb"
          strokeWidth="0.5"
        />
        {/* Right Sleeve Trim */}
        <path d="M 190 90 L 170 120 L 175 125 L 195 95 Z" fill={accentColor} />

        {/* Main Body */}
        <path
          d="M 50 60 Q 100 70, 150 60 L 155 220 Q 100 230, 45 220 Z"
          fill={
            stripes === 'argentina'
              ? 'url(#argStripes)'
              : stripes === 'juventus'
              ? 'url(#juvStripes)'
              : primaryColor
          }
          stroke="#e5e7eb"
          strokeWidth="0.5"
        />

        {/* Spain 2026 gold chest band + navy detail */}
        {productId === 'shirt-1' && (
          <g>
            <rect x="49" y="108" width="102" height="6" fill="#fbbf24" opacity="0.9" />
            <rect x="49" y="118" width="102" height="3" fill="#1e3a8a" opacity="0.35" />
            <rect x="49" y="126" width="102" height="3" fill="#1e3a8a" opacity="0.25" />
          </g>
        )}

        {/* England Sleeve Stripe Details */}
        {productId === 'shirt-2' && (
          <g>
            <path d="M 50 60 L 51 95 L 54 95 L 53 60 Z" fill="#b91c1c" />
            <path d="M 150 60 L 149 95 L 146 95 L 147 60 Z" fill="#b91c1c" />
          </g>
        )}

        {/* Collar Design */}
        <path d="M 75 60 Q 100 85, 125 60 L 115 50 Q 100 70, 85 50 Z" fill={collarColor} />

        {/* Back View Name and Number */}
        {isBackView ? (
          <g>
            <text
              x="100"
              y="110"
              fill={
                productId === 'shirt-2' || productId === 'shirt-3' ? '#1e3a8a' :
                productId === 'brazil-2002-home' ? '#15803d' :
                productId === 'bulgaria-1994-home' ? '#dc2626' :
                productId === 'shirt-8' ? 'url(#goldMetallic)' : '#ffffff'
              }
              fontSize="14"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="1.5"
              textAnchor="middle"
            >
              {customName || (
                productId === 'shirt-1' ? 'YAMAL' :
                productId === 'shirt-2' ? 'BECKHAM' :
                productId === 'shirt-3' ? 'MARADONA' :
                productId === 'shirt-4' ? 'RONALDO' :
                productId === 'shirt-5' ? 'SOLSKJAER' :
                productId === 'shirt-6' ? 'YILDIZ' :
                productId === 'shirt-8' ? 'HENRY' :
                productId === 'brazil-2002-home' ? 'CAFU' :
                productId === 'bulgaria-1994-home' ? 'IANKOV' :
                'LEGEND'
              )}
            </text>
            <text
              x="100"
              y="175"
              fill={
                productId === 'shirt-2' || productId === 'shirt-3' ? '#1e3a8a' :
                productId === 'brazil-2002-home' ? '#15803d' :
                productId === 'bulgaria-1994-home' ? '#dc2626' :
                productId === 'shirt-8' ? 'url(#goldMetallic)' : '#ffffff'
              }
              fontSize="52"
              fontFamily="sans-serif"
              fontWeight="900"
              textAnchor="middle"
            >
              {customNumber !== undefined ? customNumber : (
                productId === 'shirt-1' ? '10' :
                productId === 'shirt-2' ? '7' :
                productId === 'shirt-3' ? '10' :
                productId === 'shirt-4' ? '9' :
                productId === 'shirt-5' ? '20' :
                productId === 'shirt-6' ? '10' :
                productId === 'shirt-8' ? '14' :
                productId === 'brazil-2002-home' ? '2' :
                productId === 'bulgaria-1994-home' ? '6' :
                '10'
              )}
            </text>
          </g>
        ) : (
          /* Front View: Crest, Brand Logo, Sponsor */
          <g>
            {/* National Team / Club Crest */}
            <circle
              cx="75"
              cy="95"
              r="7"
              fill={productId === 'shirt-3' ? 'url(#goldMetallic)' : productId === 'shirt-8' ? '#fbbf24' : '#ef4444'}
              stroke="#ffffff"
              strokeWidth="0.5"
            />
            {/* Tiny Crest Details */}
            <circle cx="75" cy="95" r="3" fill="#ffffff" />

            {/* Brand Logo */}
            {productId === 'shirt-1' || productId === 'shirt-3' || productId === 'shirt-6' ? (
              /* Adidas Three Stripes */
              <g transform="translate(120, 92) scale(0.6)">
                <path d="M 0 10 L 4 0 L 7 0 L 3 10 Z" fill={productId === 'shirt-3' ? '#1e3a8a' : '#ffffff'} />
                <path d="M 5 10 L 9 0 L 12 0 L 8 10 Z" fill={productId === 'shirt-3' ? '#1e3a8a' : '#ffffff'} />
                <path d="M 10 10 L 14 0 L 17 0 L 13 10 Z" fill={productId === 'shirt-3' ? '#1e3a8a' : '#ffffff'} />
              </g>
            ) : productId === 'shirt-2' || productId === 'shirt-5' ? (
              /* Umbro Double Diamond */
              <g transform="translate(120, 91) scale(0.6)">
                <path d="M 5 0 L 10 5 L 5 10 L 0 5 Z" fill="none" stroke={productId === 'shirt-2' ? '#1e3a8a' : '#ffffff'} strokeWidth="1.5" />
                <path d="M 5 2 L 8 5 L 5 8 L 2 5 Z" fill={productId === 'shirt-2' ? '#1e3a8a' : '#ffffff'} />
              </g>
            ) : (
              /* Nike Swoosh */
              <path
                d="M 120 93 Q 128 93, 134 88 Q 129 97, 120 96 Z"
                fill={productId === 'shirt-8' ? 'url(#goldMetallic)' : '#ffffff'}
              />
            )}

            {/* Front Small Number (for world cup jerseys) */}
            {(productId === 'shirt-1' || productId === 'shirt-2' || productId === 'shirt-4') && (
              <text
                x="100"
                y="115"
                fill={productId === 'shirt-2' ? '#1e3a8a' : '#ffffff'}
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
              >
                {productId === 'shirt-1' ? '10' : productId === 'shirt-2' ? '7' : '9'}
              </text>
            )}

            {/* Sponsor Logo */}
            {sponsorText && (
              <g>
                <rect x="65" y="130" width="70" height="14" fill="#111827" opacity="0.15" rx="2" />
                <text
                  x="100"
                  y="141"
                  fill={productId === 'shirt-8' ? 'url(#goldMetallic)' : '#ffffff'}
                  fontSize={sponsorText.length > 8 ? '7' : '10'}
                  fontWeight="900"
                  fontFamily="sans-serif"
                  letterSpacing="1"
                  textAnchor="middle"
                >
                  {sponsorText}
                </text>
              </g>
            )}

            {/* Tournament badge if requested */}
            {showBadge && (
              <g transform="translate(135, 115) scale(0.6)">
                <rect x="0" y="0" width="16" height="20" rx="2" fill="url(#goldMetallic)" />
                <text x="8" y="12" fill="#000000" fontSize="7" fontWeight="bold" textAnchor="middle">
                  WC
                </text>
              </g>
            )}
          </g>
        )}
      </g>
    </svg>
  );
};
