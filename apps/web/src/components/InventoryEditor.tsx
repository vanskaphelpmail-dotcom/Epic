import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, X, AlertTriangle, Search, Filter } from 'lucide-react';
import { AppConfig, Product } from '../types';
import { JerseyRenderer } from './JerseyRenderer';
import { api, getToken, isApiEnabled } from '../lib/apiClient';
import { uploadStoreImage } from '../lib/cloudinaryUpload';
import { DEFAULT_FALLBACK_SIZES, STANDARD_PRODUCT_SIZES } from '../lib/productSizes';
import {
  calcDiscountAmount,
  calcDiscountPercent,
  calcSalePrice,
  getProductDiscountPercent,
  hasProductDiscount,
  type DiscountMode,
} from '../lib/productPricing';
import { confirmAsync, toast } from './UiFeedback';
import { generateEan13, normalizeBarcode } from '../lib/retailCodes';
import { BarcodeLabelPrint } from './admin/BarcodeLabelPrint';
import { TournamentPatchesPanel } from './TournamentPatchesPanel';
import { SizeChartsPanel } from './SizeChartsPanel';

interface InventoryEditorProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  formatPrice: (amount: number) => string;
  onRequireStaffLogin?: () => void;
  shopName?: string;
  appConfig?: AppConfig;
  onUpdateConfig?: (next: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
}

