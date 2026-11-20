export interface VirtualStoreLayout {
  enabled: boolean;
  showPublicButton: boolean;
  buttonLabel: string;
  storeName: string;
  tagline: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  whatsappNumber: string;
}

export interface VirtualStoreCategory {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualStoreProduct {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualStoreData {
  layout: VirtualStoreLayout;
  categories: VirtualStoreCategory[];
  products: VirtualStoreProduct[];
  updatedAt: string | null;
}

export interface PublicStoreSummary {
  enabled: boolean;
  showPublicButton: boolean;
  buttonLabel: string;
  storeName: string;
  activeProductsCount: number;
  activeCategoriesCount: number;
}

export interface ShopStoreContext {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
}

export const DEFAULT_STORE_BUTTON_LABEL = 'Acessar a loja virtual';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (HEX_COLOR_REGEX.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function isLightHex(hexColor?: string | null): boolean {
  if (!hexColor) return false;
  const clean = hexColor.replace('#', '').trim();
  if (clean.length !== 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

export function formatBRL(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(safe);
}

function sanitizeOptionalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function generateItemId(prefix: 'cat' | 'prod'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultVirtualStore(shop?: ShopStoreContext | null): VirtualStoreData {
  const primary = normalizeHexColor(shop?.primary_color, '#D4AF37');
  return {
    layout: {
      enabled: false,
      showPublicButton: false,
      buttonLabel: DEFAULT_STORE_BUTTON_LABEL,
      storeName: (shop?.name || '').trim() || 'Loja Virtual',
      tagline: 'Produtos selecionados com retirada no local ou pedido rápido pelo WhatsApp.',
      logoUrl: sanitizeOptionalUrl(shop?.logo_url) || null,
      bannerUrl: null,
      primaryColor: primary,
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F8FAFC',
      textColor: '#111827',
      whatsappNumber: String(shop?.whatsapp || shop?.phone || '').trim()
    },
    categories: [],
    products: [],
    updatedAt: null
  };
}

export function normalizeVirtualStore(
  rawStore: any,
  shop?: ShopStoreContext | null
): VirtualStoreData {
  const defaults = createDefaultVirtualStore(shop);
  if (!rawStore || typeof rawStore !== 'object') {
    return defaults;
  }

  const rawLayout = rawStore.layout && typeof rawStore.layout === 'object' ? rawStore.layout : {};

  const layout: VirtualStoreLayout = {
    enabled: Boolean(rawLayout.enabled),
    showPublicButton:
      rawLayout.showPublicButton !== undefined
        ? Boolean(rawLayout.showPublicButton)
        : Boolean(rawLayout.enabled),
    buttonLabel:
      typeof rawLayout.buttonLabel === 'string' && rawLayout.buttonLabel.trim().length > 0
        ? rawLayout.buttonLabel.trim().slice(0, 60)
        : DEFAULT_STORE_BUTTON_LABEL,
    storeName:
      typeof rawLayout.storeName === 'string' && rawLayout.storeName.trim().length > 0
        ? rawLayout.storeName.trim().slice(0, 80)
        : defaults.layout.storeName,
    tagline:
      typeof rawLayout.tagline === 'string'
        ? rawLayout.tagline.trim().slice(0, 220)
        : defaults.layout.tagline,
    logoUrl:
      rawLayout.logoUrl !== undefined
        ? sanitizeOptionalUrl(rawLayout.logoUrl)
        : defaults.layout.logoUrl,
    bannerUrl: sanitizeOptionalUrl(rawLayout.bannerUrl),
    primaryColor: normalizeHexColor(rawLayout.primaryColor, defaults.layout.primaryColor),
    backgroundColor: normalizeHexColor(rawLayout.backgroundColor, defaults.layout.backgroundColor),
    surfaceColor: normalizeHexColor(rawLayout.surfaceColor, defaults.layout.surfaceColor),
    textColor: normalizeHexColor(rawLayout.textColor, defaults.layout.textColor),
    whatsappNumber:
      typeof rawLayout.whatsappNumber === 'string'
        ? rawLayout.whatsappNumber.trim().slice(0, 30)
        : defaults.layout.whatsappNumber
  };

  const categories: VirtualStoreCategory[] = Array.isArray(rawStore.categories)
    ? rawStore.categories
        .filter((c: any) => c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim())
        .map((c: any, idx: number) => ({
          id: typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `cat_${idx + 1}`,
          name: String(c.name).trim().slice(0, 80),
          description: typeof c.description === 'string' ? c.description.trim().slice(0, 240) : '',
          imageUrl: sanitizeOptionalUrl(c.imageUrl),
          active: c.active !== false,
          order: Number.isFinite(Number(c.order)) ? Number(c.order) : idx,
          createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
          updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : new Date().toISOString()
        }))
        .sort((a: VirtualStoreCategory, b: VirtualStoreCategory) => a.order - b.order)
    : [];

  const validCategoryIds = new Set(categories.map((c) => c.id));

  const products: VirtualStoreProduct[] = Array.isArray(rawStore.products)
    ? rawStore.products
        .filter((p: any) => p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim())
        .map((p: any, idx: number) => {
          const parsedPrice = Number(p.price);
          const parsedStock = Math.floor(Number(p.stock));
          const catId = typeof p.categoryId === 'string' && validCategoryIds.has(p.categoryId) ? p.categoryId : null;
          return {
            id: typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `prod_${idx + 1}`,
            categoryId: catId,
            name: String(p.name).trim().slice(0, 120),
            description: typeof p.description === 'string' ? p.description.trim().slice(0, 600) : '',
            price: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? Number(parsedPrice.toFixed(2)) : 0,
            stock: Number.isFinite(parsedStock) && parsedStock >= 0 ? parsedStock : 0,
            imageUrl: sanitizeOptionalUrl(p.imageUrl),
            active: p.active !== false,
            featured: Boolean(p.featured),
            createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
            updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString()
          };
        })
    : [];

  return {
    layout,
    categories,
    products,
    updatedAt: typeof rawStore.updatedAt === 'string' ? rawStore.updatedAt : null
  };
}

export function getVirtualStoreFromConfig(
  rawConfig?: Record<string, any> | null,
  shop?: ShopStoreContext | null
): VirtualStoreData {
  return normalizeVirtualStore(rawConfig?._virtualStore, shop);
}

export function updateVirtualStoreLayout(
  rawConfig: Record<string, any> | null | undefined,
  patch: Partial<VirtualStoreLayout>,
  shop?: ShopStoreContext | null,
  nowIso: string = new Date().toISOString()
): Record<string, any> {
  const base = rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {};
  const current = getVirtualStoreFromConfig(base, shop);

  const nextLayout: VirtualStoreLayout = {
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.layout.enabled,
    showPublicButton:
      patch.showPublicButton !== undefined
        ? Boolean(patch.showPublicButton)
        : current.layout.showPublicButton,
    buttonLabel:
      patch.buttonLabel !== undefined
        ? (String(patch.buttonLabel).trim().slice(0, 60) || DEFAULT_STORE_BUTTON_LABEL)
        : current.layout.buttonLabel,
    storeName:
      patch.storeName !== undefined
        ? (String(patch.storeName).trim().slice(0, 80) || current.layout.storeName)
        : current.layout.storeName,
    tagline:
      patch.tagline !== undefined
        ? String(patch.tagline).trim().slice(0, 220)
        : current.layout.tagline,
    logoUrl:
      patch.logoUrl !== undefined
        ? sanitizeOptionalUrl(patch.logoUrl)
        : current.layout.logoUrl,
    bannerUrl:
      patch.bannerUrl !== undefined
        ? sanitizeOptionalUrl(patch.bannerUrl)
        : current.layout.bannerUrl,
    primaryColor:
      patch.primaryColor !== undefined
        ? normalizeHexColor(patch.primaryColor, current.layout.primaryColor)
        : current.layout.primaryColor,
    backgroundColor:
      patch.backgroundColor !== undefined
        ? normalizeHexColor(patch.backgroundColor, current.layout.backgroundColor)
        : current.layout.backgroundColor,
    surfaceColor:
      patch.surfaceColor !== undefined
        ? normalizeHexColor(patch.surfaceColor, current.layout.surfaceColor)
        : current.layout.surfaceColor,
    textColor:
      patch.textColor !== undefined
        ? normalizeHexColor(patch.textColor, current.layout.textColor)
        : current.layout.textColor,
    whatsappNumber:
      patch.whatsappNumber !== undefined
        ? String(patch.whatsappNumber).trim().slice(0, 30)
        : current.layout.whatsappNumber
  };

  base._virtualStore = {
    ...current,
    layout: nextLayout,
    updatedAt: nowIso
  };
  return base;
}

export interface UpsertCategoryInput {
  name: string;
  description?: string;
  imageUrl?: string | null;
  active?: boolean;
  order?: number;
}

export function upsertStoreCategory(
  rawConfig: Record<string, any> | null | undefined,
  input: UpsertCategoryInput,
  categoryId?: string | null,
  shop?: ShopStoreContext | null,
  nowIso: string = new Date().toISOString()
): { nextConfig: Record<string, any>; category: VirtualStoreCategory } {
  const cleanName = typeof input.name === 'string' ? input.name.trim() : '';
  if (cleanName.length < 2) {
    throw new Error('O nome da categoria deve ter pelo menos 2 caracteres.');
  }

  const base = rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {};
  const current = getVirtualStoreFromConfig(base, shop);
  const categories = [...current.categories];

  if (categoryId) {
    const idx = categories.findIndex((c) => c.id === categoryId);
    if (idx === -1) {
      throw new Error('Categoria não encontrada.');
    }
    const existing = categories[idx];
    const updated: VirtualStoreCategory = {
      ...existing,
      name: cleanName.slice(0, 80),
      description:
        input.description !== undefined
          ? String(input.description).trim().slice(0, 240)
          : existing.description,
      imageUrl:
        input.imageUrl !== undefined
          ? sanitizeOptionalUrl(input.imageUrl)
          : existing.imageUrl,
      active: input.active !== undefined ? Boolean(input.active) : existing.active,
      order: input.order !== undefined && Number.isFinite(Number(input.order))
        ? Number(input.order)
        : existing.order,
      updatedAt: nowIso
    };
    categories[idx] = updated;
    base._virtualStore = { ...current, categories, updatedAt: nowIso };
    return { nextConfig: base, category: updated };
  }

  const created: VirtualStoreCategory = {
    id: generateItemId('cat'),
    name: cleanName.slice(0, 80),
    description: typeof input.description === 'string' ? input.description.trim().slice(0, 240) : '',
    imageUrl: sanitizeOptionalUrl(input.imageUrl),
    active: input.active !== false,
    order:
      input.order !== undefined && Number.isFinite(Number(input.order))
        ? Number(input.order)
        : categories.length,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  categories.push(created);
  base._virtualStore = { ...current, categories, updatedAt: nowIso };
  return { nextConfig: base, category: created };
}

export function deleteStoreCategory(
  rawConfig: Record<string, any> | null | undefined,
  categoryId: string,
  shop?: ShopStoreContext | null,
  nowIso: string = new Date().toISOString()
): Record<string, any> {
  const base = rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {};
  const current = getVirtualStoreFromConfig(base, shop);
  const exists = current.categories.some((c) => c.id === categoryId);
  if (!exists) {
    throw new Error('Categoria não encontrada.');
  }

  const categories = current.categories
    .filter((c) => c.id !== categoryId)
    .map((c, idx) => ({ ...c, order: idx }));

  const products = current.products.map((p) =>
    p.categoryId === categoryId ? { ...p, categoryId: null, updatedAt: nowIso } : p
  );

  base._virtualStore = {
    ...current,
    categories,
    products,
    updatedAt: nowIso
  };
  return base;
}

export interface UpsertProductInput {
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  categoryId?: string | null;
  active?: boolean;
  featured?: boolean;
}

export function upsertStoreProduct(
  rawConfig: Record<string, any> | null | undefined,
  input: UpsertProductInput,
  productId?: string | null,
  shop?: ShopStoreContext | null,
  nowIso: string = new Date().toISOString()
): { nextConfig: Record<string, any>; product: VirtualStoreProduct } {
  const cleanName = typeof input.name === 'string' ? input.name.trim() : '';
  if (cleanName.length < 2) {
    throw new Error('O nome do produto deve ter pelo menos 2 caracteres.');
  }

  const parsedPrice = Number(input.price);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    throw new Error('Informe um preço válido maior ou igual a zero.');
  }

  const parsedStock = Number(input.stock);
  if (!Number.isFinite(parsedStock) || parsedStock < 0 || !Number.isInteger(parsedStock)) {
    throw new Error('Informe uma quantidade de estoque inteira maior ou igual a zero.');
  }

  const base = rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {};
  const current = getVirtualStoreFromConfig(base, shop);
  const validCategoryIds = new Set(current.categories.map((c) => c.id));
  const resolvedCategoryId =
    typeof input.categoryId === 'string' && validCategoryIds.has(input.categoryId)
      ? input.categoryId
      : null;

  const products = [...current.products];

  if (productId) {
    const idx = products.findIndex((p) => p.id === productId);
    if (idx === -1) {
      throw new Error('Produto não encontrado.');
    }
    const existing = products[idx];
    const updated: VirtualStoreProduct = {
      ...existing,
      name: cleanName.slice(0, 120),
      description:
        input.description !== undefined
          ? String(input.description).trim().slice(0, 600)
          : existing.description,
      price: Number(parsedPrice.toFixed(2)),
      stock: parsedStock,
      imageUrl:
        input.imageUrl !== undefined
          ? sanitizeOptionalUrl(input.imageUrl)
          : existing.imageUrl,
      categoryId: input.categoryId !== undefined ? resolvedCategoryId : existing.categoryId,
      active: input.active !== undefined ? Boolean(input.active) : existing.active,
      featured: input.featured !== undefined ? Boolean(input.featured) : existing.featured,
      updatedAt: nowIso
    };
    products[idx] = updated;
    base._virtualStore = { ...current, products, updatedAt: nowIso };
    return { nextConfig: base, product: updated };
  }

  const created: VirtualStoreProduct = {
    id: generateItemId('prod'),
    categoryId: resolvedCategoryId,
    name: cleanName.slice(0, 120),
    description: typeof input.description === 'string' ? input.description.trim().slice(0, 600) : '',
    price: Number(parsedPrice.toFixed(2)),
    stock: parsedStock,
    imageUrl: sanitizeOptionalUrl(input.imageUrl),
    active: input.active !== false,
    featured: Boolean(input.featured),
    createdAt: nowIso,
    updatedAt: nowIso
  };

  products.unshift(created);
  base._virtualStore = { ...current, products, updatedAt: nowIso };
  return { nextConfig: base, product: created };
}

export function adjustStoreProductStock(
  rawConfig: Record<string, any> | null | undefined,
  productId: string,
  delta: number,
  shop?: ShopStoreContext | null,
  nowIso: string = new Date().toISOString()
): { nextConfig: Record<string, any>; product: VirtualStoreProduct } {
  const base = rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {};
  const current = getVirtualStoreFromConfig(base, shop);
  const products = [...current.products];
  const idx = products.findIndex((p) => p.id === productId);
  if (idx === -1) {
    throw new Error('Produto não encontrado.');
  }

  const safeDelta = Math.trunc(Number(delta) || 0);
  const nextStock = Math.max(0, products[idx].stock + safeDelta);
  const updated: VirtualStoreProduct = {
    ...products[idx],
    stock: nextStock,
    updatedAt: nowIso
  };
  products[idx] = updated;
  base._virtualStore = { ...current, products, updatedAt: nowIso };
  return { nextConfig: base, product: updated };
}

export function deleteStoreProduct(
  rawConfig: Record<string, any> | null | undefined,
  productId: string,
  shop?: ShopStoreContext | null,
  nowIso: string = new Date().toISOString()
): Record<string, any> {
  const base = rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {};
  const current = getVirtualStoreFromConfig(base, shop);
  const exists = current.products.some((p) => p.id === productId);
  if (!exists) {
    throw new Error('Produto não encontrado.');
  }

  base._virtualStore = {
    ...current,
    products: current.products.filter((p) => p.id !== productId),
    updatedAt: nowIso
  };
  return base;
}

export function getPublicStoreSummary(
  rawConfig?: Record<string, any> | null,
  shop?: ShopStoreContext | null
): PublicStoreSummary {
  const store = getVirtualStoreFromConfig(rawConfig, shop);
  const activeProductsCount = store.products.filter((p) => p.active).length;
  const activeCategoriesCount = store.categories.filter((c) => c.active).length;

  return {
    enabled: store.layout.enabled,
    showPublicButton: store.layout.enabled && store.layout.showPublicButton,
    buttonLabel: store.layout.buttonLabel || DEFAULT_STORE_BUTTON_LABEL,
    storeName: store.layout.storeName,
    activeProductsCount,
    activeCategoriesCount
  };
}

export function getPublicStorefrontPayload(
  rawConfig: Record<string, any> | null | undefined,
  shop: ShopStoreContext
) {
  const store = getVirtualStoreFromConfig(rawConfig, shop);
  const activeCategories = store.categories.filter((c) => c.active);
  const activeCategoryIds = new Set(activeCategories.map((c) => c.id));
  const activeProducts = store.products
    .filter((p) => p.active)
    .map((p) => ({
      ...p,
      categoryId: p.categoryId && activeCategoryIds.has(p.categoryId) ? p.categoryId : null
    }));

  return {
    shop: {
      id: String(shop.id || ''),
      name: String(shop.name || ''),
      slug: String(shop.slug || ''),
      whatsapp: store.layout.whatsappNumber || String(shop.whatsapp || shop.phone || '')
    },
    layout: store.layout,
    categories: activeCategories,
    products: activeProducts
  };
}

export const VIRTUAL_STORE_PUBLIC_ROLLOUT_KEY = 'virtual_store_public_rollout';
export const VIRTUAL_STORE_ENABLED_SHOPS_KEY = 'virtual_store_enabled_shops';

export function parseVirtualStoreRolloutFlag(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'enabled';
}

export function parseVirtualStoreEnabledShops(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Set<string>();
    for (const item of parsed) {
      const id = String(item || '').trim();
      if (id) unique.add(id);
    }
    return Array.from(unique);
  } catch {
    return [];
  }
}

export function canAccessVirtualStorePanel(input: {
  role?: string | null;
  barbershopId?: string | null;
  enabledForAll?: boolean;
  enabledShopIds?: string[] | null;
}): boolean {
  if (input.role === 'master') return true;
  if (input.role !== 'admin') return false;
  if (input.enabledForAll) return true;
  if (!input.barbershopId || !Array.isArray(input.enabledShopIds)) return false;
  return input.enabledShopIds.includes(String(input.barbershopId));
}


