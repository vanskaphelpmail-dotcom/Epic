import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

const DEFAULT_BRANDS = [
  'Fragrance World',
  'Lattafa',
  'Armaf',
  'Afnan',
  'Rasasi',
  'Al Haramain',
  'French Avenue',
  'The Ouds',
  'Non Stop',
  'Bujairami',
  'Lattafa Pride'
];

const DEFAULT_CATEGORIES = [
  "Women's Perfume",
  "Men's Perfume",
  'Unisex Perfume',
  'Attar / Oil',
  'Body Mist',
  'Gift Set'
];

const BRAND_KEY = 'catalog.brands';
const CATEGORY_KEY = 'catalog.categories';

function normalizeName(name: string) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function asNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => normalizeName(String(v || ''))).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

async function readSettingNames(storeId: string, key: string) {
  const row = await prisma.systemSetting.findFirst({
    where: { storeId, key }
  });
  return asNameList(row?.value);
}

async function writeSettingNames(storeId: string, key: string, names: string[]) {
  const value = asNameList(names);
  const existing = await prisma.systemSetting.findFirst({ where: { storeId, key } });
  if (existing) {
    return prisma.systemSetting.update({
      where: { id: existing.id },
      data: { value }
    });
  }
  return prisma.systemSetting.create({
    data: { storeId, key, value }
  });
}

function catalogModelsReady() {
  return Boolean(prisma.catalogBrand && prisma.catalogCategory);
}

async function ensureBrandModel(storeId: string, name: string) {
  const existing = await prisma.catalogBrand.findFirst({ where: { storeId, name } });
  if (existing) {
    if (!existing.isActive) {
      return prisma.catalogBrand.update({
        where: { id: existing.id },
        data: { isActive: true, name }
      });
    }
    return existing;
  }
  return prisma.catalogBrand.create({ data: { storeId, name, isActive: true } });
}

async function ensureCategoryModel(storeId: string, name: string) {
  const existing = await prisma.catalogCategory.findFirst({ where: { storeId, name } });
  if (existing) {
    if (!existing.isActive) {
      return prisma.catalogCategory.update({
        where: { id: existing.id },
        data: { isActive: true, name }
      });
    }
    return existing;
  }
  return prisma.catalogCategory.create({ data: { storeId, name, isActive: true } });
}

async function listFromProducts(storeId: string, field: 'brand' | 'category') {
  const products = await prisma.product.findMany({
    where: { storeId, isActive: true },
    select: { brand: true, category: true }
  });
  return asNameList(products.map((p) => (field === 'brand' ? p.brand : p.category)));
}

export async function listBrands(storeId: string) {
  const fromProducts = await listFromProducts(storeId, 'brand');
  let names = asNameList([...DEFAULT_BRANDS, ...fromProducts]);

  if (catalogModelsReady()) {
    try {
      for (const name of names) await ensureBrandModel(storeId, name);
      const rows = await prisma.catalogBrand.findMany({
        where: { storeId, isActive: true },
        orderBy: { name: 'asc' }
      });
      if (rows.length) return rows;
    } catch {
      /* fall through to settings */
    }
  }

  const fromSettings = await readSettingNames(storeId, BRAND_KEY);
  names = asNameList([...names, ...fromSettings]);
  await writeSettingNames(storeId, BRAND_KEY, names);
  return names.map((name) => ({ id: `brand:${name}`, name, storeId, isActive: true }));
}

export async function listCategories(storeId: string) {
  const fromProducts = await listFromProducts(storeId, 'category');
  let names = asNameList([...DEFAULT_CATEGORIES, ...fromProducts]);

  if (catalogModelsReady()) {
    try {
      for (const name of names) await ensureCategoryModel(storeId, name);
      const rows = await prisma.catalogCategory.findMany({
        where: { storeId, isActive: true },
        orderBy: { name: 'asc' }
      });
      if (rows.length) return rows;
    } catch {
      /* fall through to settings */
    }
  }

  const fromSettings = await readSettingNames(storeId, CATEGORY_KEY);
  names = asNameList([...names, ...fromSettings]);
  await writeSettingNames(storeId, CATEGORY_KEY, names);
  return names.map((name) => ({ id: `category:${name}`, name, storeId, isActive: true }));
}

export async function createBrand(storeId: string, rawName: string) {
  const name = normalizeName(rawName);
  if (!name) throw new AppError('VALIDATION_ERROR', 'Brand name is required');
  if (name.length < 2) throw new AppError('VALIDATION_ERROR', 'Brand name is too short');

  if (catalogModelsReady()) {
    try {
      return await ensureBrandModel(storeId, name);
    } catch {
      /* settings fallback */
    }
  }

  const names = asNameList([...(await readSettingNames(storeId, BRAND_KEY)), name]);
  await writeSettingNames(storeId, BRAND_KEY, names);
  return { id: `brand:${name}`, name, storeId, isActive: true };
}

export async function createCategory(storeId: string, rawName: string) {
  const name = normalizeName(rawName);
  if (!name) throw new AppError('VALIDATION_ERROR', 'Category name is required');
  if (name.length < 2) throw new AppError('VALIDATION_ERROR', 'Category name is too short');

  if (catalogModelsReady()) {
    try {
      return await ensureCategoryModel(storeId, name);
    } catch {
      /* settings fallback */
    }
  }

  const names = asNameList([...(await readSettingNames(storeId, CATEGORY_KEY)), name]);
  await writeSettingNames(storeId, CATEGORY_KEY, names);
  return { id: `category:${name}`, name, storeId, isActive: true };
}