export const InventoryEditor: React.FC<InventoryEditorProps> = ({
  products,
  setProducts,
  formatPrice,
  onRequireStaffLogin,
  shopName = 'Epic Vanskap',
  appConfig,
  onUpdateConfig,
}) => {
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Form modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states for Add/Edit
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState<string>('Classic');
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formOriginalPrice, setFormOriginalPrice] = useState<number>(0);
  const [formDiscountMode, setFormDiscountMode] = useState<DiscountMode>('amount');
  const [formDiscountAmount, setFormDiscountAmount] = useState<number>(0);
  const [formDiscountPercent, setFormDiscountPercent] = useState<number>(0);
  const formFinalPrice = calcSalePrice(
    formOriginalPrice,
    formDiscountMode,
    formDiscountAmount,
    formDiscountPercent,
  );
  const formHasDiscount = formFinalPrice < formOriginalPrice && formOriginalPrice > 0;
  const [formStock, setFormStock] = useState<number>(10);
  const [formSeason, setFormSeason] = useState('2025/2026');
  const [formYear, setFormYear] = useState<number>(2026);
  const [formCondition, setFormCondition] = useState<string>('Mint');
  const [formConditionDetail, setFormConditionDetail] = useState('');
  const [formColor, setFormColor] = useState('Green/Red');
  const [formSizes, setFormSizes] = useState<string[]>([...DEFAULT_FALLBACK_SIZES]);
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formBarcodeMode, setFormBarcodeMode] = useState<'none' | 'auto' | 'manual'>('none');
  const [labelPrint, setLabelPrint] = useState<{
    barcode: string;
    sellPrice: number;
    name: string;
    category?: string;
  } | null>(null);
  const [formDescription, setFormDescription] = useState('');
  const [formMaterial, setFormMaterial] = useState('100% Curated Polyester Mesh');
  const [formMadeIn, setFormMadeIn] = useState('Bangladesh');
  const [formFit, setFormFit] = useState('Aero Athlete Standard');
  const [formUploadedImage, setFormUploadedImage] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormName('');
    setFormBrand('');
    setFormCategory('Classic');
    setFormPrice(0);
    setFormOriginalPrice(0);
    setFormDiscountMode('amount');
    setFormDiscountAmount(0);
    setFormDiscountPercent(0);
    setFormStock(10);
    setFormSeason('2025/2026');
    setFormYear(2026);
    setFormCondition('Mint');
    setFormConditionDetail('');
    setFormColor('Green/Red');
    setFormSizes([...DEFAULT_FALLBACK_SIZES]);
    setFormSku('');
    setFormBarcode('');
    setFormBarcodeMode('none');
    setFormDescription('');
    setFormMaterial('100% Curated Polyester Mesh');
    setFormMadeIn('Bangladesh');
    setFormFit('Aero Athlete Standard');
    setFormUploadedImage('');
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormBrand(product.brand);
    setFormCategory(product.category || 'Classic');
    const sale = product.price || 0;
    const original =
      product.originalPrice && product.originalPrice > sale ? product.originalPrice : sale;
    const amount =
      product.discount && product.discount > 0
        ? product.discount
        : calcDiscountAmount(original, sale);
    const percent = calcDiscountPercent(original, sale);
    const cleanPercent =
      percent > 0 && calcSalePrice(original, 'percent', 0, percent) === sale;
    setFormOriginalPrice(original);
    setFormPrice(sale);
    setFormDiscountMode(cleanPercent ? 'percent' : 'amount');
    setFormDiscountAmount(amount);
    setFormDiscountPercent(percent);
    setFormStock(product.stock);
    setFormSeason(product.season);
    setFormYear(product.year);
    setFormCondition(product.condition);
    setFormConditionDetail(product.conditionDetail || '');
    setFormColor(product.color || 'Green/Red');
    setFormSizes(product.sizes || [...DEFAULT_FALLBACK_SIZES]);
    setFormSku(product.sku);
    setFormBarcode(product.barcode || '');
    setFormBarcodeMode(product.barcode ? 'manual' : 'none');
    setFormDescription(product.description || '');
    setFormMaterial(product.specification?.material || '100% Curated Polyester Mesh');
    setFormMadeIn(product.specification?.madeIn || 'Bangladesh');
    setFormFit(product.specification?.fit || 'Aero Athlete Standard');
    setFormUploadedImage(product.uploadedImage || '');
    setIsEditModalOpen(true);
  };

  const ensureStaffSession = (): boolean => {
    if (isApiEnabled() && !getToken()) {
      if (onRequireStaffLogin) onRequireStaffLogin();
      else alert('Sign in as staff is required to save products to the database.');
      return false;
    }
    return true;
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formBrand) return;
    if (!ensureStaffSession()) return;
    setSaving(true);

    const salePrice = formHasDiscount ? formFinalPrice : formOriginalPrice || formPrice;
    const discountAmount = formHasDiscount
      ? calcDiscountAmount(formOriginalPrice, salePrice)
      : 0;

    const resolvedBarcode =
      formBarcodeMode === 'none'
        ? undefined
        : formBarcodeMode === 'manual'
          ? normalizeBarcode(formBarcode) || undefined
          : normalizeBarcode(formBarcode) || generateEan13(formSku || Date.now());

    const payload = {
      name: formName,
      slug: formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `product-${Date.now()}`,
      sku: formSku || `BD-SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      barcode: resolvedBarcode || null,
      price: salePrice,
      originalPrice: formHasDiscount ? formOriginalPrice : null,
      discount: formHasDiscount ? discountAmount : null,
      sellingPrice: salePrice,
      description: formDescription || 'Special customized vintage retro kit added to Epic Vanskap BD inventory.',
      image: formUploadedImage || 'shirt-custom',
      images: [] as string[],
      brand: formBrand,
      season: formSeason,
      year: formYear,
      condition: formCondition,
      conditionDetail: formConditionDetail || 'Sourced from local archives in perfect collectible condition.',
      color: formColor,
      sizes: formSizes,
      stock: formStock,
      material: formMaterial,
      madeIn: formMadeIn,
      fit: formFit,
      status: 'Active' as const,
      isFeatured: true,
      warehouse: 'Dhaka Central',
      binCode: formSku ? `BIN-${formSku.slice(-4)}` : undefined,
    };

    try {
      if (isApiEnabled() && getToken()) {
        const saved = await api.createProduct(payload);
        setProducts((prev) => [saved as Product, ...prev]);
      } else {
        const newProd: Product = {
          id: `shirt-custom-${Date.now()}`,
          ...payload,
          status: 'Active',
          badgeAvailable: true,
          printAvailable: true,
          rating: 5.0,
          reviewsCount: 1,
          specification: { material: formMaterial, madeIn: formMadeIn, fit: formFit },
          category: formCategory,
          uploadedImage: formUploadedImage || undefined,
        };
        setProducts((prev) => [newProd, ...prev]);
      }
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create product in database');
    } finally {
      setSaving(false);
    }
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!ensureStaffSession()) return;
    setSaving(true);

    const salePrice = formHasDiscount ? formFinalPrice : formOriginalPrice || formPrice;
    const discountAmount = formHasDiscount
      ? calcDiscountAmount(formOriginalPrice, salePrice)
      : 0;

    const resolvedBarcode =
      formBarcodeMode === 'none'
        ? null
        : formBarcodeMode === 'manual'
          ? normalizeBarcode(formBarcode) || null
          : normalizeBarcode(formBarcode) || generateEan13(formSku || editingProduct.sku);

    const payload = {
      name: formName,
      slug: formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || editingProduct.slug,
      sku: formSku,
      barcode: resolvedBarcode,
      price: salePrice,
      originalPrice: formHasDiscount ? formOriginalPrice : null,
      discount: formHasDiscount ? discountAmount : null,
      sellingPrice: salePrice,
      description: formDescription,
      image: formUploadedImage || editingProduct.uploadedImage || editingProduct.image,
      brand: formBrand,
      season: formSeason,
      year: formYear,
      condition: formCondition,
      conditionDetail: formConditionDetail,
      color: formColor,
      sizes: formSizes,
      stock: formStock,
      material: formMaterial,
      madeIn: formMadeIn,
      fit: formFit,
      status: editingProduct.status || 'Active',
      warehouse: editingProduct.warehouse || 'Dhaka Central',
      binCode: editingProduct.binCode,
    };

    try {
      if (isApiEnabled() && getToken()) {
        const saved = await api.updateProduct(editingProduct.id, payload);
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? (saved as Product) : p)));
      } else {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  ...payload,
                  specification: { ...p.specification, material: formMaterial, madeIn: formMadeIn, fit: formFit },
                  category: formCategory,
                  uploadedImage: formUploadedImage || undefined,
                }
              : p,
          ),
        );
      }
      setIsEditModalOpen(false);
      setEditingProduct(null);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update product in database');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const ok = await confirmAsync({
      title: 'Delete product',
      message: 'Permanently delete this product? This cannot be undone.',
      danger: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    if (!ensureStaffSession()) return;
    try {
      if (isApiEnabled() && getToken()) {
        try {
          await api.deleteProduct(productId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/not found|404|P2025/i.test(msg)) throw err;
        }
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      toast('Product deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete product', 'error');
    }
  };

  // Image upload → Cloudinary
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large! Maximum limit is 5MB.');
      return;
    }
    try {
      const url = await uploadStoreImage(file, 'products');
      setFormUploadedImage(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image to Cloudinary');
    }
  };

  // Filters computed list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.club || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.player?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.player?.number != null && String(p.player.number).includes(searchTerm));
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  // Categories count tracker
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['All', ...Array.from(set)];
  }, [products]);

  return (
    <div className="space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-emerald-50/40 border border-emerald-100 p-6 rounded-2xl">
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-zinc-950 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-950" />
            Vault Catalog Inventory Registry
          </h3>
          <p className="text-[13px] text-zinc-700 font-medium">
            Create custom releases, adjust collector prices, restock sizing availability, or purge discontinued products.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs px-5 py-3 rounded-xl uppercase tracking-wider font-black flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-800/15 transition-all self-start md:self-auto"
        >
          <Plus size={14} className="stroke-[3]" /> Add New Jersey Release
        </button>
      </div>

      {appConfig && onUpdateConfig ? (
        <>
          <TournamentPatchesPanel
            appConfig={appConfig}
            onUpdateConfig={onUpdateConfig}
            onRequireStaffLogin={onRequireStaffLogin}
            formatPrice={formatPrice}
          />
          <SizeChartsPanel
            appConfig={appConfig}
            onUpdateConfig={onUpdateConfig}
            onRequireStaffLogin={onRequireStaffLogin}
          />
        </>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" />
          <input
            type="text"
            placeholder="Search SKU, club, player name, brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-emerald-100 rounded-xl pl-10 pr-4 py-2.5 text-xs text-emerald-950 placeholder-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 bg-white border border-emerald-100 px-3 rounded-xl overflow-x-auto">
          <Filter size={12} className="text-emerald-600 flex-shrink-0" />
          <div className="flex gap-1.5 py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 text-[10px] rounded-lg font-mono uppercase transition-all whitespace-nowrap cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-emerald-100 text-emerald-850 font-bold border border-emerald-200'
                    : 'text-emerald-700 hover:text-emerald-950'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 flex justify-between items-center text-xs font-mono text-emerald-800 gap-2">
          <div>
            Total Models: <span className="text-emerald-950 font-bold">{filteredProducts.length}</span>
          </div>
          <div>
            Units in stock:{' '}
            <span className="text-emerald-950 font-bold">
              {products.reduce((s, p) => s + (Number(p.stock) || 0), 0)}
            </span>
          </div>
          <div>
            Low Stock: <span className="text-red-600 font-bold">{products.filter((p) => p.stock > 0 && p.stock <= 3).length}</span>
          </div>
        </div>
      </div>

      {/* Products Inventory List */}
      <div className="bg-white border border-emerald-100 rounded-2xl overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="mx-auto text-emerald-600" size={32} />
            <h4 className="text-sm font-bold text-emerald-900">No matching jerseys found in inventory</h4>
            <p className="text-[11px] text-emerald-600 font-mono">Try adjusting your filters or add a new record to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-50/60 border-b border-emerald-100 text-emerald-850 font-mono uppercase text-[10px]">
                  <th className="p-4 w-16">Preview</th>
                  <th className="p-4">SKU / Model</th>
                  <th className="p-4">Barcode</th>
                  <th className="p-4">Vintage Season</th>
                  <th className="p-4">Condition</th>
                  <th className="p-4 text-center">Stock Limit</th>
                  <th className="p-4">Price</th>
                  <th className="p-4 text-right">Actions Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/40">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors">
                    
                    {/* Visual Preview */}
                    <td className="p-4">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                        {p.uploadedImage ? (
                          <img
                            src={p.uploadedImage}
                            alt={p.name}
                            className="w-full h-full object-contain filter drop-shadow-md"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full scale-90 flex items-center justify-center">
                            <JerseyRenderer productId={p.id} />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* SKU / Name */}
                    <td className="p-4">
                      <div>
                        <p className="font-extrabold text-emerald-950 text-sm hover:text-emerald-700 transition-colors cursor-pointer" onClick={() => handleOpenEdit(p)}>
                          {p.name}
                        </p>
                        <div className="flex gap-3.5 mt-1 font-mono text-[12px] font-semibold text-zinc-800">
                          <span>SKU: <span className="text-zinc-950">{p.sku}</span></span>
                          <span className="text-zinc-950">{p.brand}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      {p.barcode ? (
                        <span className="inline-block bg-zinc-950 text-white text-[12px] font-mono font-bold px-2.5 py-1 rounded-full">
                          {p.barcode}
                        </span>
                      ) : (
                        <span className="text-[12px] text-zinc-700 font-semibold">Optional — none</span>
                      )}
                    </td>

                    {/* Season / Category */}
                    <td className="p-4">
                      <div>
                        <p className="font-mono text-emerald-900 font-semibold">{p.season}</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">{p.category}</p>
                      </div>
                    </td>

                    {/* Condition Rating */}
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <span className="bg-emerald-50 text-emerald-850 px-2.5 py-1 rounded text-[10px] font-mono border border-emerald-100 font-bold inline-block">
                          {p.condition}
                        </span>
                        {p.conditionDetail && (
                          <p className="text-[9px] text-emerald-700 truncate max-w-[150px] font-mono block">
                            {p.conditionDetail}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Stock Units */}
                    <td className="p-4 text-center">
                      <span className={`font-mono font-bold text-xs px-2.5 py-1 rounded-md ${
                        p.stock <= 3 
                          ? 'text-red-700 bg-red-50 border border-red-100 font-black' 
                          : 'text-emerald-950 bg-emerald-50 border border-emerald-100'
                      }`}>
                        {p.stock} units {p.stock <= 3 && '⚠️'}
                      </span>
                    </td>

                    {/* Price Tag */}
                    <td className="p-4">
                      <div className="font-mono">
                        <span className="text-emerald-800 font-black text-sm">{formatPrice(p.price)}</span>
                        {hasProductDiscount(p) && (
                          <span className="text-[10px] text-rose-600 font-mono ml-1.5 block">
                            <span className="line-through text-emerald-600">{formatPrice(p.originalPrice!)}</span>
                            {' '}
                            {getProductDiscountPercent(p)}% OFF
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions panel */}
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-850 px-3 py-2 rounded-xl flex items-center gap-1.5 text-[11px] font-extrabold cursor-pointer transition-all"
                        >
                          <Edit size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLabelPrint({
                              barcode: p.barcode || '',
                              sellPrice: p.sellingPrice || p.price,
                              name: p.name,
                              category: p.category,
                            });
                          }}
                          className="bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-900 px-3 py-2 rounded-xl text-[11px] font-extrabold cursor-pointer transition-all"
                        >
                          Barcode
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-xl border border-red-100 flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition-all"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD PRODUCT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 animate-scaleUp text-zinc-950">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-zinc-300 pb-3.5">
              <div>
                <h3 className="text-lg font-black uppercase text-zinc-950">Add New Vault Jersey</h3>
                <p className="text-[10px] text-zinc-700 font-mono">Provide vintage specifications, dimensions & custom pictures.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 hover:bg-emerald-950 rounded-full text-zinc-700 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddProductSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left block fields */}
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Jersey Catalog Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Manchester United 1999 Treble Vintage"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 placeholder-zinc-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Brand *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Adidas / Umbro"
                        value={formBrand}
                        onChange={(e) => setFormBrand(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 placeholder-zinc-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Category</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as any)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      >
                        <option value="Classic">Classic Vintage</option>
                        <option value="Current Season">Current Season</option>
                        <option value="World Cup">World Cup Vault</option>
                        <option value="England">England</option>
                        <option value="Clearance">Clearance</option>
                        <option value="Legends">Legends Tribute</option>
                        <option value="Accessories">Accessories</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Original Price (BDT) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={formOriginalPrice || ''}
                        onChange={(e) => setFormOriginalPrice(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Final Selling Price</label>
                      <div className="w-full bg-zinc-100 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 font-mono font-bold">
                        {formatPrice(formHasDiscount ? formFinalPrice : formOriginalPrice || 0)}
                      </div>
                      {formHasDiscount && (
                        <p className="text-[9px] text-rose-300 font-mono">
                          <span className="line-through opacity-70">{formatPrice(formOriginalPrice)}</span>
                          {' → '}
                          {formatPrice(formFinalPrice)} ({calcDiscountPercent(formOriginalPrice, formFinalPrice)}% OFF)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Discount</label>
                    <div className="flex rounded-xl border border-zinc-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setFormDiscountMode('amount')}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-black uppercase ${
                          formDiscountMode === 'amount' ? 'bg-zinc-950 text-emerald-950' : 'bg-zinc-50 text-emerald-400'
                        }`}
                      >
                        Amount
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDiscountMode('percent')}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-black uppercase ${
                          formDiscountMode === 'percent' ? 'bg-zinc-950 text-emerald-950' : 'bg-zinc-50 text-emerald-400'
                        }`}
                      >
                        Percent
                      </button>
                    </div>
                    {formDiscountMode === 'amount' ? (
                      <input
                        type="number"
                        min={0}
                        value={formDiscountAmount || ''}
                        onChange={(e) => setFormDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="Discount amount (৳)"
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formDiscountPercent || ''}
                        onChange={(e) =>
                          setFormDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                        }
                        placeholder="Discount percent (%)"
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Stock Units *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={formStock}
                        onChange={(e) => setFormStock(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Vintage Season *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 1998/1999"
                        value={formSeason}
                        onChange={(e) => setFormSeason(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 placeholder-zinc-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Release Year</label>
                      <input
                        type="number"
                        value={formYear}
                        onChange={(e) => setFormYear(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Condition Grade *</label>
                      <select
                        value={formCondition}
                        onChange={(e) => setFormCondition(e.target.value as any)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      >
                        <option value="Mint">Mint (Like New)</option>
                        <option value="Excellent">Excellent</option>
                        <option value="Very Good">Very Good</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* Right block fields */}
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">SKU Reference Number</label>
                    <input
                      type="text"
                      placeholder="Leave empty for auto-generated SKU"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono placeholder-zinc-500"
                    />
                  </div>

                  <div className="space-y-2 rounded-xl border border-zinc-300 p-3 bg-zinc-50">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="text-[10px] font-mono text-zinc-700 uppercase font-bold">
                        Barcode <span className="text-zinc-600 normal-case">(optional)</span>
                      </label>
                      <div className="flex rounded-lg overflow-hidden border border-zinc-300">
                        {(['none', 'auto', 'manual'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setFormBarcodeMode(mode);
                              if (mode === 'none') setFormBarcode('');
                              if (mode === 'auto') setFormBarcode(generateEan13(formSku || Date.now()));
                            }}
                            className={`px-2.5 py-1 text-[9px] font-bold uppercase cursor-pointer ${
                              formBarcodeMode === mode ? 'bg-white text-black' : 'bg-transparent text-zinc-700'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder={formBarcodeMode === 'none' ? 'No barcode' : 'EAN-13 or CODE128'}
                      value={formBarcode}
                      disabled={formBarcodeMode === 'none'}
                      readOnly={formBarcodeMode === 'auto'}
                      onChange={(e) => {
                        setFormBarcodeMode('manual');
                        setFormBarcode(e.target.value);
                      }}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono placeholder-zinc-500 disabled:opacity-40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Condition Detail Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Sourced from archives with original tags..."
                      value={formConditionDetail}
                      onChange={(e) => setFormConditionDetail(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 placeholder-zinc-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Colorway</label>
                      <input
                        type="text"
                        value={formColor}
                        onChange={(e) => setFormColor(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Made In Country</label>
                      <input
                        type="text"
                        value={formMadeIn}
                        onChange={(e) => setFormMadeIn(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Material Composition</label>
                      <input
                        type="text"
                        value={formMaterial}
                        onChange={(e) => setFormMaterial(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Fit Spec Type</label>
                      <input
                        type="text"
                        value={formFit}
                        onChange={(e) => setFormFit(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Description Narrative</label>
                    <textarea
                      rows={2}
                      placeholder="Historical records, key design aspects, legendary players..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 placeholder-zinc-500"
                    />
                  </div>

                  {/* Sizes Grid */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-700 font-mono uppercase block font-bold">Available Sizes Sizing:</label>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[...STANDARD_PRODUCT_SIZES].map((sz) => {
                        const hasSize = formSizes.includes(sz);
                        return (
                          <button
                            type="button"
                            key={sz}
                            onClick={() => {
                              if (hasSize) {
                                setFormSizes(formSizes.filter((s) => s !== sz));
                              } else {
                                setFormSizes([...formSizes, sz]);
                              }
                            }}
                            className={`px-3 py-1 text-[11px] rounded-lg font-mono border transition-all cursor-pointer ${
                              hasSize
                                ? 'bg-zinc-950 border-amber-400 text-white font-extrabold shadow-sm'
                                : 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:border-emerald-800'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Image manual uploader with base64 string storage */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[10px] text-zinc-700 font-mono uppercase block font-bold">Jersey Illustration Image (Base64):</label>
                    <label className="flex items-center gap-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 hover:border-emerald-800 p-4 rounded-2xl cursor-pointer transition-all group">
                      <div className="w-16 h-16 rounded-xl bg-zinc-100 border border-zinc-300/60 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                        {formUploadedImage ? (
                          <img
                            src={formUploadedImage}
                            alt="Uploaded base64 preview"
                            className="w-full h-full object-contain filter drop-shadow"
                          />
                        ) : (
                          <ImageIcon size={20} className="text-emerald-600 group-hover:text-zinc-950 transition-colors" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-zinc-100 group-hover:bg-zinc-950 group-hover:text-white border border-zinc-300 text-emerald-400 text-[10px] font-extrabold uppercase px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm">
                          <Plus size={11} />
                          Browse Local Jersey Photo
                        </div>
                        {formUploadedImage ? (
                          <p className="text-[9px] text-emerald-500 font-mono mt-1">✓ Image loaded successfully</p>
                        ) : (
                          <p className="text-[9px] text-zinc-600 font-mono leading-tight mt-1">PNG/JPG with resolution limits of up to 2MB</p>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {formUploadedImage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormUploadedImage('');
                        }}
                        className="text-[12px] text-zinc-700 hover:text-zinc-950 hover:underline font-semibold mt-1 flex items-center gap-1"
                      >
                        ✕ Remove Uploaded Photo
                      </button>
                    )}
                  </div>

                </div>
              </div>

              {/* Footer submission */}
              <div className="flex justify-end gap-3 border-t border-zinc-300/80 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-zinc-100 hover:bg-emerald-950 border border-zinc-300 text-zinc-700 text-xs px-5 py-2.5 rounded-xl uppercase font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs px-6 py-2.5 rounded-xl uppercase tracking-wider font-black cursor-pointer shadow-lg shadow-amber-400/10 transition-all"
                >
                  Inject Jersey to Database
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 animate-scaleUp text-zinc-950">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-zinc-300 pb-3.5">
              <div>
                <h3 className="text-lg font-black uppercase text-zinc-950">Edit Vault Jersey Details</h3>
                <p className="text-[10px] text-zinc-700 font-mono">ID: {editingProduct?.id} | SKU: {editingProduct?.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1.5 hover:bg-emerald-950 rounded-full text-zinc-700 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditProductSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left block fields */}
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Jersey Catalog Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Manchester United 1999 Treble Vintage"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Brand *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Umbro"
                        value={formBrand}
                        onChange={(e) => setFormBrand(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Category</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as any)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      >
                        <option value="Classic">Classic Vintage</option>
                        <option value="Current Season">Current Season</option>
                        <option value="World Cup">World Cup Vault</option>
                        <option value="England">England</option>
                        <option value="Clearance">Clearance</option>
                        <option value="Legends">Legends Tribute</option>
                        <option value="Accessories">Accessories</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Original Price (BDT) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={formOriginalPrice || ''}
                        onChange={(e) => setFormOriginalPrice(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Final Selling Price</label>
                      <div className="w-full bg-zinc-100 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 font-mono font-bold">
                        {formatPrice(formHasDiscount ? formFinalPrice : formOriginalPrice || 0)}
                      </div>
                      {formHasDiscount && (
                        <p className="text-[9px] text-rose-300 font-mono">
                          <span className="line-through opacity-70">{formatPrice(formOriginalPrice)}</span>
                          {' → '}
                          {formatPrice(formFinalPrice)} ({calcDiscountPercent(formOriginalPrice, formFinalPrice)}% OFF)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Discount</label>
                    <div className="flex rounded-xl border border-zinc-300 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setFormDiscountMode('amount')}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-black uppercase ${
                          formDiscountMode === 'amount' ? 'bg-zinc-950 text-emerald-950' : 'bg-zinc-50 text-emerald-400'
                        }`}
                      >
                        Amount
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDiscountMode('percent')}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-black uppercase ${
                          formDiscountMode === 'percent' ? 'bg-zinc-950 text-emerald-950' : 'bg-zinc-50 text-emerald-400'
                        }`}
                      >
                        Percent
                      </button>
                    </div>
                    {formDiscountMode === 'amount' ? (
                      <input
                        type="number"
                        min={0}
                        value={formDiscountAmount || ''}
                        onChange={(e) => setFormDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="Discount amount (৳)"
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formDiscountPercent || ''}
                        onChange={(e) =>
                          setFormDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                        }
                        placeholder="Discount percent (%)"
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Stock Units *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={formStock}
                        onChange={(e) => setFormStock(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Vintage Season *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 1998/1999"
                        value={formSeason}
                        onChange={(e) => setFormSeason(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Release Year</label>
                      <input
                        type="number"
                        value={formYear}
                        onChange={(e) => setFormYear(Number(e.target.value))}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Condition *</label>
                      <select
                        value={formCondition}
                        onChange={(e) => setFormCondition(e.target.value as any)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                      >
                        <option value="Mint">Mint (Like New)</option>
                        <option value="Excellent">Excellent</option>
                        <option value="Very Good">Very Good</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* Right block fields */}
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">SKU Reference Number</label>
                    <input
                      type="text"
                      required
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div className="space-y-2 rounded-xl border border-zinc-300 p-3 bg-zinc-50">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="text-[10px] font-mono text-zinc-700 uppercase font-bold">
                        Barcode <span className="text-zinc-600 normal-case">(optional)</span>
                      </label>
                      <div className="flex rounded-lg overflow-hidden border border-zinc-300">
                        {(['none', 'auto', 'manual'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              setFormBarcodeMode(mode);
                              if (mode === 'none') setFormBarcode('');
                              if (mode === 'auto') setFormBarcode(generateEan13(formSku || Date.now()));
                            }}
                            className={`px-2.5 py-1 text-[9px] font-bold uppercase cursor-pointer ${
                              formBarcodeMode === mode ? 'bg-white text-black' : 'bg-transparent text-zinc-700'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder={formBarcodeMode === 'none' ? 'No barcode' : 'EAN-13 or CODE128'}
                      value={formBarcode}
                      disabled={formBarcodeMode === 'none'}
                      readOnly={formBarcodeMode === 'auto'}
                      onChange={(e) => {
                        setFormBarcodeMode('manual');
                        setFormBarcode(e.target.value);
                      }}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400 font-mono placeholder-zinc-500 disabled:opacity-40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Condition Detail Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Sourced from archives with original tags..."
                      value={formConditionDetail}
                      onChange={(e) => setFormConditionDetail(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Colorway</label>
                      <input
                        type="text"
                        value={formColor}
                        onChange={(e) => setFormColor(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Made In Country</label>
                      <input
                        type="text"
                        value={formMadeIn}
                        onChange={(e) => setFormMadeIn(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Material Composition</label>
                      <input
                        type="text"
                        value={formMaterial}
                        onChange={(e) => setFormMaterial(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Fit Spec Type</label>
                      <input
                        type="text"
                        value={formFit}
                        onChange={(e) => setFormFit(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-700 block uppercase font-bold">Description Narrative</label>
                    <textarea
                      rows={2}
                      placeholder="Historical records, key design aspects..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-xl py-2.5 px-3.5 text-xs text-zinc-950 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Sizes Grid */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-700 font-mono uppercase block font-bold">Available Sizes Sizing:</label>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[...STANDARD_PRODUCT_SIZES].map((sz) => {
                        const hasSize = formSizes.includes(sz);
                        return (
                          <button
                            type="button"
                            key={sz}
                            onClick={() => {
                              if (hasSize) {
                                setFormSizes(formSizes.filter((s) => s !== sz));
                              } else {
                                setFormSizes([...formSizes, sz]);
                              }
                            }}
                            className={`px-3 py-1 text-[11px] rounded-lg font-mono border transition-all cursor-pointer ${
                              hasSize
                                ? 'bg-zinc-950 border-amber-400 text-white font-extrabold shadow-sm'
                                : 'bg-zinc-50 border-zinc-300 text-zinc-700 hover:border-emerald-800'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Image manual uploader with base64 string storage */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[10px] text-zinc-700 font-mono uppercase block font-bold">Jersey Illustration Image (Base64):</label>
                    <label className="flex items-center gap-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 hover:border-emerald-800 p-4 rounded-2xl cursor-pointer transition-all group">
                      <div className="w-16 h-16 rounded-xl bg-zinc-100 border border-zinc-300/60 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                        {formUploadedImage ? (
                          <img
                            src={formUploadedImage}
                            alt="Uploaded base64 preview"
                            className="w-full h-full object-contain filter drop-shadow"
                          />
                        ) : (
                          <ImageIcon size={20} className="text-emerald-600 group-hover:text-zinc-950 transition-colors" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-zinc-100 group-hover:bg-zinc-950 group-hover:text-white border border-zinc-300 text-emerald-400 text-[10px] font-extrabold uppercase px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm">
                          <Plus size={11} />
                          Replace Jersey Photo
                        </div>
                        {formUploadedImage ? (
                          <p className="text-[9px] text-emerald-500 font-mono mt-1">✓ Image loaded successfully</p>
                        ) : (
                          <p className="text-[9px] text-zinc-600 font-mono leading-tight mt-1">PNG/JPG with resolution limits of up to 2MB</p>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {formUploadedImage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormUploadedImage('');
                        }}
                        className="text-[12px] text-zinc-700 hover:text-zinc-950 hover:underline font-semibold mt-1 flex items-center gap-1"
                      >
                        ✕ Remove Uploaded Photo
                      </button>
                    )}
                  </div>

                </div>
              </div>

              {/* Footer submission */}
              <div className="flex justify-end gap-3 border-t border-zinc-300/80 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="bg-zinc-100 hover:bg-emerald-950 border border-zinc-300 text-zinc-700 text-xs px-5 py-2.5 rounded-xl uppercase font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-zinc-950 hover:bg-zinc-800 text-white text-xs px-6 py-2.5 rounded-xl uppercase tracking-wider font-black cursor-pointer shadow-lg shadow-amber-400/10 transition-all"
                >
                  Save Specification Changes
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      <BarcodeLabelPrint
        open={!!labelPrint}
        onClose={() => setLabelPrint(null)}
        items={
          labelPrint
            ? [
                {
                  shopName,
                  barcode: labelPrint.barcode,
                  sellPriceLabel: formatPrice(labelPrint.sellPrice),
                  productName: labelPrint.name,
                  category: labelPrint.category,
                  location: 'Dhaka',
                },
              ]
            : []
        }
      />

    </div>
  );
};
