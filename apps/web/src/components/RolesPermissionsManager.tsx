import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, UserPlus, Users, Lock, Key, Check, X, 
  Edit3, Trash2, Eye, EyeOff, Sparkles, RefreshCw, CheckCircle2, 
  AlertTriangle, Search, Mail, Phone, Building, BadgeCheck, 
  Briefcase, Copy, Send, LogOut, ArrowRight, Shield, Box, ShoppingBag, 
  Headphones, FileText, Store, Settings, UserCheck, ToggleLeft, ToggleRight,
  Sliders, Database, SlidersHorizontal, Info, RotateCcw
} from 'lucide-react';
import { User, UserRole, StaffRoleDefinition, AccessPermissionFlags } from '../types';
import { api, getToken, isApiEnabled } from '../lib/apiClient';

export const DYNAMIC_PERMISSION_FLAGS: { key: keyof AccessPermissionFlags; label: string; desc: string; category: string }[] = [
  { key: 'can_edit_stock', label: 'Edit Inventory & Stock Bins', desc: 'Modify warehouse stock numbers, bin assignments, and restock receiving logs', category: 'Inventory' },
  { key: 'can_delete_orders', label: 'Delete / Cancel Orders', desc: 'Cancel, delete, or wipe completed customer checkout order records', category: 'Orders' },
  { key: 'can_manage_products', label: 'Manage Kit Listings', desc: 'Create, edit, or delete jersey products, sizes, and pricing tags', category: 'Catalog' },
  { key: 'can_process_refunds', label: 'Process Refunds & Returns', desc: 'Issue payment refunds, store credit, and log returned kits', category: 'Orders' },
  { key: 'can_edit_prices', label: 'Override Retail Prices', desc: 'Edit retail prices, discounts, sale campaign badges, and custom print fees', category: 'Catalog' },
  { key: 'can_manage_content', label: 'Manage CMS & Content', desc: 'Edit homepage hero sliders, banner images, page builder, and blogs', category: 'CMS' },
  { key: 'can_manage_users', label: 'Manage Staff & Roles', desc: 'Create staff user accounts, toggle suspension, and edit permission flags', category: 'Security' },
  { key: 'can_manage_seller_desk', label: 'Seller Submission Desk', desc: 'Review, approve, or reject third-party vintage seller submissions', category: 'Sellers' },
  { key: 'can_export_reports', label: 'Export Analytics Reports', desc: 'Download CSV sales ledgers, customer CRM lists, and financial audits', category: 'Analytics' },
  { key: 'can_edit_coupons', label: 'Manage Coupons & Promos', desc: 'Create, edit, or deactivate promo discount codes and voucher campaigns', category: 'Marketing' },
  { key: 'can_manage_system_settings', label: 'System Settings & Gateways', desc: 'Configure store currency, VAT rates, delivery charges, and payment gateways', category: 'Settings' },
  { key: 'can_manage_orders', label: 'Manage Order Pipeline', desc: 'Update order status, logistics tracking, and fulfillment stages', category: 'Orders' },
  { key: 'can_manage_reviews', label: 'Moderate Reviews', desc: 'Approve or remove customer product reviews', category: 'CMS' },
];

export const DEFAULT_ROLE_ACCESS_FLAGS: Record<UserRole, AccessPermissionFlags> = {
  'Super Admin': {
    can_edit_stock: true,
    can_delete_orders: true,
    can_manage_products: true,
    can_process_refunds: true,
    can_edit_prices: true,
    can_manage_content: true,
    can_manage_users: true,
    can_manage_seller_desk: true,
    can_export_reports: true,
    can_edit_coupons: true,
    can_manage_system_settings: true,
    can_manage_orders: true,
    can_manage_reviews: true,
  },
  'Admin': {
    can_edit_stock: true,
    can_delete_orders: false,
    can_manage_products: true,
    can_process_refunds: true,
    can_edit_prices: true,
    can_manage_content: true,
    can_manage_users: false,
    can_manage_seller_desk: true,
    can_export_reports: true,
    can_edit_coupons: true,
    can_manage_system_settings: false,
    can_manage_orders: true,
    can_manage_reviews: true,
  },
  'Inventory Manager': {
    can_edit_stock: true,
    can_delete_orders: false,
    can_manage_products: true,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: true,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: false,
  },
  'Order Manager': {
    can_edit_stock: false,
    can_delete_orders: true,
    can_manage_products: false,
    can_process_refunds: true,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: true,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: true,
    can_manage_reviews: false,
  },
  'Customer Support': {
    can_edit_stock: false,
    can_delete_orders: false,
    can_manage_products: false,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: false,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: true,
  },
  'Content Manager': {
    can_edit_stock: false,
    can_delete_orders: false,
    can_manage_products: false,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: true,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: false,
    can_edit_coupons: true,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: true,
  },
  'Seller': {
    can_edit_stock: false,
    can_delete_orders: false,
    can_manage_products: false,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: true,
    can_export_reports: false,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: false,
  },
  'Customer': {
    can_edit_stock: false,
    can_delete_orders: false,
    can_manage_products: false,
    can_process_refunds: false,
    can_edit_prices: false,
    can_manage_content: false,
    can_manage_users: false,
    can_manage_seller_desk: false,
    can_export_reports: false,
    can_edit_coupons: false,
    can_manage_system_settings: false,
    can_manage_orders: false,
    can_manage_reviews: false,
  }
};

export function getUserEffectiveFlags(user: User, roleConfig?: Record<UserRole, AccessPermissionFlags>): AccessPermissionFlags {
  const config = roleConfig || DEFAULT_ROLE_ACCESS_FLAGS;
  const defaults = config[user.role] || config['Customer'];
  return {
    ...defaults,
    ...(user.accessFlags || {})
  };
}

