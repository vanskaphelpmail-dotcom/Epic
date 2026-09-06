/** Official jersey size charts — Player, Retro, Fan, Customised Kit, Kids + custom from Inventory */

export type SizeChartColumn = {
  key: 'size' | 'age' | 'chest' | 'length';
  label: string;
};

export type SizeChartRow = {
  size: string;
  chest: string | number;
  length: string | number;
  age?: string;
};

export type SizeChartDef = {
  id: string;
  title: string;
  note: string;
  /** Labels shown in admin size-chart picker */
  label: string;
  columns: SizeChartColumn[];
  rows: SizeChartRow[];
  /** Default size keys offered when this chart is selected in Product Manager */
  sizeOptions: string[];
};

export const STANDARD_ADULT_COLUMNS: SizeChartColumn[] = [
  { key: 'size', label: 'Size' },
  { key: 'chest', label: 'Chest (in)' },
  { key: 'length', label: 'Length (in)' },
];

export const SIZE_CHARTS: Record<string, SizeChartDef> = {
  'player-edition': {
    id: 'player-edition',
    label: 'Player Edition',
    title: 'Player Edition Jersey',
    note: 'N.B: 0.5 inch may differ from jersey to jersey',
    columns: STANDARD_ADULT_COLUMNS,
    sizeOptions: ['S', 'M', 'L', 'XL', '2XL'],
    rows: [
      { size: 'S', chest: 36, length: 27 },
      { size: 'M', chest: 38, length: 28 },
      { size: 'L', chest: 40, length: 29 },
      { size: 'XL', chest: 42, length: 30 },
      { size: '2XL', chest: 44, length: 31 },
    ],
  },
  retro: {
    id: 'retro',
    label: 'Retro Kit',
    title: 'Retro Kit Size Chart',
    note: 'Measurement may vary 0.5–1.0 inch from jersey to jersey',
    columns: STANDARD_ADULT_COLUMNS,
    sizeOptions: ['S', 'M', 'L', 'XL', 'XXL'],
    rows: [
      { size: 'S', chest: 38, length: 27 },
      { size: 'M', chest: 40, length: 28 },
      { size: 'L', chest: 42, length: 29 },
      { size: 'XL', chest: 44, length: 30 },
      { size: 'XXL', chest: 46, length: 31 },
    ],
  },
  custom: {
    id: 'custom',
    label: 'Customised Kit',
    title: 'Customised Kit Size Chart',
    note: 'N.B: 0.5 inch may differ from jersey to jersey for manufacturing finishing',
    columns: [
      { key: 'size', label: 'Size' },
      { key: 'length', label: 'Length (inches)' },
      { key: 'chest', label: 'Chest (inches)' },
    ],
    sizeOptions: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    rows: [
      { size: 'S', length: 26, chest: 36 },
      { size: 'M', length: 27, chest: 38 },
      { size: 'L', length: 28, chest: 40 },
      { size: 'XL', length: 29, chest: 42 },
      { size: '2XL', length: 30, chest: 44 },
      { size: '3XL', length: 31, chest: 46 },
    ],
  },
  'fan-edition': {
    id: 'fan-edition',
    label: 'Fan Edition',
    title: 'Fan Edition Size Chart',
    note: 'N.B: 0.5 inch may differ from jersey to jersey for manufacturing finishing',
    columns: STANDARD_ADULT_COLUMNS,
    sizeOptions: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    rows: [
      { size: 'S', chest: 36, length: 26 },
      { size: 'M', chest: 38, length: 27 },
      { size: 'L', chest: 40, length: 28 },
      { size: 'XL', chest: 42, length: 29 },
      { size: '2XL', chest: 44, length: 30 },
      { size: '3XL', chest: 46, length: 31 },
    ],
  },
  kids: {
    id: 'kids',
    label: 'Kids',
    title: 'Kids Size Chart',
    note: 'Measurement may vary 0.5–1.0 inch from jersey to jersey',
    columns: [
      { key: 'size', label: 'Kit Size' },
      { key: 'age', label: 'Target Age' },
      { key: 'chest', label: 'Garment Chest (measured flat)' },
      { key: 'length', label: 'Garment Length' },
    ],
    sizeOptions: ['16', '18', '20', '22', '24', '26', '28'],
    rows: [
      { size: '16', age: '1–2 Years', chest: '24" (61 cm)', length: '18" (46 cm)' },
      { size: '18', age: '3–4 Years', chest: '26" (66 cm)', length: '19" (48 cm)' },
      { size: '20', age: '5–6 Years', chest: '28" (71 cm)', length: '20" (51 cm)' },
      { size: '22', age: '7–8 Years', chest: '30" (76 cm)', length: '21" (53 cm)' },
      { size: '24', age: '9–10 Years', chest: '32" (81 cm)', length: '22" (56 cm)' },
      { size: '26', age: '11–12 Years', chest: '34" (86 cm)', length: '23" (58 cm)' },
      { size: '28', age: '13–14 Years', chest: '36" (91 cm)', length: '24" (61 cm)' },
    ],
  },
};

