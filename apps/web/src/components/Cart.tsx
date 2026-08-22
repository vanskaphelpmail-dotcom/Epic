import React from 'react';
import { Trash2, Plus, Minus, ArrowRight, ShoppingCart, CreditCard } from 'lucide-react';
import { CartItem } from '../types';
import { getSelectedBadgeLabels } from '../lib/productAddons';
import { JerseyRenderer } from './JerseyRenderer';
import { isRenderableImageSrc } from '../lib/productImage';

interface CartProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onCheckout: () => void;
  onBackToCatalog: () => void;
  formatPrice: (amount: number) => string;
}

export const Cart: React.FC<CartProps> = ({ cart, setCart, onCheckout, onBackToCatalog, formatPrice }) => {
  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      copy[index] = { ...copy[index], quantity: newQty };
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Coupons disabled — pricing is subtotal + shipping only
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingCost = subtotal >= 150 || subtotal === 0 ? 0 : 15;
  const grandTotal = subtotal + shippingCost;

  const isEligibleForFreeShipping = subtotal >= 150;
  const progressToFreeShipping = Math.min(100, Math.round((subtotal / 150) * 100));

  if (cart.length === 0) {
    return (
      <section className="max-w-4xl mx-auto px-6 py-16 text-center text-zinc-950 space-y-6">
        <div className="w-20 h-20 bg-zinc-50 border border-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-700 shadow-xl">
          <ShoppingCart size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tight">Your Jersey Bag is Empty</h1>
          <p className="text-zinc-800 text-sm max-w-md mx-auto leading-relaxed">
            There are currently no vintage items inside your bag. Explore our historical collections and secure a piece of football legacy today.
          </p>
        </div>
        <button
          onClick={onBackToCatalog}
          className="bg-black hover:bg-zinc-700 text-white font-extrabold text-xs uppercase tracking-widest px-8 py-3.5 rounded-full cursor-pointer transition-all shadow-lg shadow-black/10"
        >
          Browse Our Collections
        </button>
      </section>
    );
  }

  return (
    <section className="bg-white text-zinc-950 py-10 px-4 md:px-12 max-w-7xl mx-auto min-h-screen">
      
      <div className="flex justify-between items-end border-b border-zinc-100 pb-4 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-950">Shopping Bag</h1>
          <p className="text-xs text-zinc-600 font-mono">
            {cart.length} unique item{cart.length > 1 ? 's' : ''} • Checked & sanitized
          </p>
        </div>
        <button
          onClick={onBackToCatalog}
          className="text-xs text-zinc-700 hover:text-black font-mono font-semibold uppercase cursor-pointer"
        >
          + Continue Shopping
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* Left Col: Cart Items list */}
        <div className="lg:col-span-8 space-y-4">
          {/* Free Shipping Tracker */}
          <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl space-y-2 text-xs">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-zinc-900">
                {isEligibleForFreeShipping
                  ? '✓ Congratulations! You qualify for Free Premium Sourced Shipping.'
                  : `Add ${formatPrice(150 - subtotal)} more to unlock Free Premium Sourced Shipping`}
              </span>
              <span className="text-zinc-800 font-mono">{progressToFreeShipping}%</span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-zinc-800 to-zinc-900 h-full transition-all duration-500"
                style={{ width: `${progressToFreeShipping}%` }}
              />
            </div>
          </div>

          {/* List of items */}
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div
                key={index}
                className="bg-white border border-zinc-100 rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between"
              >
                {/* Product Detail Thumbnail and Info */}
                <div className="flex gap-4 items-center">
                  <div className="w-20 h-20 bg-zinc-50 rounded-xl p-1.5 flex items-center justify-center border border-zinc-100 relative flex-shrink-0 overflow-hidden">
                    <JerseyRenderer
                      productId={item.product.id}
                      uploadedImage={
                        [
                          item.product.uploadedImage,
                          ...(item.product.gallery || []),
                          ...(item.product.images || []),
                          item.product.image,
                        ].find(isRenderableImageSrc)
                      }
                      imageKey={item.product.image}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase text-zinc-700 font-black">
                      {item.product.brand} • {item.product.season}
                    </span>
                    <h3 className="text-sm font-bold tracking-tight text-zinc-950 hover:text-zinc-700 cursor-pointer">
                      {item.product.name}
                    </h3>
                    
                    {/* Display customization details */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="bg-zinc-100 text-zinc-800 text-[10px] font-mono px-2 py-0.5 rounded">
                        Size: {item.selectedSize}
                      </span>
                      {item.customPrint?.name && (
                        <span className="bg-zinc-50 text-zinc-700 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-100">
                          Print: {item.customPrint.name} #{item.customPrint.number}
                        </span>
                      )}
                      {getSelectedBadgeLabels(item.product, item.selectedBadges || []).map((label) => {
                        const badgeId = (item.selectedBadges || []).find((id) => {
                          const opts = item.product.badgeOptions || [];
                          return opts.some((o) => o.id === id && o.label === label) || id === label;
                        });
                        const custom = badgeId ? item.badgeTexts?.[badgeId] : undefined;
                        return (
                          <span
                            key={label}
                            className="bg-zinc-50 text-zinc-700 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-100"
                          >
                            + {label}{custom ? `: ${custom}` : ''}
                          </span>
                        );
                      })}
                      {!item.selectedBadges?.length && item.addBadge && (
                        <span className="bg-zinc-50 text-zinc-700 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-100">
                          + Sleeve Badge
                        </span>
                      )}
                      {(item.selectedBadges || []).map((id) => {
                        const text = item.badgeTexts?.[id];
                        if (!text) return null;
                        const alreadyShown = getSelectedBadgeLabels(item.product, [id]).length > 0;
                        if (alreadyShown) return null;
                        return (
                          <span
                            key={`text-${id}`}
                            className="bg-zinc-50 text-zinc-700 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-100"
                          >
                            + Badge: {text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Pricing, Quantity adjustment, and Delete */}
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                  
                  {/* Quantity adjustment */}
                  <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 p-1.5 rounded-full text-zinc-950">
                    <button
                      onClick={() => updateQuantity(index, -1)}
                      className="p-1 bg-white hover:bg-zinc-100 text-zinc-800 rounded-full transition-all"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="text-xs font-mono font-bold px-2">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(index, 1)}
                      className="p-1 bg-white hover:bg-zinc-100 text-zinc-800 rounded-full transition-all"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <p className="text-sm font-black text-zinc-800">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono">
                      {formatPrice(item.product.price)} each
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(index)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                    aria-label="Delete Item"
                  >
                    <Trash2 size={16} />
                  </button>

                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Checkout Order summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6 space-y-4">
            <h4 className="text-xs font-mono font-black text-zinc-800 uppercase tracking-widest border-b border-zinc-100 pb-2">
              Order Pricing Summary
            </h4>
            <div className="space-y-2.5 text-xs text-zinc-800">
              <div className="flex justify-between">
                <span>Original Subtotal:</span>
                <span className="text-zinc-950 font-mono">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Curated Sourced Shipping:</span>
                <span className="text-zinc-950 font-mono">
                  {shippingCost === 0 ? <span className="text-zinc-700 font-bold uppercase">FREE</span> : formatPrice(shippingCost)}
                </span>
              </div>
              <div className="border-t border-zinc-100 pt-3 flex justify-between items-end text-sm">
                <span className="text-zinc-900 font-bold">Estimated Grand Total:</span>
                <span className="text-zinc-800 font-black text-xl font-mono">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="w-full bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-800 hover:to-zinc-900 text-white font-black text-xs uppercase tracking-widest py-4 rounded-full flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/10 transition-all"
              id="proceed-to-checkout-btn"
            >
              Proceed to Secure Checkout <ArrowRight size={15} />
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 font-mono pt-2">
              <CreditCard size={12} className="text-zinc-700" />
              <span>Checkout processes are 256-bit encrypted</span>
            </div>
          </div>

        </div>

      </div>

    </section>
  );
};
