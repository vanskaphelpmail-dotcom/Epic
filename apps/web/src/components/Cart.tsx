import React from 'react';
import { Trash2, Plus, Minus, ArrowRight, ShoppingCart, CreditCard, Check } from 'lucide-react';
import { CartItem } from '../types';
import { getSelectedBadgeLabels } from '../lib/productAddons';
import { JerseyRenderer } from './JerseyRenderer';
import { getProductImageSrc } from '../lib/productImage';

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

  if (cart.length === 0) {
    return (
      <section className="max-w-4xl mx-auto px-6 py-16 text-center text-[#0A0A0A] space-y-6">
        <div className="w-20 h-20 bg-[#F8F8F7] border border-[#E5E5E5] rounded-full flex items-center justify-center mx-auto text-[#555555] shadow-xl">
          <ShoppingCart size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tight">Your Jersey Bag is Empty</h1>
          <p className="text-[#555555] text-sm max-w-md mx-auto leading-relaxed">
            There are currently no vintage items inside your bag. Explore our historical collections and secure a piece of football legacy today.
          </p>
        </div>
        <button
          onClick={onBackToCatalog}
          type="button"
          className="inline-flex items-center justify-center gap-2 bg-[#0A0A0A] hover:bg-black text-white font-black text-sm uppercase tracking-wide px-8 py-3.5 rounded-xl cursor-pointer transition-all shadow-lg shadow-black/20"
        >
          Go to Home
        </button>
      </section>
    );
  }

  return (
    <section className="bg-transparent text-[#0A0A0A] py-10 px-4 md:px-12 max-w-7xl mx-auto min-h-screen">
      
      <div className="flex justify-between items-end border-b border-[#E5E5E5] pb-4 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-[#0A0A0A]">Shopping Bag</h1>
        </div>
        <button
          onClick={onBackToCatalog}
          type="button"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F8F8F7] border border-[#E5E5E5] text-[#0A0A0A] hover:border-[#E30613] hover:bg-[#F8F8F7] text-xs sm:text-sm font-black uppercase tracking-wide cursor-pointer transition-colors"
        >
          Go to Home
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        {/* Left Col: Cart Items list */}
        <div className="lg:col-span-8 space-y-4">
          {/* List of items */}
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div
                key={index}
                className="bg-white border border-[#E5E5E5] rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between"
              >
                {/* Product Detail Thumbnail and Info */}
                <div className="flex gap-4 items-center">
                  <div className="w-20 h-20 bg-white rounded-xl p-1.5 flex items-center justify-center border-2 border-[#0A0A0A] ring-2 ring-[#0A0A0A]/10 relative flex-shrink-0 overflow-hidden shadow-sm">
                    <JerseyRenderer
                      productId={item.product.id}
                      uploadedImage={getProductImageSrc(item.product)}
                      imageKey={item.product.image}
                    />
                    <span
                      className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0A0A] text-white shadow-sm"
                      aria-label="Selected for checkout"
                      title="Selected"
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase text-[#555555] font-black">
                      {item.product.brand} • {item.product.season}
                    </span>
                    <h3 className="text-sm font-bold tracking-tight text-[#0A0A0A] hover:text-[#555555] cursor-pointer">
                      {item.product.name}
                    </h3>
                    
                    {/* Display customization details */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="bg-[#F8F8F7] text-[#555555] text-[10px] font-mono px-2 py-0.5 rounded">
                        Size: {item.selectedSize}
                      </span>
                      {item.customPrint?.name && (
                        <span className="bg-[#F8F8F7] text-[#555555] text-[10px] font-mono px-2 py-0.5 rounded border border-[#E5E5E5]">
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
                            className="bg-[#F8F8F7] text-[#555555] text-[10px] font-mono px-2 py-0.5 rounded border border-[#E5E5E5]"
                          >
                            + {label}{custom ? `: ${custom}` : ''}
                          </span>
                        );
                      })}
                      {!item.selectedBadges?.length && item.addBadge && (
                        <span className="bg-[#F8F8F7] text-[#555555] text-[10px] font-mono px-2 py-0.5 rounded border border-[#E5E5E5]">
                          + Tournament Patch
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
                            className="bg-[#F8F8F7] text-[#555555] text-[10px] font-mono px-2 py-0.5 rounded border border-[#E5E5E5]"
                          >
                            + Patch: {text}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Pricing, Quantity adjustment, and Delete */}
                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                  
                  {/* Quantity adjustment */}
                  <div className="flex items-center gap-1.5 bg-[#F8F8F7] border border-[#E5E5E5] p-1.5 rounded-full text-[#0A0A0A]">
                    <button
                      onClick={() => updateQuantity(index, -1)}
                      className="p-1 bg-white hover:bg-[#F8F8F7] text-[#555555] rounded-full transition-all"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="text-xs font-mono font-bold px-2">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(index, 1)}
                      className="p-1 bg-white hover:bg-[#F8F8F7] text-[#555555] rounded-full transition-all"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <p className="text-sm font-black text-[#555555]">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                    <p className="text-[10px] text-[#555555] font-mono">
                      {formatPrice(item.product.price)} each
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(index)}
                    className="p-2 text-[#555555] hover:text-[#E30613] hover:bg-red-50 rounded-full transition-all cursor-pointer"
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
          <div className="bg-[#F8F8F7] border border-[#E5E5E5] rounded-2xl p-6 space-y-4">
            <h4 className="text-xs font-mono font-black text-[#555555] uppercase tracking-widest border-b border-[#E5E5E5] pb-2">
              Order Pricing Summary
            </h4>
            <div className="space-y-2.5 text-xs text-[#555555]">
              <div className="flex justify-between">
                <span>Original Subtotal:</span>
                <span className="text-[#0A0A0A] font-mono">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Curated Sourced Shipping:</span>
                <span className="text-[#0A0A0A] font-mono">
                  {shippingCost === 0 ? <span className="text-[#555555] font-bold uppercase">FREE</span> : formatPrice(shippingCost)}
                </span>
              </div>
              <div className="border-t border-[#E5E5E5] pt-3 flex justify-between items-end text-sm">
                <span className="text-[#0A0A0A] font-bold">Estimated Grand Total:</span>
                <span className="text-[#555555] font-black text-xl font-mono">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="w-full bg-[#0A0A0A] hover:bg-black text-white font-black text-xs uppercase tracking-widest py-4 rounded-full flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/20 transition-all"
              id="proceed-to-checkout-btn"
            >
              Proceed to Secure Checkout <ArrowRight size={15} />
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-[#555555] font-mono pt-2">
              <CreditCard size={12} className="text-[#555555]" />
              <span>Checkout processes are 256-bit encrypted</span>
            </div>
          </div>

        </div>

      </div>

    </section>
  );
};