export const STAFF_ROLE_DEFINITIONS: StaffRoleDefinition[] = [
  {
    id: 'Super Admin',
    name: 'Super Admin',
    description: 'Root system authority. Full access to create staff user accounts, assign roles, configure platform settings, and manage all store modules.',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-200',
    allowedTabs: ['all'],
    defaultPermissions: [
      'all_access', 'manage_users', 'manage_roles', 'manage_products', 
      'manage_orders', 'manage_inventory', 'manage_customers', 
      'manage_content', 'system_settings', 'manage_seller_desk', 'manage_courier'
    ],
    defaultFlags: DEFAULT_ROLE_ACCESS_FLAGS['Super Admin']
  },
  {
    id: 'Admin',
    name: 'Admin',
    description: 'General store operations lead. Manages products, inventory, orders, customer CRM, coupons, and content, but cannot edit Super Admin accounts.',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    allowedTabs: [
      'analytics', 'product-management', 'inventory', 'orders', 
      'customers', 'coupons', 'reviews', 'blogs', 'gallery', 'homepage-builder'
    ],
    defaultPermissions: [
      'manage_products', 'manage_orders', 'manage_inventory', 
      'manage_customers', 'manage_content', 'manage_reviews', 'manage_courier'
    ],
    defaultFlags: DEFAULT_ROLE_ACCESS_FLAGS['Admin']
  },
  {
    id: 'Inventory Manager',
    name: 'Inventory Manager',
    description: 'Stock control specialist. Manages product listings, warehouse bin stock levels, restock logs, write-offs, categories, and suppliers.',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
    allowedTabs: [
      'product-management', 'inventory', 'categories', 'collections', 
      'leagues', 'clubs', 'brands', 'players'
    ],
    defaultPermissions: ['manage_products', 'manage_inventory', 'stock_adjustment', 'restock_logs'],
    defaultFlags: DEFAULT_ROLE_ACCESS_FLAGS['Inventory Manager']
  },
  {
    id: 'Order Manager',
    name: 'Order Manager',
    description: 'Fulfillment & Express Courier lead. Processes orders, updates Steadfast/Pathao tracking, generates invoices, and handles returns.',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
    allowedTabs: ['orders', 'coupons', 'customers'],
    defaultPermissions: ['manage_orders', 'manage_courier', 'process_refunds', 'print_invoices'],
    defaultFlags: DEFAULT_ROLE_ACCESS_FLAGS['Order Manager']
  },
  {
    id: 'Customer Support',
    name: 'Customer Support',
    description: 'VIP Customer Service. Accesses buyer profiles, purchase history, order status lookup, internal support notes, and buyer reviews.',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    allowedTabs: ['customers', 'orders', 'reviews', 'testimonials'],
    defaultPermissions: ['view_customers', 'manage_reviews', 'view_orders', 'customer_notes'],
    defaultFlags: DEFAULT_ROLE_ACCESS_FLAGS['Customer Support']
  },
  {
    id: 'Content Manager',
    name: 'Content Manager',
    description: 'Digital Marketing & Page Creator. Controls homepage sliders, banners, custom landing pages, menu navigation, blogs, and fan gallery.',
    badgeColor: 'bg-pink-100 text-pink-900 border-pink-200',
    allowedTabs: [
      'homepage-builder', 'hero-slider', 'announcement-bar', 'page-builder', 
      'menu-builder', 'mega-menu', 'blogs', 'gallery', 'videos'
    ],
    defaultPermissions: ['manage_content', 'manage_banners', 'manage_blogs', 'manage_pages', 'manage_gallery'],
    defaultFlags: DEFAULT_ROLE_ACCESS_FLAGS['Content Manager']
  },
  {
    id: 'Seller',
    name: 'Seller Partner',
    description: 'Verified Vintage Seller account. Accesses seller submission portal, lists vintage kits for authentication, and views sales earnings.',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-200',
    allowedTabs: ['seller-requests'],
    defaultPermissions: ['seller_portal', 'submit_kits', 'view_own_sales'],
    defaultFlags: DEFAULT_ROLE_ACCESS_FLAGS['Seller']
  }
];

export const ALL_PERMISSIONS_LIST = [
  { key: 'all_access', label: 'Full System Root Access (Super Admin Only)', desc: 'Unrestricted access to all modules and configurations' },
  { key: 'can_edit_stock', label: 'can_edit_stock (Edit Inventory & Stock Bins)', desc: 'Modify warehouse stock numbers, bin assignments, and restock logs' },
  { key: 'can_delete_orders', label: 'can_delete_orders (Delete / Cancel Orders)', desc: 'Cancel, delete, or wipe checkout order records' },
  { key: 'manage_products', label: 'manage_products (Product Catalog)', desc: 'Add, edit, delete, and publish kit listings' },
  { key: 'manage_inventory', label: 'manage_inventory (Stock Control)', desc: 'Adjust stock numbers, log receiving, write off damaged kits' },
  { key: 'manage_orders', label: 'manage_orders (Orders Hub)', desc: 'Update order status, delivery notes, and pipeline stages' },
  { key: 'manage_courier', label: 'manage_courier (Logistics Dispatch)', desc: 'Steadfast/Pathao tracking numbers, carrier booking, invoices' },
  { key: 'manage_customers', label: 'manage_customers (Collector CRM)', desc: 'View customer purchase history, addresses, and internal notes' },
  { key: 'manage_reviews', label: 'manage_reviews (Reviews & Testimonials)', desc: 'Approve, moderate, or remove customer reviews' },
  { key: 'manage_content', label: 'manage_content (CMS, Page Builder & Banners)', desc: 'Hero sliders, banners, custom pages, mega menus, and blogs' },
  { key: 'manage_seller_desk', label: 'manage_seller_desk (Seller Desk)', desc: 'Review, approve, or reject third-party seller submissions' },
  { key: 'manage_users', label: 'manage_users (Create & Manage Staff)', desc: 'Create user accounts, assign roles, and revoke access' },
  { key: 'system_settings', label: 'system_settings (System Settings & VAT)', desc: 'Store details, currency rates, delivery charges, and gateways' },
  { key: 'can_process_refunds', label: 'can_process_refunds (Process Refunds)', desc: 'Issue payment refunds, store credit, and log returned kits' },
  { key: 'can_edit_prices', label: 'can_edit_prices (Override Prices)', desc: 'Edit retail prices, discounts, sale campaign badges' },
  { key: 'can_export_reports', label: 'can_export_reports (Export Analytics)', desc: 'Download CSV sales ledgers and customer CRM audits' },
  { key: 'can_edit_coupons', label: 'can_edit_coupons (Manage Coupons)', desc: 'Create, edit, or deactivate promo discount codes' },
];

interface RolesPermissionsManagerProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  activeUserRole: UserRole;
  setActiveUserRole: (role: UserRole) => void;
  currentUser: User | null;
  handleAddLog: (msg: string) => void;
}