/** Built-in charts offered in Product Manager (order matters). */
export const SIZE_CHART_OPTIONS: SizeChartDef[] = [
  SIZE_CHARTS['player-edition'],
  SIZE_CHARTS.retro,
  SIZE_CHARTS['fan-edition'],
  SIZE_CHARTS.custom,
  SIZE_CHARTS.kids,
];

/** Max upload bytes before client compression, by edition category. */
export const IMAGE_UPLOAD_LIMITS_BYTES: Record<string, number> = {
  'player-edition': 3 * 1024 * 1024,
  retro: 4 * 1024 * 1024,
  'fan-edition': 3 * 1024 * 1024,
  custom: 3 * 1024 * 1024,
  kids: 3 * 1024 * 1024,
  default: 4 * 1024 * 1024,
};

function normalizeKey(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
}

export function normalizeCustomChart(
  raw: Partial<SizeChartDef> & { id?: string },
  index = 0,
): SizeChartDef | null {
  const id = normalizeKey(raw.id) || `custom-chart-${index + 1}`;
  const label = String(raw.label || raw.title || '').trim();
  if (!label) return null;
  const rows = Array.isArray(raw.rows) ? raw.rows : [];
  const sizeOptions =
    Array.isArray(raw.sizeOptions) && raw.sizeOptions.length
      ? raw.sizeOptions.map(String)
      : rows.map((r) => String(r.size)).filter(Boolean);
  return {
    id,
    label,
    title: String(raw.title || label).trim(),
    note: String(raw.note || 'N.B: measurements may vary slightly').trim(),
    columns: Array.isArray(raw.columns) && raw.columns.length ? raw.columns : STANDARD_ADULT_COLUMNS,
    sizeOptions: sizeOptions.length ? sizeOptions : ['S', 'M', 'L', 'XL', '2XL'],
    rows: rows.length
      ? rows
      : [
          { size: 'S', chest: 36, length: 27 },
          { size: 'M', chest: 38, length: 28 },
          { size: 'L', chest: 40, length: 29 },
          { size: 'XL', chest: 42, length: 30 },
          { size: '2XL', chest: 44, length: 31 },
        ],
  };
}

/** Merge built-in + Inventory custom charts. */
export function getAllSizeCharts(customCharts?: Partial<SizeChartDef>[] | null): SizeChartDef[] {
  const custom = (customCharts || [])
    .map((c, i) => normalizeCustomChart(c, i))
    .filter((c): c is SizeChartDef => Boolean(c));
  const byId = new Map<string, SizeChartDef>();
  for (const c of SIZE_CHART_OPTIONS) byId.set(c.id, c);
  for (const c of custom) byId.set(c.id, c);
  return Array.from(byId.values());
}

