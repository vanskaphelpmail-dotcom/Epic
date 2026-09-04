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

  const brandLine =
    [product.brand, product.category]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
      .join(' • ') || 'Jersey';

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
      className="group bg-[#121212] border border-zinc-800 hover:border-red-600 rounded-xl lg:rounded-2xl p-1.5 sm:p-2 lg:p-4 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-red-600/10 transition-all duration-300 relative flex flex-col h-full min-w-0"
      id={`product-card-${product.id}`}
      title={product.name}
    >
      <div className="min-w-0 flex flex-col flex-1">
        <div className="relative mb-1.5 sm:mb-2 lg:mb-3 w-full aspect-square shrink-0 overflow-hidden rounded-lg lg:rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
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
            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-20 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/80 shadow-md border border-zinc-700 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
            aria-pressed={isWishlisted}
            type="button"
          >
            <Heart
              size={16}
              strokeWidth={2.25}
              className={
                isWishlisted
                  ? 'fill-red-500 text-red-500 transition-colors'
                  : 'fill-transparent text-white transition-colors'
              }
            />
          </button>

          {product.isPreOrder && (
            <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-20 bg-red-600 text-white text-[8px] lg:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-md shadow-sm">
              Pre-Order
            </span>
          )}
        </div>

        <div className="hidden lg:flex flex-col gap-1 mb-0">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold truncate">
            {brandLine}
          </span>
          <h3 className="text-white text-sm font-black tracking-tight line-clamp-2 min-h-[2.5rem] group-hover:text-red-500 transition-colors text-left">
            {product.name}
          </h3>
        </div>
      </div>

      <div className="mt-auto pt-0 lg:mt-3 lg:pt-3 lg:border-t lg:border-zinc-800 shrink-0">
        <button
          onClick={handleSeeMore}
          type="button"
          className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-600 py-2 sm:py-2.5 lg:py-3 px-3 rounded-lg lg:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
          title="View product details"
          id={`see-more-${product.id}`}
        >
          <span>See More</span>
          <ArrowRight size={11} className="shrink-0" />
        </button>
      </div>
    </div>
  );
};
