import React, { useState, useEffect } from 'react';
import { JerseyRenderer } from './JerseyRenderer';
import { ArrowRight, Trophy, Sparkles, X, CheckCircle, Clock, ShoppingCart } from 'lucide-react';
import { Product } from '../types';
import { STANDARD_PRODUCT_SIZES } from '../lib/productSizes';

interface AuctionItem {
  id: string;
  title: string;
  productId: string;
  type: 'MATCH WORN' | 'MATCH ISSUE';
  tags: string[];
  currentBid: number; // Used as price
  player: { name: string; number: number };
}

const DEFAULT_AUCTION_ITEMS: AuctionItem[] = [
  {
    id: 'heritage-beckham-2006',
    title: '2006 England Match Worn World Cup Home L/S Shirt Beckham #7',
    productId: 'shirt-2',
    type: 'MATCH WORN',
    tags: ['🏆 FIFA Man of the Match', '⚽ 2 Assists'],
    currentBid: 7750,
    player: { name: 'BECKHAM', number: 7 }
  },
  {
    id: 'heritage-yamal-2026',
    title: '2026 Spain Match Issue World Cup Home Shirt L. Yamal #10',
    productId: 'shirt-1',
    type: 'MATCH ISSUE',
    tags: ['🛡️ World Cup 2026 Starter', '🇪🇸 La Roja Nameset'],
    currentBid: 4100,
    player: { name: 'YAMAL', number: 10 }
  },
  {
    id: 'heritage-cafu-2002',
    title: '2002 Brazil Match Issue World Cup Home Shirt Cafu #2',
    productId: 'brazil-2002-home',
    type: 'MATCH ISSUE',
    tags: ['🏆 Pentacampeão Campaign', '⚡ Right Flank Dominance'],
    currentBid: 1650,
    player: { name: 'CAFU', number: 2 }
  },
  {
    id: 'heritage-iankov-1994',
    title: '1994 Bulgaria Match Worn World Cup Home Shirt Iankov #6',
    productId: 'bulgaria-1994-home',
    type: 'MATCH WORN',
    tags: ['⭐ Golden Generation Star', '🦁 USA 94 Semifinalist'],
    currentBid: 2200,
    player: { name: 'IANKOV', number: 6 }
  }
];

interface BiddingSectionProps {
  onAddToCart?: (item: any) => void;
  setCurrentPage?: (page: string) => void;
  formatPrice?: (amount: number) => string;
}

