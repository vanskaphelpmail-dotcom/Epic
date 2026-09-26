import React, { useState } from 'react';
import { Heart, User, MapPin, Award, Search, ShoppingBag, ShieldCheck, ClipboardList, Trash2, Edit, Plus, Check, Home, Briefcase } from 'lucide-react';
import { Product, Order } from '../types';
import { api, getToken, isApiEnabled } from '../lib/apiClient';

interface CustomerDashboardProps {
  orders: Order[];
  wishlist: Product[];
  onRemoveWishlist: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  setCurrentPage: (page: string) => void;
  formatPrice?: (amount: number) => string;
  currentUserEmail?: string;
  currentUserPhone?: string;
  onProfileUpdated?: (user: { fullName: string; email: string; phone?: string }) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  orders,
  wishlist,
  onRemoveWishlist,
  onSelectProduct,
  setCurrentPage,
  formatPrice,
  currentUserEmail,
  currentUserPhone,
  onProfileUpdated,
}) => {
  const displayPrice = formatPrice || ((amount: number) => `৳${Math.round(Number(amount) || 0).toLocaleString('en-BD')}`);
  // Tabs: 'profile' | 'orders' | 'wishlist' | 'addresses'
  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'profile' | 'addresses'>(
    currentUserEmail ? 'orders' : 'wishlist',
  );

  // Profile data state
  const [fullName, setFullName] = useState(() => {
    const storedUser = localStorage.getItem('vault_current_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        return u.fullName || '';
      } catch (e) {}
    }
    return '';
  });
  const [email, setEmail] = useState(() => currentUserEmail || (() => {
    const storedUser = localStorage.getItem('vault_current_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        return u.email || '';
      } catch (e) {}
    }
    return '';
  })());
  const [phone, setPhone] = useState(() => currentUserPhone || (() => {
    const storedUser = localStorage.getItem('vault_current_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        return u.phone || '';
      } catch (e) {}
    }
    return '';
  })());
  const [profileBusy, setProfileBusy] = useState(false);

  // Dynamic Saved Addresses — empty until hydrated from Neon (no fake demo addresses)
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isApiEnabled() || !getToken()) {
        const stored = localStorage.getItem('vault_shipping_addresses');
        if (stored) {
          try {
            if (!cancelled) setAddresses(JSON.parse(stored));
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setAddressesLoaded(true);
        return;
      }
      try {
        const { items } = await api.listAddresses();
        if (!cancelled) setAddresses(items || []);
      } catch {
        if (!cancelled) setAddresses([]);
      } finally {
        if (!cancelled) setAddressesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!isApiEnabled() || !getToken()) {
      localStorage.setItem('vault_shipping_addresses', JSON.stringify(addresses));
    }
  }, [addresses]);

  // Form edit / add state
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null); // null means adding a new address

  // Form field states
  const [formLabel, setFormLabel] = useState<'Home' | 'Office' | 'Visitor'>('Home');
  const [formFullName, setFormFullName] = useState('');
  const [formAddressLine1, setFormAddressLine1] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPostalCode, setFormPostalCode] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const handleOpenAddForm = () => {
    setEditingAddressId(null);
    setFormLabel('Home');
    setFormFullName(fullName);
    setFormAddressLine1('');
    setFormCity('Dhaka');
    setFormPostalCode('');
    setFormPhone(phone);
    setFormIsDefault(addresses.length === 0);
    setIsEditingAddress(true);
  };

  const handleOpenEditForm = (addr: typeof addresses[0]) => {
    setEditingAddressId(addr.id);
    setFormLabel(addr.label);
    setFormFullName(addr.fullName);
    setFormAddressLine1(addr.addressLine1);
    setFormCity(addr.city);
    setFormPostalCode(addr.postalCode);
    setFormPhone(addr.phone);
    setFormIsDefault(addr.isDefault);
    setIsEditingAddress(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName || !formAddressLine1 || !formPhone) {
      alert('Please fill out all required fields.');
      return;
    }

    const payload = {
      label: formLabel,
      fullName: formFullName,
      addressLine1: formAddressLine1,
      city: formCity || 'Dhaka',
      postalCode: formPostalCode || 'N/A',
      country: 'Bangladesh',
      phone: formPhone,
      isDefault: formIsDefault,
    };

    if (isApiEnabled() && getToken()) {
      try {
        if (editingAddressId) {
          const saved = await api.updateAddress(editingAddressId, payload);
          setAddresses((prev) => {
            let updated = prev.map((a) => (a.id === editingAddressId ? saved : a));
            if (saved.isDefault) {
              updated = updated.map((a) => (a.id !== saved.id ? { ...a, isDefault: false } : a));
            }
            return updated;
          });
        } else {
          const saved = await api.createAddress(payload);
          setAddresses((prev) => {
            let updated = [...prev, saved];
            if (saved.isDefault) {
              updated = updated.map((a) => (a.id !== saved.id ? { ...a, isDefault: false } : a));
            }
            return updated;
          });
        }
        setIsEditingAddress(false);
        return;
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to save address');
        return;
      }
    }

    if (editingAddressId) {
      setAddresses(prev => {
        let updated = prev.map(a => {
          if (a.id === editingAddressId) {
            return { ...a, ...payload };
          }
          return a;
        });
        if (formIsDefault) {
          updated = updated.map(a => a.id !== editingAddressId ? { ...a, isDefault: false } : a);
        }
        return updated;
      });
    } else {
      const newId = `addr-${Date.now()}`;
      const newAddr = { id: newId, ...payload };
      setAddresses(prev => {
        let updated = [...prev, newAddr];
        if (formIsDefault) {
          updated = updated.map(a => a.id !== newId ? { ...a, isDefault: false } : a);
        }
        return updated;
      });
    }

    setIsEditingAddress(false);
  };

  const handleDeleteAddress = async (id: string, isDefault: boolean) => {
    if (isDefault && addresses.length > 1) {
      alert('Please set another address as default before deleting this one.');
      return;
    }
    if (!confirm('Are you sure you want to delete this shipping address?')) return;

    if (isApiEnabled() && getToken()) {
      try {
        await api.deleteAddress(id);
        const { items } = await api.listAddresses();
        setAddresses(items || []);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete address');
      }
      return;
    }

    setAddresses(prev => {
      const filtered = prev.filter(a => a.id !== id);
      if (isDefault && filtered.length > 0) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
  };

  const handleSetDefault = async (id: string) => {
    if (isApiEnabled() && getToken()) {
      try {
        const target = addresses.find((a) => a.id === id);
        if (!target) return;
        await api.updateAddress(id, { ...target, isDefault: true });
        setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to set default address');
      }
      return;
    }
    setAddresses(prev => prev.map(a => ({
      ...a,
      isDefault: a.id === id,
    })));
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      alert('Full name is required.');
      return;
    }
    setProfileBusy(true);
    try {
      if (isApiEnabled() && getToken()) {
        const updated = await api.updateProfile({
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
        });
        const next = {
          fullName: updated.fullName,
          email: updated.email,
          phone: updated.phone,
        };
        const stored = localStorage.getItem('vault_current_user');
        if (stored) {
          try {
            const u = JSON.parse(stored);
            localStorage.setItem('vault_current_user', JSON.stringify({ ...u, ...next }));
          } catch {
            /* ignore */
          }
        }
        onProfileUpdated?.(next);
        alert('Profile updated in database.');
      } else {
        alert('Sign in with the live API to save profile to the database.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Profile update failed');
    } finally {
      setProfileBusy(false);
    }
  };

  // Only this customer's orders — never show other users' or fake demo invoices
  const activeOrders = orders.filter((o) => {
    const orderEmail = o.shippingAddress?.email?.toLowerCase().trim();
    const orderPhone = o.shippingAddress?.phone?.replace(/\D/g, "");
    const myEmail = currentUserEmail?.toLowerCase().trim();
    const myPhone = currentUserPhone?.replace(/\D/g, "");
    if (myEmail && orderEmail && orderEmail === myEmail) return true;
    if (myPhone && orderPhone && orderPhone === myPhone) return true;
    if (!orderEmail && myPhone && orderPhone && orderPhone === myPhone) return true;
    return false;
  });

  return (
    <section className="bg-transparent text-[#0A0A0A] py-6 sm:py-10 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto w-full min-w-0 min-h-0 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-10">
      
      {/* Dashboard Welcome Header */}
      <div className="border-b border-[#E5E5E5] pb-5 sm:pb-6 mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:gap-5 justify-between items-stretch sm:items-center min-w-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full bg-[#E30613] border border-[#E30613] text-white flex items-center justify-center font-sans font-black text-lg sm:text-xl shadow-sm">
            {(fullName || 'U')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() || '')
              .join('') || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#0A0A0A] leading-tight">
              My Profile & Account
            </h1>
            <p className="text-[11px] sm:text-xs text-[#555555] font-mono mt-1 break-words">
              Signed in as{' '}
              <span className="text-[#0A0A0A] font-bold">{fullName || 'Collector'}</span>
              {email ? (
                <>
                  {' '}
                  · <span className="text-[#555555] break-all">{email}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* Dynamic mini counts */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-4 text-xs font-mono w-full sm:w-auto">
          <div className="bg-white border border-[#E5E5E5] px-3 sm:px-4 py-2.5 rounded-xl text-center min-w-0 sm:min-w-[88px]">
            <p className="text-[#555555] text-[10px] uppercase tracking-wider">My Orders</p>
            <p className="text-[#0A0A0A] font-black text-sm mt-0.5">{activeOrders.length}</p>
          </div>
          <div className="bg-white border border-[#E5E5E5] px-3 sm:px-4 py-2.5 rounded-xl text-center min-w-0 sm:min-w-[88px]">
            <p className="text-[#555555] text-[10px] uppercase tracking-wider">Wishlisted</p>
            <p className="text-[#0A0A0A] font-black text-sm mt-0.5">{wishlist.length}</p>
          </div>
        </div>
      </div>

      {/* Dashboard Sub Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start min-w-0">
        
        {/* Left Col: Menu Navigation */}
        <div className="lg:col-span-3 bg-white border-2 border-[#E5E5E5] rounded-2xl p-3 sm:p-4 space-y-1.5 sm:space-y-2 text-xs font-semibold min-w-0">
          {[
            { id: 'orders', label: 'My Order History', icon: ClipboardList },
            { id: 'wishlist', label: 'My Wishlist', icon: Heart },
            { id: 'profile', label: 'Profile Settings', icon: User },
            { id: 'addresses', label: 'My Saved Addresses', icon: MapPin },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full text-left py-3 px-3.5 sm:px-4 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer min-h-11 ${
                  activeTab === item.id
                    ? 'bg-[#E30613] text-white font-black shadow-sm'
                    : 'text-[#555555] hover:text-[#0A0A0A] hover:bg-[#F8F8F7]'
                }`}
              >
                <Icon size={14} className="shrink-0" />{' '}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Col: Active Tab Contents */}
        <div className="lg:col-span-9 space-y-6 min-w-0 w-full">
          
          {activeTab === 'orders' && (
            <div className="space-y-5 sm:space-y-6 animate-fadeIn min-w-0 w-full">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-[#0A0A0A] border-b border-[#E5E5E5] pb-2">
                Order History & Logistics tracking
              </h3>

              {activeOrders.length === 0 ? (
                <div className="bg-white border-2 border-[#E5E5E5] p-6 sm:p-10 text-center rounded-2xl space-y-4">
                  <p className="text-sm text-[#555555] leading-relaxed px-1">
                    No orders yet. When you place an order, it will show up here with tracking.
                  </p>
                  <button
                    onClick={() => setCurrentPage('home')}
                    type="button"
                    className="inline-flex items-center justify-center gap-2 bg-[#0A0A0A] hover:bg-black text-white text-sm font-black uppercase tracking-wide px-6 py-3 rounded-xl cursor-pointer transition-colors min-h-11 w-full sm:w-auto"
                  >
                    Go to Home
                  </button>
                </div>
              ) : (
              <div className="space-y-4 min-w-0">
                {activeOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white border-2 border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm min-w-0"
                  >
                    {/* Order header row */}
                    <div className="bg-[#F8F8F7] border-b border-[#E5E5E5] p-4 sm:p-5 md:p-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs font-mono text-[#0A0A0A]">
                      <div className="min-w-0">
                        <span className="text-[#555555] text-[10px]">ORDER NUMBER</span>
                        <p className="text-[#0A0A0A] font-bold text-sm break-all">{ord.orderNumber || ord.id}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[#555555] text-[10px]">DATE CONFIRMED</span>
                        <p className="text-[#0A0A0A] font-bold">{ord.date}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[#555555] text-[10px]">TOTAL VALUE</span>
                        <p className="text-[#0A0A0A] font-extrabold text-sm">{displayPrice(ord.total)}</p>
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-1 min-w-0 col-span-2 sm:col-span-1">
                        <span className="bg-[#E30613] text-white px-3 py-1 rounded font-bold text-[10px] sm:text-xs">
                          {ord.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono text-[#555555] uppercase">
                          Payment: {ord.paymentStatus || 'Unpaid'}
                        </span>
                      </div>
                    </div>

                    {/* Order content detail */}
                    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                      <div className="space-y-3">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="flex gap-3 sm:gap-4 items-center border-b border-[#E5E5E5] pb-3 text-xs min-w-0">
                            <div className="w-12 h-12 shrink-0 bg-[#F8F8F7] border border-[#E5E5E5] rounded p-1 flex items-center justify-center">
                              <svg viewBox="0 0 200 240" className="w-full h-full">
                                <rect width="200" height="240" rx="10" fill="#27272a" />
                                <circle cx="100" cy="120" r="60" fill="#3f3f46" opacity="0.5" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4
                                className="font-bold text-[#0A0A0A] hover:text-[#E30613] cursor-pointer truncate"
                                onClick={() => { onSelectProduct(item.product); setCurrentPage('details'); }}
                              >
                                {item.product.name}
                              </h4>
                              <p className="text-[10px] text-[#555555] font-mono">
                                Size: {item.selectedSize} | Qty: {item.quantity}
                              </p>
                            </div>
                            <span className="text-[#0A0A0A] font-bold font-mono shrink-0">{displayPrice(item.product.price)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Visual Logistics Tracking nodes */}
                      {ord.trackingNumber && (
                        <div className="bg-[#F8F8F7] border border-[#E5E5E5] p-3.5 sm:p-5 rounded-xl space-y-4 text-xs min-w-0 overflow-hidden">
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between sm:items-center border-b border-[#E5E5E5] pb-2 min-w-0">
                            <span className="font-mono text-[10px] text-[#555555]">TRACKING COURIER</span>
                            <span className="font-mono font-black text-[#0A0A0A] break-all">{ord.trackingNumber}</span>
                          </div>

                          {/* Interactive milestones dots bar */}
                          <div className="relative pt-2 pb-1">
                            <div className="absolute top-[7px] left-[12%] right-[12%] h-0.5 bg-[#E5E5E5] hidden sm:block" />
                            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2 text-center">
                              <div className="space-y-1.5 flex flex-col items-center min-w-0">
                                <span className="w-3.5 h-3.5 rounded-full bg-[#E30613] border-4 border-white z-10 shrink-0" />
                                <p className="text-[9px] font-bold text-[#555555] uppercase leading-tight px-0.5">Sourced</p>
                              </div>
                              <div className="space-y-1.5 flex flex-col items-center min-w-0">
                                <span className="w-3.5 h-3.5 rounded-full bg-[#E30613] border-4 border-white z-10 shrink-0" />
                                <p className="text-[9px] font-bold text-[#555555] uppercase leading-tight px-0.5">Verified</p>
                              </div>
                              <div className="space-y-1.5 flex flex-col items-center min-w-0">
                                <span className={`w-3.5 h-3.5 rounded-full border-4 border-white z-10 shrink-0 ${ord.status === 'Shipped' || ord.status === 'Delivered' ? 'bg-[#E30613]' : 'bg-[#E5E5E5]'}`} />
                                <p className="text-[9px] font-bold text-[#555555] uppercase leading-tight px-0.5">In Transit</p>
                              </div>
                              <div className="space-y-1.5 flex flex-col items-center min-w-0">
                                <span className={`w-3.5 h-3.5 rounded-full border-4 border-white z-10 shrink-0 ${ord.status === 'Delivered' ? 'bg-[#E30613]' : 'bg-[#E5E5E5]'}`} />
                                <p className="text-[9px] font-bold text-[#555555] uppercase leading-tight px-0.5">Delivery</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          {activeTab === 'wishlist' && (
            <div className="space-y-5 sm:space-y-6 animate-fadeIn min-w-0 w-full">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-[#0A0A0A] border-b border-[#E5E5E5] pb-2">
                My saved wishlist ({wishlist.length} Items)
              </h3>

              {wishlist.length === 0 ? (
                <div className="bg-white border-2 border-[#E5E5E5] p-6 sm:p-10 text-center rounded-2xl space-y-4">
                  <p className="text-sm text-[#555555] leading-relaxed px-1">
                    No jerseys saved yet. Browse the catalog and tap the heart to add favorites.
                  </p>
                  <button
                    onClick={() => setCurrentPage('home')}
                    type="button"
                    className="inline-flex items-center justify-center gap-2 bg-[#0A0A0A] hover:bg-black text-white text-sm font-black uppercase tracking-wide px-6 py-3 rounded-xl cursor-pointer transition-colors min-h-11 w-full sm:w-auto"
                  >
                    Go to Home
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {wishlist.map((w) => (
                    <div
                      key={w.id}
                      className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-3.5 sm:p-4 flex gap-3 items-center justify-between min-w-0"
                    >
                      <div
                        className="flex gap-3 items-center cursor-pointer min-w-0 flex-1"
                        onClick={() => { onSelectProduct(w); setCurrentPage('details'); }}
                      >
                        <div className="w-12 h-12 shrink-0 bg-[#F8F8F7] border border-[#E5E5E5] p-1 rounded flex items-center justify-center">
                          <svg viewBox="0 0 200 240" className="w-full h-full">
                            <rect width="200" height="240" rx="10" fill="#27272a" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-[#0A0A0A] hover:text-[#E30613] leading-tight truncate">
                            {w.name}
                          </h4>
                          <span className="text-[10px] text-[#0A0A0A] font-bold font-mono">{displayPrice(w.price)}</span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => onRemoveWishlist(w)}
                        className="text-[#555555] hover:text-[#E30613] p-2.5 rounded-full cursor-pointer shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center"
                        title="Remove from wishlist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-white border-2 border-[#E5E5E5] p-4 sm:p-6 rounded-2xl space-y-5 animate-fadeIn min-w-0 w-full overflow-hidden">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-[#0A0A0A] border-b border-[#E5E5E5] pb-2 flex items-center gap-2">
                <User size={18} className="text-[#E30613] shrink-0" />
                <span className="min-w-0">Account & Security</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <label
                    htmlFor="dash-full-name"
                    className="block text-[10px] text-[#555555] font-mono uppercase tracking-wide"
                  >
                    Full name
                  </label>
                  <input
                    id="dash-full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    className="w-full min-w-0 bg-[#F8F8F7] border-2 border-[#E5E5E5] rounded-lg py-2.5 px-3 text-xs text-[#0A0A0A] placeholder:text-[#555555] focus:outline-none focus:border-[#E30613]"
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <label
                    htmlFor="dash-email"
                    className="block text-[10px] text-[#555555] font-mono uppercase tracking-wide"
                  >
                    Email address
                  </label>
                  <input
                    id="dash-email"
                    type="email"
                    value={email}
                    readOnly
                    autoComplete="email"
                    className="w-full min-w-0 bg-[#F8F8F7] border-2 border-[#E5E5E5] rounded-lg py-2.5 px-3 text-xs text-[#555555] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5 min-w-0 sm:col-span-2">
                  <label
                    htmlFor="dash-phone"
                    className="block text-[10px] text-[#555555] font-mono uppercase tracking-wide"
                  >
                    Phone contact
                  </label>
                  <input
                    id="dash-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="w-full min-w-0 bg-[#F8F8F7] border-2 border-[#E5E5E5] rounded-lg py-2.5 px-3 text-xs text-[#0A0A0A] placeholder:text-[#555555] focus:outline-none focus:border-[#E30613]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={profileBusy}
                className="w-full sm:w-auto bg-[#0A0A0A] hover:bg-black disabled:opacity-60 text-white font-extrabold text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl cursor-pointer min-h-11"
              >
                {profileBusy ? 'Saving…' : 'Save Settings Profile'}
              </button>
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="bg-white border-2 border-[#E5E5E5] p-4 sm:p-6 rounded-2xl space-y-5 sm:space-y-6 animate-fadeIn min-w-0 w-full overflow-hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center border-b border-[#E5E5E5] pb-3 min-w-0">
                <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-[#0A0A0A] flex items-center gap-2 min-w-0">
                  <MapPin size={18} className="text-[#E30613] shrink-0" />
                  <span className="min-w-0 leading-snug">Saved Shipping Addresses</span>
                </h3>
                {!isEditingAddress && (
                  <button
                    type="button"
                    onClick={handleOpenAddForm}
                    className="w-full sm:w-auto shrink-0 bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-11 whitespace-nowrap"
                  >
                    <Plus size={12} className="shrink-0" /> Add Address
                  </button>
                )}
              </div>

              {isEditingAddress ? (
                /* ADD / EDIT ADDRESS FORM */
                <form onSubmit={handleSaveAddress} className="space-y-4 text-xs min-w-0">
                  <div className="bg-[#F8F8F7] border-2 border-[#E5E5E5] p-3.5 sm:p-4 rounded-2xl space-y-4 min-w-0 overflow-hidden">
                    <p className="text-[10px] font-mono text-[#555555] uppercase font-black">
                      {editingAddressId ? 'Edit Shipping Address' : 'Add New Shipping Address'}
                    </p>

                    {/* ADDRESS LABEL OPTIONS (Home, Office, Visitor) */}
                    <div className="space-y-2 min-w-0">
                      <label className="text-[10px] text-[#555555] font-mono block uppercase font-bold">Address label</label>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {[
                          { id: 'Home', icon: Home },
                          { id: 'Office', icon: Briefcase },
                          { id: 'Visitor', icon: User }
                        ].map((lbl) => {
                          const Icon = lbl.icon;
                          const isSelected = formLabel === lbl.id;
                          return (
                            <button
                              key={lbl.id}
                              type="button"
                              onClick={() => setFormLabel(lbl.id as any)}
                              className={`p-2.5 sm:p-3 rounded-xl border-2 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer font-bold min-h-11 min-w-0 ${
                                isSelected
                                  ? 'bg-[#E30613] text-white border-[#E30613] font-black'
                                  : 'border-[#E5E5E5] bg-white text-[#555555] hover:border-[#E5E5E5]'
                              }`}
                            >
                              <Icon size={14} className="shrink-0" />
                              <span className="text-[9px] sm:text-[10px] uppercase truncate">{lbl.id}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Name & Phone fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                      <div className="space-y-1.5 min-w-0">
                        <label className="text-[10px] text-[#555555] font-mono block uppercase">Recipient Full Name *</label>
                        <input
                          type="text"
                          required
                          value={formFullName}
                          onChange={(e) => setFormFullName(e.target.value)}
                          placeholder="e.g. Yasin Ahmed"
                          className="w-full min-w-0 bg-white border-2 border-[#E5E5E5] rounded-lg py-2.5 px-3 text-xs text-[#0A0A0A] placeholder:text-[#555555] focus:outline-none focus:border-[#E30613]"
                        />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <label className="text-[10px] text-[#555555] font-mono block uppercase">Active Contact Phone *</label>
                        <input
                          type="tel"
                          required
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          placeholder="e.g. 01840990700"
                          className="w-full min-w-0 bg-white border-2 border-[#E5E5E5] rounded-lg py-2.5 px-3 text-xs text-[#0A0A0A] placeholder:text-[#555555] focus:outline-none focus:border-[#E30613]"
                        />
                      </div>
                    </div>

                    {/* Detailed Address field */}
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-[10px] text-[#555555] font-mono block uppercase">Detailed Delivery Address *</label>
                      <textarea
                        required
                        rows={2}
                        value={formAddressLine1}
                        onChange={(e) => setFormAddressLine1(e.target.value)}
                        placeholder="e.g. Flat 4B, House 12, Road 5, Sector 4, Uttara"
                        className="w-full min-w-0 bg-white border-2 border-[#E5E5E5] rounded-lg py-2.5 px-3 text-xs text-[#0A0A0A] placeholder:text-[#555555] focus:outline-none focus:border-[#E30613] resize-none"
                      />
                    </div>

                    {/* City / District & Postal code fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                      <div className="space-y-1.5 min-w-0">
                        <label className="text-[10px] text-[#555555] font-mono block uppercase">City / District *</label>
                        <input
                          type="text"
                          required
                          value={formCity}
                          onChange={(e) => setFormCity(e.target.value)}
                          placeholder="e.g. Dhaka"
                          className="w-full min-w-0 bg-white border-2 border-[#E5E5E5] rounded-lg py-2.5 px-3 text-xs text-[#0A0A0A] placeholder:text-[#555555] focus:outline-none focus:border-[#E30613]"
                        />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <label className="text-[10px] text-[#555555] font-mono block uppercase">Postal Code (Optional)</label>
                        <input
                          type="text"
                          value={formPostalCode}
                          onChange={(e) => setFormPostalCode(e.target.value)}
                          placeholder="e.g. 1230"
                          className="w-full min-w-0 bg-white border-2 border-[#E5E5E5] rounded-lg py-2.5 px-3 text-xs text-[#0A0A0A] placeholder:text-[#555555] focus:outline-none focus:border-[#E30613]"
                        />
                      </div>
                    </div>

                    {/* Is Default Address Checkbox */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="formIsDefault"
                        checked={formIsDefault}
                        disabled={editingAddressId !== null && addresses.find(a => a.id === editingAddressId)?.isDefault}
                        onChange={(e) => setFormIsDefault(e.target.checked)}
                        className="w-3.5 h-3.5 accent-red-600 bg-[#F8F8F7] border-[#E5E5E5] rounded"
                      />
                      <label htmlFor="formIsDefault" className="text-[10px] text-[#555555] font-mono cursor-pointer select-none">
                        Make this my primary default delivery address
                      </label>
                    </div>
                  </div>

                  {/* Form Action buttons */}
                  <div className="flex flex-col-reverse sm:flex-row gap-2.5">
                    <button
                      type="submit"
                      className="w-full sm:w-auto bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-[10px] uppercase tracking-widest py-3 px-6 rounded-xl transition-all cursor-pointer min-h-11"
                    >
                      Save Address
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(false)}
                      className="w-full sm:w-auto bg-[#F8F8F7] hover:bg-[#F0F0EF] border-2 border-[#E5E5E5] text-[#0A0A0A] font-bold text-[10px] uppercase tracking-widest py-3 px-6 rounded-xl transition-all cursor-pointer min-h-11"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                /* SAVED ADDRESSES GRID LIST */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                  {addresses.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 text-center py-8 px-4 bg-[#F8F8F7] border-2 border-[#E5E5E5] rounded-xl">
                      <p className="text-sm text-[#555555] font-mono leading-relaxed">No shipping addresses saved yet. Click Add Address to set one up.</p>
                    </div>
                  ) : (
                    addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`border-2 p-4 sm:p-5 rounded-2xl space-y-3.5 text-xs transition-all flex flex-col justify-between min-w-0 overflow-hidden ${
                          addr.isDefault
                            ? 'border-[#E30613] bg-[#F8F8F7]'
                            : 'border-[#E5E5E5] bg-[#F8F8F7] hover:border-[#E5E5E5]'
                        }`}
                      >
                        <div className="space-y-2.5 min-w-0">
                          {/* Label Badge & Priority Actions */}
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className={`inline-flex items-center gap-1 font-mono text-[9px] font-black px-2.5 py-0.5 rounded-md border ${
                                addr.label === 'Home'
                                  ? 'bg-[#E30613] text-white border-[#E30613]'
                                  : 'bg-[#F8F8F7] text-[#0A0A0A] border-[#E5E5E5]'
                              }`}>
                                {addr.label === 'Home' && <Home size={9} />}
                                {addr.label === 'Office' && <Briefcase size={9} />}
                                {addr.label === 'Visitor' && <User size={9} />}
                                {addr.label.toUpperCase()}
                              </span>

                              {addr.isDefault && (
                                <span className="bg-[#F8F8F7] text-[#0A0A0A] font-mono text-[9px] font-bold px-2 py-0.5 rounded-md border border-[#E5E5E5]">
                                  PRIMARY DEFAULT
                                </span>
                              )}
                            </div>

                            {!addr.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(addr.id)}
                                className="text-[#555555] hover:text-[#0A0A0A] text-[9px] font-mono hover:underline cursor-pointer flex items-center gap-0.5 shrink-0"
                              >
                                <Check size={10} /> Make Default
                              </button>
                            )}
                          </div>

                          {/* Address details */}
                          <div className="space-y-1 min-w-0">
                            <p className="font-black text-[#0A0A0A] text-sm break-words">{addr.fullName}</p>
                            <p className="text-[#555555] font-medium leading-relaxed break-words">{addr.addressLine1}</p>
                            <p className="text-[#555555] font-mono text-[10px] break-words">
                              {addr.city}{addr.postalCode && addr.postalCode !== 'N/A' ? ` - ${addr.postalCode}` : ''}
                            </p>
                            <p className="text-[#555555] font-mono text-[10px] pt-1 block break-all">
                              Phone: <span className="text-[#0A0A0A] font-bold">{addr.phone}</span>
                            </p>
                          </div>
                        </div>

                        {/* Edit & Delete Action Row */}
                        <div className="flex gap-2.5 pt-3 border-t border-[#E5E5E5] mt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditForm(addr)}
                            className="text-[#555555] hover:text-[#0A0A0A] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors min-h-10 px-1"
                          >
                            <Edit size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr.id, addr.isDefault)}
                            className="text-[#E30613] hover:text-[#E30613] text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ml-auto min-h-10 px-1"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </section>
  );
};
