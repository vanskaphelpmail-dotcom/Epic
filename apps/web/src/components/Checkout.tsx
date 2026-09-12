import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, Truck, ClipboardCheck, AlertCircle, MapPin, ShoppingBag, Trash2, Info, Check } from 'lucide-react';
import { CartItem, Order, AppConfig, User as UserType } from '../types';
import { BkashPaymentPanel, BKASH_DEFAULT_NUMBER, BKASH_PARTIAL_DEFAULT_BDT, type MobileWalletProvider } from './BkashPaymentPanel';
import {
  buildBkashPaymentMeta,
  withBkashNote,
  cartRequiresFullBkashPayment,
  cartJerseyCount,
  calcPartialAdvanceBdt,
  formatPartialAdvanceBreakdown,
} from '../lib/bkashPayment';
import { api, isApiEnabled } from '../lib/apiClient';
import { mapApiOrderToSpa } from '../lib/mapOrder';
import { getProductSizes, getSizeStock, isSizeAvailable } from '../lib/productSizes';
import { isRenderableImageSrc } from '../lib/productImage';
import { JerseyRenderer } from './JerseyRenderer';

const isInsideFeniDistrict = (district: string) =>
  district.trim().toLowerCase() === 'feni';

interface CheckoutProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onOrderSuccess: (order: Order) => void;
  onBackToCart: () => void;
  onBackToCatalog: () => void;
  formatPrice: (amount: number) => string;
  appConfig: AppConfig;
  currentUser?: UserType | null;
}