export const RolesPermissionsManager: React.FC<RolesPermissionsManagerProps> = ({
  users,
  setUsers,
  activeUserRole,
  setActiveUserRole,
  currentUser,
  handleAddLog
}) => {
  const [activeTabMode, setActiveTabMode] = useState<'directory' | 'flag-toggles' | 'role-config'>('flag-toggles');
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Role Access Configuration Object (persisted in localStorage)
  const [roleAccessConfig, setRoleAccessConfig] = useState<Record<UserRole, AccessPermissionFlags>>(() => {
    const saved = localStorage.getItem('vault_role_access_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed reading role access config', e);
      }
    }
    return DEFAULT_ROLE_ACCESS_FLAGS;
  });

  // Selected User Account for Granular Flag Overrides
  const [selectedAccountForFlagsId, setSelectedAccountForFlagsId] = useState<string>(() => {
    return users[1]?.id || users[0]?.id || '';
  });

  const selectedAccount = users.find(u => u.id === selectedAccountForFlagsId) || users[0] || null;
  const [draftAccessFlags, setDraftAccessFlags] = useState<AccessPermissionFlags | null>(null);
  const [flagsDirty, setFlagsDirty] = useState(false);
  const [roleConfigDirty, setRoleConfigDirty] = useState(false);
  const [rolesSaveMsg, setRolesSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAccount) {
      setDraftAccessFlags(getUserEffectiveFlags(selectedAccount, roleAccessConfig));
      setFlagsDirty(false);
    }
  }, [selectedAccountForFlagsId]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  
  // Password show/hide toggle
  const [showPassword, setShowPassword] = useState(false);
  
  // New user form state
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDepartment, setFormDepartment] = useState('Dhaka HQ Operations');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Admin');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive' | 'Suspended'>('Active');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [sendWelcomeNotice, setSendWelcomeNotice] = useState(true);
  const [copiedPassNotice, setCopiedPassNotice] = useState(false);

  // Auto-fill default permissions when role changes in form
  const handleRoleSelection = (role: UserRole) => {
    setFormRole(role);
    const def = STAFF_ROLE_DEFINITIONS.find(r => r.id === role);
    if (def) {
      setFormPermissions([...def.defaultPermissions]);
    }
  };

  // Generate strong random password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pass = 'JABD-';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(pass);
  };

  // Open Create Modal initialized
  const openCreateModal = () => {
    setFormFullName('');
    setFormEmail('');
    setFormPhone('');
    setFormDepartment('Dhaka HQ Operations');
    setFormRole('Admin');
    setFormStatus('Active');
    const def = STAFF_ROLE_DEFINITIONS.find(r => r.id === 'Admin');
    setFormPermissions(def ? [...def.defaultPermissions] : []);
    generateStrongPassword();
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (user: User) => {
    setSelectedUserForEdit(user);
    setFormFullName(user.fullName);
    setFormEmail(user.email);
    setFormPhone(user.phone || '');
    setFormDepartment(user.department || 'General Staff');
    setFormPassword(user.password || '••••••••');
    setFormRole(user.role);
    setFormStatus(user.status || 'Active');
    setFormPermissions(user.permissions || []);
    setIsEditModalOpen(true);
  };

  // Toggle individual permission checkbox
  const togglePermission = (permKey: string) => {
    setFormPermissions((prev) => {
      if (prev.includes(permKey)) {
        return prev.filter(p => p !== permKey);
      } else {
        return [...prev, permKey];
      }
    });
  };

  // Expanded row for quick permissions drawer in table
  const [expandedUserPermissionsId, setExpandedUserPermissionsId] = useState<string | null>(null);

  // Inline role change directly from directory table
  const handleInlineRoleChange = (userId: string, newRole: UserRole) => {
    setUsers((prev) => {
      const next = prev.map((u) => {
        if (u.id === userId) {
          const roleDef = STAFF_ROLE_DEFINITIONS.find((r) => r.id === newRole);
          const defaultPerms = roleDef ? [...roleDef.defaultPermissions] : u.permissions;
          return {
            ...u,
            role: newRole,
            permissions: defaultPerms,
          };
        }
        return u;
      });
      localStorage.setItem('vault_staff_users', JSON.stringify(next));
      return next;
    });
    const targetUser = users.find((u) => u.id === userId);
    handleAddLog(`[SECURITY] Super Admin updated role of user "${targetUser?.fullName || userId}" to "${newRole}"`);
  };

  // Inline permission checkbox toggle for any user
  const handleInlinePermissionToggle = (userId: string, permKey: string) => {
    setUsers((prev) => {
      const next = prev.map((u) => {
        if (u.id === userId) {
          const currentPerms = u.permissions || [];
          const hasPerm = currentPerms.includes(permKey);
          const newPerms = hasPerm
            ? currentPerms.filter((p) => p !== permKey)
            : [...currentPerms, permKey];

          const currentFlags = u.accessFlags || {};
          const isFlagKey = permKey in DEFAULT_ROLE_ACCESS_FLAGS['Super Admin'];
          const newFlags = isFlagKey ? { ...currentFlags, [permKey]: !hasPerm } : currentFlags;

          return {
            ...u,
            permissions: newPerms,
            accessFlags: newFlags,
          };
        }
        return u;
      });
      localStorage.setItem('vault_staff_users', JSON.stringify(next));
      return next;
    });
    const targetUser = users.find((u) => u.id === userId);
    handleAddLog(`[SECURITY] Super Admin toggled permission "${permKey}" for user "${targetUser?.fullName || userId}"`);
  };

  // Toggle explicit user access flag for selected user (draft until Save)
  const handleToggleUserAccessFlag = (flagKey: keyof AccessPermissionFlags) => {
    if (!selectedAccount || !draftAccessFlags) return;
    setDraftAccessFlags((prev) => (prev ? { ...prev, [flagKey]: !prev[flagKey] } : prev));
    setFlagsDirty(true);
  };

  const handleSaveUserAccessFlags = async () => {
    if (!selectedAccount || !draftAccessFlags) return;
    const updatedPerms = DYNAMIC_PERMISSION_FLAGS
      .filter((f) => draftAccessFlags[f.key])
      .map((f) => f.key as string);
    try {
      if (isApiEnabled() && getToken()) {
        await api.updateUser(selectedAccount.id, {
          permissions: Array.from(
            new Set([
              ...(selectedAccount.permissions || []).filter(
                (p) => !DYNAMIC_PERMISSION_FLAGS.some((f) => f.key === p),
              ),
              ...updatedPerms,
            ]),
          ),
          accessFlags: { ...draftAccessFlags },
        });
      }
      setUsers((prev) => {
        const next = prev.map((u) => {
          if (u.id === selectedAccount.id) {
            return {
              ...u,
              permissions: Array.from(
                new Set([
                  ...(u.permissions || []).filter(
                    (p) => !DYNAMIC_PERMISSION_FLAGS.some((f) => f.key === p),
                  ),
                  ...updatedPerms,
                ]),
              ),
              accessFlags: { ...draftAccessFlags },
            };
          }
          return u;
        });
        if (!(isApiEnabled() && getToken())) {
          localStorage.setItem('vault_staff_users', JSON.stringify(next));
        }
        return next;
      });
      setFlagsDirty(false);
      setRolesSaveMsg(`Access flags saved for ${selectedAccount.fullName}`);
      handleAddLog(`[SECURITY] Super Admin saved permission flags for account "${selectedAccount.fullName}"`);
      window.setTimeout(() => setRolesSaveMsg(null), 2800);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save access flags');
    }
  };

  // Reset selected user account flags to role defaults
  const handleResetUserFlagsToDefault = () => {
    if (!selectedAccount) return;
    const defaults = roleAccessConfig[selectedAccount.role] || DEFAULT_ROLE_ACCESS_FLAGS[selectedAccount.role];
    setDraftAccessFlags({ ...defaults });
    setFlagsDirty(true);
    handleAddLog(`[SECURITY] Super Admin reset draft flags to role defaults for account "${selectedAccount.fullName}"`);
  };

  // Toggle baseline role access flag in configuration object (draft until Save Role Config)
  const handleToggleRoleConfigFlag = (role: UserRole, flagKey: keyof AccessPermissionFlags) => {
    setRoleAccessConfig((prev) => {
      const currentRoleObj = prev[role] || DEFAULT_ROLE_ACCESS_FLAGS[role];
      return {
        ...prev,
        [role]: {
          ...currentRoleObj,
          [flagKey]: !currentRoleObj[flagKey]
        }
      };
    });
    setRoleConfigDirty(true);
  };

  const handleSaveRoleConfig = () => {
    localStorage.setItem('vault_role_access_config', JSON.stringify(roleAccessConfig));
    setRoleConfigDirty(false);
    setRolesSaveMsg('Role baseline permissions saved');
    handleAddLog(`[SECURITY] Super Admin saved baseline role permission configuration`);
    window.setTimeout(() => setRolesSaveMsg(null), 2800);
  };

  // Create User Submit
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formEmail.trim() || !formPassword.trim()) {
      alert('Please fill in all required fields (Name, Email, Password).');
      return;
    }

    if (users.some(u => u.email.toLowerCase() === formEmail.trim().toLowerCase())) {
      alert('A user account with this email address already exists.');
      return;
    }

    try {
      if (isApiEnabled() && getToken()) {
        const created = await api.createUser({
          email: formEmail.trim().toLowerCase(),
          fullName: formFullName.trim(),
          password: formPassword,
          role: formRole,
          phone: formPhone.trim() || undefined,
          department: formDepartment,
          permissions: formPermissions,
          status: formStatus,
        });
        setUsers((prev) => [created as User, ...prev]);
        handleAddLog(`[SECURITY] Created staff user "${formFullName}" (${formRole}) in database`);
        alert(`✓ Staff user created in database.\nEmail: ${formEmail}\nRole: ${formRole}`);
        setIsCreateModalOpen(false);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const newUser: User = {
        id: `usr-${Date.now()}`,
        fullName: formFullName.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim() || '+880 1800-000000',
        role: formRole,
        department: formDepartment,
        status: formStatus,
        permissions: formPermissions,
        assignedBy: currentUser?.fullName || 'Super Admin Root',
        createdAt: todayStr,
        lastLogin: 'Never logged in yet',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formFullName)}`
      };
      setUsers((prev) => {
        const next = [newUser, ...prev];
        localStorage.setItem('vault_staff_users', JSON.stringify(next.map(({ password: _p, ...u }) => u)));
        return next;
      });
      handleAddLog(`[SECURITY] Super Admin created new staff user "${newUser.fullName}" (${newUser.role})`);
      alert(`✓ Staff profile created locally.\nName: ${newUser.fullName}\nEmail: ${newUser.email}\nRole: ${newUser.role}`);
      setIsCreateModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create staff user');
    }
  };

  // Update User Submit
  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    try {
      if (isApiEnabled() && getToken()) {
        const updated = await api.updateUser(selectedUserForEdit.id, {
          fullName: formFullName.trim(),
          phone: formPhone.trim(),
          department: formDepartment,
          role: formRole,
          status: formStatus,
          permissions: formPermissions,
          ...(formPassword ? { password: formPassword } : {}),
        });
        setUsers((prev) => prev.map((u) => (u.id === selectedUserForEdit.id ? { ...u, ...updated } : u)));
        handleAddLog(`[SECURITY] Updated staff user "${formFullName}" in database`);
        alert('✓ User details updated in database!');
        setIsEditModalOpen(false);
        return;
      }

      setUsers((prev) => {
        const next = prev.map((u) => {
          if (u.id === selectedUserForEdit.id) {
            const currentFlags = { ...(u.accessFlags || {}) };
            DYNAMIC_PERMISSION_FLAGS.forEach((flag) => {
              if (formPermissions.includes(flag.key)) {
                currentFlags[flag.key] = true;
              }
            });
            return {
              ...u,
              fullName: formFullName.trim(),
              email: formEmail.trim().toLowerCase(),
              phone: formPhone.trim(),
              department: formDepartment,
              password: formPassword,
              role: formRole,
              status: formStatus,
              permissions: formPermissions,
              accessFlags: currentFlags,
            };
          }
          return u;
        });
        localStorage.setItem('vault_staff_users', JSON.stringify(next));
        return next;
      });
      handleAddLog(`[SECURITY] Updated credentials/role for staff user "${formFullName}" (${formRole})`);
      alert(`✓ User details updated successfully!`);
      setIsEditModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update staff user');
    }
  };

  // Toggle Suspend Status
  const handleToggleSuspend = async (user: User) => {
    if (user.role === 'Super Admin' && users.filter(u => u.role === 'Super Admin' && u.status === 'Active').length <= 1) {
      alert('Cannot suspend the last active Super Admin account!');
      return;
    }

    const nextStatus = (user.status === 'Suspended' ? 'Active' : 'Suspended') as NonNullable<User['status']>;
    try {
      if (isApiEnabled() && getToken()) {
        await api.updateUser(user.id, { status: nextStatus });
      }
      setUsers((prev) => {
        const next = prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u));
        if (!(isApiEnabled() && getToken())) {
          localStorage.setItem('vault_staff_users', JSON.stringify(next));
        }
        return next;
      });
      handleAddLog(`[SECURITY] Changed status of user "${user.fullName}" to ${nextStatus}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Delete User
  const handleDeleteUser = async (user: User) => {
    if (user.role === 'Super Admin') {
      alert('Super Admin accounts cannot be deleted directly for security governance!');
      return;
    }

    if (!confirm(`Are you sure you want to permanently revoke & delete user account "${user.fullName}" (${user.email})?`)) {
      return;
    }

    try {
      if (isApiEnabled() && getToken()) {
        await api.deleteUser(user.id);
      }
      setUsers((prev) => {
        const next = prev.filter((u) => u.id !== user.id);
        if (!(isApiEnabled() && getToken())) {
          localStorage.setItem('vault_staff_users', JSON.stringify(next));
        }
        return next;
      });
      handleAddLog(`[SECURITY] Deleted/deactivated user "${user.fullName}"`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Filter users by tab and search query
  const filteredUsers = users.filter((u) => {
    const matchesRole = selectedRoleTab === 'All' ? true : u.role === selectedRoleTab;
    const matchesSearch = 
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery)) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  // Role icon getter
  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'Super Admin': return <ShieldCheck className="text-purple-600" size={18} />;
      case 'Admin': return <BadgeCheck className="text-emerald-600" size={18} />;
      case 'Inventory Manager': return <Box className="text-amber-600" size={18} />;
      case 'Order Manager': return <ShoppingBag className="text-blue-600" size={18} />;
      case 'Customer Support': return <Headphones className="text-indigo-600" size={18} />;
      case 'Content Manager': return <FileText className="text-pink-600" size={18} />;
      case 'Seller': return <Store className="text-teal-600" size={18} />;
      default: return <UserCheck className="text-zinc-600" size={18} />;
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* ========================================================= */}
      {/* TOP BANNER: SUPER ADMIN CONTROL TOWER & ROLE SIMULATOR   */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-emerald-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-purple-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-500/20 text-purple-300 border border-purple-400/30 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-purple-400" />
                SUPER ADMIN GOVERNANCE DESK
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider">
                Active Staff Accounts: {users.length}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Role & Permission Manager
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Super Admin root interface to toggle specific access flags (e.g. <code className="bg-purple-900/60 text-purple-200 px-1 py-0.5 rounded font-mono">can_edit_stock</code>, <code className="bg-purple-900/60 text-purple-200 px-1 py-0.5 rounded font-mono">can_delete_orders</code>) for individual user accounts by mapping their roles against a permission configuration object.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Create Staff Account Button */}
            <button
              type="button"
              onClick={openCreateModal}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <UserPlus size={16} />
              <span>＋ Create Staff Account</span>
            </button>
          </div>
        </div>

        {/* Role Simulator & Mode Switcher Bar */}
        <div className="mt-6 pt-5 border-t border-purple-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-purple-200">
            <Sparkles size={16} className="text-amber-400 animate-pulse" />
            <span>Active View Role:</span>
            <span className="font-bold text-white bg-purple-900/80 px-2.5 py-1 rounded-lg border border-purple-700">
              {activeUserRole}
            </span>
            {activeUserRole !== 'Super Admin' && (
              <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded">
                (Simulated View Active)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-400 text-[11px]">Simulate View Role:</span>
            {STAFF_ROLE_DEFINITIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setActiveUserRole(r.id);
                  handleAddLog(`[ROLE_SIM] Super Admin switched active admin view role to "${r.id}"`);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  activeUserRole === r.id
                    ? 'bg-white text-slate-950 font-bold shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {r.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* THREE MAIN CONTROL MODES SWITCHER TABS                    */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 bg-emerald-50/50 p-1.5 rounded-2xl border border-emerald-100 max-w-2xl">
        <button
          type="button"
          onClick={() => setActiveTabMode('flag-toggles')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTabMode === 'flag-toggles'
              ? 'bg-emerald-950 text-white shadow-md'
              : 'text-emerald-900 hover:bg-emerald-100/50'
          }`}
        >
          <Sliders size={16} className={activeTabMode === 'flag-toggles' ? 'text-emerald-400' : 'text-emerald-800'} />
          <span>User Flag Overrides</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabMode('role-config')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTabMode === 'role-config'
              ? 'bg-emerald-950 text-white shadow-md'
              : 'text-emerald-900 hover:bg-emerald-100/50'
          }`}
        >
          <Database size={16} className={activeTabMode === 'role-config' ? 'text-emerald-400' : 'text-emerald-800'} />
          <span>Role Config Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTabMode('directory')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTabMode === 'directory'
              ? 'bg-emerald-950 text-white shadow-md'
              : 'text-emerald-900 hover:bg-emerald-100/50'
          }`}
        >
          <Users size={16} className={activeTabMode === 'directory' ? 'text-emerald-400' : 'text-emerald-800'} />
          <span>Staff Directory ({users.length})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* MODE 1: DYNAMIC INDIVIDUAL USER PERMISSION FLAG TOGGLES   */}
      {/* ========================================================= */}
      {activeTabMode === 'flag-toggles' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white rounded-3xl border border-emerald-100 p-6 shadow-xl space-y-6">
            
            {/* Header & User Picker */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-emerald-100 pb-6">
              <div>
                <span className="bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  DYNAMIC ACCESS CONTROL MATRIX
                </span>
                <h3 className="text-xl font-black uppercase text-emerald-950 tracking-tight mt-1 flex items-center gap-2">
                  <span>Individual Account Flag Overrides</span>
                </h3>
                <p className="text-xs text-emerald-800 font-mono mt-0.5">
                  Select any staff account below to toggle granular access flags directly against their base role definition.
                </p>
              </div>

              {/* Select User Dropdown */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <label className="text-xs font-bold text-emerald-950 font-mono whitespace-nowrap">Target Staff Account:</label>
                <select
                  value={selectedAccountForFlagsId}
                  onChange={(e) => setSelectedAccountForFlagsId(e.target.value)}
                  className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-[260px]"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} — [{u.role}] ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected User Quick Card */}
            {selectedAccount && (() => {
              const effectiveFlags = draftAccessFlags || getUserEffectiveFlags(selectedAccount, roleAccessConfig);
              const activeFlagCount = Object.values(effectiveFlags).filter(Boolean).length;
              const hasCustomOverrides = selectedAccount.accessFlags && Object.keys(selectedAccount.accessFlags).length > 0;

              return (
                <div className="space-y-6">
                  {rolesSaveMsg && (
                    <div className="bg-emerald-800 text-white text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2">
                      <CheckCircle2 size={16} /> {rolesSaveMsg}
                    </div>
                  )}
                  
                  {/* Account Profile Bar */}
                  <div className="bg-gradient-to-r from-emerald-950 to-slate-900 text-white rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg border border-emerald-800/50">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={selectedAccount.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(selectedAccount.fullName)}`}
                        alt={selectedAccount.fullName}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-400/50 bg-emerald-900 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base md:text-lg font-black tracking-tight truncate">{selectedAccount.fullName}</h4>
                          <span className="bg-emerald-800/80 text-emerald-200 border border-emerald-600 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full">
                            {selectedAccount.role}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-300 font-mono flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="truncate">{selectedAccount.email}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{selectedAccount.department || 'Dhaka HQ'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-emerald-800/50">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] font-mono text-emerald-300 uppercase block">Active Access Flags</span>
                        <span className="text-xl font-black text-amber-400 font-mono">{activeFlagCount} / 11 Enabled</span>
                      </div>

                      {hasCustomOverrides && (
                        <button
                          type="button"
                          onClick={handleResetUserFlagsToDefault}
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/40 text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          title="Clear user-specific flag overrides and restore default role permissions"
                        >
                          <RotateCcw size={14} />
                          <span>Reset to Role Defaults</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSaveUserAccessFlags}
                        disabled={!flagsDirty}
                        className={`text-xs font-extrabold uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          flagsDirty
                            ? 'bg-amber-400 text-emerald-950 hover:bg-amber-300'
                            : 'bg-emerald-800/40 text-emerald-200 cursor-not-allowed'
                        }`}
                      >
                        <Check size={14} />
                        {flagsDirty ? 'Save Access Flags' : 'Saved'}
                      </button>
                    </div>
                  </div>

                  {/* Flag Toggle Switches Grid */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="text-xs font-mono font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                        <SlidersHorizontal size={15} className="text-emerald-800 shrink-0" />
                        <span className="leading-snug">TOGGLE ACCESS FLAGS FOR {selectedAccount.fullName.toUpperCase()}</span>
                      </h4>
                      <span className="text-[11px] font-mono text-emerald-800">
                        {flagsDirty ? 'Unsaved changes — click Save Access Flags' : 'All changes saved'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                      {DYNAMIC_PERMISSION_FLAGS.map((flag) => {
                        const isEnabled = effectiveFlags[flag.key];
                        const isOverridden = selectedAccount.accessFlags && flag.key in selectedAccount.accessFlags;
                        const roleDefaultVal = (roleAccessConfig[selectedAccount.role] || DEFAULT_ROLE_ACCESS_FLAGS['Customer'])[flag.key];

                        return (
                          <div
                            key={flag.key}
                            className={`p-4 rounded-2xl border transition-all ${
                              isEnabled
                                ? 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                                : 'bg-slate-50/80 border-slate-200 opacity-90'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-emerald-200 inline-block mb-1">
                                  {flag.category}
                                </span>
                                <h5 className="font-bold text-sm text-emerald-950 tracking-tight">{flag.label}</h5>
                                <code className="text-[10px] text-purple-700 font-mono font-bold block mt-0.5">
                                  {flag.key}
                                </code>
                              </div>

                              {/* Interactive Toggle Switch */}
                              <button
                                type="button"
                                onClick={() => handleToggleUserAccessFlag(flag.key)}
                                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                                  isEnabled ? 'bg-emerald-700' : 'bg-zinc-300'
                                }`}
                                title={`Click to toggle ${flag.key}`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    isEnabled ? 'translate-x-6' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            <p className="text-[11px] text-emerald-900 leading-snug mb-3">
                              {flag.desc}
                            </p>

                            <div className="pt-2 border-t border-emerald-100/60 flex items-center justify-between text-[10px] font-mono">
                              <span className="text-zinc-500">
                                Role Standard: <strong className={roleDefaultVal ? 'text-emerald-700' : 'text-zinc-600'}>{roleDefaultVal ? 'ON' : 'OFF'}</strong>
                              </span>

                              {isOverridden ? (
                                <span className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded font-bold">
                                  ★ Super Admin Override
                                </span>
                              ) : (
                                <span className="text-emerald-700 italic">
                                  Inherited from Role
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveUserAccessFlags}
                      disabled={!flagsDirty}
                      className={`w-full sm:w-auto text-xs font-extrabold uppercase tracking-widest px-6 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer ${
                        flagsDirty
                          ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                          : 'bg-emerald-100 text-emerald-500 cursor-not-allowed'
                      }`}
                    >
                      <Check size={14} /> Save Access Flags
                    </button>
                  </div>

                </div>
              );
            })()}

          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: ROLE ACCESS CONFIGURATION OBJECT MATRIX           */}
      {/* ========================================================= */}
      {activeTabMode === 'role-config' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-white rounded-3xl border border-emerald-100 p-4 md:p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  BASELINE ROLE PERMISSION OBJECT
                </span>
                <h3 className="text-lg md:text-xl font-black uppercase text-emerald-950 tracking-tight mt-1">
                  Staff Role Baseline Matrix Configuration
                </h3>
                <p className="text-xs text-emerald-800 font-mono mt-0.5">
                  Toggle role defaults, then click Save Role Config to publish.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveRoleConfig}
                disabled={!roleConfigDirty}
                className={`text-xs font-extrabold uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                  roleConfigDirty
                    ? 'bg-emerald-800 text-white hover:bg-emerald-900'
                    : 'bg-emerald-100 text-emerald-500 cursor-not-allowed'
                }`}
              >
                <Check size={14} /> Save Role Config
              </button>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-emerald-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-950 text-white text-[11px] font-mono uppercase tracking-wider">
                    <th className="p-4 border-b border-emerald-800">Permission Flag Key</th>
                    {STAFF_ROLE_DEFINITIONS.map((r) => (
                      <th key={r.id} className="p-3 text-center border-b border-emerald-800 min-w-[120px]">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-xs">{r.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 text-xs">
                  {DYNAMIC_PERMISSION_FLAGS.map((flag) => (
                    <tr key={flag.key} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="p-4 font-mono">
                        <div className="font-bold text-emerald-950">{flag.label}</div>
                        <div className="text-[10px] text-purple-700 font-bold">{flag.key}</div>
                      </td>

                      {STAFF_ROLE_DEFINITIONS.map((r) => {
                        const isChecked = (roleAccessConfig[r.id] || DEFAULT_ROLE_ACCESS_FLAGS[r.id])[flag.key];
                        const isSuperAdminRole = r.id === 'Super Admin';

                        return (
                          <td key={r.id} className="p-3 text-center">
                            <button
                              type="button"
                              disabled={isSuperAdminRole}
                              onClick={() => handleToggleRoleConfigFlag(r.id, flag.key)}
                              className={`px-3 py-1.5 rounded-xl font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
                              } ${isSuperAdminRole ? 'opacity-80 cursor-not-allowed' : ''}`}
                            >
                              {isChecked ? '✓ YES' : '✗ NO'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs font-mono text-emerald-900 flex items-center gap-2">
              <Info size={18} className="text-emerald-800 shrink-0" />
              <span>Note: Super Admin role always maintains <code className="bg-emerald-200 text-emerald-950 px-1.5 py-0.5 rounded font-bold">true</code> on all flags by system root design.</span>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 3: FULL STAFF DIRECTORY TABLE                       */}
      {/* ========================================================= */}
      {activeTabMode === 'directory' && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* SECTION: 7 STAFF ROLE HIERARCHY DECK */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black uppercase text-emerald-950 tracking-tight flex items-center gap-2">
                  <Shield size={20} className="text-emerald-800" />
                  <span>Defined Staff Roles & Access Tiers</span>
                </h3>
                <p className="text-xs text-emerald-800 font-mono">
                  Click any role to filter staff members or review permission capabilities
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {STAFF_ROLE_DEFINITIONS.map((role) => {
                const count = users.filter((u) => u.role === role.id).length;
                const isSelected = selectedRoleTab === role.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleTab(role.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-emerald-950 text-white border-emerald-800 shadow-xl ring-2 ring-emerald-500'
                        : 'bg-white hover:bg-emerald-50/40 text-emerald-950 border-emerald-100 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role.id)}
                        <h4 className="font-bold text-sm tracking-tight">{role.name}</h4>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                        isSelected ? 'bg-emerald-900 text-emerald-200 border-emerald-700' : role.badgeColor
                      }`}>
                        {count} Users
                      </span>
                    </div>

                    <p className={`text-xs mb-4 line-clamp-2 ${isSelected ? 'text-emerald-200' : 'text-emerald-800'}`}>
                      {role.description}
                    </p>

                    <div className="space-y-1.5 pt-3 border-t border-emerald-100/20 text-[10px] font-mono">
                      <span className={`block font-bold ${isSelected ? 'text-emerald-300' : 'text-emerald-900'}`}>
                        Default Access Flags:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(role.defaultFlags).filter(([_, val]) => val).slice(0, 3).map(([key]) => (
                          <span
                            key={key}
                            className={`px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-emerald-900/80 text-emerald-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            }`}
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STAFF USERS DIRECTORY TABLE */}
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl overflow-hidden">
            
            {/* Table Controls Header */}
            <div className="p-6 border-b border-emerald-100 bg-emerald-50/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-emerald-900" />
                  <h3 className="text-lg font-black uppercase text-emerald-950">Staff Accounts Directory</h3>
                </div>
                <p className="text-xs text-emerald-800 font-mono">
                  Showing {filteredUsers.length} of {users.length} staff member credentials
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search staff by name, email, department..."
                    className="pl-10 pr-4 py-2 bg-white border border-emerald-200 rounded-xl text-xs text-emerald-950 placeholder-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-64"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter by Role Pills */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedRoleTab('All')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedRoleTab === 'All' ? 'bg-emerald-900 text-white shadow-xs' : 'text-emerald-800 hover:bg-emerald-50'
                    }`}
                  >
                    All ({users.length})
                  </button>
                  {STAFF_ROLE_DEFINITIONS.map((r) => {
                    const c = users.filter((u) => u.role === r.id).length;
                    if (c === 0) return null;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRoleTab(r.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          selectedRoleTab === r.id ? 'bg-emerald-900 text-white shadow-xs' : 'text-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        {r.id} ({c})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Directory Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-950 text-white text-[11px] font-mono uppercase tracking-wider">
                    <th className="p-4">Staff Member & Email</th>
                    <th className="p-4">Role & Badge</th>
                    <th className="p-4">Department / Outlet</th>
                    <th className="p-4">Active Access Flags</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4 text-right">Super Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-emerald-800 font-mono">
                        <ShieldAlert size={32} className="mx-auto text-amber-500 mb-2 opacity-60" />
                        No staff user accounts match your search filters or selected role category.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const roleDef = STAFF_ROLE_DEFINITIONS.find((r) => r.id === u.role);
                      const isSuspended = u.status === 'Suspended';
                      const effective = getUserEffectiveFlags(u, roleAccessConfig);
                      const flagCount = Object.values(effective).filter(Boolean).length;

                      return (
                        <React.Fragment key={u.id}>
                          <tr className={`hover:bg-emerald-50/40 transition-colors ${isSuspended ? 'bg-red-50/30' : ''}`}>
                          
                          {/* Name & Avatar */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.fullName)}`}
                                alt={u.fullName}
                                className="w-10 h-10 rounded-full object-cover border border-emerald-200 bg-emerald-50 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                                  <span>{u.fullName}</span>
                                  {u.role === 'Super Admin' && (
                                    <ShieldCheck size={14} className="text-purple-600 fill-purple-100" />
                                  )}
                                </div>
                                <div className="text-emerald-700 font-mono text-[11px] flex items-center gap-1">
                                  <Mail size={12} />
                                  <span>{u.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role & Badge (With Direct Role Switcher Dropdown) */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <select
                                value={u.role}
                                disabled={u.id === 'usr-super-admin' && users.filter((x) => x.role === 'Super Admin').length <= 1}
                                onChange={(e) => handleInlineRoleChange(u.id, e.target.value as UserRole)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs transition-all"
                              >
                                {STAFF_ROLE_DEFINITIONS.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="p-4 font-mono text-emerald-900">
                            <div className="flex items-center gap-1">
                              <Building size={13} className="text-emerald-700" />
                              <span className="font-medium">{u.department || 'Dhaka HQ'}</span>
                            </div>
                          </td>

                          {/* Access Flags Count & Quick Toggle Drawer */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAccountForFlagsId(u.id);
                                  setActiveTabMode('flag-toggles');
                                }}
                                className="bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-mono font-bold px-2.5 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                                title="Open full Flag Overrides tab"
                              >
                                <Sliders size={13} className="text-purple-700" />
                                <span>{flagCount} Flags</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setExpandedUserPermissionsId(expandedUserPermissionsId === u.id ? null : u.id)}
                                className={`text-xs font-mono font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
                                  expandedUserPermissionsId === u.id
                                    ? 'bg-emerald-900 text-white border-emerald-950 shadow-xs'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                                }`}
                                title="Toggle granular permissions checkboxes drawer"
                              >
                                <span>{expandedUserPermissionsId === u.id ? 'Hide Toggles' : 'Permissions'}</span>
                              </button>
                            </div>
                          </td>

                          {/* Account Status */}
                          <td className="p-4">
                            {isSuspended ? (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                                Suspended
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                                Active
                              </span>
                            )}
                          </td>

                          {/* Super Admin Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              
                              {/* Quick Permissions Drawer Toggle */}
                              <button
                                type="button"
                                onClick={() => setExpandedUserPermissionsId(expandedUserPermissionsId === u.id ? null : u.id)}
                                title="Toggle Granular Permissions Checkboxes"
                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-950 p-2 rounded-xl border border-emerald-300 cursor-pointer transition-colors"
                              >
                                <ToggleRight size={14} />
                              </button>

                              {/* Edit Flags */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAccountForFlagsId(u.id);
                                  setActiveTabMode('flag-toggles');
                                }}
                                title="Manage Permission Flags"
                                className="bg-purple-50 hover:bg-purple-100 text-purple-900 p-2 rounded-xl border border-purple-200 cursor-pointer transition-colors"
                              >
                                <Sliders size={14} />
                              </button>

                              {/* Edit Access */}
                              <button
                                type="button"
                                onClick={() => openEditModal(u)}
                                title="Edit Role & Details"
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 p-2 rounded-xl border border-emerald-200 cursor-pointer transition-colors"
                              >
                                <Edit3 size={14} />
                              </button>

                              {/* Toggle Suspend */}
                              <button
                                type="button"
                                onClick={() => handleToggleSuspend(u)}
                                title={isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                                className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                                  isSuspended
                                    ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                                }`}
                              >
                                <ShieldAlert size={14} />
                              </button>

                              {/* Delete Account */}
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                title="Revoke & Delete User Account"
                                className="bg-red-50 hover:bg-red-100 text-red-700 p-2 rounded-xl border border-red-200 cursor-pointer transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>

                            </div>
                          </td>

                        </tr>

                        {/* EXPANDABLE GRANULAR PERMISSION CHECKBOXES DRAWER */}
                        {expandedUserPermissionsId === u.id && (
                          <tr key={`${u.id}-permissions-drawer`} className="bg-emerald-950 text-white">
                            <td colSpan={6} className="p-5 border-b-2 border-emerald-800">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
                                  <div className="flex items-center gap-2">
                                    <SlidersHorizontal size={16} className="text-amber-400" />
                                    <span className="font-black text-xs uppercase tracking-wider text-amber-300">
                                      Granular Permission Checkboxes — {u.fullName} ({u.role})
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-emerald-300">
                                    Toggling any checkbox immediately maps to global state & persists to localStorage
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                                  {ALL_PERMISSIONS_LIST.map((perm) => {
                                    const isChecked = (u.permissions || []).includes(perm.key) || (u.accessFlags?.[perm.key as keyof AccessPermissionFlags] ?? false);
                                    return (
                                      <label
                                        key={perm.key}
                                        className={`p-2 rounded-xl border text-xs cursor-pointer flex items-start gap-2 transition-all ${
                                          isChecked
                                            ? 'bg-emerald-800/90 border-emerald-500 text-white font-bold shadow-xs'
                                            : 'bg-slate-900/80 border-emerald-900/60 text-slate-300 hover:border-emerald-700 hover:text-white'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleInlinePermissionToggle(u.id, perm.key)}
                                          className="mt-0.5 accent-amber-400 rounded cursor-pointer"
                                        />
                                        <div className="min-w-0">
                                          <span className="block text-[11px] font-mono font-bold truncate">{perm.key}</span>
                                          <span className="block text-[10px] opacity-80 leading-tight">{perm.label}</span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: SUPER ADMIN CREATE STAFF USER ACCOUNT            */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-emerald-100 max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 shadow-2xl space-y-6 relative animate-fadeIn">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-emerald-100 pb-4">
              <div>
                <span className="bg-emerald-100 text-emerald-900 text-[10px] font-mono font-bold px-2.5 py-1 rounded-md uppercase">
                  SUPER ADMIN USER PROVISIONING
                </span>
                <h3 className="text-xl font-black text-emerald-950 tracking-tight mt-1">
                  Create New Staff Account
                </h3>
                <p className="text-xs text-emerald-800 font-mono">
                  Grant authorized operational access to Jersey Addicts BD team members
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 p-2 rounded-full cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateUserSubmit} className="space-y-6">
              
              {/* Step 1: Personal Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="e.g. Kazi Towhid Ahmed"
                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. towhid@jerseyaddicts.bd"
                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1">
                    Phone Number (BD format)
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+880 1840-990700"
                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1">
                    Department / Location Outlet
                  </label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Dhaka HQ Operations">Dhaka HQ Executive Operations</option>
                    <option value="Bailey Road Store">Bailey Road Physical Outlet</option>
                    <option value="Warehouse & Logistics">Dhaka Central Warehouse</option>
                    <option value="Fulfillment & Shipping">Express Courier Dispatch</option>
                    <option value="Customer Care">VIP Customer Support Desk</option>
                    <option value="Digital Marketing">Creative Studio & Media</option>
                    <option value="Seller Partner">Verified Vintage Marketplace</option>
                  </select>
                </div>
              </div>

              {/* Step 2: Secure Password Generator */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Key size={14} className="text-emerald-800" />
                    <span>Assign Password</span> <span className="text-red-500">*</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 px-3 py-1 rounded-lg border border-purple-200 flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Sparkles size={12} />
                    <span>⚡ Auto-Generate Password</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Enter or generate staff password"
                    className="w-full p-3 pr-24 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-zinc-500 hover:text-zinc-800 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(formPassword);
                        setCopiedPassNotice(true);
                        setTimeout(() => setCopiedPassNotice(false), 2000);
                      }}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 p-1.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer"
                      title="Copy Password"
                    >
                      {copiedPassNotice ? 'Copied!' : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Role Selection Grid */}
              <div>
                <label className="block text-xs font-bold text-emerald-950 mb-2">
                  Select Staff Role <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {STAFF_ROLE_DEFINITIONS.map((r) => {
                    const isSelected = formRole === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleRoleSelection(r.id)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-950 text-white border-emerald-800 ring-2 ring-emerald-500 shadow-md'
                            : 'bg-white hover:bg-emerald-50/50 text-emerald-950 border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getRoleIcon(r.id)}
                          <span className="font-bold text-xs">{r.name}</span>
                        </div>
                        <p className={`text-[10px] line-clamp-2 ${isSelected ? 'text-emerald-200' : 'text-emerald-700'}`}>
                          {r.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: Granular Custom Permissions Checkboxes */}
              <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-emerald-950">
                      Granular Module Access Permissions
                    </h4>
                    <p className="text-[10px] text-emerald-700 font-mono">
                      Overrides or fine-tunes default capabilities for this user
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 font-bold bg-white px-2 py-1 rounded border border-emerald-200">
                    {formPermissions.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-2">
                  {ALL_PERMISSIONS_LIST.map((perm) => {
                    const isChecked = formPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-white border-emerald-100 text-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(perm.key)}
                          className="mt-0.5 accent-emerald-800 rounded"
                        />
                        <div>
                          <span className="text-xs font-bold block">{perm.label}</span>
                          <span className="text-[10px] text-emerald-700 block leading-tight">{perm.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Step 5: Account Status & Credentials Notification */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                      Initial Account Status
                    </label>
                    <div className="flex items-center gap-2">
                      {(['Active', 'Inactive', 'Suspended'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFormStatus(st)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            formStatus === st
                              ? st === 'Active' ? 'bg-emerald-800 text-white' : 'bg-red-800 text-white'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-emerald-950 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <input
                    type="checkbox"
                    checked={sendWelcomeNotice}
                    onChange={(e) => setSendWelcomeNotice(e.target.checked)}
                    className="accent-emerald-800 rounded"
                  />
                  <span>Send welcome credentials notice (SMS & Email)</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>Create Staff Account Now</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: SUPER ADMIN EDIT STAFF USER DETAILS             */}
      {/* ========================================================= */}
      {isEditModalOpen && selectedUserForEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-emerald-100 max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 md:p-8 shadow-2xl space-y-6 relative animate-fadeIn">
            
            <div className="flex justify-between items-start border-b border-emerald-100 pb-4">
              <div>
                <span className="bg-purple-100 text-purple-900 text-[10px] font-mono font-bold px-2.5 py-1 rounded-md uppercase">
                  EDIT CREDENTIALS & PERMISSIONS
                </span>
                <h3 className="text-xl font-black text-emerald-950 tracking-tight mt-1">
                  Edit Account: {selectedUserForEdit.fullName}
                </h3>
                <p className="text-xs text-emerald-800 font-mono">
                  {selectedUserForEdit.email} • Assigned by {selectedUserForEdit.assignedBy || 'Super Admin'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 p-2 rounded-full cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateUserSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1">Department</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full p-3 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-950"
                  />
                </div>
              </div>

              {/* Role Picker */}
              <div>
                <label className="block text-xs font-bold text-emerald-950 mb-2">Role Level</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STAFF_ROLE_DEFINITIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleSelection(r.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                        formRole === r.id
                          ? 'bg-emerald-950 text-white border-emerald-800'
                          : 'bg-white text-emerald-950 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      {getRoleIcon(r.id)}
                      <span className="truncate">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-emerald-950 mb-1">Account Status</label>
                <div className="flex gap-2">
                  {(['Active', 'Inactive', 'Suspended'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFormStatus(st)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                        formStatus === st
                          ? st === 'Active' ? 'bg-emerald-800 text-white' : 'bg-red-800 text-white'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  ✓ Save Account Details
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
