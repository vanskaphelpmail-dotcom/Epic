'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { productImageOf, withProductImages } from '../lib/product-image';
import { invoiceItemSize, normalizePerfumeSize, parseMl } from '../lib/perfume-sizes';
import SizeMlField from './SizeMlField';
import WorkspaceModules from './WorkspaceModules';
import OpsModules from './OpsModules';
import RequestModules from './RequestModules';
import SaleActionsMenu from './SaleActionsMenu';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import { pageFromPath, pageMeta, pathForPage } from '../lib/app-routes';
import {
  ACCESS_MODULES,
  ROLE_PRESETS,
  canAccessNav,
  permissionsFromModules
} from '../lib/permissions';

const navGroups = [
  {
    label: 'Command',
    items: [
      ['Overview', 'overview'],
      ['POS', 'pos'],
      ['Invoice List', 'orders'],
      ['Unpaid / Due', 'orders'],
      ['Inventory', 'inventory']
    ]
  },
  {
    label: 'Operations',
    items: [
      ['Sales', 'sales'],
      ['Attendance', 'attendance'],
      ['Payroll', 'payroll'],
      ['Documents', 'documents'],
      ['Requests', 'documents'],
      ['Expenses', 'documents'],
      ['Accounts', 'reports'],
      ['Suppliers', 'inventory']
    ]
  },
  {
    label: 'Insights',
    items: [
      ['Reports', 'reports'],
      ['Audit', 'team'],
      ['Team & Roles', 'team']
    ]
  }
];

const DEFAULT_STAFF_MODULES = ROLE_PRESETS.pos.modules;

const money = (n) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2
  }).format(Number(n || 0));

function toLocalInputValue(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Icon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    pos: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h6" /></>,
    orders: <><path d="M7 4h10l1 4H6l1-4z" /><path d="M6 8h12v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8z" /><path d="M10 12h4" /></>,
    inventory: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></>,
    sales: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15l3-4 3 2 4-6" /></>,
    attendance: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>,
    payroll: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></>,
    documents: <><path d="M8 3h7l5 5v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M15 3v5h5M9 13h6M9 17h4" /></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V8" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 19a4.5 4.5 0 0 1 6.5-4" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-3.5-3.5" /></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    sync: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
    export: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    back: <><path d="M15 18l-6-6 6-6" /></>
  };
  return <svg {...common}>{paths[name] || paths.overview}</svg>;
}

function Stat({ label, value, detail, tone }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={tone}>{detail}</small>
    </div>
  );
}

function statusClass(status = '') {
  const value = String(status).toLowerCase();
  if (['paid', 'completed', 'fulfilled', 'healthy'].includes(value)) return 'badge paid';
  if (['pending', 'processing'].includes(value)) return 'badge pending';
  if (['cancelled', 'refunded'].includes(value)) return 'badge cancelled';
  return 'badge warning';
}