export const Checkout: React.FC<CheckoutProps> = ({
  cart,
  setCart,
  onOrderSuccess,
  onBackToCart,
  onBackToCatalog,
  formatPrice,
  appConfig,
  currentUser = null,
}) => {
  type SavedProfileAddress = {
    fullName: string;
    phone: string;
    email?: string;
    addressLine1: string;
    city: string;
    postalCode?: string;
  };

  // Form fields always start blank — user types or clicks “Fill from profile”
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [savedProfile, setSavedProfile] = useState<SavedProfileAddress | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Delivery: Inside Feni 70 · Outside Feni 120 (driven by district)
  const [deliveryRegion, setDeliveryRegion] = useState<'inside' | 'outside'>('inside');

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [bkashNumber, setBkashNumber] = useState('');
  const [bkashTransactionId, setBkashTransactionId] = useState('');
  /** Admin setting = advance per jersey (default 300). */
  const partialPerJerseyBdt = appConfig.bkashPartialAmountBdt ?? BKASH_PARTIAL_DEFAULT_BDT;
  /** Nameset / jersey name printing forces full bKash only. */
  const requiresFullBkashForNameset = cartRequiresFullBkashPayment(cart);
  /** Always offer Full + Partial for jerseys; hide Partial when nameset is on. */
  const showPayTypeChoice = !requiresFullBkashForNameset;
  const [bkashPayChoice, setBkashPayChoice] = useState<'full' | 'partial'>('partial');
  const [walletProvider, setWalletProvider] = useState<MobileWalletProvider>('bkash');
  const merchantBkash = appConfig.bkashPersonalNumber || BKASH_DEFAULT_NUMBER;
  const bkashEnabled = appConfig.bkashEnabled !== false;
  const walletPaymentLabel = walletProvider === 'nagad' ? 'Nagad' : 'bKash';
  const walletPaymentMethodApi = walletProvider === 'nagad' ? 'nagad' : 'bkash';

  const preOrderItems = cart.filter((item) => item.product.isPreOrder);
  const hasPreOrder = preOrderItems.length > 0;
  const buildPreOrderNotes = () => {
    if (!hasPreOrder) return undefined;
    const lines = preOrderItems.map((item) => {
      const eta = item.product.preOrderEta ? ` (ETA: ${item.product.preOrderEta})` : '';
      return `${item.product.name}${eta}`;
    });
    return `PRE-ORDER: ${lines.join('; ')}`;
  };

  const applyDistrict = (district: string) => {
    setCity(district);
    const trimmed = district.trim();
    if (!trimmed) return;
    setDeliveryRegion(isInsideFeniDistrict(trimmed) ? 'inside' : 'outside');
  };

  const fillFromProfile = () => {
    if (!savedProfile) return;
    setFullName(savedProfile.fullName || '');
    setPhone(savedProfile.phone || '');
    setEmail(savedProfile.email || '');
    setAddressLine1(savedProfile.addressLine1 || '');
    setPostalCode(
      savedProfile.postalCode && savedProfile.postalCode !== 'N/A' ? savedProfile.postalCode : '',
    );
    if (savedProfile.city) applyDistrict(savedProfile.city);
  };

  // Load saved signup/profile address as a suggestion only (do not auto-fill inputs)
  useEffect(() => {
    if (!isApiEnabled() || !currentUser) {
      setProfileLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.listAddresses();
        const items = data?.items || [];
        if (cancelled) return;
        const primary = items.find((a: { isDefault?: boolean }) => a.isDefault) || items[0];
        if (primary) {
          setSavedProfile({
            fullName: primary.fullName || currentUser.fullName || '',
            phone: primary.phone || currentUser.phone || '',
            email: primary.email || currentUser.email || '',
            addressLine1: primary.addressLine1 || '',
            city: primary.city || '',
            postalCode: primary.postalCode || '',
          });
        } else {
          setSavedProfile(null);
        }
      } catch {
        setSavedProfile(null);
      } finally {
        if (!cancelled) setProfileLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryChargeBDT = deliveryRegion === 'inside' ? 70 : 120;
  const shipCityLabel = city.trim() || (deliveryRegion === 'inside' ? 'Feni' : 'Outside Feni');
  const grandTotal = subtotal + deliveryChargeBDT;
  const jerseyCount = cartJerseyCount(cart);
  const partialAdvanceBdt = calcPartialAdvanceBdt(jerseyCount, partialPerJerseyBdt, grandTotal);
  const partialAdvanceBreakdown = formatPartialAdvanceBreakdown(
    jerseyCount,
    partialPerJerseyBdt,
    partialAdvanceBdt,
  );

  const effectiveBkashPayChoice: 'full' | 'partial' = requiresFullBkashForNameset
    ? 'full'
    : bkashPayChoice;
  const isPartialBkash = effectiveBkashPayChoice === 'partial';
  const bkashSendAmountBdt = isPartialBkash ? partialAdvanceBdt : grandTotal;
  const bkashDueOnDelivery = isPartialBkash
    ? Math.max(0, grandTotal - bkashSendAmountBdt)
    : 0;

  // Nameset / jersey name → full payment only
  useEffect(() => {
    if (requiresFullBkashForNameset && bkashPayChoice !== 'full') {
      setBkashPayChoice('full');
    }
  }, [requiresFullBkashForNameset, bkashPayChoice]);

  // Empty cart UI (after hooks so Rules of Hooks stay valid)
  if (cart.length === 0) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-6 bg-white border-2 border-[#E5E5E5] p-8 rounded-3xl text-[#0A0A0A] shadow-lg animate-fadeIn">
        <div className="w-16 h-16 bg-[#F8F8F7] rounded-full flex items-center justify-center mx-auto text-[#555555] border border-[#E5E5E5]">
          <ShoppingBag size={28} />
        </div>
        <h3 className="text-xl font-black uppercase tracking-tight text-[#0A0A0A]">Your Order Bag is Empty</h3>
        <p className="text-xs text-[#555555] font-mono">You do not have any vintage shirts in your checkout session. Return to the catalog to select legendary items.</p>
        <button
          onClick={onBackToCatalog}
          type="button"
          className="w-full bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-sm uppercase tracking-wide py-3.5 rounded-xl transition-all cursor-pointer"
        >
          Go to Home
        </button>
      </div>
    );
  }

  const buildBkashPayNote = (extra?: string) => {
    const meta = buildBkashPaymentMeta(
      effectiveBkashPayChoice,
      bkashSendAmountBdt,
      grandTotal,
    );
    const pre = buildPreOrderNotes();
    return withBkashNote(
      [pre, extra].filter(Boolean).join(' | ') || undefined,
      meta,
    );
  };

  const attachBkashFields = (order: Order): Order => ({
    ...order,
    bkashPaymentType: effectiveBkashPayChoice,
    bkashPaidAmount: bkashSendAmountBdt,
    customerNotes: order.customerNotes || buildBkashPayNote(),
    paymentStatus: 'Unpaid',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlacingOrder) return;
    if (!fullName || !addressLine1 || !phone || !city.trim()) {
      alert('Please fill out name, address, district, and phone for delivery.');
      return;
    }

    if (phone.length < 10) {
      alert('Please enter a valid active phone number.');
      return;
    }

    if (!bkashNumber || bkashNumber.replace(/\D/g, '').length < 11) {
      alert('অনুগ্রহ করে যে মোবাইল নম্বর থেকে Send Money করেছেন সেটি লিখুন।');
      return;
    }
    if (!bkashTransactionId || bkashTransactionId.trim().length < 6) {
      alert(`অনুগ্রহ করে আপনার ${walletPaymentLabel} ট্রানজ্যাকশন আইডি (TrxID) লিখুন।`);
      return;
    }

    setIsPlacingOrder(true);
    try {
    if (isApiEnabled()) {
      try {
        const created = await api.createOrder({
          paymentMethod: walletPaymentMethodApi,
          deliveryRegion,
          deliveryCharge: deliveryChargeBDT,
          shipFullName: fullName,
          shipPhone: phone,
          shipEmail: email || undefined,
          shipAddressLine1: addressLine1,
          shipCity: shipCityLabel,
          shipPostalCode: postalCode || 'N/A',
          bkashNumber,
          bkashTransactionId: bkashTransactionId.trim(),
          bkashPaymentType: effectiveBkashPayChoice,
          customerNotes: buildPreOrderNotes(),
          items: cart.map((item) => ({
            productId: item.product.id,
            selectedSize: item.selectedSize,
            quantity: item.quantity,
            customPrintName: item.customPrint?.name,
            customPrintNum: item.customPrint?.number,
            namesetEnabled: Boolean(item.namesetEnabled || item.customPrint),
            addBadge: item.addBadge,
            selectedBadgeIds: item.selectedBadges?.length ? item.selectedBadges.join(',') : '',
          })),
        });
        let placedOrder: Order;
        try {
          placedOrder = attachBkashFields(mapApiOrderToSpa(created, cart));
        } catch (mapErr) {
          console.error('Failed to map order response', mapErr);
          placedOrder = attachBkashFields({
            id: created?.orderNumber || created?.id || `ORD-${Date.now()}`,
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            createdAt: new Date().toISOString(),
            deliveryRegion,
            deliveryCharge: deliveryChargeBDT,
            items: [...cart],
            subtotal,
            tax: 0,
            shipping: deliveryChargeBDT,
            total: grandTotal,
            status: 'Pending',
            trackingNumber: created?.orderNumber || created?.id,
            shippingAddress: {
              fullName,
              email: email || undefined,
              addressLine1,
              city: shipCityLabel,
              postalCode: postalCode || 'N/A',
              country: 'Bangladesh',
              phone,
            },
            paymentMethod: walletPaymentLabel,
            paymentStatus: 'Unpaid',
            bkashNumber,
            bkashTransactionId: bkashTransactionId.trim(),
          });
        }
        onOrderSuccess(placedOrder);
        try {
          await api.clearCart();
        } catch {
          /* cart clear is best-effort */
        }
        return;
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
        return;
      }
    }

    const trackingID = `CFJ-BK-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: Order = attachBkashFields({
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      createdAt: new Date().toISOString(),
      deliveryRegion,
      deliveryCharge: deliveryChargeBDT,
      items: [...cart],
      subtotal,
      tax: 0,
      shipping: deliveryChargeBDT,
      total: grandTotal,
      status: 'Pending',
      trackingNumber: trackingID,
      shippingAddress: {
        fullName,
        email: email || undefined,
        addressLine1,
        city: shipCityLabel,
        postalCode: postalCode || 'N/A',
        country: 'Bangladesh',
        phone,
      },
      paymentMethod: walletPaymentLabel,
      paymentStatus: 'Unpaid',
      bkashNumber,
      bkashTransactionId: bkashTransactionId.trim(),
      customerNotes: buildBkashPayNote(),
    });

    onOrderSuccess(newOrder);
    setCart([]);
    } catch (err) {
      console.error('Checkout submit failed', err);
      alert(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <section className="bg-transparent text-[#0A0A0A] py-8 px-4 md:px-12 max-w-7xl mx-auto min-h-screen">
      
      {/* Navigation Back Link */}
      <button
        onClick={onBackToCart}
        className="inline-flex items-center gap-2 text-[10px] md:text-xs font-mono font-bold tracking-wider text-[#555555] hover:text-[#0A0A0A] uppercase mb-6 cursor-pointer transition-all"
        id="checkout-back-to-cart"
      >
        <ArrowLeft size={14} /> Back to Cart
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form & Options */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6" autoComplete="off">
          
          {/* Header Title */}
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-[#0A0A0A] font-display">
              Complete Your Order
            </h1>
            <p className="text-xs text-[#555555] font-mono font-medium">
              {isPartialBkash
                ? `Fill in delivery details, then send ${bkashSendAmountBdt} advance via bKash Send Money and submit your TrxID. Pay the rest on delivery.`
                : `Fill in delivery details, then send the full order amount (${grandTotal.toLocaleString('en-BD')}) via bKash Send Money and submit your TrxID.`}
            </p>
          </div>

          {hasPreOrder && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex gap-3 items-start text-amber-950">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-wider">Pre-Order Items in Your Bag</p>
                <p className="text-[11px] font-mono leading-relaxed">
                  This order includes pre-order product(s). They will ship when stock arrives
                  {preOrderItems.some((i) => i.product.preOrderEta)
                    ? ` (${preOrderItems
                        .filter((i) => i.product.preOrderEta)
                        .map((i) => i.product.preOrderEta)
                        .join(', ')})`
                    : ''}
                  . Your order will be tagged as Pre-Order for our team.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Personal Contact Details */}
          <div className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-4 md:p-6 space-y-4 shadow-xl text-[#0A0A0A]">
            <h3 className="text-xs md:text-sm font-mono font-black text-[#0A0A0A] uppercase tracking-widest border-b-2 border-[#E5E5E5] pb-2.5 flex items-center gap-2">
              <ClipboardCheck size={16} className="text-[#555555]" /> 1. Contact Information
            </h3>

            {profileLoaded && savedProfile && (
              <div className="rounded-xl border border-[#E5E5E5] bg-[#F8F8F7] p-3 space-y-2">
                <p className="text-[11px] text-[#555555] font-medium leading-relaxed">
                  Fields stay empty until you type or fill from your saved profile address.
                  Change the saved address anytime in your account profile.
                </p>
                <div className="text-[10px] text-[#555555] font-mono leading-relaxed line-clamp-2">
                  {[savedProfile.fullName, savedProfile.phone, savedProfile.addressLine1, savedProfile.city]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <button
                  type="button"
                  onClick={fillFromProfile}
                  className="w-full sm:w-auto bg-[#0A0A0A] hover:bg-black border border-[#0A0A0A] text-white text-[11px] font-black uppercase tracking-wider px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Fill from profile
                </button>
              </div>
            )}
            {profileLoaded && !savedProfile && (
              <p className="text-[11px] text-[#555555] font-medium leading-relaxed">
                No saved address yet. Enter details below, or save an address in your profile for next time.
              </p>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#0A0A0A] font-mono font-black block tracking-wider">RECIPIENT FULL NAME *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yasin Ahmed"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#F8F8F7] border-2 border-[#E5E5E5] focus:border-[#E30613] focus:bg-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none transition-colors text-[#0A0A0A] placeholder:text-[#555555]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-[#0A0A0A] font-mono font-black block tracking-wider">MOBILE PHONE NUMBER *</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 01840990700"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#F8F8F7] border-2 border-[#E5E5E5] focus:border-[#E30613] focus:bg-white rounded-xl py-3 px-4 text-xs focus:outline-none transition-colors font-mono font-bold text-[#0A0A0A] placeholder:text-[#555555]"
                  />
                </div>
                <span className="text-[10px] text-[#555555] font-mono block font-medium">We will call this number before delivery to verify.</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] text-[#0A0A0A] font-mono font-black block tracking-wider">EMAIL ADDRESS (OPTIONAL)</label>
              <input
                type="email"
                placeholder="e.g. collector@vault.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F8F8F7] border-2 border-[#E5E5E5] focus:border-[#E30613] focus:bg-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none transition-colors text-[#0A0A0A] placeholder:text-[#555555]"
              />
            </div>
          </div>

          {/* Section 2: Delivery Address Details */}
          <div className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-4 md:p-6 space-y-4 shadow-xl text-[#0A0A0A]">
            <h3 className="text-xs md:text-sm font-mono font-black text-[#0A0A0A] uppercase tracking-widest border-b-2 border-[#E5E5E5] pb-2.5 flex items-center gap-2">
              <MapPin size={16} className="text-[#555555]" /> 2. Delivery Address
            </h3>

            <p className="text-[11px] text-[#555555] font-medium leading-relaxed">
              Leave blank and type for this order, or use Fill from profile above. Edit your permanent address in Profile anytime.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] text-[#0A0A0A] font-mono font-black block tracking-wider">FULL DETAILED ADDRESS (House, Flat, Road, Area) *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Flat 4B, House 12, Road 5, Feni Sadar"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full bg-[#F8F8F7] border-2 border-[#E5E5E5] focus:border-[#E30613] focus:bg-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none transition-colors resize-none leading-relaxed text-[#0A0A0A] placeholder:text-[#555555]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#0A0A0A] font-mono font-black block tracking-wider">DISTRICT *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Feni"
                  value={city}
                  onChange={(e) => applyDistrict(e.target.value)}
                  className="w-full bg-[#F8F8F7] border-2 border-[#E5E5E5] focus:border-[#E30613] focus:bg-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none transition-colors text-[#0A0A0A] placeholder:text-[#555555]"
                />
                <span className="text-[10px] text-[#555555] font-mono block font-medium">
                  Type <span className="text-[#0A0A0A] font-bold">Feni</span> for 70 · any other district 120
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-[#0A0A0A] font-mono font-black block tracking-wider">POSTAL CODE (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. 3900"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full bg-[#F8F8F7] border-2 border-[#E5E5E5] focus:border-[#E30613] focus:bg-white rounded-xl py-3 px-4 text-xs focus:outline-none transition-colors font-mono font-bold text-[#0A0A0A] placeholder:text-[#555555]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Localization Shipping Cost Selection */}
          <div className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-4 md:p-6 space-y-4 shadow-xl text-[#0A0A0A]">
            <h3 className="text-xs md:text-sm font-mono font-black text-[#0A0A0A] uppercase tracking-widest border-b-2 border-[#E5E5E5] pb-2.5 flex items-center gap-2">
              <Truck size={16} className="text-[#555555]" /> 3. Select Delivery Area
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => {
                  setDeliveryRegion('inside');
                  if (!isInsideFeniDistrict(city)) setCity('Feni');
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${
                  deliveryRegion === 'inside'
                    ? 'bg-red-50 border-[#E30613] text-[#0A0A0A] shadow-lg ring-1 ring-[#E30613]/40'
                    : 'bg-[#F8F8F7] border-[#E5E5E5] text-[#555555] hover:border-[#E5E5E5]'
                }`}
                id="shipping-inside-feni"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        deliveryRegion === 'inside' ? 'border-[#E30613]' : 'border-[#E5E5E5]'
                      }`}
                    >
                      {deliveryRegion === 'inside' && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                    </span>
                    <p className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]">Inside Feni</p>
                  </div>
                  <p className="text-[10px] text-[#555555] font-medium leading-normal">
                    Cash on delivery / local delivery within Feni district (24–48 hours).
                  </p>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                  <span className="text-sm font-mono font-black text-[#0A0A0A]">70</span>
                  <p className="text-[9px] text-[#555555] font-mono font-bold">fee</p>
                </div>
              </div>

              <div
                onClick={() => {
                  setDeliveryRegion('outside');
                  if (isInsideFeniDistrict(city)) setCity('');
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${
                  deliveryRegion === 'outside'
                    ? 'bg-red-50 border-[#E30613] text-[#0A0A0A] shadow-lg ring-1 ring-[#E30613]/40'
                    : 'bg-[#F8F8F7] border-[#E5E5E5] text-[#555555] hover:border-[#E5E5E5]'
                }`}
                id="shipping-outside-feni"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        deliveryRegion === 'outside' ? 'border-[#E30613]' : 'border-[#E5E5E5]'
                      }`}
                    >
                      {deliveryRegion === 'outside' && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                    </span>
                    <p className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]">Outside Feni</p>
                  </div>
                  <p className="text-[10px] text-[#555555] font-medium leading-normal">
                    Courier to all other districts across Bangladesh (2–4 days).
                  </p>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                  <span className="text-sm font-mono font-black text-[#0A0A0A]">120</span>
                  <p className="text-[9px] text-[#555555] font-mono font-bold">fee</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Payment method */}
          <div className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-4 md:p-6 space-y-4 shadow-xl text-[#0A0A0A]">
            <h3 className="text-xs md:text-sm font-mono font-black text-[#0A0A0A] uppercase tracking-widest border-b-2 border-[#E5E5E5] pb-2.5 flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#555555]" /> 4. Payment Method
            </h3>

            <div className="space-y-3">
              {bkashEnabled && (
                <>
                  {requiresFullBkashForNameset && (
                    <p className="text-[11px] font-mono text-[#0A0A0A] bg-[#F8F8F7] border border-[#E5E5E5] rounded-lg px-3 py-2">
                      Custom font selected — <strong>full bKash payment</strong> required.
                      Per-jersey advance ({partialPerJerseyBdt} × qty) is not available for this order.
                    </p>
                  )}

                  {showPayTypeChoice && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#555555]">
                        পেমেন্ট টাইপ নির্বাচন করুন · Choose payment type
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setBkashPayChoice('full')}
                          className={`text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                            effectiveBkashPayChoice === 'full'
                              ? 'border-[#E30613] bg-red-50 shadow-md ring-2 ring-[#E30613]/40'
                              : 'border-[#E5E5E5] bg-[#F8F8F7] hover:border-[#E5E5E5]'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                effectiveBkashPayChoice === 'full' ? 'border-[#E30613]' : 'border-[#E5E5E5]'
                              }`}
                            >
                              {effectiveBkashPayChoice === 'full' && (
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                              )}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]">
                              Full Pay · পূর্ণ পেমেন্ট
                            </span>
                            {effectiveBkashPayChoice === 'full' && (
                              <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-[#E30613] bg-red-50 border border-[#E30613] px-1.5 py-0.5 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#555555] font-medium pl-6">
                            bKash Send Money — full order:{' '}
                            <span className="font-mono font-black text-[#0A0A0A]">{formatPrice(grandTotal)}</span>
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBkashPayChoice('partial')}
                          className={`text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                            effectiveBkashPayChoice === 'partial'
                              ? 'border-[#E30613] bg-red-50 shadow-md ring-2 ring-[#E30613]/40'
                              : 'border-[#E5E5E5] bg-[#F8F8F7] hover:border-[#E5E5E5]'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                effectiveBkashPayChoice === 'partial' ? 'border-[#E30613]' : 'border-[#E5E5E5]'
                              }`}
                            >
                              {effectiveBkashPayChoice === 'partial' && (
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                              )}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-[#0A0A0A]">
                              Partial Pay · আংশিক এডভান্স
                            </span>
                            {effectiveBkashPayChoice === 'partial' && (
                              <span className="ml-auto text-[9px] font-black uppercase tracking-wider text-[#E30613] bg-red-50 border border-[#E30613] px-1.5 py-0.5 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#555555] font-medium pl-6">
                            Pay <span className="font-mono font-black text-[#0A0A0A]">{partialAdvanceBdt}</span> now
                            <span className="text-[#555555]"> ({partialAdvanceBreakdown})</span>
                            {' — '}rest{' '}
                            <span className="font-mono font-black text-[#0A0A0A]">{formatPrice(bkashDueOnDelivery)}</span> on delivery
                          </p>
                        </button>
                      </div>
                    </div>
                  )}

                  <BkashPaymentPanel
                    selected
                    onSelect={() => {}}
                    personalNumber={merchantBkash}
                    sendMoneyAmountBdt={bkashSendAmountBdt}
                    isPartialPayment={isPartialBkash}
                    dueOnDeliveryBdt={bkashDueOnDelivery}
                    partialBreakdownLabel={isPartialBkash ? partialAdvanceBreakdown : undefined}
                    customerBkashNumber={bkashNumber}
                    transactionId={bkashTransactionId}
                    onCustomerBkashNumberChange={setBkashNumber}
                    onTransactionIdChange={setBkashTransactionId}
                    walletProvider={walletProvider}
                    onWalletProviderChange={setWalletProvider}
                  />
                </>
              )}
            </div>
          </div>

          {/* Place Order CTA Button */}
          <button
            type="submit"
            disabled={isPlacingOrder}
            className="w-full bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-xs md:text-sm uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-wait disabled:active:scale-100"
            id="checkout-submit-btn"
          >
            <ShieldCheck size={16} />{' '}
            {isPlacingOrder
              ? 'Placing order…'
              : isPartialBkash
                ? `Place bKash Order (Advance ${bkashSendAmountBdt})`
                : `Place bKash Order (${formatPrice(grandTotal)})`}
          </button>

        </form>

        {/* Right Column: Mini Sticky Order Summary */}
        <div className="lg:col-span-4 bg-white border-2 border-[#E5E5E5] rounded-2xl p-4 md:p-6 space-y-5 sticky top-28 text-[#0A0A0A] shadow-xl">
          <h4 className="text-xs font-mono font-black text-[#0A0A0A] uppercase tracking-widest border-b-2 border-[#E5E5E5] pb-2.5 flex items-center justify-between">
            <span>Order Summary</span>
            <span className="bg-[#0A0A0A] text-white text-[9px] px-2.5 py-0.5 rounded-full font-mono font-black">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
            </span>
          </h4>

          {/* Items Checklist */}
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
            {cart.map((item, idx) => {
              const sizes = getProductSizes(item.product);
              const maxForSize = getSizeStock(item.product, item.selectedSize);

              return (
                <div key={idx} className="bg-[#F8F8F7] border-2 border-[#E5E5E5] rounded-xl p-3 space-y-3 shadow-xs relative group">
                  <div className="flex gap-3 text-xs">
                    {/* Image */}
                    <div className="w-12 h-12 bg-white border-2 border-[#0A0A0A] ring-2 ring-[#0A0A0A]/10 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 relative shadow-sm">
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
                      <span
                        className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[#0A0A0A] text-white border border-white"
                        aria-label="Selected for checkout"
                        title="Selected"
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="font-extrabold text-[#0A0A0A] truncate leading-tight" title={item.product.name}>{item.product.name}</p>
                      <p className="text-[10px] font-mono text-[#555555] mt-1 font-bold">Unit: {formatPrice(item.product.price)}</p>
                    </div>

                    {/* Delete Icon */}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = cart.filter((_, i) => i !== idx);
                        setCart(updated);
                      }}
                      className="absolute top-2.5 right-2.5 p-1 text-[#555555] hover:text-[#E30613] hover:bg-red-50 rounded-md transition-all cursor-pointer"
                      title="Remove Item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Size and Qty Controls Row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E5E5] text-xs">
                    {/* Size Selector */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-[#555555] font-black uppercase">Size:</span>
                      <select
                        value={item.selectedSize}
                        onChange={(e) => {
                          const newSize = e.target.value;
                          const max = getSizeStock(item.product, newSize);
                          setCart(prev => prev.map((itemVal, i) => i === idx ? {
                            ...itemVal,
                            selectedSize: newSize,
                            quantity: Math.min(itemVal.quantity, Math.max(1, max || 1)),
                          } : itemVal));
                        }}
                        className="bg-white border-2 border-[#E5E5E5] text-[#0A0A0A] text-[11px] font-bold rounded-lg px-2 py-0.5 focus:outline-none focus:border-[#E30613] cursor-pointer"
                      >
                        {sizes.map(size => (
                          <option key={size} value={size} disabled={!isSizeAvailable(item.product, size)}>
                            {size}{!isSizeAvailable(item.product, size) ? ' (OOS)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Selector with increment and decrement buttons */}
                    <div className="flex items-center gap-1 bg-[#F8F8F7] rounded-lg p-0.5 border border-[#E5E5E5]">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.quantity > 1) {
                            setCart(prev => prev.map((itemVal, i) => i === idx ? { ...itemVal, quantity: itemVal.quantity - 1 } : itemVal));
                          } else {
                            // If quantity is 1, decrement deletes the item
                            const updated = cart.filter((_, i) => i !== idx);
                            setCart(updated);
                          }
                        }}
                        className="w-5 h-5 flex items-center justify-center text-[#555555] hover:text-[#0A0A0A] font-black bg-white rounded shadow-xs cursor-pointer text-xs"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-mono font-black text-[#0A0A0A] text-xs">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const max = maxForSize || 0;
                          setCart(prev => prev.map((itemVal, i) =>
                            i === idx
                              ? { ...itemVal, quantity: Math.min(max, itemVal.quantity + 1) }
                              : itemVal
                          ));
                        }}
                        disabled={item.quantity >= maxForSize}
                        className="w-5 h-5 flex items-center justify-center text-[#555555] hover:text-[#0A0A0A] font-black bg-white rounded shadow-xs cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Subtotal per item */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#555555] pt-1 font-bold">
                    <span>Subtotal:</span>
                    <span className="font-extrabold text-[#0A0A0A]">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals Section — mirrors bKash Full / Partial choice live */}
          <div className="space-y-2.5 text-xs text-[#0A0A0A] border-t-2 border-[#E5E5E5] pt-4 font-medium">
            <div className="flex justify-between items-center">
              <span>Items Subtotal:</span>
              <span className="text-[#0A0A0A] font-mono font-extrabold">{formatPrice(subtotal)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Delivery Charge ({deliveryRegion === 'inside' ? 'Inside Feni' : 'Outside Feni'}):</span>
              <span className="text-[#0A0A0A] font-extrabold font-mono">{deliveryChargeBDT}</span>
            </div>

            <div className="border-t-2 border-[#E5E5E5] pt-3 flex justify-between items-baseline">
              <span className="text-[#0A0A0A] font-black uppercase text-[10px] tracking-wider">
                Order Total
              </span>
              <span className="text-[#0A0A0A] font-black text-lg font-mono">{formatPrice(grandTotal)}</span>
            </div>

            {bkashEnabled && (
              <div
                className={`rounded-xl border-2 p-3 space-y-2 transition-all ${
                  isPartialBkash
                    ? 'border-[#E30613] bg-[#F8F8F7]'
                    : 'border-[#E5E5E5] bg-[#F8F8F7]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#555555]">
                    {isPartialBkash ? 'Partial Pay · আংশিক এডভান্স' : 'Full Pay · পূর্ণ পেমেন্ট'}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      isPartialBkash
                        ? 'bg-[#E30613] text-white'
                        : 'bg-[#F8F8F7] text-[#0A0A0A] border border-[#E5E5E5]'
                    }`}
                  >
                    {walletPaymentLabel}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#555555]">
                    {isPartialBkash
                      ? `Pay now (${walletPaymentLabel} advance):`
                      : `Pay now (${walletPaymentLabel} Send Money):`}
                  </span>
                  <span className="text-[#0A0A0A] font-black font-mono text-base">
                    {formatPrice(bkashSendAmountBdt)}
                  </span>
                </div>

                {isPartialBkash && (
                  <>
                    <div className="flex justify-between items-center text-[10px] text-[#555555]">
                      <span>Advance rate:</span>
                      <span className="font-mono font-bold text-[#0A0A0A]">{partialAdvanceBreakdown}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#555555] font-medium">Due on delivery:</span>
                      <span className="text-[#0A0A0A] font-black font-mono">
                        {formatPrice(bkashDueOnDelivery)}
                      </span>
                    </div>
                  </>
                )}

                <p className="text-[10px] text-[#555555] font-medium leading-snug pt-1 border-t border-[#E5E5E5]">
                  {isPartialBkash
                    ? `Send ${Math.round(bkashSendAmountBdt).toLocaleString('en-BD')} now (${partialAdvanceBreakdown}) — remaining ${Math.round(bkashDueOnDelivery).toLocaleString('en-BD')} collected when your order arrives.`
                    : `Send the full ${formatPrice(grandTotal)} via ${walletPaymentLabel} Send Money to complete this order.`}
                </p>
              </div>
            )}

            <div className="border-t-2 border-[#E5E5E5] pt-4 flex justify-between items-baseline">
              <span className="text-[#0A0A0A] font-black uppercase text-[10px] tracking-wider">
                {isPartialBkash ? `Due via ${walletPaymentLabel} now:` : 'Grand Total to Pay:'}
              </span>
              <span
                className={`font-black text-xl font-mono ${
                  isPartialBkash ? 'text-[#E30613]' : 'text-[#0A0A0A]'
                }`}
              >
                {formatPrice(bkashSendAmountBdt)}
              </span>
            </div>
          </div>

          {/* Delivery Note */}
          <div className="bg-[#F8F8F7] border-2 border-[#E5E5E5] p-4 rounded-xl text-[10px] text-[#555555] flex gap-2.5">
            <Info size={14} className="text-[#555555] flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed font-semibold">
              Every package is chemically sanitized and sealed inside historical vacuum-sealed cases with certificates of origin. Sourced for real fans.
            </p>
          </div>
        </div>

      </div>

    </section>
  );
};