/** Infer chart id from category / label (Kids, Customised Kit, Retro, …). */
export function inferSizeChartId(category?: string | null): string {
  const key = normalizeKey(category);
  if (!key) return '';
  if (key.includes('kid') || key.includes('junior') || key.includes('youth')) return 'kids';
  if (key.includes('custom')) return 'custom';
  if (key.includes('player')) return 'player-edition';
  if (key.includes('retro') || key.includes('legend') || key.includes('classic') || key.includes('vintage')) {
    return 'retro';
  }
  if (key.includes('fan')) return 'fan-edition';
  if (
    key.includes('racket') ||
    key.includes('boot') ||
    key.includes('ball') ||
    key.includes('football') ||
    key.includes('trouser') ||
    key.includes('short')
  ) {
    return '';
  }
  // League / club style categories → no automatic edition chart
  return '';
}

export function getSizeChartById(
  id?: string | null,
  customCharts?: Partial<SizeChartDef>[] | null,
): SizeChartDef | null {
  if (!id) return null;
  const key = normalizeKey(id);
  if (SIZE_CHARTS[key]) return SIZE_CHARTS[key];
  if (SIZE_CHARTS[id]) return SIZE_CHARTS[id];
  const custom = getAllSizeCharts(customCharts).find((c) => c.id === key || c.id === id);
  return custom || null;
}

export function resolveSizeChart(
  category?: string | null,
  sizeChartId?: string | null,
  customCharts?: Partial<SizeChartDef>[] | null,
): SizeChartDef | null {
  const explicit = getSizeChartById(sizeChartId, customCharts);
  if (explicit) return explicit;
  const inferred = inferSizeChartId(category);
  if (!inferred) return null;
  return getSizeChartById(inferred, customCharts);
}

/** All charts for a product (multi Fan + Player, etc.). */
export function resolveProductSizeCharts(
  product: {
    category?: string | null;
    categories?: string[] | null;
    sizeChartId?: string | null;
    sizeChartIds?: string[] | null;
  },
  customCharts?: Partial<SizeChartDef>[] | null,
): SizeChartDef[] {
  const ids: string[] = [];
  for (const id of product.sizeChartIds || []) {
    if (id?.trim()) ids.push(id.trim());
  }
  if (product.sizeChartId?.trim()) {
    for (const part of product.sizeChartId.split(',')) {
      if (part.trim()) ids.push(part.trim());
    }
  }
  if (!ids.length) {
    const cats = [...(product.categories || []), ...(product.category ? [product.category] : [])];
    for (const cat of cats) {
      const inferred = inferSizeChartId(cat);
      if (inferred) ids.push(inferred);
    }
  }
  const unique = Array.from(new Set(ids.map(normalizeKey).filter(Boolean)));
  const charts = unique
    .map((id) => getSizeChartById(id, customCharts))
    .filter((c): c is SizeChartDef => Boolean(c));
  if (charts.length) return charts;
  const fallback = resolveSizeChart(product.category, product.sizeChartId, customCharts);
  return fallback ? [fallback] : [];
}

export function getProductCategories(product: {
  category?: string | null;
  categories?: string[] | null;
}): string[] {
  const list = [...(product.categories || []), ...(product.category ? [product.category] : [])]
    .map((c) => String(c || '').trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}
export function imageUploadLimitForCategory(category?: string): number {
  const inferred = inferSizeChartId(category) || 'default';
  return IMAGE_UPLOAD_LIMITS_BYTES[inferred] || IMAGE_UPLOAD_LIMITS_BYTES.default;
}

/** Suggested product category name when a size chart is picked. */
export function categoryHintForSizeChart(chartId: string): string | null {
  const id = normalizeKey(chartId);
  if (id === 'kids') return 'Kids';
  if (id === 'custom') return 'Customised Kit';
  if (id === 'retro') return 'Retro';
  if (id === 'fan-edition') return 'Fan Edition';
  if (id === 'player-edition') return 'Player Edition';
  return null;
}