export default function AppWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const routeName = pageFromPath(pathname);
  const active = routeName || 'Overview';
  const route = pageMeta(active);
  const setActive = (name) => {
    setNavOpen(false);
    router.push(pathForPage(name));
  };
  const goBack = () => {
    if (active === 'Overview') {
      router.push('/');
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };
  const [navOpen, setNavOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dash, setDash] = useState(null);
  const [posSession, setPosSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const loadedTabs = useRef(new Set());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [stockFilter, setStockFilter] = useState('All');
  const [cart, setCart] = useState([]);
  const emptyCustomer = {
    name: '',
    email: '',
    phone: '',
    companyName: '',
    address: '',
    city: 'Cardiff',
    location: '136A Woodville Road'
  };
  const [customer, setCustomer] = useState(emptyCustomer);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [saleMode, setSaleMode] = useState('PAID');
  const [posDiscountType, setPosDiscountType] = useState('FIXED');
  const [posDiscountValue, setPosDiscountValue] = useState('0');
  const [posTaxRate, setPosTaxRate] = useState('0');
  const [manualProduct, setManualProduct] = useState({
    name: '',
    category: '',
    size: '100ml',
    purchasePrice: '',
    sellingPrice: '',
    quantity: '1'
  });
  const [showManualPos, setShowManualPos] = useState(true);
  const [saleDateTime, setSaleDateTime] = useState(() => toLocalInputValue());
  const saleDateFollowClock = useRef(true);
  const [billing, setBilling] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [sales, setSales] = useState([]);
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [staff, setStaff] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [extraSizes, setExtraSizes] = useState([]);
  const [catalogExtras, setCatalogExtras] = useState({ supplier: [], dupe: [], notes: [], accords: [] });
  const [catalogModal, setCatalogModal] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '', brand: '', category: "Women's Perfume", size: '100ml',
    sellingPrice: '', purchasePrice: '', stockQuantity: '10',
    sku: '', barcode: '', autoBarcode: true, image: null, supplierName: '', dupe: '', notes: '', season: '', mainAccords: '',
    spring: false, summer: false, autumn: false, winter: false, allSeason: false, isActive: true
  });
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    employeeId: '',
    password: 'Staff123!',
    preset: 'pos',
    modules: [...DEFAULT_STAFF_MODULES]
  });
  const [accessModules, setAccessModules] = useState(ACCESS_MODULES);
  const [editingAccessUser, setEditingAccessUser] = useState(null);
  const [salesPeriod, setSalesPeriod] = useState('all');
  const [salesStaffFilter, setSalesStaffFilter] = useState('');
  const [salesChannel, setSalesChannel] = useState('IN_STORE');
  const [expenses, setExpenses] = useState([]);
  const [loans, setLoans] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState(null);
  const [audit, setAudit] = useState(null);
  const [docForm, setDocForm] = useState({
    title: '',
    category: 'INVOICE',
    directory: 'INVOICE',
    periodYear: new Date().getFullYear(),
    periodMonth: new Date().getMonth() + 1,
    file: null
  });
  const [salaryForm, setSalaryForm] = useState({
    userId: '',
    baseSalary: '400',
    paidAmount: '0',
    workingDays: '0',
    workingHours: '0',
    calculatedSalary: '',
    periodType: 'week',
    periodAnchor: new Date().toISOString().slice(0, 10),
    expectedHours: '40'
  });
  const [salaryPreview, setSalaryPreview] = useState(null);
  const [editingSalary, setEditingSalary] = useState(null);
  const [credentials, setCredentials] = useState({
    identifier: '',
    password: ''
  });
  const [clockModal, setClockModal] = useState(null);
  const [clockCash, setClockCash] = useState('0');
  const [billingAction, setBillingAction] = useState(null);
  const [billingForm, setBillingForm] = useState({
    invoiceNumber: '',
    customerName: '',
    notes: '',
    saleDateTime: '',
    discountType: 'fixed',
    discountValue: '0',
    items: [],
    returnProductId: '',
    returnQuantity: '1',
    newProductId: '',
    newQuantity: '1',
    newSellingPrice: '',
    deliveryCharge: '0',
    taxRate: '20',
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    paymentAmount: '',
    reason: '',
    returnReason: 'Customer changed mind',
    returnCondition: 'Resellable',
    refundMethod: 'CASH',
    refundAmount: ''
  });
  const [saleHistory, setSaleHistory] = useState([]);
  const isAdmin = user?.role === 'ADMIN';
  const [editingProduct, setEditingProduct] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('thisMonth');
  const [reportFrom, setReportFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const toast = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 2600);
  };

  const canSeeCost = user?.role === 'ADMIN' || user?.permissions?.includes('COST_VIEW');
  const userPermissions = user?.permissions || [];
  const allowedNav = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(([name]) => canAccessNav(name, userPermissions, user?.role))
      }))
      .filter((group) => group.items.length > 0);
  }, [userPermissions, user?.role]);

  const applyCatalog = (inventory, brandsRes, catsRes) => {
    const productItems = inventory.data?.items || inventory.data || [];
    setProducts(withProductImages(productItems));
    let brandList = Array.isArray(brandsRes?.data) ? brandsRes.data : [];
    let categoryList = Array.isArray(catsRes?.data) ? catsRes.data : [];
    if (!brandList.length && Array.isArray(productItems)) {
      brandList = [...new Set(productItems.map((p) => p.brand).filter(Boolean))]
        .sort()
        .map((name) => ({ id: name, name }));
    }
    if (!categoryList.length && Array.isArray(productItems)) {
      categoryList = [...new Set(productItems.map((p) => p.category).filter(Boolean))]
        .sort()
        .map((name) => ({ id: name, name }));
    }
    setBrands(brandList);
    setCategories(categoryList);
  };

  const loadTabData = async (tab, { force } = {}) => {
    if (!tab || tab === 'Overview') return;
    if (!force && loadedTabs.current.has(tab)) return;
    loadedTabs.current.add(tab);
    try {
      if (tab === 'POS' || tab === 'Inventory') {
        const [inventory, brandsRes, catsRes] = await Promise.all([
          api(`/products?limit=100${tab === 'Inventory' ? '&includeInactive=true' : ''}`),
          api('/catalog/brands').catch(() => ({ data: [] })),
          api('/catalog/categories').catch(() => ({ data: [] }))
        ]);
        applyCatalog(inventory, brandsRes, catsRes);
        loadedTabs.current.add('POS');
        loadedTabs.current.add('Inventory');
      } else if (tab === 'Sales' || tab === 'Invoice List' || tab === 'Unpaid / Due') {
        const status = tab === 'Unpaid / Due' ? '&paymentStatus=UNPAID' : '';
        const staffQ = salesStaffFilter ? `&staffId=${encodeURIComponent(salesStaffFilter)}` : '';
        const [salesRes, staffRes] = await Promise.all([
          api(`/sales?limit=100${status}${staffQ}`),
          api('/staff').catch(() => ({ data: [] }))
        ]);
        setSales(salesRes.data || []);
        setOrders(salesRes.data || []);
        const staffPayload = staffRes.data;
        if (Array.isArray(staffPayload)) setStaff(staffPayload);
        else if (staffPayload?.users) setStaff(staffPayload.users);
        loadedTabs.current.add('Sales');
        loadedTabs.current.add('Invoice List');
        loadedTabs.current.add('Unpaid / Due');
      } else if (tab === 'Attendance' || tab === 'Payroll') {
        const [attRes, staffRes, salRes] = await Promise.all([
          api('/attendance'),
          api('/staff').catch(() => ({ data: [] })),
          tab === 'Payroll' ? api('/salaries') : Promise.resolve({ data: [] })
        ]);
        setAttendanceRows(attRes.data || []);
        const staffPayload = staffRes.data;
        if (Array.isArray(staffPayload)) setStaff(staffPayload);
        else if (staffPayload?.users) setStaff(staffPayload.users);
        if (tab === 'Payroll') setSalaries(salRes.data || []);
      } else if (tab === 'Requests') {
        /* loaded inside RequestModules */
      } else if (tab === 'Documents') {
        const docsRes = await api('/documents');
        setDocuments(docsRes.data || []);
      } else if (tab === 'Team & Roles') {
        const staffRes = await api('/staff');
        const staffPayload = staffRes.data;
        setStaff(Array.isArray(staffPayload) ? staffPayload : staffPayload?.users || []);
        if (staffPayload?.accessModules?.length) setAccessModules(staffPayload.accessModules);
      } else if (tab === 'Reports') {
        const [inventory, salesRes] = await Promise.all([
          api('/products?limit=100').catch(() => ({ data: { items: [] } })),
          api('/sales?limit=50').catch(() => ({ data: [] }))
        ]);
        applyCatalog(inventory, { data: [] }, { data: [] });
        setSales(salesRes.data || []);
        if (salesRes.data?.length) setOrders(salesRes.data);
      } else if (tab === 'Expenses') {
        const res = await api('/expenses');
        setExpenses(res.data || []);
      } else if (tab === 'Accounts') {
        const [acc, loanRes] = await Promise.all([api('/accounts'), api('/loans').catch(() => ({ data: [] }))]);
        setAccounts(acc.data || null);
        setLoans(loanRes.data || []);
      } else if (tab === 'Suppliers') {
        const res = await api('/suppliers');
        setSuppliers(res.data || []);
      } else if (tab === 'Audit') {
        const res = await api('/audit');
        setAudit(res.data || null);
      }
    } catch (e) {
      loadedTabs.current.delete(tab);
      setError(e.message);
    }
  };

  const applyDashboard = (data) => {
    setDash(data);
    setOrders(data?.recentOrders || []);
  };

  const load = async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const summary = await api('/dashboard');
      applyDashboard(summary.data);
    } catch (e) {
      setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const refreshAfterMutation = async () => {
    await load({ silent: true });
    loadedTabs.current.delete(active);
    await loadTabData(active);
  };

  useEffect(() => {
    let cancelled = false;
    api('/bootstrap')
      .then((r) => {
        if (cancelled) return;
        setUser(r.data.user);
        try {
          window.sessionStorage.setItem('ps_user', JSON.stringify(r.data.user));
        } catch {
          /* ignore */
        }
        applyDashboard(r.data.dashboard);
        setError('');
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e?.message || '';
        if (/Authentication required/i.test(msg)) {
          setUser(null);
          try {
            window.sessionStorage.removeItem('ps_user');
          } catch {
            /* ignore */
          }
        } else {
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('ps_extra_sizes') || '[]');
      if (Array.isArray(saved) && saved.length) {
        setExtraSizes(saved.map(normalizePerfumeSize));
      }
      const extras = JSON.parse(window.localStorage.getItem('ps_catalog_extras') || '{}');
      setCatalogExtras({
        supplier: Array.isArray(extras.supplier) ? extras.supplier : [],
        dupe: Array.isArray(extras.dupe) ? extras.dupe : [],
        notes: Array.isArray(extras.notes) ? extras.notes : [],
        accords: Array.isArray(extras.accords) ? extras.accords : []
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user || active === 'Overview') return;
    loadTabData(active);
  }, [user, active]);

  useEffect(() => {
    if (active !== 'POS' || !user) return;
    saleDateFollowClock.current = true;
    setSaleDateTime(toLocalInputValue());
    let cancelled = false;
    const loadSession = async () => {
      try {
        const r = await api('/attendance/status');
        if (!cancelled) setPosSession(r.data);
      } catch {
        /* keep last session */
      }
    };
    loadSession();
    const tick = setInterval(() => {
      if (saleDateFollowClock.current) setSaleDateTime(toLocalInputValue());
      loadSession();
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [active, user]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 1024) setNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (routeName === null) router.replace('/');
  }, [routeName, router]);

  useEffect(() => {
    document.title = `${route.title} · THE OUDS`;
  }, [route.title]);

  useEffect(() => {
    if (!user || !authChecked) return;
    if (!canAccessNav(active, user.permissions || [], user.role)) {
      const first =
        allowedNav[0]?.items?.[0]?.[0] ||
        (canAccessNav('Overview', user.permissions || [], user.role) ? 'Overview' : 'POS');
      router.replace(pathForPage(first));
    }
  }, [user, active, allowedNav, router]);

  const login = async (e) => {
    e.preventDefault();
    setSigningIn(true);
    setError('');
    try {
      const r = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: credentials.identifier.trim(),
          password: credentials.password
        })
      });
      setUser(r.data.user);
      try {
        window.sessionStorage.setItem('ps_user', JSON.stringify(r.data.user));
      } catch {
        /* ignore */
      }
      setAuthChecked(true);
      setCredentials({ identifier: '', password: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSigningIn(false);
    }
  };

  const openClockModal = async () => {
    try {
      setError('');
      const status = await api('/attendance/status');
      const data = status.data;
      const mode = data.isClockedIn ? 'out' : 'in';
      setClockCash(String(data.suggestedOpeningCash ?? data.currentBalance ?? 0));
      setClockModal({
        mode,
        currentBalance: data.currentBalance ?? 0,
        balanceSource: data.balanceSource,
        employee: data.employee,
        isClockedIn: data.isClockedIn
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const submitClock = async () => {
    if (!clockModal) return;
    try {
      setError('');
      if (clockModal.mode === 'in') {
        const r = await api('/attendance/clock-in', {
          method: 'POST',
          body: JSON.stringify({ openingCash: Number(clockCash) })
        });
        toast(`Clocked in · balance ${money(r.data?.currentBalance ?? clockCash)}`);
      } else {
        const r = await api('/attendance/clock-out', {
          method: 'POST',
          body: JSON.stringify({ closingCash: Number(clockCash) })
        });
        const diff = r.data?.summary?.cashDifference;
        toast(
          diff === 0 || diff === undefined
            ? `Clocked out · balance ${money(r.data?.summary?.currentBalance ?? clockCash)}`
            : `Clocked out · difference ${money(diff)}`
        );
      }
      setClockModal(null);
      await refreshAfterMutation();
      try {
        const r = await api('/attendance/status');
        setPosSession(r.data);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setUser(null);
    setAuthChecked(true);
    try {
      window.sessionStorage.removeItem('ps_user');
    } catch {
      /* ignore */
    }
    setDash(null);
    setProducts([]);
    setOrders([]);
    setCart([]);
    setInvoice(null);
  };

  const productIdOf = (product) => product?.id || product?._id;
  const productStockOf = (product) => product?.stockQuantity ?? product?.quantity ?? 0;
  const productPriceOf = (product) => product?.sellingPrice ?? product?.price ?? 0;
  const productMinOf = (product) => product?.minimumStock ?? product?.lowStockThreshold ?? 5;

  const matchesProductQuery = (p, raw) => {
    const q = String(raw || '').trim().toLowerCase();
    if (!q) return true;
    const barcode = String(p.barcode || '').toLowerCase();
    const sku = String(p.sku || '').toLowerCase();
    // Exact barcode / SKU match (scanner paste)
    if (barcode === q || sku === q) return true;
    return (
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.brand || '').toLowerCase().includes(q) ||
      String(p.category || '').toLowerCase().includes(q) ||
      sku.includes(q) ||
      barcode.includes(q)
    );
  };

  const findProductByScan = (raw) => {
    const code = String(raw || '').trim();
    if (!code) return null;
    const lower = code.toLowerCase();
    return (
      products.find((p) => String(p.barcode || '') === code) ||
      products.find((p) => String(p.sku || '').toLowerCase() === lower) ||
      products.find((p) => String(p.barcode || '').includes(code) && code.length >= 6) ||
      null
    );
  };

  const filtered = products.filter((p) => {
    if (!matchesProductQuery(p, query)) return false;
    if (stockFilter === 'Healthy') return productStockOf(p) > productMinOf(p);
    if (stockFilter === 'Low stock') return productStockOf(p) <= productMinOf(p);
    return true;
  });

  const cartLines = useMemo(
    () =>
      cart.map((line) => {
        const product = products.find((p) => productIdOf(p) === line.productId);
        const unit = line.sellingPrice != null ? Number(line.sellingPrice) : productPriceOf(product);
        return {
          ...line,
          product: product || {
            id: line.productId,
            name: line.name,
            sellingPrice: unit,
            barcode: 'Manual',
            stockQuantity: 999
          },
          lineTotal: unit * line.quantity
        };
      }),
    [cart, products]
  );

  // Selling prices are VAT-inclusive (UK). Extract 20% VAT from the gross cart total.
  const cartGross = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const posDiscount = posDiscountType === 'PERCENT'
    ? Number((cartGross * Math.max(0, Number(posDiscountValue) || 0) / 100).toFixed(2))
    : Math.min(cartGross, Math.max(0, Number(posDiscountValue) || 0));
  const discountedGross = Math.max(0, cartGross - posDiscount);
  const taxDecimal = Math.max(0, Number(posTaxRate) || 0) / 100;
  const cartTax = Number(((discountedGross * taxDecimal) / (1 + taxDecimal)).toFixed(2));
  const cartSubtotal = Number((discountedGross - cartTax).toFixed(2));
  const cartTotal = Number(discountedGross.toFixed(2));

  const addToCart = (product) => {
    const id = productIdOf(product);
    const stock = productStockOf(product);
    if (stock <= 0) {
      toast('This product is out of stock');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast('Not enough stock');
          return prev;
        }
        return prev.map((item) =>
          item.productId === id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { productId: id, quantity: 1 }];
    });
  };

  const onScanProduct = async (raw, { add = false } = {}) => {
    const code = String(raw || '').trim();
    if (!code) return null;
    let product = findProductByScan(code);
    if (!product) {
      try {
        const res = await api(`/products/barcode/${encodeURIComponent(code)}`);
        product = res.data;
        if (product && !products.some((p) => productIdOf(p) === productIdOf(product))) {
          setProducts((prev) => [product, ...prev]);
        }
      } catch {
        toast(`No product for barcode ${code}`);
        return null;
      }
    }
    if (!product) {
      toast(`No product for barcode ${code}`);
      return null;
    }
    setQuery(String(product.barcode || code));
    if (add) {
      addToCart(product);
      toast(`Added · ${product.name}`);
    } else {
      toast(`${product.name} · barcode ${product.barcode}`);
    }
    setScanCode('');
    return product;
  };

  const updateCartQty = (productId, quantity) => {
    const product = products.find((p) => productIdOf(p) === productId);
    const next = Math.max(1, Math.min(Number(quantity) || 1, productStockOf(product) || 1));
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: next } : item))
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const onAddProduct = async (e) => {
    e.preventDefault();
    try {
      if (productForm.image && productForm.image.size > 500 * 1024) {
        throw new Error('Image must be 500KB or smaller');
      }
      const form = new FormData();
      form.append('name', productForm.name);
      form.append('brand', productForm.brand);
      form.append('category', productForm.category);
      form.append('size', productForm.size);
      form.append('sellingPrice', productForm.sellingPrice);
      form.append('purchasePrice', productForm.purchasePrice || '0');
      form.append('stockQuantity', productForm.stockQuantity || '0');
      ['supplierName', 'dupe', 'notes', 'season', 'mainAccords'].forEach((key) => form.append(key, productForm[key] || ''));
      ['spring', 'summer', 'autumn', 'winter', 'allSeason', 'isActive'].forEach((key) => form.append(key, String(!!productForm[key])));
      if (productForm.autoBarcode !== false && !productForm.barcode) {
        form.append('autoBarcode', 'true');
      } else if (productForm.barcode) {
        form.append('barcode', String(productForm.barcode).trim());
        form.append('autoBarcode', 'false');
      } else {
        form.append('autoBarcode', 'true');
      }
      if (productForm.image) form.append('image', productForm.image);

      const editingId = editingProduct?.id || editingProduct?._id;
      const res = await fetch(editingId ? `/api/products/${editingId}` : '/api/products', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        body: form
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message || 'Could not save product');
      toast(editingId ? 'Product updated' : 'Product added');
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm({
        name: '', brand: '', category: "Women's Perfume", size: '100ml',
        sellingPrice: '', purchasePrice: '', stockQuantity: '10',
        sku: '', barcode: '', autoBarcode: true, image: null, supplierName: '', dupe: '', notes: '', season: '', mainAccords: '',
        spring: false, summer: false, autumn: false, winter: false, allSeason: false, isActive: true
      });
      await refreshAfterMutation();
    } catch (err) {
      setError(err.message);
    }
  };

  const onAddBrand = () => setCatalogModal({ type: 'brand', name: '' });
  const onAddCategory = () => setCatalogModal({ type: 'category', name: '' });
  const onAddSize = () => setCatalogModal({ type: 'size', name: '' });
  const onAddCatalog = (type) => setCatalogModal({ type, name: '' });

  const saveCatalogExtra = (key, value, field) => {
    setCatalogExtras((prev) => {
      const next = { ...prev, [key]: [...new Set([...(prev[key] || []), value])] };
      try {
        window.localStorage.setItem('ps_catalog_extras', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setProductForm((prev) => ({ ...prev, [field]: value }));
    toast(`${value} added`);
    setCatalogModal(null);
  };

  const submitCatalogModal = async () => {
    if (!catalogModal) return;
    const name = String(catalogModal.name || '').trim();
    if (catalogModal.type === 'size') {
      const ml = parseMl(name);
      if (ml == null) {
        toast('Enter a size in millilitres, e.g. 1, 3 or 1000');
        return;
      }
      const size = `${ml}ml`;
      setExtraSizes((prev) => {
        const next = [...new Set([...prev, size])];
        try {
          window.localStorage.setItem('ps_extra_sizes', JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      setProductForm((prev) => ({ ...prev, size }));
      setManualProduct((prev) => ({ ...prev, size }));
      toast(`Size “${size}” added`);
      setCatalogModal(null);
      return;
    }
    if (catalogModal.type === 'supplier') {
      if (name.length < 2) {
        toast('Enter a supplier name');
        return;
      }
      saveCatalogExtra('supplier', name, 'supplierName');
      return;
    }
    if (catalogModal.type === 'dupe') {
      if (!name) {
        toast('Enter a dupe / inspired-by name');
        return;
      }
      saveCatalogExtra('dupe', name, 'dupe');
      return;
    }
    if (catalogModal.type === 'notes') {
      if (!name) {
        toast('Enter notes');
        return;
      }
      saveCatalogExtra('notes', name, 'notes');
      return;
    }
    if (catalogModal.type === 'accords') {
      if (!name) {
        toast('Enter a main accord');
        return;
      }
      saveCatalogExtra('accords', name, 'mainAccords');
      return;
    }
    if (name.length < 2) {
      toast('Enter a name (at least 2 characters)');
      return;
    }
    try {
      const path = catalogModal.type === 'brand' ? '/catalog/brands' : '/catalog/categories';
      const res = await api(path, {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      const created = res.data || { id: `local-${Date.now()}`, name };
      if (catalogModal.type === 'brand') {
        setBrands((prev) => {
          const next = [...prev.filter((b) => b.name !== created.name), created];
          return next.sort((a, b) => a.name.localeCompare(b.name));
        });
        setProductForm((prev) => ({ ...prev, brand: created.name }));
        toast(`Brand “${created.name}” added`);
      } else {
        setCategories((prev) => {
          const next = [...prev.filter((c) => c.name !== created.name), created];
          return next.sort((a, b) => a.name.localeCompare(b.name));
        });
        setProductForm((prev) => ({ ...prev, category: created.name }));
        toast(`Category “${created.name}” added`);
      }
      setCatalogModal(null);
    } catch (err) {
      toast(err.message || 'Could not save');
    }
  };

  const startEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      brand: product.brand || '',
      category: product.category || "Women's Perfume",
      size: product.size || '100ml',
      sellingPrice: String(product.sellingPrice ?? product.price ?? ''),
      purchasePrice: String(product.purchasePrice ?? product.cost ?? ''),
      stockQuantity: String(product.stockQuantity ?? product.quantity ?? 0),
      sku: product.sku || '',
      barcode: product.barcode || '',
      image: null, supplierName: product.supplierName || product.supplier?.name || '', dupe: product.dupe || '', notes: product.notes || '',
      season: product.season || '', mainAccords: product.mainAccords || '', spring: !!product.spring, summer: !!product.summer,
      autumn: !!product.autumn, winter: !!product.winter, allSeason: !!product.allSeason, isActive: product.isActive !== false
    });
    setShowProductForm(true);
    setActive('Inventory');
  };

  const [barcodeModal, setBarcodeModal] = useState(null);
  const [stockReturn, setStockReturn] = useState(null);
  const [stockReturnQty, setStockReturnQty] = useState('1');
  const [stockReturnType, setStockReturnType] = useState('RETURN');
  const [stockReturnReason, setStockReturnReason] = useState('');

  const printBarcode = (product) => {
    setBarcodeModal({
      id: productIdOf(product),
      name: product.name || 'Product',
      category: product.category || 'Perfume',
      barcode: product.barcode || '',
      price: product.sellingPrice ?? product.price ?? 0,
      qty: '1'
    });
  };

  const openBarcodeOutput = (format) => {
    if (!barcodeModal?.id) return;
    const qty = Math.min(200, Math.max(1, Number(barcodeModal.qty) || 1));
    const url = `/api/products/${barcodeModal.id}/barcode?format=${format}&qty=${qty}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setBarcodeModal(null);
    toast(
      format === 'pdf'
        ? `Barcode PDF · ${qty} label${qty === 1 ? '' : 's'}`
        : `Barcode print preview · ${qty} label${qty === 1 ? '' : 's'}`
    );
  };

  const submitStockReturn = async () => {
    if (!stockReturn) return;
    try {
      const qty = Number(stockReturnQty);
      if (!(qty > 0)) throw new Error('Enter a return quantity');
      await api(`/products/${stockReturn.id || stockReturn._id}/stock`, {
        method: 'POST',
        body: JSON.stringify({
          quantity: qty,
          type: stockReturnType,
          reason: stockReturnReason || undefined
        })
      });
      toast(`Returned ${qty} to inventory`);
      setStockReturn(null);
      setStockReturnQty('1');
      setStockReturnReason('');
      await refreshAfterMutation();
    } catch (err) {
      toast(err.message);
    }
  };

  const openBillingAction = (order, action) => {
    if (!isAdmin) {
      toast('Only admin can edit billing invoices');
      return;
    }
    const firstItem = order.items?.[0];
    setError('');
    setBillingAction({ order, action });
    setBillingForm({
      invoiceNumber: order.invoiceNumber || order.orderNumber || '',
      customerName: order.customer?.name || 'Walk-in customer',
      notes: order.notes || '',
      saleDateTime: toLocalInputValue(new Date(order.saleDate || order.createdAt || Date.now())),
      discountType: 'fixed',
      discountValue: String(order.discount ?? 0),
      items: (order.items || []).map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        quantity: String(item.quantity),
        sellingPrice: String(item.sellingPrice ?? item.price ?? 0)
      })),
      returnProductId: firstItem?.productId || '',
      returnQuantity: String(firstItem?.quantity || 1),
      newProductId: '',
      newQuantity: '1',
      newSellingPrice: '',
      deliveryCharge: String(order.deliveryCharge ?? 0),
      taxRate: String(((order.taxRate > 1 ? order.taxRate : (order.taxRate || 0) * 100) || 20)),
      paymentMethod: order.paymentMethod || 'CASH',
      paymentStatus: order.paymentStatus || 'PAID',
      paymentAmount: '',
      reason: '',
      returnReason: 'Customer changed mind',
      returnCondition: 'Resellable',
      refundMethod: order.paymentMethod || 'CASH',
      refundAmount: String(order.total ?? '')
    });
  };

  const handleSaleAction = async (action, sale) => {
    const id = sale?.id || sale?._id;
    if (action === 'view') {
      setInvoice(sale);
      return;
    }
    if (action === 'print' && id) {
      window.open(`/api/invoices/${id}/print`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action === 'download' && id) {
      window.open(`/api/invoices/${id}/pdf`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action === 'history' && id) {
      try {
        const res = await api(`/sales/${id}/history`);
        setSaleHistory(res.data || []);
        setBillingAction({ order: sale, action: 'history' });
      } catch (err) {
        toast(err.message);
      }
      return;
    }
    openBillingAction(sale, action);
  };

  const loadInvoiceByNumber = async (action = 'edit') => {
    if (!billingForm.invoiceNumber?.trim()) {
      toast('Enter an invoice number');
      return;
    }
    try {
      setError('');
      const res = await api(`/sales/by-invoice/${encodeURIComponent(billingForm.invoiceNumber.trim())}`);
      openBillingAction(res.data, action);
      toast(`Loaded ${res.data.invoiceNumber}`);
    } catch (err) {
      setError(err.message);
      toast(err.message);
    }
  };

  const updateBillingItem = (index, key, value) => {
    setBillingForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    }));
  };

  const submitBillingAction = async () => {
    if (!billingAction || !isAdmin) return;
    let id = billingAction.order?.id || billingAction.order?._id;
    try {
      setError('');
      if (!id && billingForm.invoiceNumber) {
        const found = await api(`/sales/by-invoice/${encodeURIComponent(billingForm.invoiceNumber.trim())}`);
        id = found.data.id;
        setBillingAction((prev) => ({ ...prev, order: found.data }));
      }
      if (!id) throw new Error('Invoice not found');

      if (['edit', 'discount'].includes(billingAction.action)) {
        const previous = Number(billingAction.order.total || 0);
        const subtotal = billingForm.items.reduce(
          (sum, item) => sum + Number(item.sellingPrice || 0) * Number(item.quantity || 0),
          0
        );
        const discount = billingForm.discountType === 'percent'
          ? (subtotal * Number(billingForm.discountValue || 0)) / 100
          : Number(billingForm.discountValue || 0);
        const net = Math.max(0, subtotal - discount);
        const tax = net * (Number(billingForm.taxRate || 0) / 100);
        const nextTotal = net + tax + Number(billingForm.deliveryCharge || 0);
        if (!window.confirm(
          `Previous total ${money(previous)} → updated total ${money(nextTotal)}. Apply this change?`
        )) return;
        if (!billingForm.reason?.trim() && Math.abs(nextTotal - previous) > 0.004) {
          throw new Error('Enter a reason for this sale change');
        }
        await api(`/sales/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            customerName: billingForm.customerName,
            notes: billingForm.notes,
            saleDate: billingForm.saleDateTime
              ? new Date(billingForm.saleDateTime).toISOString()
              : undefined,
            discountType: billingForm.discountType,
            discountValue: Number(billingForm.discountValue || 0),
            deliveryCharge: Number(billingForm.deliveryCharge || 0),
            taxRate: Number(billingForm.taxRate || 0) / 100,
            paymentMethod: billingForm.paymentMethod,
            paymentStatus: billingForm.paymentStatus,
            reason: billingForm.reason,
            items: billingForm.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              quantity: Number(item.quantity),
              sellingPrice: Number(item.sellingPrice)
            }))
          })
        });
        toast('Sale updated · history recorded');
      } else if (billingAction.action === 'delete') {
        if (!billingForm.reason?.trim()) throw new Error('Enter a cancellation reason');
        if (!window.confirm('Cancel this sale? Stock and money will be reversed. The invoice is kept as Cancelled.')) return;
        await api(`/sales/${id}`, { method: 'DELETE', body: JSON.stringify({ reason: billingForm.reason }) });
        toast('Sale cancelled · invoice preserved');
      } else if (billingAction.action === 'return' || billingAction.action === 'refund') {
        if (!billingForm.reason?.trim() && !billingForm.returnReason) throw new Error('Enter a reason');
        if (!window.confirm('Confirm return/refund? Inventory and accounts will update.')) return;
        await api(`/sales/${id}/return`, {
          method: 'POST',
          body: JSON.stringify({
            items: [
              {
                productId: billingForm.returnProductId,
                quantity: Number(billingForm.returnQuantity)
              }
            ],
            reason: billingForm.returnReason || billingForm.reason,
            condition: billingForm.returnCondition,
            refundMethod: billingForm.refundMethod,
            refundAmount: billingForm.refundAmount ? Number(billingForm.refundAmount) : undefined,
            notes: billingForm.notes
          })
        });
        toast('Return/refund processed');
      } else if (billingAction.action === 'exchange') {
        if (!billingForm.newProductId) throw new Error('Select a replacement product');
        if (!billingForm.reason?.trim()) throw new Error('Enter an exchange reason');
        if (!window.confirm('Confirm exchange? Stock will move and any price difference will be calculated.')) return;
        const returned = (billingAction.order.items || []).find(
          (item) => item.productId === billingForm.returnProductId
        );
        const oldUnit = Number(returned?.sellingPrice || 0);
        const newUnit = Number(billingForm.newSellingPrice || 0);
        const returnQty = Number(billingForm.returnQuantity || 0);
        const newQty = Number(billingForm.newQuantity || 0);
        const oldTotal = oldUnit * returnQty;
        const newTotal = newUnit * newQty;
        const res = await api(`/sales/${id}/exchange`, {
          method: 'POST',
          body: JSON.stringify({
            returnProductId: billingForm.returnProductId,
            returnQuantity: returnQty,
            newProductId: billingForm.newProductId,
            newQuantity: newQty,
            newSellingPrice: newUnit,
            reason: billingForm.reason
          })
        });
        const diff = Number(res?.data?.difference ?? newTotal - oldTotal);
        if (diff > 0) toast(`Exchange done · collect ${money(diff)}`);
        else if (diff < 0) toast(`Exchange done · refund ${money(Math.abs(diff))}`);
        else toast('Exchange done · same price');
      } else if (billingAction.action === 'payment' || billingAction.action === 'method') {
        await api(`/sales/${id}/payment`, {
          method: 'POST',
          body: JSON.stringify({
            paymentStatus: billingForm.paymentStatus,
            paymentMethod: billingForm.paymentMethod,
            amount: billingAction.action === 'payment' ? Number(billingForm.paymentAmount || 0) : undefined,
            reason: billingForm.reason
          })
        });
        toast('Payment updated');
      } else if (billingAction.action === 'recheck') {
        await api(`/sales/${id}/recheck`, {
          method: 'POST',
          body: JSON.stringify({ notes: billingForm.notes })
        });
        toast('Sale marked as verified / rechecked');
      }
      setBillingAction(null);
      await refreshAfterMutation();
    } catch (err) {
      setError(err.message);
      toast(err.message);
    }
  };

  const applyStaffPreset = (preset) => {
    const modules = ROLE_PRESETS[preset]?.modules || DEFAULT_STAFF_MODULES;
    setStaffForm((prev) => ({ ...prev, preset, modules: [...modules] }));
  };

  const toggleStaffModule = (moduleId) => {
    setStaffForm((prev) => {
      const has = prev.modules.includes(moduleId);
      return {
        ...prev,
        modules: has ? prev.modules.filter((m) => m !== moduleId) : [...prev.modules, moduleId]
      };
    });
  };

  const onAddStaff = async (e) => {
    e.preventDefault();
    try {
      if (!staffForm.modules.length) throw new Error('Select at least one access module');
      await api('/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: staffForm.name,
          email: staffForm.email,
          employeeId: staffForm.employeeId,
          password: staffForm.password,
          modules: staffForm.modules,
          permissions: permissionsFromModules(staffForm.modules)
        })
      });
      toast('Staff user created with selected access');
      setStaffForm({
        name: '',
        email: '',
        employeeId: '',
        password: 'Staff123!',
        preset: 'pos',
        modules: [...DEFAULT_STAFF_MODULES]
      });
      await refreshAfterMutation();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditAccess = (member) => {
    if (member.role === 'ADMIN') {
      toast('Shop admin access cannot be edited here');
      return;
    }
    setError('');
    setEditingAccessUser({
      id: member.id,
      name: member.name,
      email: member.email,
      employeeId: member.employeeId,
      role: member.role,
      modules: Array.isArray(member.modules) ? [...member.modules] : [],
      password: '',
      passwordConfirm: ''
    });
  };

  const toggleEditModule = (moduleId) => {
    setEditingAccessUser((prev) => {
      if (!prev) return prev;
      const has = prev.modules.includes(moduleId);
      return {
        ...prev,
        modules: has ? prev.modules.filter((m) => m !== moduleId) : [...prev.modules, moduleId]
      };
    });
  };

  const saveAccess = async () => {
    if (!editingAccessUser) return;
    try {
      if (editingAccessUser.role === 'ADMIN') {
        throw new Error('Shop admin cannot be edited here');
      }
      const password = (editingAccessUser.password || '').trim();
      const confirm = (editingAccessUser.passwordConfirm || '').trim();

      if (password || confirm) {
        if (password.length < 8) throw new Error('Password must be at least 8 characters');
        if (password !== confirm) throw new Error('Passwords do not match');
      }
      if (!editingAccessUser.modules.length) {
        throw new Error('Select at least one access module');
      }

      await api(`/staff/${editingAccessUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          modules: editingAccessUser.modules,
          ...(password ? { password } : {})
        })
      });
      toast(
        password
          ? `Access & password updated for ${editingAccessUser.name}`
          : `Access updated for ${editingAccessUser.name}`
      );
      setEditingAccessUser(null);
      setError('');
      await refreshAfterMutation();
    } catch (err) {
      setError(err.message);
      toast(err.message);
    }
  };

  const onAddDocument = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData();
      form.append('title', docForm.title);
      form.append('category', docForm.category || 'INVOICE');
      form.append('directory', docForm.directory || 'INVOICE');
      form.append('periodYear', String(docForm.periodYear || new Date().getFullYear()));
      form.append('periodMonth', String(docForm.periodMonth || new Date().getMonth() + 1));
      if (docForm.file) form.append('file', docForm.file);
      const response = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        body: form
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || payload?.message || 'Upload failed');
      toast('Document saved to directory');
      setDocForm({
        title: '',
        category: 'INVOICE',
        directory: 'INVOICE',
        periodYear: new Date().getFullYear(),
        periodMonth: new Date().getMonth() + 1,
        file: null
      });
      await refreshAfterMutation();
    } catch (err) {
      setError(err.message);
      toast(err.message);
    }
  };

  const refreshSalaryPreview = async (form = salaryForm) => {
    if (!form.userId) {
      setSalaryPreview(null);
      return null;
    }
    try {
      const params = new URLSearchParams({
        userId: form.userId,
        baseSalary: String(form.baseSalary || 0),
        periodType: form.periodType || 'week',
        periodAnchor: form.periodAnchor || new Date().toISOString().slice(0, 10),
        expectedHours: String(form.expectedHours || (form.periodType === 'month' ? 160 : 40))
      });
      const res = await api(`/salaries/preview?${params.toString()}`);
      setSalaryPreview(res.data);
      setSalaryForm((prev) => ({
        ...prev,
        workingDays: String(res.data.workingDays ?? 0),
        workingHours: String(res.data.workingHours ?? 0),
        calculatedSalary: String(res.data.calculatedSalary ?? '')
      }));
      return res.data;
    } catch (err) {
      setSalaryPreview(null);
      toast(err.message);
      return null;
    }
  };

  const onSalaryFormChange = (patch) => {
    const next = { ...salaryForm, ...patch };
    if (patch.periodType === 'week' && !patch.expectedHours) next.expectedHours = '40';
    if (patch.periodType === 'month' && !patch.expectedHours) next.expectedHours = '160';
    setSalaryForm(next);
    if (next.userId && (patch.userId || patch.periodType || patch.periodAnchor || patch.baseSalary || patch.expectedHours)) {
      refreshSalaryPreview(next);
    }
  };

  const onAddSalary = async (e) => {
    e.preventDefault();
    try {
      const preview = salaryPreview || (await refreshSalaryPreview());
      await api('/salaries', {
        method: 'POST',
        body: JSON.stringify({
          userId: salaryForm.userId,
          baseSalary: Number(salaryForm.baseSalary),
          paidAmount: Number(salaryForm.paidAmount || 0),
          workingDays: Number(salaryForm.workingDays || preview?.workingDays || 0),
          workingHours: Number(salaryForm.workingHours || preview?.workingHours || 0),
          calculatedSalary: Number(
            salaryForm.calculatedSalary || preview?.calculatedSalary || salaryForm.baseSalary
          ),
          periodType: salaryForm.periodType,
          periodAnchor: salaryForm.periodAnchor,
          expectedHours: Number(salaryForm.expectedHours || 40),
          autoCalculate: true
        })
      });
      toast(
        `Salary saved · ${salaryForm.periodType === 'week' ? 'weekly' : 'monthly'} · ${money(
          Number(salaryForm.calculatedSalary || preview?.calculatedSalary || 0)
        )} from clock hours`
      );
      setSalaryForm({
        userId: '',
        baseSalary: salaryForm.periodType === 'week' ? '400' : '2000',
        paidAmount: '0',
        workingDays: '0',
        workingHours: '0',
        calculatedSalary: '',
        periodType: salaryForm.periodType,
        periodAnchor: new Date().toISOString().slice(0, 10),
        expectedHours: salaryForm.periodType === 'week' ? '40' : '160'
      });
      setSalaryPreview(null);
      await refreshAfterMutation();
    } catch (err) {
      setError(err.message);
      toast(err.message);
    }
  };

  const openEditSalary = (row) => {
    setEditingSalary({
      id: row.id,
      name: row.user?.name || 'Employee',
      baseSalary: String(row.baseSalary ?? 0),
      calculatedSalary: String(row.calculatedSalary ?? 0),
      paidAmount: String(row.paidAmount ?? 0),
      workingDays: String(row.workingDays ?? 0),
      workingHours: String(row.workingHours ?? 0),
      partialPay: ''
    });
  };

  const saveEditSalary = async () => {
    if (!editingSalary) return;
    try {
      await api(`/salaries/${editingSalary.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          baseSalary: Number(editingSalary.baseSalary),
          calculatedSalary: Number(editingSalary.calculatedSalary),
          paidAmount: Number(editingSalary.paidAmount),
          workingDays: Number(editingSalary.workingDays),
          workingHours: Number(editingSalary.workingHours)
        })
      });
      toast('Salary updated');
      setEditingSalary(null);
      await refreshAfterMutation();
    } catch (err) {
      toast(err.message);
    }
  };

  const recalculateSalary = async (id) => {
    try {
      await api(`/salaries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ recalculate: true, periodType: 'week' })
      });
      toast('Recalculated from clock in/out');
      await refreshAfterMutation();
    } catch (err) {
      toast(err.message);
    }
  };

  const loadDemoHistory = async () => {
    if (!isAdmin) {
      toast('Only admin can load demo history');
      return;
    }
    try {
      const res = await api('/admin/seed-demo', { method: 'POST' });
      toast(res.data?.message || 'Demo history loaded (UK time)');
      await refreshAfterMutation();
    } catch (err) {
      toast(err.message);
    }
  };

  const paySalaryRecord = async (id, mode, amount) => {
    try {
      await api(`/salaries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: mode === 'full' ? 'pay_full' : 'pay_partial',
          amount: amount != null ? Number(amount) : undefined
        })
      });
      toast(mode === 'full' ? 'Marked paid in full' : `Partial payment ${money(amount)} recorded`);
      setEditingSalary(null);
      await refreshAfterMutation();
    } catch (err) {
      toast(err.message);
    }
  };

  const checkout = async (requestedSaleMode = saleMode) => {
    if (!cart.length) {
      toast('Add at least one product');
      return;
    }
    setBilling(true);
    setError('');
    try {
      if (requestedSaleMode === 'UNPAID' && (!customer.name.trim() || !customer.phone.trim())) {
        setSaleMode('UNPAID');
        throw new Error('Due sales require customer name and mobile number');
      }
      const methodMap = {
        card: 'CARD',
        cash: 'CASH',
        bank: 'BANK_TRANSFER'
      };
      const isAdmin = user?.role === 'ADMIN';
      const payload = {
        items: cart.map((item) => ({
          productId: String(item.productId || '').startsWith('manual-') ? undefined : item.productId,
          quantity: item.quantity,
          manual: Boolean(item.manual || String(item.productId || '').startsWith('manual-')),
          name: item.name,
          sellingPrice: item.sellingPrice,
          category: item.category,
          purchasePrice: item.purchasePrice,
          size: item.size
        })),
        customer: {
          name: customer.name.trim() || 'Walk-in customer',
          email: customer.email,
          phone: customer.phone,
          companyName: customer.companyName,
          address: customer.address,
          city: customer.city.trim() || 'Cardiff',
          location: customer.location.trim() || '136A Woodville Road'
        },
        paymentMethod: methodMap[paymentMethod] || 'CARD',
        paymentStatus: requestedSaleMode,
        cashReceived: requestedSaleMode === 'PAID' ? cartTotal : undefined,
        discount: posDiscount,
        discountType: posDiscountType,
        discountPercent: posDiscountType === 'PERCENT' ? Number(posDiscountValue || 0) : 0,
        taxRate: Math.max(0, Number(posTaxRate) || 0) / 100,
        channel: salesChannel,
        idempotencyKey: `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`
      };
      if (isAdmin && saleDateTime) {
        payload.saleDate = new Date(saleDateTime).toISOString();
      }
      const r = await api('/pos/sale', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const sale = r.data.sale;
      setInvoice({
        ...sale,
        invoiceNumber: sale.invoiceNumber,
        orderNumber: sale.invoiceNumber,
        share: r.data.invoice
      });
      setCart([]);
      setCustomer(emptyCustomer);
      setPosDiscountValue('0');
      setSaleMode('PAID');
      setSaleDateTime(toLocalInputValue());
      saleDateFollowClock.current = true;
      toast(isAdmin && saleDateTime ? 'Backdated invoice created' : 'Invoice created');
      await refreshAfterMutation();
      try {
        const session = await api('/attendance/status');
        setPosSession(session.data);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e.message);
      toast(e.message);
    } finally {
      setBilling(false);
    }
  };

  const addManualProductToCart = () => {
    const name = manualProduct.name.trim();
    const sellingPrice = Number(manualProduct.sellingPrice);
    const purchasePrice = Number(manualProduct.purchasePrice || 0);
    const quantity = Math.max(1, Number(manualProduct.quantity) || 1);
    if (!name || !(sellingPrice >= 0)) {
      toast('Enter a product name and sell price');
      return;
    }
    const id = `manual-${Date.now()}`;
    const category = manualProduct.category.trim() || 'Manual';
    setProducts((prev) => [
      ...prev,
      {
        id,
        name,
        category,
        purchasePrice,
        sellingPrice,
        stockQuantity: quantity,
        sku: 'MANUAL',
        barcode: 'Manual entry',
        size: manualProduct.size || '100ml',
        isManualEntry: true
      }
    ]);
    setCart((prev) => [
      ...prev,
      { productId: id, quantity, manual: true, name, category, purchasePrice, sellingPrice, size: manualProduct.size || '100ml' }
    ]);
    setManualProduct({ name: '', category: '', size: '100ml', purchasePrice: '', sellingPrice: '', quantity: '1' });
    setShowManualPos(false);
    toast(`${name} added to the bill`);
  };

  const weeklyTotal = (dash?.weeklySales || []).reduce((a, x) => a + x.total, 0);

  if (!user && !authChecked) {
    return (
      <main className="login-page">
        <div className="login-card">
          <div className="brand brand-stack">
            <img src="/the-ouds-logo.png?v=3" alt="" className="brand-logo hero" />
            <div>
              <b className="brand-name">THE OUDS</b>
              <span className="brand-tag">Management</span>
            </div>
          </div>
          <h1>Restoring session</h1>
          <p>Please wait…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <div className="brand brand-stack">
            <img src="/the-ouds-logo.png?v=3" alt="" className="brand-logo hero" />
            <div>
              <b className="brand-name">THE OUDS</b>
              <span className="brand-tag">Management</span>
            </div>
          </div>
          <h1>Welcome back</h1>
          <p>Sign in with your email or employee ID.</p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <label>
            Email or Employee ID
            <input
              type="text"
              required
              autoComplete="username"
              value={credentials.identifier}
              onChange={(e) => {
                setError('');
                setCredentials({ ...credentials, identifier: e.target.value });
              }}
              placeholder="Email or employee ID"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={credentials.password}
              onChange={(e) => {
                setError('');
                setCredentials({ ...credentials, password: e.target.value });
              }}
            />
          </label>
          <button className="primary" disabled={signingIn}>
            {signingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className={`shell ${navOpen ? 'nav-open' : ''}`}>
      {navOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/the-ouds-logo.png?v=3" alt="" className="brand-logo" />
          <div>
            <b className="brand-name">THE OUDS</b>
            <span className="brand-tag">Management</span>
          </div>
        </div>
        <div className="side-search">
          <Icon name="search" />
          <input
            placeholder="Search…"
            readOnly
            onFocus={() => setGlobalSearchOpen(true)}
            onClick={() => setGlobalSearchOpen(true)}
          />
        </div>
        {allowedNav.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            <nav>
              {group.items.map(([name, icon]) => (
                <Link
                  key={name}
                  href={pathForPage(name)}
                  className={active === name ? 'active' : ''}
                  title={pathForPage(name)}
                  onClick={() => setNavOpen(false)}
                >
                  <span className="nav-icon">
                    <Icon name={icon} />
                  </span>
                  <span className="nav-text">{name}</span>
                  {name === 'Unpaid / Due' && (sales.filter((s) => s.paymentStatus === 'UNPAID').length || 0) > 0 && (
                    <small>{sales.filter((s) => s.paymentStatus === 'UNPAID').length}</small>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        ))}
        <div className="sidebar-bottom">
          <button className="logout" onClick={logout}>
            Sign out
          </button>
          <div className="profile">
            <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <b>{user.name}</b>
              <span>{user.role}</span>
            </div>
          </div>
        </div>
      </aside>

      <section className={`content ${active === 'POS' ? 'pos-mode' : ''}`}>
        <header className="page-head">
          <div className="page-head-copy">
            <button
              type="button"
              className="btn icon-btn menu-toggle"
              title="Open menu"
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <button
              type="button"
              className="btn icon-btn back-btn"
              title="Back"
              aria-label="Back"
              disabled={active === 'Overview'}
              onClick={goBack}
            >
              <Icon name="back" />
            </button>
            <div>
              <p className="crumb">
                <Link href="/">theouds</Link>
                <span>/</span>
                <span>{route.slug || 'dashboard'}</span>
              </p>
              <h1>{active === 'Overview' ? 'Dashboard' : active}</h1>
              <p className="subhead">
                {active === 'Overview'
                  ? `Good morning, ${user.name.split(' ')[0]}. Here’s what’s happening today.`
                  : active === 'POS'
                    ? 'Bill products at the till and generate a UK-style VAT invoice in GBP (£).'
                    : `${route.path} · Manage your business activity in one organized place.`}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn icon-btn" title="Search" type="button" onClick={() => setGlobalSearchOpen(true)}>
              <Icon name="search" />
            </button>
            <NotificationBell Icon={Icon} onOpenPage={setActive} />
          </div>
        </header>

        {notice && <div className="toast">✓ {notice}</div>}
        <GlobalSearch open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} onOpenPage={setActive} />

        {invoice && (
          <div className="invoice-overlay" onClick={() => setInvoice(null)}>
            <div className="invoice-card receipt" onClick={(e) => e.stopPropagation()}>
              <div className="receipt-brand">
                <img src="/the-ouds-logo.png?v=3" alt="" className="receipt-logo" />
                <h2>THE OUDS</h2>
                <p>136A Woodville Road, Cardiff CF24 4EE</p>
                <p>+44 7454 045315</p>
                <p>www.theouds.co.uk</p>
              </div>
              <div className="receipt-meta">
                <div className="row"><span>Invoice</span><span>{invoice.invoiceNumber || invoice.orderNumber}</span></div>
                <div className="row"><span>Date</span><span>{new Date(invoice.createdAt || invoice.saleDate || Date.now()).toLocaleString('en-GB')}</span></div>
                <div className="row"><span>Staff</span><span>{invoice.staff?.name || user?.name || '—'}</span></div>
                <div className="row"><span>Customer</span><span>{invoice.customer?.name || 'Walk-in'}</span></div>
                {invoice.customer?.phone && <div className="row"><span>Mobile</span><span>{invoice.customer.phone}</span></div>}
                {invoice.customer?.companyName && <div className="row"><span>Company</span><span>{invoice.customer.companyName}</span></div>}
                {invoice.customer?.city && <div className="row"><span>City</span><span>{invoice.customer.city}</span></div>}
                {invoice.customer?.location && <div className="row"><span>Location</span><span>{invoice.customer.location}</span></div>}
              </div>
              <table className="receipt-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, idx) => {
                    const line = item.lineTotal ?? (item.sellingPrice ?? item.price ?? 0) * item.quantity;
                    return (
                      <tr key={`${item.name}-${idx}`}>
                        <td>
                          {item.name}
                          <small className="receipt-size">Size {invoiceItemSize(item)}</small>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{money(line)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="invoice-totals receipt-totals">
                <div><span>Subtotal</span><b>{money(invoice.subtotal)}</b></div>
                {Number(invoice.discount) > 0 && (
                  <div>
                    <span>Discount{invoice.discountPercent ? ` (${invoice.discountPercent}%)` : ''}</span>
                    <b>{money(invoice.discount)}</b>
                  </div>
                )}
                <div><span>VAT ({Number(invoice.taxRate || 0) * 100}%)</span><b>{money(invoice.tax)}</b></div>
                <div className="grand"><span>Total</span><b>{money(invoice.total)}</b></div>
                <div>
                  <span>{invoice.paymentStatus === 'UNPAID' ? 'Due' : 'Paid'}</span>
                  <b>{money(invoice.cashReceived ?? (invoice.paymentStatus === 'UNPAID' ? 0 : invoice.total))}</b>
                </div>
              </div>
              <p className="receipt-thanks">Thank you for shopping with us.</p>
              <div className="receipt-qr">
                <img src="/refund-policy-qr.png" alt="Refund policy" />
                <p>Refund policy</p>
              </div>
              <div className="invoice-actions">
                {invoice.id && (
                  <>
                    <a className="btn" href={`/api/invoices/${invoice.id}/print`} target="_blank" rel="noreferrer">Print</a>
                    <a className="btn" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>
                  </>
                )}
                <button className="btn primary" type="button" onClick={() => setInvoice(null)}>Done</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <section className="panel loading-state">
            <div className="spinner" />
            <p>Loading your live business data…</p>
          </section>
        ) : error && active === 'Overview' && !dash ? (
          <section className="panel empty-module">
            <div className="large-icon">!</div>
            <h3>Couldn’t load data</h3>
            <p>{error}</p>
            <button className="btn primary" style={{ marginTop: 16 }} onClick={load}>
              Try again
            </button>
          </section>
        ) : active === 'Overview' ? (
          <>
            <div className="stats">
              {(dash?.access?.sales !== false) && (
                <Stat
                  label="Today’s sales"
                  value={money(dash?.todaySales)}
                  detail={`${dash?.todayOrderCount || 0} invoice(s) today`}
                  tone="up"
                />
              )}
              {(dash?.access?.sales !== false) && (
                <Stat
                  label="Last month sales"
                  value={money(dash?.lastMonthSales)}
                  detail={`${dash?.lastMonthOrderCount || 0} invoice(s) · ${dash?.lastMonthLabel || 'previous month'}`}
                  tone="up"
                />
              )}
              <Stat
                label="Stock value"
                value={money(dash?.stockValue)}
                detail={canSeeCost ? 'At cost' : 'At sell price'}
              />
              {(dash?.access?.attendance !== false) && (
                <Stat
                  label="Staff clocked in"
                  value={dash?.clockedIn || 0}
                  detail="Currently on shift"
                />
              )}
              {(dash?.access?.payroll !== false) && (
                <Stat
                  label="Pending dues"
                  value={money(dash?.pendingDues)}
                  detail="Outstanding payroll"
                />
              )}
            </div>

            {(dash?.access?.sales !== false || dash?.access?.attendance !== false) && (
              <section className="panel staff-day-panel">
                <div className="panel-title">
                  <div>
                    <h2>Staff sales today</h2>
                    <p>
                      Auto cards for everyone who clocked in or made a sale ·{' '}
                      {(dash?.staffDayCards || []).length} user(s)
                    </p>
                  </div>
                  <button className="link-btn" onClick={() => setActive('Attendance')}>
                    Attendance →
                  </button>
                </div>
                {(dash?.staffDayCards || []).length ? (
                  <div className="staff-day-grid">
                    {(dash.staffDayCards || [])
                      .filter((card) => user?.role === 'ADMIN' || card.userId === user?.id)
                      .map((card) => (
                      <article className={`staff-day-card ${card.onShift ? 'on-shift' : ''}`} key={card.userId}>
                        <div className="staff-day-head">
                          <div>
                            <b>{card.name}</b>
                            <small>{card.employeeId || 'Staff'}</small>
                          </div>
                          <span className={`badge ${card.onShift ? 'paid' : 'pending'}`}>
                            {card.onShift ? 'On shift' : card.clockOut ? 'Clocked out' : 'No clock'}
                          </span>
                        </div>
                        <div className="staff-day-sales">
                          <strong>{money(card.salesTotal)}</strong>
                          <span>{card.invoiceCount} sale(s)</span>
                        </div>
                        <div className="staff-day-clock">
                          <span>In {card.clockIn || '—'}</span>
                          <span className="clock-arrow">→</span>
                          <span>Out {card.clockOut || (card.onShift ? 'now' : '—')}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-table">No staff clock-ins or sales yet today.</div>
                )}
              </section>
            )}

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Trending products</h2>
                  <p>Top 10 by quantity sold this week</p>
                </div>
              </div>
              <div className="data-table">
                {(dash?.trendingProducts || []).length ? (dash.trendingProducts || []).map((p, i) => (
                  <div className="table-row" key={p.id}>
                    <span>{i + 1}. {p.name}</span>
                    <span>{p.qty} sold</span>
                    <strong>{money(p.revenue)}</strong>
                  </div>
                )) : (
                  <div className="empty-table">No sales in this period yet — rankings appear after POS sales.</div>
                )}
              </div>
            </section>

            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Sales performance</h2>
                    <p>Revenue and transactions this week</p>
                  </div>
                  <button className="link-btn" onClick={() => setActive('Reports')}>
                    View report →
                  </button>
                </div>
                <div className="chart-info">
                  <div>
                    <strong>{money(weeklyTotal)}</strong>
                    <p>Weekly revenue from completed orders</p>
                  </div>
                  <div className="legend">
                    <i /> Sales <i className="faint" /> Target
                  </div>
                </div>
                <div className="chart">
                  <div className="gridlines" />
                  <svg viewBox="0 0 650 190" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                        <stop stopColor="#111827" stopOpacity=".18" />
                        <stop offset="1" stopColor="#111827" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,152 C35,139 52,140 75,122 S122,135 148,108 S198,119 227,92 S274,112 302,75 S347,85 376,66 S420,89 449,43 S500,55 526,38 S575,48 600,18 S630,28 650,13 L650,190 L0,190Z"
                      fill="url(#fill)"
                    />
                    <path
                      d="M0,152 C35,139 52,140 75,122 S122,135 148,108 S198,119 227,92 S274,112 302,75 S347,85 376,66 S420,89 449,43 S500,55 526,38 S575,48 600,18 S630,28 650,13"
                      fill="none"
                      stroke="#111827"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="chart-days">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span>
                    <span>Fri</span><span>Sat</span><span>Sun</span>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Quick actions</h2>
                    <p>Get things done faster</p>
                  </div>
                </div>
                <div className="quick-actions">
                  {canAccessNav('POS', userPermissions, user?.role) && (
                    <button onClick={() => setActive('POS')}>
                      <span className="qa-icon"><Icon name="pos" /></span>
                      <span>Open POS</span>
                    </button>
                  )}
                  {canAccessNav('Inventory', userPermissions, user?.role) && (
                    <button onClick={() => setActive('Inventory')}>
                      <span className="qa-icon"><Icon name="inventory" /></span>
                      <span>Add stock</span>
                    </button>
                  )}
                  {canAccessNav('Attendance', userPermissions, user?.role) && (
                    <button onClick={openClockModal}>
                      <span className="qa-icon"><Icon name="attendance" /></span>
                      <span>Clock in / out</span>
                    </button>
                  )}
                  {canAccessNav('Documents', userPermissions, user?.role) && (
                    <button onClick={() => setActive('Documents')}>
                      <span className="qa-icon"><Icon name="documents" /></span>
                      <span>Upload file</span>
                    </button>
                  )}
                  {canAccessNav('Sales', userPermissions, user?.role) && (
                    <button onClick={() => { setSalesPeriod('last_month'); setActive('Sales'); }}>
                      <span className="qa-icon"><Icon name="sales" /></span>
                      <span>Last month sales</span>
                    </button>
                  )}
                  {canAccessNav('Team & Roles', userPermissions, user?.role) && (
                    <button onClick={() => setActive('Team & Roles')}>
                      <span className="qa-icon"><Icon name="team" /></span>
                      <span>Access management</span>
                    </button>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Recent billing</h2>
                    <p>Latest invoices across channels</p>
                  </div>
                  <button className="link-btn" onClick={() => setActive('Invoice List')}>
                    View all →
                  </button>
                </div>
                <div className="orders-list">
                  {(dash?.recentOrders?.length ? dash.recentOrders : orders.slice(0, 5)).length ? (
                    (dash?.recentOrders?.length ? dash.recentOrders : orders.slice(0, 5)).map((o) => (
                      <div className="order" key={o.id || o._id}>
                        <div className="order-icon"><Icon name="orders" /></div>
                        <div className="order-name">
                          <b>{o.customer?.name || 'Walk-in customer'}</b>
                          <span>
                            {o.invoiceNumber || o.orderNumber} · {o.items?.length || 0} item(s)
                          </span>
                        </div>
                        <div className="order-price">
                          <b>{money(o.total)}</b>
                          <span className={statusClass(o.paymentStatus || o.status)}>
                            {o.paymentStatus || o.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="no-data">No recent invoices yet.</p>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Needs attention</h2>
                    <p>Keep the store running smoothly</p>
                  </div>
                </div>
                <div className="alerts-list">
                  <div className="alert-row">
                    <div className="alert-icon red">!</div>
                    <div className="alert-copy">
                      <b>{dash?.lowStock?.length || 0} products are low in stock</b>
                      <p>Reorder before the next rush.</p>
                    </div>
                    <button className="btn-text" onClick={() => setActive('Inventory')}>Review</button>
                  </div>
                  <div className="alert-row">
                    <div className="alert-icon warn">£</div>
                    <div className="alert-copy">
                      <b>{dash?.unpaidSaleCount || 0} unpaid / due invoices</b>
                      <p>Customer dues waiting to be collected.</p>
                    </div>
                    <button className="btn-text" onClick={() => setActive('Unpaid / Due')}>Review</button>
                  </div>
                  <div className="alert-row">
                    <div className="alert-icon warn">£</div>
                    <div className="alert-copy">
                      <b>Salary payments due</b>
                      <p>{money(dash?.pendingDues)} pending payroll.</p>
                    </div>
                    <button className="btn-text" onClick={() => setActive('Payroll')}>Review</button>
                  </div>
                  <div className="alert-row">
                    <div className="alert-icon info">!</div>
                    <div className="alert-copy">
                      <b>{dash?.pendingManualCount || 0} manual POS products to review</b>
                      <p>Staff entered products that need admin approval.</p>
                    </div>
                    <button className="btn-text" onClick={() => setActive('Inventory')}>Review</button>
                  </div>
                  <div className="alert-row">
                    <div className="alert-icon info">↗</div>
                    <div className="alert-copy">
                      <b>{dash?.pendingRequestCount || 0} pending document requests</b>
                      <p>{dash?.needInfoRequestCount || 0} need information · {dash?.readyRequestCount || 0} ready · {dash?.overdueRequestCount || 0} overdue</p>
                    </div>
                    <button className="btn-text" onClick={() => setActive('Requests')}>Review</button>
                  </div>
                  {(dash?.activities || []).slice(0, 5).map((n) => (
                    <div className="alert-row" key={n.id}>
                      <div className="alert-icon info">•</div>
                      <div className="alert-copy">
                        <b>{n.title}</b>
                        <p>{n.message}</p>
                      </div>
                    </div>
                  ))}
                  {(dash?.expenseDueCount || 0) > 0 && (
                    <div className="alert-row">
                      <div className="alert-icon warn">£</div>
                      <div className="alert-copy">
                        <b>{dash.expenseDueCount} expense(s) due</b>
                        <p>Rent, electricity or supplier bills.</p>
                      </div>
                      <button className="btn-text" onClick={() => setActive('Expenses')}>Review</button>
                    </div>
                  )}
                  {(dash?.loanDueCount || 0) > 0 && (
                    <div className="alert-row">
                      <div className="alert-icon warn">£</div>
                      <div className="alert-copy">
                        <b>{dash.loanDueCount} loan(s) due</b>
                        <p>Lender payments need attention.</p>
                      </div>
                      <button className="btn-text" onClick={() => setActive('Accounts')}>Review</button>
                    </div>
                  )}
                  {(dash?.supplierOverdueCount || 0) > 0 && (
                    <div className="alert-row">
                      <div className="alert-icon red">£</div>
                      <div className="alert-copy">
                        <b>{dash.supplierOverdueCount} supplier payment(s) overdue</b>
                        <p>Due date has passed and a balance remains.</p>
                      </div>
                      <button className="btn-text" onClick={() => setActive('Suppliers')}>Review</button>
                    </div>
                  )}
                  {(dash?.supplierDueSoonCount || 0) > 0 && (
                    <div className="alert-row">
                      <div className="alert-icon warn">£</div>
                      <div className="alert-copy">
                        <b>{dash.supplierDueSoonCount} supplier payment(s) due soon</b>
                        <p>Due date is approaching.</p>
                      </div>
                      <button className="btn-text" onClick={() => setActive('Suppliers')}>Review</button>
                    </div>
                  )}
                  {(dash?.supplierDueCount || 0) > 0 && (
                    <div className="alert-row">
                      <div className="alert-icon warn">£</div>
                      <div className="alert-copy">
                        <b>{dash.supplierDueCount} supplier(s) with outstanding dues</b>
                        <p>Purchase balances waiting to be paid.</p>
                      </div>
                      <button className="btn-text" onClick={() => setActive('Suppliers')}>Review</button>
                    </div>
                  )}
                  {dash?.storeClosingSoon && (
                    <div className="alert-row">
                      <div className="alert-icon info">!</div>
                      <div className="alert-copy">
                        <b>Daily store close</b>
                        <p>Generate the daily summary before 11:59 PM reset.</p>
                      </div>
                    </div>
                  )}
                  {(dash?.adminPresence || []).slice(0, 3).map((a) => (
                    <div className="alert-row" key={a.name}>
                      <div className="alert-icon info">•</div>
                      <div className="alert-copy">
                        <b>{a.name} last seen</b>
                        <p>{a.lastSeenAt || a.lastLoginAt ? new Date(a.lastSeenAt || a.lastLoginAt).toLocaleString('en-GB') : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : active === 'POS' ? (
          <section className="pos-layout">
            {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
            {(() => {
              const myDay = (dash?.staffDayCards || []).find((c) => c.userId === user?.id);
              const clockIn = posSession?.clockIn || myDay?.clockIn;
              const clockOut = posSession?.isClockedIn ? (posSession?.clockOut || 'now') : (myDay?.clockOut || '—');
              const salesCount = posSession?.todaySaleCount ?? myDay?.invoiceCount ?? 0;
              const salesTotal = posSession?.todaySaleTotal ?? myDay?.salesTotal ?? 0;
              const till = posSession?.tillCash ?? posSession?.currentBalance ?? posSession?.storeBalance;
              return (
                <div className="panel pos-session">
                  <div className="pos-session-grid">
                    <div>
                      <small>Clock out</small>
                      <b>{clockOut}</b>
                    </div>
                    <div>
                      <small>Clock in</small>
                      <b>{clockIn || 'Not clocked in'}</b>
                    </div>
                    <div>
                      <small>My sales</small>
                      <b>{salesCount} · {money(salesTotal)}</b>
                    </div>
                    <div>
                      <small>Till cash</small>
                      <b>{till != null ? money(till) : '—'}</b>
                    </div>
                    <div>
                      <small>Logged in</small>
                      <b>{user?.name}</b>
                    </div>
                    <button className="btn" type="button" onClick={openClockModal}>
                      {posSession?.isClockedIn ? 'Clock out' : 'Clock in'}
                    </button>
                  </div>
                </div>
              );
            })()}
            <div className="panel pos-catalog">
              <div className="panel-title">
                <div>
                  <h2>Product catalog</h2>
                  <p>Scan barcode or tap a fragrance to add it to the bill</p>
                </div>
                <button className="btn" type="button" onClick={() => setShowManualPos((v) => !v)}>
                  {showManualPos ? 'Close manual product' : 'Manual product'}
                </button>
              </div>
              <form
                className="scan-bar"
                onSubmit={(e) => {
                  e.preventDefault();
                  onScanProduct(scanCode || query, { add: true });
                }}
              >
                <input
                  className="search-input scan-input"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  placeholder="Scan barcode here…"
                  autoComplete="off"
                  autoFocus={active === 'POS'}
                />
                <button className="btn primary" type="submit">Add scan</button>
              </form>
              {showManualPos && (
                <div id="manual-pos-entry" className="pos-customer" style={{ marginBottom: 14 }}>
                  <label>
                    Product name
                    <input
                      value={manualProduct.name}
                      onChange={(e) => setManualProduct({ ...manualProduct, name: e.target.value })}
                      placeholder="Any product name"
                    />
                  </label>
                  <label>
                    Category
                    <input
                      list="pos-manual-categories"
                      value={manualProduct.category}
                      onChange={(e) => setManualProduct({ ...manualProduct, category: e.target.value })}
                      placeholder="e.g. Women's Perfume"
                    />
                    <datalist id="pos-manual-categories">
                      {categories.map((c) => (
                        <option key={c.id || c.name} value={c.name} />
                      ))}
                    </datalist>
                  </label>
                  <SizeMlField
                    value={manualProduct.size}
                    onChange={(size) => setManualProduct({ ...manualProduct, size })}
                    extraSizes={extraSizes}
                    onAdd={onAddSize}
                  />
                  <label>
                    Cost (£)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualProduct.purchasePrice}
                      onChange={(e) => setManualProduct({ ...manualProduct, purchasePrice: e.target.value })}
                    />
                  </label>
                  <label>
                    Sell price (£)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualProduct.sellingPrice}
                      onChange={(e) => setManualProduct({ ...manualProduct, sellingPrice: e.target.value })}
                    />
                  </label>
                  <label>
                    Qty
                    <input
                      type="number"
                      min="1"
                      value={manualProduct.quantity}
                      onChange={(e) => setManualProduct({ ...manualProduct, quantity: e.target.value })}
                    />
                  </label>
                  <button className="btn primary" type="button" onClick={addManualProductToCart}>
                    Add to bill
                  </button>
                </div>
              )}
              <input
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const q = query.trim();
                    if (/^\d{6,}$/.test(q) || /^TOU-/i.test(q)) {
                      onScanProduct(q, { add: true });
                    }
                  }
                }}
                placeholder="Search name, SKU, or barcode…"
              />
              <div className="pos-grid">
                {products
                  .filter((p) => p.isActive !== false && matchesProductQuery(p, query))
                  .map((p) => {
                    const stock = productStockOf(p);
                    const stockClass = stock <= 0 ? 'out' : stock <= productMinOf(p) ? 'low' : '';
                    return (
                      <button key={productIdOf(p)} className="pos-product" onClick={() => addToCart(p)} type="button">
                        {productImageOf(p) ? (
                          <img src={productImageOf(p)} alt={p.name || ''} className="pos-thumb" />
                        ) : (
                          <div className="pos-thumb empty" aria-hidden="true" />
                        )}
                        <b>{p.name}</b>
                        {p.brand ? <span className="pos-brand">{p.brand}</span> : null}
                        <span className="product-ids">
                          <span className="sku-chip">{p.sku}</span>
                          <span className="barcode-chip" title="Barcode">{p.barcode}</span>
                        </span>
                        <strong>{money(productPriceOf(p))}</strong>
                        <small className={`stock-pill ${stockClass}`}>
                          {stock <= 0 ? 'Out of stock' : `${stock} in stock`}
                        </small>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="panel pos-bill">
              <div className="panel-title">
                <div>
                  <h2>Current bill</h2>
                  <p>UK-style VAT invoice · GBP (£)</p>
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="pos-datetime">
                  <label>
                    Sale date & time
                    <input type="datetime-local" value={saleDateTime} max={toLocalInputValue()} readOnly />
                  </label>
                  <p className="hint">Set automatically to the current date and time.</p>
                </div>
              )}

              <div className="pos-customer">
                <label>
                  Customer name {saleMode === 'UNPAID' ? '*' : ''}
                  <input
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    placeholder={saleMode === 'UNPAID' ? 'Required for due sale' : 'Walk-in customer'}
                  />
                </label>
                <label>
                  Mobile {saleMode === 'UNPAID' ? '*' : ''}
                  <input
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="+44…"
                  />
                </label>
                <label>
                  City {saleMode === 'UNPAID' ? '*' : ''}
                  <input value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} placeholder="Cardiff" />
                </label>
                <label>
                  Location {saleMode === 'UNPAID' ? '*' : ''}
                  <input value={customer.location} onChange={(e) => setCustomer({ ...customer, location: e.target.value })} placeholder="Shop location" />
                </label>
              </div>

              <div className="pos-cart">
                {cartLines.length ? (
                  cartLines.map((line) => (
                    <div className="pos-line" key={line.productId}>
                      {productImageOf(line.product) ? (
                        <img src={productImageOf(line.product)} alt="" className="cart-thumb" />
                      ) : (
                        <div className="cart-thumb empty" />
                      )}
                      <div>
                        <b>{line.product?.name}</b>
                        <span className="barcode-chip">Size {invoiceItemSize(line.product || line)}</span>
                        <span>{money(productPriceOf(line.product))} each</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={line.manual ? 9999 : productStockOf(line.product) || 1}
                        value={line.quantity}
                        onChange={(e) => updateCartQty(line.productId, e.target.value)}
                      />
                      <strong>{money(line.lineTotal)}</strong>
                      <button className="btn-text" type="button" onClick={() => removeFromCart(line.productId)}>
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No items on the bill yet.</p>
                )}
              </div>

              <div className="pos-pay">
                <label>
                  Discount
                  <select value={posDiscountType} onChange={(e) => setPosDiscountType(e.target.value)}>
                    <option value="FIXED">Fixed £</option>
                    <option value="PERCENT">Percent %</option>
                    <option value="MANUAL">Manual £</option>
                  </select>
                </label>
                <label>
                  {posDiscountType === 'PERCENT' ? 'Discount %' : 'Discount £'}
                  <input type="number" min="0" step="0.01" value={posDiscountValue} onChange={(e) => setPosDiscountValue(e.target.value)} />
                </label>
                <label>
                  VAT %
                  <input type="number" min="0" step="0.01" value={posTaxRate} onChange={(e) => setPosTaxRate(e.target.value)} />
                </label>
                <label>
                  Channel
                  <select value={salesChannel} onChange={(e) => setSalesChannel(e.target.value)}>
                    <option value="IN_STORE">In store</option>
                    <option value="WEBSITE">Website</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="EBAY">eBay</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label>
                  Payment
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank transfer</option>
                  </select>
                </label>
              </div>

              <div className="invoice-totals compact">
                <div><span>Subtotal</span><b>{money(cartSubtotal)}</b></div>
                <div><span>Discount{posDiscountType === 'PERCENT' ? ` (${posDiscountValue || 0}%)` : ''}</span><b>{money(posDiscount)}</b></div>
                <div><span>VAT ({posTaxRate || 0}%)</span><b>{money(cartTax)}</b></div>
                <div className="grand"><span>Total</span><b>{money(cartTotal)}</b></div>
              </div>

              <div className="pos-checkout-row">
                <button
                  type="button"
                  className="btn primary"
                  disabled={billing}
                  onClick={() => {
                    setSaleMode('PAID');
                    checkout('PAID');
                  }}
                >
                  {billing && saleMode === 'PAID' ? 'Creating…' : 'Paid'}
                </button>
                <button
                  type="button"
                  className="btn pos-unpaid"
                  disabled={billing}
                  onClick={() => {
                    setSaleMode('UNPAID');
                    checkout('UNPAID');
                  }}
                >
                  {billing && saleMode === 'UNPAID' ? 'Creating…' : 'Unpaid / Due'}
                </button>
              </div>
            </div>
          </section>
        ) : active === 'Invoice List' || active === 'Unpaid / Due' ? (
          <section className="module panel">
            <div className="module-head">
              <div>
                <h2>{active}</h2>
                <p>
                  {isAdmin
                    ? 'Admin: edit price/discount/date, return, exchange or delete (stock restored)'
                    : 'Digital invoices with optional PDF download and printing'}
                </p>
              </div>
              <button className="btn primary" onClick={() => setActive('POS')}>
                <Icon name="plus" />
                <span>New sale</span>
              </button>
            </div>
            {isAdmin && (
              <div className="billing-lookup">
                <label>
                  Find invoice number
                  <input
                    value={billingForm.invoiceNumber}
                    onChange={(e) => setBillingForm({ ...billingForm, invoiceNumber: e.target.value })}
                    placeholder="INV-2026-000001"
                  />
                </label>
                <div className="row-actions">
                  <button type="button" className="btn" onClick={() => loadInvoiceByNumber('edit')}>Edit</button>
                  <button type="button" className="btn" onClick={() => loadInvoiceByNumber('return')}>Return</button>
                  <button type="button" className="btn" onClick={() => loadInvoiceByNumber('exchange')}>Exchange</button>
                  <button type="button" className="btn danger-outline" onClick={() => loadInvoiceByNumber('delete')}>Delete</button>
                </div>
              </div>
            )}
            <div className="billing-lookup">
              <label>
                Search invoices
                <input value={invoiceQuery} onChange={(e) => setInvoiceQuery(e.target.value)} placeholder="Invoice, customer or mobile" />
              </label>
              <div className="filters">
                <button type="button" className={`chip ${active === 'Invoice List' ? 'active' : ''}`} onClick={() => setActive('Invoice List')}>All invoices</button>
                <button type="button" className={`chip ${active === 'Unpaid / Due' ? 'active' : ''}`} onClick={() => setActive('Unpaid / Due')}>Due only</button>
              </div>
            </div>
            <div className="data-table billing-table">
              <div className="table-head">
                <span>Invoice</span>
                <span>Customer</span>
                <span>Staff</span>
                <span>Items</span>
                <span>Total</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {orders.filter((o) => {
                const q = invoiceQuery.trim().toLowerCase();
                return (!q || [o.invoiceNumber, o.customer?.name, o.customer?.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) && (active !== 'Unpaid / Due' || o.paymentStatus === 'UNPAID');
              }).length ? (
                orders.filter((o) => {
                  const q = invoiceQuery.trim().toLowerCase();
                  return (!q || [o.invoiceNumber, o.customer?.name, o.customer?.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) && (active !== 'Unpaid / Due' || o.paymentStatus === 'UNPAID');
                }).map((o) => (
                  <div className="table-row" key={o.id || o._id}>
                    <div>
                      <b>{o.invoiceNumber || o.orderNumber}</b>
                      <small>{new Date(o.saleDate || o.createdAt).toLocaleString('en-GB')}</small>
                    </div>
                    <span>{o.customer?.name || 'Walk-in customer'}</span>
                    <span>{o.staff?.name || '—'}</span>
                    <span>{o.items?.length || 0}</span>
                    <b>{money(o.total)}</b>
                    <span className={statusClass(o.paymentStatus || o.status)}>
                      {o.status === 'VOID' ? 'CANCELLED' : (o.paymentStatus || o.status)}
                    </span>
                    <SaleActionsMenu sale={o} isAdmin={isAdmin} onAction={handleSaleAction} />
                  </div>
                ))
              ) : (
                <div className="empty-table">No invoices yet. Create one from POS.</div>
              )}
            </div>
          </section>
        ) : active === 'Requests' ? (
          <RequestModules user={user} isAdmin={isAdmin} toast={toast} />
        ) : ['Expenses', 'Accounts', 'Suppliers', 'Audit'].includes(active) ? (
          <OpsModules
            active={active}
            expenses={expenses}
            loans={loans}
            suppliers={suppliers}
            accounts={accounts}
            audit={audit}
            onReload={() => loadTabData(active, { force: true })}
            toast={toast}
          />
        ) : (
          <WorkspaceModules
            active={active}
            setActive={setActive}
            user={user}
            products={products}
            filtered={filtered}
            sales={sales}
            staff={staff}
            attendance={attendanceRows}
            documents={documents}
            salaries={salaries}
            query={query}
            setQuery={setQuery}
            scanCode={scanCode}
            setScanCode={setScanCode}
            onScanProduct={onScanProduct}
            stockFilter={stockFilter}
            setStockFilter={setStockFilter}
            productForm={productForm}
            setProductForm={setProductForm}
            staffForm={staffForm}
            setStaffForm={setStaffForm}
            docForm={docForm}
            setDocForm={setDocForm}
            salaryForm={salaryForm}
            setSalaryForm={setSalaryForm}
            showProductForm={showProductForm}
            setShowProductForm={setShowProductForm}
            editingProduct={editingProduct}
            setEditingProduct={setEditingProduct}
            reportPeriod={reportPeriod}
            setReportPeriod={setReportPeriod}
            reportFrom={reportFrom}
            setReportFrom={setReportFrom}
            reportTo={reportTo}
            setReportTo={setReportTo}
            salesPeriod={salesPeriod}
            setSalesPeriod={setSalesPeriod}
            salesStaffFilter={salesStaffFilter}
            setSalesStaffFilter={async (id) => {
              setSalesStaffFilter(id);
              try {
                const salesRes = await api(`/sales?limit=100${id ? `&staffId=${encodeURIComponent(id)}` : ''}`);
                setSales(salesRes.data || []);
                setOrders(salesRes.data || []);
              } catch (e) {
                toast(e.message);
              }
            }}
            lastMonthSales={dash?.lastMonthSales}
            lastMonthOrderCount={dash?.lastMonthOrderCount}
            lastMonthLabel={dash?.lastMonthLabel}
            accessModules={accessModules}
            editingAccessUser={editingAccessUser}
            setEditingAccessUser={setEditingAccessUser}
            onToggleStaffModule={toggleStaffModule}
            onApplyStaffPreset={applyStaffPreset}
            onStartEditAccess={startEditAccess}
            onToggleEditModule={toggleEditModule}
            onSaveAccess={saveAccess}
            canSeeCost={!!canSeeCost}
            brands={brands}
            categories={categories}
            onAddBrand={onAddBrand}
            onAddCategory={onAddCategory}
            extraSizes={extraSizes}
            catalogExtras={catalogExtras}
            suppliers={suppliers}
            onAddSize={onAddSize}
            onAddCatalog={onAddCatalog}
            onAddProduct={onAddProduct}
            onEditProduct={startEditProduct}
            onPrintBarcode={printBarcode}
            onReturnStock={(p) => {
              setStockReturn(p);
              setStockReturnQty('1');
              setStockReturnType('RETURN');
              setStockReturnReason('');
            }}
            onClock={openClockModal}
            onAddStaff={onAddStaff}
            onAddDocument={onAddDocument}
            onAddSalary={onAddSalary}
            onSalaryFormChange={onSalaryFormChange}
            salaryPreview={salaryPreview}
            onRefreshSalaryPreview={() => refreshSalaryPreview()}
            onEditSalary={openEditSalary}
            onRecalculateSalary={recalculateSalary}
            onPaySalary={paySalaryRecord}
            onLoadDemoHistory={loadDemoHistory}
            onOpenInvoice={setInvoice}
            isAdmin={isAdmin}
            onSaleAction={handleSaleAction}
            toast={toast}
            Icon={Icon}
          />
        )}

        {stockReturn && (
          <div className="invoice-overlay" onClick={() => setStockReturn(null)}>
            <div className="invoice-card clock-card" onClick={(e) => e.stopPropagation()}>
              <h2>Return to inventory</h2>
              <p>{stockReturn.name} · current stock {stockReturn.stockQuantity ?? stockReturn.quantity ?? 0}</p>
              <label>
                Return type
                <select value={stockReturnType} onChange={(e) => setStockReturnType(e.target.value)}>
                  <option value="RETURN">Customer / shop return</option>
                  <option value="PURCHASE">Supplier delivery</option>
                  <option value="ADJUSTMENT">Stock correction</option>
                </select>
              </label>
              <label>
                Quantity
                <input type="number" min="1" value={stockReturnQty} onChange={(e) => setStockReturnQty(e.target.value)} />
              </label>
              <label>
                Note (optional)
                <input value={stockReturnReason} onChange={(e) => setStockReturnReason(e.target.value)} placeholder="Reason" />
              </label>
              <div className="invoice-actions">
                <button className="btn" type="button" onClick={() => setStockReturn(null)}>Cancel</button>
                <button className="btn primary" type="button" onClick={submitStockReturn}>Add to stock</button>
              </div>
            </div>
          </div>
        )}

        {clockModal && (
          <div className="invoice-overlay" onClick={() => setClockModal(null)}>
            <div className="invoice-card clock-card" onClick={(e) => e.stopPropagation()}>
              <h2>{clockModal.mode === 'in' ? 'Clock in' : 'Clock out'}</h2>
              <p>
                {clockModal.employee?.name} ({clockModal.employee?.employeeId})
              </p>
              <div className="balance-box">
                <span>Current till balance</span>
                <strong>{money(clockModal.currentBalance)}</strong>
                <small>
                  {clockModal.balanceSource === 'LAST_CLOSING'
                    ? 'Carried from last closing'
                    : clockModal.balanceSource === 'OPEN_SESSION'
                      ? 'Open session balance'
                      : 'New joining balance'}
                </small>
              </div>
              <label>
                {clockModal.mode === 'in' ? 'Opening cash (GBP)' : 'Closing cash (GBP)'}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={clockCash}
                  onChange={(e) => setClockCash(e.target.value)}
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <div className="invoice-actions">
                <button className="btn" type="button" onClick={() => setClockModal(null)}>Cancel</button>
                <button className="btn primary" type="button" onClick={submitClock}>
                  {clockModal.mode === 'in' ? 'Confirm clock in' : 'Confirm clock out'}
                </button>
              </div>
            </div>
          </div>
        )}

        {catalogModal && (
          <div className="invoice-overlay" onClick={() => setCatalogModal(null)}>
            <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <h2>
                Add{' '}
                {{
                  brand: 'brand',
                  category: 'category',
                  size: 'size',
                  supplier: 'supplier',
                  dupe: 'dupe',
                  notes: 'notes',
                  accords: 'main accord'
                }[catalogModal.type] || catalogModal.type}
              </h2>
              <p className="modal-sub">
                Saved to your catalog so you can pick it on every product.
              </p>
              <div className="section-block">
                <label className="full">
                  {{
                    brand: 'Brand name',
                    category: 'Category name',
                    size: 'Size (ml)',
                    supplier: 'Supplier name',
                    dupe: 'Dupe / inspired by',
                    notes: 'Notes',
                    accords: 'Main accord'
                  }[catalogModal.type] || 'Name'}
                  <input
                    autoFocus
                    value={catalogModal.name}
                    placeholder={
                      {
                        brand: 'e.g. Lattafa',
                        category: "e.g. Men's Perfume",
                        size: 'e.g. 1, 3 or 1000',
                        supplier: 'e.g. Fragrance World',
                        dupe: 'e.g. Creed Aventus',
                        notes: 'e.g. Top: bergamot, Heart: rose',
                        accords: 'e.g. Woody, amber, oud'
                      }[catalogModal.type] || ''
                    }
                    onChange={(e) => setCatalogModal({ ...catalogModal, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submitCatalogModal();
                      }
                    }}
                  />
                </label>
              </div>
              <div className="invoice-actions">
                <button className="btn" type="button" onClick={() => setCatalogModal(null)}>Cancel</button>
                <button className="btn primary" type="button" onClick={submitCatalogModal}>
                  Save {catalogModal.type}
                </button>
              </div>
            </div>
          </div>
        )}

        {barcodeModal && (
          <div className="invoice-overlay" onClick={() => setBarcodeModal(null)}>
            <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <h2>Print barcodes</h2>
              <p className="modal-sub">
                Thermal barcode printer · Code 128 · 50×30mm price labels
              </p>
              <div className="section-block">
                <div className="field-grid">
                  <label className="full">
                    Product
                    <input value={barcodeModal.name} readOnly />
                  </label>
                  <label>
                    Category
                    <input value={barcodeModal.category} readOnly />
                  </label>
                  <label>
                    Price
                    <input value={money(barcodeModal.price)} readOnly />
                  </label>
                  <label className="full">
                    Barcode
                    <input value={barcodeModal.barcode} readOnly />
                  </label>
                  <label className="full">
                    How many barcodes to print?
                    <input
                      type="number"
                      min="1"
                      max="200"
                      autoFocus
                      value={barcodeModal.qty}
                      onChange={(e) => setBarcodeModal({ ...barcodeModal, qty: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          openBarcodeOutput('label');
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="hint-box ok" style={{ marginTop: 12 }}>
                  Each label shows name, category, price, and Code 128 barcode — for thermal barcode/price label printers.
                  Use A4 only if your driver scales labels; prefer the label printer for stickers.
                </div>
              </div>
              <div className="invoice-actions">
                <button className="btn" type="button" onClick={() => setBarcodeModal(null)}>Cancel</button>
                <button className="btn" type="button" onClick={() => openBarcodeOutput('pdf')}>
                  Download PDF
                </button>
                <button className="btn primary" type="button" onClick={() => openBarcodeOutput('label')}>
                  Print preview
                </button>
              </div>
            </div>
          </div>
        )}

        {editingSalary && (
          <div className="invoice-overlay" onClick={() => setEditingSalary(null)}>
            <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Edit salary</h2>
              <p className="modal-sub">{editingSalary.name}</p>
              <div className="section-block">
                <div className="field-grid">
                  <label>
                    Base (£)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingSalary.baseSalary}
                      onChange={(e) => setEditingSalary({ ...editingSalary, baseSalary: e.target.value })}
                    />
                  </label>
                  <label>
                    Calculated (£)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingSalary.calculatedSalary}
                      onChange={(e) => setEditingSalary({ ...editingSalary, calculatedSalary: e.target.value })}
                    />
                  </label>
                  <label>
                    Paid (£)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingSalary.paidAmount}
                      onChange={(e) => setEditingSalary({ ...editingSalary, paidAmount: e.target.value })}
                    />
                  </label>
                  <label>
                    Working days
                    <input
                      type="number"
                      min="0"
                      value={editingSalary.workingDays}
                      onChange={(e) => setEditingSalary({ ...editingSalary, workingDays: e.target.value })}
                    />
                  </label>
                  <label>
                    Working hours
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={editingSalary.workingHours}
                      onChange={(e) => setEditingSalary({ ...editingSalary, workingHours: e.target.value })}
                    />
                  </label>
                  <label>
                    Partial pay now (£)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingSalary.partialPay}
                      onChange={(e) => setEditingSalary({ ...editingSalary, partialPay: e.target.value })}
                    />
                  </label>
                </div>
              </div>
              <div className="invoice-actions">
                <button className="btn" type="button" onClick={() => setEditingSalary(null)}>Cancel</button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => paySalaryRecord(editingSalary.id, 'partial', Number(editingSalary.partialPay || 0))}
                >
                  Pay partial
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => paySalaryRecord(editingSalary.id, 'full')}
                >
                  Pay full
                </button>
                <button className="btn primary" type="button" onClick={saveEditSalary}>Save</button>
              </div>
            </div>
          </div>
        )}

        {billingAction && billingAction.order && (() => {
          const returnedItem = (billingAction.order.items || []).find(
            (item) => item.productId === billingForm.returnProductId
          );
          const oldUnit = Number(returnedItem?.sellingPrice || 0);
          const newUnit = Number(billingForm.newSellingPrice || 0);
          const returnQty = Number(billingForm.returnQuantity || 0);
          const newQty = Number(billingForm.newQuantity || 0);
          const exchangeDiff = Math.round((newUnit * newQty - oldUnit * returnQty) * 100) / 100;
          const eligibleProducts = products.filter(
            (p) => productIdOf(p) !== billingForm.returnProductId && Number(productStockOf(p)) > 0
          );
          const titles = {
            edit: ['Edit sale', 'Previous total vs updated total is confirmed before saving'],
            discount: ['Apply discount', 'Percent or fixed. Invoice recalculates subtotal, discount, VAT and delivery'],
            delete: ['Cancel sale', 'Invoice is kept as Cancelled. Stock and money are reversed'],
            return: ['Return product', 'Returned stock updates inventory from the selected condition'],
            refund: ['Refund customer', 'Full or partial refund posts to Accounts'],
            exchange: ['Exchange product', 'Returned item is restocked; replacement is deducted. Difference is calculated'],
            payment: ['Add payment', 'Unpaid/partial dues update the invoice and cash/bank'],
            method: ['Update payment method', 'Changes how this sale is recorded without deleting history'],
            recheck: ['Recheck sale', 'Compare original details, then mark verified'],
            history: ['Invoice version history', 'Original sale is never deleted. Each change is a new version']
          };
          const [actionTitle, actionHint] = titles[billingAction.action] || ['Sale action', ''];
          const previewSubtotal = billingForm.items.reduce(
            (sum, item) => sum + Number(item.sellingPrice || 0) * Number(item.quantity || 0),
            0
          );
          const previewDiscount = billingForm.discountType === 'percent'
            ? (previewSubtotal * Number(billingForm.discountValue || 0)) / 100
            : Number(billingForm.discountValue || 0);
          const previewNet = Math.max(0, previewSubtotal - previewDiscount);
          const previewTax = previewNet * (Number(billingForm.taxRate || 0) / 100);
          const previewTotal = previewNet + previewTax + Number(billingForm.deliveryCharge || 0);

          return (
            <div className="invoice-overlay" onClick={() => setBillingAction(null)}>
              <div className="invoice-card billing-modal" onClick={(e) => e.stopPropagation()}>
                <h2>{actionTitle}</h2>
                <p className="modal-sub">{actionHint}</p>

                <div className="billing-lookup" style={{ marginBottom: 18 }}>
                  <label>
                    Invoice number
                    <input
                      value={billingForm.invoiceNumber}
                      onChange={(e) => setBillingForm({ ...billingForm, invoiceNumber: e.target.value })}
                      placeholder="INV-2026-000001"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          loadInvoiceByNumber(billingAction.action);
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => loadInvoiceByNumber(billingAction.action)}
                  >
                    Fetch sale
                  </button>
                </div>

                {['edit', 'discount'].includes(billingAction.action) && (
                  <div className="section-block">
                    <h3>Invoice details</h3>
                    <div className="field-grid">
                      <label>
                        Sale date & time
                        <input
                          type="datetime-local"
                          value={billingForm.saleDateTime}
                          max={toLocalInputValue()}
                          onChange={(e) => setBillingForm({ ...billingForm, saleDateTime: e.target.value })}
                        />
                      </label>
                      <label>
                        Customer name
                        <input
                          value={billingForm.customerName}
                          onChange={(e) => setBillingForm({ ...billingForm, customerName: e.target.value })}
                        />
                      </label>
                      <label>
                        Discount type
                        <select
                          value={billingForm.discountType}
                          onChange={(e) => setBillingForm({ ...billingForm, discountType: e.target.value })}
                        >
                          <option value="fixed">Fixed amount (£)</option>
                          <option value="percent">Percentage (%)</option>
                        </select>
                      </label>
                      <label>
                        Discount {billingForm.discountType === 'percent' ? '(%)' : '(£)'}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={billingForm.discountValue}
                          onChange={(e) => setBillingForm({ ...billingForm, discountValue: e.target.value })}
                        />
                      </label>
                      <label>
                        VAT / tax (%)
                        <input type="number" min="0" step="0.01" value={billingForm.taxRate} onChange={(e) => setBillingForm({ ...billingForm, taxRate: e.target.value })} />
                      </label>
                      <label>
                        Delivery charge (£)
                        <input type="number" min="0" step="0.01" value={billingForm.deliveryCharge} onChange={(e) => setBillingForm({ ...billingForm, deliveryCharge: e.target.value })} />
                      </label>
                      <label>
                        Payment method
                        <select value={billingForm.paymentMethod} onChange={(e) => setBillingForm({ ...billingForm, paymentMethod: e.target.value })}>
                          <option value="CASH">Cash</option>
                          <option value="CARD">Card</option>
                          <option value="BANK_TRANSFER">Bank transfer</option>
                          <option value="MOBILE_BANKING">Mobile banking</option>
                        </select>
                      </label>
                      <label>
                        Payment status
                        <select value={billingForm.paymentStatus} onChange={(e) => setBillingForm({ ...billingForm, paymentStatus: e.target.value })}>
                          <option value="PAID">Paid</option>
                          <option value="UNPAID">Unpaid</option>
                          <option value="PARTIAL">Partial</option>
                        </select>
                      </label>
                      <label className="full">
                        Reason
                        <input value={billingForm.reason} onChange={(e) => setBillingForm({ ...billingForm, reason: e.target.value })} />
                      </label>
                      <label className="full">
                        Notes
                        <input
                          value={billingForm.notes}
                          onChange={(e) => setBillingForm({ ...billingForm, notes: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="edit-items" style={{ marginTop: 14 }}>
                      <h3>Line items</h3>
                      {billingForm.items.map((item, idx) => (
                        <div className="edit-item-row" key={item.id || item.productId || idx}>
                          <span>{item.name}</span>
                          <label>
                            Qty
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateBillingItem(idx, 'quantity', e.target.value)}
                            />
                          </label>
                          <label>
                            Price (£)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.sellingPrice}
                              onChange={(e) => updateBillingItem(idx, 'sellingPrice', e.target.value)}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="hint-box ok" style={{ marginTop: 12 }}>
                      Previous total {money(billingAction.order.total)} → updated {money(previewTotal)}
                      {billingForm.discountType === 'percent' ? ` · discount ${billingForm.discountValue || 0}%` : ''}
                    </div>
                  </div>
                )}

                {billingAction.action === 'delete' && (
                  <div className="section-block">
                    <div className="hint-box warn">
                      This cancels <b>{billingAction.order.invoiceNumber}</b>. The invoice stays on record as Cancelled.
                    </div>
                    <label className="full">
                      Cancellation reason
                      <input required value={billingForm.reason} onChange={(e) => setBillingForm({ ...billingForm, reason: e.target.value })} />
                    </label>
                  </div>
                )}

                {(billingAction.action === 'return' || billingAction.action === 'refund' || billingAction.action === 'exchange') && (
                  <div className="section-block">
                    <h3>{billingAction.action === 'return' ? 'Return & restock' : 'Product leaving invoice'}</h3>
                    <div className="field-grid">
                      <label className="full">
                        Product from this invoice
                        <select
                          value={billingForm.returnProductId}
                          onChange={(e) => {
                            const item = (billingAction.order.items || []).find(
                              (x) => x.productId === e.target.value
                            );
                            setBillingForm({
                              ...billingForm,
                              returnProductId: e.target.value,
                              returnQuantity: String(item?.quantity || 1),
                              newProductId: '',
                              newSellingPrice: ''
                            });
                          }}
                        >
                          {(billingAction.order.items || []).map((item) => (
                            <option key={item.productId} value={item.productId}>
                              {item.name} (qty {item.quantity}) · {money(item.sellingPrice)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Return quantity
                        <input
                          type="number"
                          min="1"
                          max={returnedItem?.quantity || undefined}
                          value={billingForm.returnQuantity}
                          onChange={(e) => setBillingForm({ ...billingForm, returnQuantity: e.target.value })}
                        />
                      </label>
                      <label>
                        Original unit price
                        <input value={money(oldUnit)} readOnly />
                      </label>
                    </div>
                    {billingAction.action !== 'exchange' && (
                      <>
                        <label>
                          Return reason
                          <select value={billingForm.returnReason} onChange={(e) => setBillingForm({ ...billingForm, returnReason: e.target.value })}>
                            {['Customer changed mind', 'Wrong product', 'Damaged product', 'Defective product', 'Wrong size', 'Wrong item', 'Product issue', 'Delivery issue', 'Other'].map((r) => (
                              <option key={r}>{r}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Return condition
                          <select value={billingForm.returnCondition} onChange={(e) => setBillingForm({ ...billingForm, returnCondition: e.target.value })}>
                            <option>Resellable</option>
                            <option>Damaged</option>
                            <option>Defective</option>
                            <option>Write-off</option>
                          </select>
                        </label>
                        <label>
                          Refund method
                          <select value={billingForm.refundMethod} onChange={(e) => setBillingForm({ ...billingForm, refundMethod: e.target.value })}>
                            <option value="CASH">Cash</option>
                            <option value="BANK_TRANSFER">Bank</option>
                            <option value="CARD">Card</option>
                            <option value="MOBILE_BANKING">Mobile banking</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </label>
                        <label>
                          Refund amount (£)
                          <input type="number" min="0" step="0.01" value={billingForm.refundAmount} onChange={(e) => setBillingForm({ ...billingForm, refundAmount: e.target.value })} />
                        </label>
                      </>
                    )}
                  </div>
                )}

                {billingAction.action === 'exchange' && (
                  <div className="section-block">
                    <h3>Replacement product</h3>
                    <div className="field-grid">
                      <label className="full">
                        New product
                        <select
                          value={billingForm.newProductId}
                          onChange={(e) => {
                            const p = products.find((x) => productIdOf(x) === e.target.value);
                            setBillingForm({
                              ...billingForm,
                              newProductId: e.target.value,
                              newSellingPrice: p ? String(productPriceOf(p)) : ''
                            });
                          }}
                        >
                          <option value="">Select product…</option>
                          {eligibleProducts.map((p) => (
                            <option key={productIdOf(p)} value={productIdOf(p)}>
                              {p.name} · {productStockOf(p)} in stock · {money(productPriceOf(p))}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        New quantity
                        <input
                          type="number"
                          min="1"
                          value={billingForm.newQuantity}
                          onChange={(e) => setBillingForm({ ...billingForm, newQuantity: e.target.value })}
                        />
                      </label>
                      <label>
                        New price (£)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={billingForm.newSellingPrice}
                          onChange={(e) => setBillingForm({ ...billingForm, newSellingPrice: e.target.value })}
                        />
                      </label>
                    </div>
                    {billingForm.newProductId && newUnit > 0 && (
                      <div
                        className={`hint-box ${exchangeDiff < 0 ? 'warn' : 'ok'}`}
                        style={{ marginTop: 12 }}
                      >
                        {exchangeDiff < 0
                          ? `Customer refund: ${money(Math.abs(exchangeDiff))}`
                          : exchangeDiff > 0
                            ? `Collect balance due: ${money(exchangeDiff)}`
                            : 'Same price exchange — no extra balance.'}
                      </div>
                    )}
                    {!eligibleProducts.length && (
                      <div className="hint-box warn" style={{ marginTop: 12 }}>
                        No in-stock replacement products.
                      </div>
                    )}
                    <label className="full">
                      Exchange reason
                      <input value={billingForm.reason} onChange={(e) => setBillingForm({ ...billingForm, reason: e.target.value })} />
                    </label>
                  </div>
                )}

                {(billingAction.action === 'payment' || billingAction.action === 'method') && (
                  <div className="section-block">
                    <div className="field-grid">
                      <label>
                        Payment status
                        <select value={billingForm.paymentStatus} onChange={(e) => setBillingForm({ ...billingForm, paymentStatus: e.target.value })}>
                          <option value="PAID">Paid</option>
                          <option value="UNPAID">Unpaid</option>
                          <option value="PARTIAL">Partial</option>
                        </select>
                      </label>
                      <label>
                        Payment method
                        <select value={billingForm.paymentMethod} onChange={(e) => setBillingForm({ ...billingForm, paymentMethod: e.target.value })}>
                          <option value="CASH">Cash</option>
                          <option value="CARD">Card</option>
                          <option value="BANK_TRANSFER">Bank transfer</option>
                          <option value="MOBILE_BANKING">Mobile banking</option>
                        </select>
                      </label>
                      {billingAction.action === 'payment' && (
                        <label>
                          Amount received (£)
                          <input type="number" min="0" step="0.01" value={billingForm.paymentAmount} onChange={(e) => setBillingForm({ ...billingForm, paymentAmount: e.target.value })} />
                        </label>
                      )}
                      <label className="full">
                        Reason / note
                        <input value={billingForm.reason} onChange={(e) => setBillingForm({ ...billingForm, reason: e.target.value })} />
                      </label>
                    </div>
                  </div>
                )}

                {billingAction.action === 'recheck' && (
                  <div className="section-block">
                    <p>Original total {money(billingAction.order.total)} · {billingAction.order.items?.length || 0} item(s) · {billingAction.order.paymentStatus}</p>
                    <label className="full">
                      Recheck notes
                      <input value={billingForm.notes} onChange={(e) => setBillingForm({ ...billingForm, notes: e.target.value })} />
                    </label>
                  </div>
                )}

                {billingAction.action === 'history' && (
                  <div className="data-table">
                    <div className="table-head"><span>Version</span><span>Action</span><span>Previous</span><span>Updated</span><span>When</span></div>
                    {saleHistory.length ? saleHistory.map((row) => (
                      <div className="table-row" key={row.id}>
                        <span>v{row.version}</span>
                        <b>{row.action}</b>
                        <span>{money(row.previousTotal)}</span>
                        <span>{money(row.updatedTotal)}</span>
                        <span>{new Date(row.createdAt).toLocaleString('en-GB')}</span>
                      </div>
                    )) : <div className="empty-table">No versions yet — original sale only.</div>}
                  </div>
                )}

                {error && <div className="form-error">{error}</div>}
                <div className="invoice-actions">
                  <button className="btn" type="button" onClick={() => setBillingAction(null)}>Cancel</button>
                  {billingAction.action !== 'history' && (
                  <button className="btn primary" type="button" onClick={submitBillingAction}>
                    {billingAction.action === 'delete'
                      ? 'Cancel sale'
                      : billingAction.action === 'return' || billingAction.action === 'refund'
                        ? 'Confirm return / refund'
                        : billingAction.action === 'exchange'
                          ? 'Confirm exchange'
                          : billingAction.action === 'recheck'
                            ? 'Mark verified'
                            : 'Save changes'}
                  </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </section>
    </main>
  );
}