export const BiddingSection: React.FC<BiddingSectionProps> = ({ onAddToCart, setCurrentPage, formatPrice }) => {
  // Master countdown timer (2 days, 20 hours, 5 minutes, 55 seconds initially)
  const [timer, setTimer] = useState({
    days: 2,
    hours: 20,
    minutes: 5,
    seconds: 55
  });

  // Ticking effect for the master countdown timer
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
          return { days: 2, hours: 20, minutes: 5, seconds: 55 }; // loop
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Modal / Success feedback state
  const [addedItem, setAddedItem] = useState<AuctionItem | null>(null);

  // Size and Quantity state for the 4 auction items
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleAddToCartClick = (item: AuctionItem) => {
    if (onAddToCart) {
      const currentSize = selectedSizes[item.id] || 'L';
      const currentQty = quantities[item.id] || 1;

      // Map item to a Product
      const productObj: Product = {
        id: item.id,
        name: item.title,
        slug: item.id,
        price: item.currentBid, // This is the price of the item
        image: item.productId,
        images: [item.productId],
        brand: item.id.includes('beckham') ? 'Umbro' : item.id.includes('blanc') ? 'Adidas' : item.id.includes('cafu') ? 'Nike' : 'Adidas',
        season: item.id.includes('beckham') ? '2006' : item.id.includes('blanc') ? '1998' : item.id.includes('cafu') ? '2002' : '1994',
        year: item.id.includes('beckham') ? 2006 : item.id.includes('blanc') ? 1998 : item.id.includes('cafu') ? 2002 : 1994,
        condition: 'Excellent',
        conditionDetail: `${item.type} shirt with official museum certification of authenticity.`,
        player: { name: item.player.name, number: item.player.number },
        color: item.id.includes('beckham') ? 'White' : item.id.includes('blanc') ? 'Blue' : item.id.includes('cafu') ? 'Yellow' : 'White',
        sizes: [currentSize], // Selected size
        sku: `HERITAGE-${item.player.name}-${item.player.number}`,
        badgeAvailable: false,
        printAvailable: false,
        rating: 5.0,
        reviewsCount: 1,
        description: `Museum grade original vintage match shirt. ${item.tags.join(', ')}. Perfect physical structure and official nameset printing on reverse.`,
        specification: {
          material: '100% Polyester / Authentic Player Spec',
          madeIn: 'Varies',
          fit: `Player Fit (Size ${currentSize})`
        },
        category: 'World Cup',
        stock: 1
      };

      onAddToCart({
        product: productObj,
        selectedSize: `${currentSize} (Player Spec)`,
        quantity: currentQty
      });

      // Open beautiful success dialog with correct subtotal price representation
      setAddedItem({
        ...item,
        currentBid: item.currentBid * currentQty
      });
    }
  };

  const handleCheckoutClick = (item: AuctionItem) => {
    if (onAddToCart && setCurrentPage) {
      const currentSize = selectedSizes[item.id] || 'L';
      const currentQty = quantities[item.id] || 1;

      // Map item to a Product
      const productObj: Product = {
        id: item.id,
        name: item.title,
        slug: item.id,
        price: item.currentBid, // This is the price of the item
        image: item.productId,
        images: [item.productId],
        brand: item.id.includes('beckham') ? 'Umbro' : item.id.includes('blanc') ? 'Adidas' : item.id.includes('cafu') ? 'Nike' : 'Adidas',
        season: item.id.includes('beckham') ? '2006' : item.id.includes('blanc') ? '1998' : item.id.includes('cafu') ? '2002' : '1994',
        year: item.id.includes('beckham') ? 2006 : item.id.includes('blanc') ? 1998 : item.id.includes('cafu') ? 2002 : 1994,
        condition: 'Excellent',
        conditionDetail: `${item.type} shirt with official museum certification of authenticity.`,
        player: { name: item.player.name, number: item.player.number },
        color: item.id.includes('beckham') ? 'White' : item.id.includes('blanc') ? 'Blue' : item.id.includes('cafu') ? 'Yellow' : 'White',
        sizes: [currentSize], // Selected size
        sku: `HERITAGE-${item.player.name}-${item.player.number}`,
        badgeAvailable: false,
        printAvailable: false,
        rating: 5.0,
        reviewsCount: 1,
        description: `Museum grade original vintage match shirt. ${item.tags.join(', ')}. Perfect physical structure and official nameset printing on reverse.`,
        specification: {
          material: '100% Polyester / Authentic Player Spec',
          madeIn: 'Varies',
          fit: `Player Fit (Size ${currentSize})`
        },
        category: 'World Cup',
        stock: 1
      };

      onAddToCart({
        product: productObj,
        selectedSize: `${currentSize} (Player Spec)`,
        quantity: currentQty
      });

      setCurrentPage('checkout');
    }
  };

  const formatCurrency = (val: number) => {
    if (formatPrice) {
      return formatPrice(val);
    }
    return '৳' + val.toLocaleString();
  };

  const pad = (num: number) => String(num).padStart(2, '0');

  return (
    <div id="heritage-bidding-section" className="w-full space-y-8 max-w-7xl mx-auto px-6 md:px-12 py-6">
      
      {/* 1. AUCTION HERO BANNER */}
      <section 
        className="relative rounded-3xl overflow-hidden bg-cover bg-center min-h-[280px] md:min-h-[320px] flex items-center shadow-lg transition-all border border-emerald-100"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.85)), url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1600')`
        }}
      >
        <div className="w-full px-8 md:px-12 py-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 text-white z-10">
          
          {/* Banner Details (Left) */}
          <div className="space-y-3.5 max-w-2xl text-left">
            <span className="inline-block bg-emerald-700/60 backdrop-blur-sm border border-emerald-500/20 text-white font-mono font-black text-[9px] md:text-[10px] tracking-widest uppercase px-3 py-1 rounded-full">
              Epic Vanskap BD
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight uppercase font-sans text-white">
              Club Jersey Heritage, Live from Fanatics Fest
            </h1>
            <p className="text-amber-300 font-bold text-xs sm:text-sm tracking-wide">
              Where glory awaits.
            </p>
            <p className="text-gray-200 text-xs md:text-[13px] leading-relaxed max-w-xl font-medium">
              Match-worn and match-issue shirts from football's greatest clubs, each one of one and impossible to replace. Just 10 are now available for immediate acquisition. Secure a piece of Club Jersey history today.
            </p>
          </div>

          {/* Live Countdown widget card (Right) */}
          <div className="w-full md:w-auto bg-black/75 backdrop-blur-md border border-white/15 p-6 rounded-2xl flex flex-col items-start md:items-center gap-2 text-left md:text-center shrink-0 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-amber-500 font-mono">
                LIMITED DROP
              </span>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              EXCLUSIVE Epic Vanskap BD DROP CLOSES IN
            </p>
            <div className="font-mono text-xl sm:text-2xl font-black text-white tracking-wider flex items-center gap-1 mt-1">
              <span>{timer.days}d</span>
              <span className="text-gray-500">:</span>
              <span>{pad(timer.hours)}h</span>
              <span className="text-gray-500">:</span>
              <span>{pad(timer.minutes)}m</span>
              <span className="text-gray-500">:</span>
              <span className="text-amber-400">{pad(timer.seconds)}s</span>
            </div>
          </div>

        </div>
      </section>

      {/* 2. THE 4 HERITAGE ITEMS GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {DEFAULT_AUCTION_ITEMS.map((item) => (
          <div 
            key={item.id} 
            className="group bg-white border border-emerald-100 hover:border-emerald-300 rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md relative overflow-hidden"
          >
            
            {/* Jersey visual container */}
            <div className="bg-emerald-50/20 rounded-2xl p-4 h-[240px] flex items-center justify-center relative border border-emerald-50/10 mb-4 group-hover:bg-emerald-50/45 transition-colors">
              <div className="w-full h-full max-h-[190px]">
                <JerseyRenderer 
                  productId={item.productId} 
                  isBackView={true} 
                  customName={item.player.name}
                  customNumber={item.player.number}
                />
              </div>
            </div>

            {/* Details & Acquisition Information */}
            <div className="space-y-3 flex-grow flex flex-col justify-between">
              
              <div className="space-y-1.5">
                <h3 className="text-emerald-950 font-extrabold text-[13px] leading-snug tracking-tight text-left min-h-[40px] group-hover:text-emerald-700 transition-colors">
                  {item.title}
                </h3>
                <div className="flex justify-between items-center border-t border-emerald-50/50 pt-3">
                  <span className="text-[10px] text-emerald-700/60 font-mono font-bold uppercase tracking-wider">In Stock</span>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-950 font-mono tracking-tight">
                      {formatCurrency(item.currentBid * (quantities[item.id] || 1))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sizing & Quantity selection options */}
              <div className="space-y-3 pt-2.5 border-t border-emerald-100">
                {/* Size Selection */}
                <div className="space-y-1 text-left">
                  <span className="text-[9px] font-bold text-emerald-700/60 uppercase tracking-widest font-mono">SELECT SIZE</span>
                  <div className="flex gap-1 flex-wrap">
                    {[...STANDARD_PRODUCT_SIZES.filter((s) => s !== 'XS')].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSizes(prev => ({ ...prev, [item.id]: size }));
                        }}
                        className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all border flex items-center justify-center cursor-pointer ${
                          (selectedSizes[item.id] || 'L') === size
                            ? 'bg-emerald-800 border-emerald-800 text-white shadow-sm'
                            : 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 text-emerald-900'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="flex items-center justify-between text-left">
                  <span className="text-[9px] font-bold text-emerald-700/60 uppercase tracking-widest font-mono">QUANTITY</span>
                  <div className="flex items-center border border-emerald-100 rounded-lg overflow-hidden bg-emerald-50/30">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuantities(prev => ({ ...prev, [item.id]: Math.max(1, (prev[item.id] || 1) - 1) }));
                      }}
                      className="px-2.5 py-1 text-xs font-black text-emerald-800 hover:bg-emerald-100/80 transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3 text-xs font-black font-mono text-emerald-950">{quantities[item.id] || 1}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuantities(prev => ({ ...prev, [item.id]: (prev[item.id] || 1) + 1 }));
                      }}
                      className="px-2.5 py-1 text-xs font-black text-emerald-800 hover:bg-emerald-100/80 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => handleAddToCartClick(item)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer font-sans"
                  title="Add to shopping bag"
                >
                  <ShoppingCart size={11} />
                  <span>ADD TO BAG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckoutClick(item)}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-800 py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer font-sans shadow-md shadow-emerald-900/10"
                  title="Checkout directly"
                >
                  <span>CHECK OUT</span>
                </button>
              </div>

            </div>

          </div>
        ))}
      </section>

      {/* 3. SUCCESS NOTIFICATION MODAL */}
      {addedItem && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full border border-emerald-100 overflow-hidden shadow-2xl relative p-8 text-center space-y-6 animate-scaleUp">
            
            {/* Modal Close Button */}
            <button 
              type="button"
              onClick={() => setAddedItem(null)}
              className="absolute top-5 right-5 p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-full transition-all cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-850 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle size={32} className="text-emerald-800" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-widest">
                HERITAGE SECURED
              </span>
              <h3 className="text-xl font-black text-emerald-950 uppercase tracking-tight">
                Added to Your Bag
              </h3>
              <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                The certified 1-of-1 <strong>{addedItem.title}</strong> has been successfully added to your shopping bag.
              </p>
            </div>

            {/* Small Jersey Preview inside success modal */}
            <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-100/30 flex items-center gap-4 text-left">
              <div className="w-16 h-16 shrink-0 bg-white rounded-xl p-1 border border-emerald-100/50">
                <JerseyRenderer 
                  productId={addedItem.productId} 
                  isBackView={true} 
                  customName={addedItem.player.name}
                  customNumber={addedItem.player.number}
                />
              </div>
              <div className="space-y-0.5 overflow-hidden">
                <p className="text-xs font-black text-emerald-950 truncate">{addedItem.title}</p>
                <p className="text-[10px] font-mono text-emerald-700 font-bold">{addedItem.type} • SIZE L (PLAYER SPEC)</p>
                <p className="text-sm font-bold text-emerald-950 font-mono">{formatCurrency(addedItem.currentBid)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => setAddedItem(null)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs uppercase py-3.5 rounded-full transition-all cursor-pointer"
              >
                Keep Browsing
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddedItem(null);
                  if (setCurrentPage) {
                    setCurrentPage('cart');
                  }
                }}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-full transition-all cursor-pointer"
              >
                Go to Bag
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
