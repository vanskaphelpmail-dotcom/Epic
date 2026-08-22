import React from 'react';
import { Heart, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { JerseyRenderer } from './JerseyRenderer';
import { isRenderableImageSrc } from '../lib/productImage';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  isWishlisted: boolean;
  onQuickAdd?: (product: Product, size?: string, quantity?: number) => void;
  onCheckout?: (product: Product, size: string, quantity: number) => void;
  onUpdateImage?: (productId: string, base64: string) => void;
  formatPrice: (amount: number) => string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onToggleWishlist,
  isWishlisted,
}) => {
  const galleryImages = Array.from(
    new Set(
      [...(product.gallery || []), ...(product.images || []), product.uploadedImage, product.image].filter(
        (src): src is string => isRenderableImageSrc(src)
      )
    )
  ).slice(0, 3);

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWishlist(product);
  };

  const handleSeeMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(product);
  };

  return (
    <div
      onClick={() => onSelect(product)}
      className="group bg-white border border-zinc-200 hover:border-zinc-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col h-full min-w-0"
      id={`product-card-${product.id}`}
    >
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="relative mb-3.5 sm:mb-4 w-full aspect-square shrink-0 overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-50 ring-1 ring-zinc-100">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,rgba(0,0,0,0.03),transparent_62%)]" />

          {galleryImages[0] ? (
            <img
              src={galleryImages[0]}
              alt={product.name}
              className="absolute inset-0 h-full w-full object-cover object-center select-none"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 overflow-hidden [&_img]:!max-h-none [&_img]:!h-full [&_img]:!w-full [&_img]:!object-cover [&_img]:!rounded-none [&_img]:!drop-shadow-none [&_svg]:h-full [&_svg]:w-full">
              <JerseyRenderer
                productId={product.id}
                uploadedImage={product.uploadedImage}
                imageKey={product.image}
              />
            </div>
          )}

          <button
            onClick={handleWishlist}
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white shadow-md border border-zinc-100 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
            aria-pressed={isWishlisted}
            type="button"
          >
            <Heart
              size={18}
              strokeWidth={2.25}
              className={
                isWishlisted
                  ? 'fill-red-500 text-red-500 transition-colors'
                  : 'fill-transparent text-neutral-800 transition-colors'
              }
            />
          </button>

          {product.isPreOrder && (
            <span className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-20 bg-red-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              Pre-Order
            </span>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
            {[product.brand, product.category]
              .map((v) => String(v || '').trim())
              .filter(Boolean)
              .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
              .join(' • ') || 'Jersey'}
          </span>
          <h3 className="text-zinc-950 text-sm font-black tracking-tight line-clamp-2 group-hover:text-black transition-colors text-left">
            {product.name}
          </h3>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-zinc-100">
        <button
          onClick={handleSeeMore}
          type="button"
          className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-700 py-2.5 sm:py-3 px-3 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
          title="View product details"
          id={`see-more-${product.id}`}
        >
          <span>See More</span>
          <ArrowRight size={12} className="shrink-0" />
        </button>
      </div>
    </div>
  );
};
