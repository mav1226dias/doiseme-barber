import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  Package,
  Image as ImageIcon,
  Search,
  X,
  Check,
  Minus,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import StoreAdminHeader, { uploadStoreImage } from '../../components/StoreAdminHeader';
import { getSessionAuth } from '../../lib/auth';
import {
  formatBRL,
  type VirtualStoreCategory,
  type VirtualStoreProduct
} from '../../lib/virtualStore';

export default function StoreProducts() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shopId, setShopId] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [storeEnabled, setStoreEnabled] = useState(false);
  const [categories, setCategories] = useState<VirtualStoreCategory[]>([]);
  const [products, setProducts] = useState<VirtualStoreProduct[]>([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [stockInput, setStockInput] = useState('0');
  const [categoryId, setCategoryId] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStore = async () => {
    setLoading(true);
    setLoadError(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/store', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao carregar produtos e estoque.');
      }
      setShopId(data.shop?.id || '');
      setShopSlug(data.shop?.slug || '');
      setStoreEnabled(Boolean(data.layout?.enabled));
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err: any) {
      setLoadError(err?.message || 'Erro de conexão ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPriceInput('');
    setStockInput('0');
    setCategoryId('');
    setImageUrl(null);
    setActive(true);
    setFeatured(false);
  };

  const startEdit = (product: VirtualStoreProduct) => {
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description || '');
    setPriceInput(String(product.price));
    setStockInput(String(product.stock));
    setCategoryId(product.categoryId || '');
    setImageUrl(product.imageUrl || null);
    setActive(product.active);
    setFeatured(product.featured);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    setUploading(true);
    try {
      const publicUrl = await uploadStoreImage(file, 'product', shopId);
      setImageUrl(publicUrl);
      toast.success('Foto do produto enviada!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar foto do produto.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPrice = Number(String(priceInput).replace(',', '.'));
    const normalizedStock = Number(stockInput);

    if (name.trim().length < 2) {
      toast.error('Informe o nome do produto (mínimo 2 caracteres).');
      return;
    }
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      toast.error('Informe um preço válido.');
      return;
    }
    if (!Number.isFinite(normalizedStock) || normalizedStock < 0 || !Number.isInteger(normalizedStock)) {
      toast.error('Informe um estoque inteiro maior ou igual a zero.');
      return;
    }
    if (uploading) {
      toast.error('Aguarde o envio da foto terminar.');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const url = editingId
        ? `/api/admin/store/products/${editingId}`
        : '/api/admin/store/products';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          price: normalizedPrice,
          stock: normalizedStock,
          categoryId: categoryId || null,
          imageUrl,
          active,
          featured
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao salvar produto.');
      if (Array.isArray(data.products)) setProducts(data.products);
      toast.success(editingId ? 'Produto atualizado!' : 'Produto cadastrado!');
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível salvar o produto.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStock = async (productId: string, delta: number) => {
    setAdjustingId(productId);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/store/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ stockDelta: delta })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar estoque.');
      if (Array.isArray(data.products)) setProducts(data.products);
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível ajustar o estoque.');
    } finally {
      setAdjustingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/store/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir produto.');
      if (Array.isArray(data.products)) setProducts(data.products);
      if (editingId === id) resetForm();
      setConfirmDeleteId(null);
      toast.success('Produto removido.');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível excluir o produto.');
    }
  };

  const [seedingDemo, setSeedingDemo] = useState(false);

  const handleSeedDemoCatalog = async () => {
    setSeedingDemo(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/store/seed-demo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar catálogo de exemplo.');
      if (Array.isArray(data.categories)) setCategories(data.categories);
      if (Array.isArray(data.products)) setProducts(data.products);
      setStoreEnabled(true);
      toast.success('Catálogo de exemplo carregado (6 categorias e 35 produtos)!');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível carregar o catálogo de exemplo.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter === 'uncategorized' && p.categoryId !== null) return false;
      if (categoryFilter !== 'all' && categoryFilter !== 'uncategorized' && p.categoryId !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter]);

  const metrics = useMemo(() => {
    const totalItems = products.length;
    const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);
    const outOfStock = products.filter((p) => p.stock === 0).length;
    const inventoryValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
    return { totalItems, totalUnits, outOfStock, inventoryValue };
  }, [products]);

  return (
    <div className="space-y-6">
      <StoreAdminHeader
        shopSlug={shopSlug}
        storeEnabled={storeEnabled}
        title="Estoque e Valores"
        description="Cadastre produtos com foto, nome, descrição, preço e controle de estoque em tempo real."
      />

      {getSessionAuth().role === 'master' && products.length === 0 && !loading && !loadError && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              Quer popular com produtos de teste?
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Carregue automaticamente 6 categorias (5 de barbearia + Vestuário Masculino) e 35 produtos com foto, preço e estoque.
            </p>
          </div>
          <button
            type="button"
            disabled={seedingDemo}
            onClick={handleSeedDemoCatalog}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs font-bold text-gray-900 dark:text-white hover:border-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
          >
            {seedingDemo ? 'Carregando...' : 'Carregar 35 produtos de exemplo'}
          </button>
        </div>
      )}

      {/* Resumo numérico */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-gray-500 dark:text-zinc-400">Produtos cadastrados</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
            {metrics.totalItems}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-gray-500 dark:text-zinc-400">Unidades em estoque</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
            {metrics.totalUnits}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-gray-500 dark:text-zinc-400">Sem estoque</div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${metrics.outOfStock > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
            {metrics.outOfStock}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-gray-500 dark:text-zinc-400">Valor total em estoque</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
            {formatBRL(metrics.inventoryValue)}
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 text-center space-y-4">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{loadError}</p>
          <button
            type="button"
            onClick={fetchStore}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Formulário de Cadastro / Edição de Produto */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editingId ? 'Editar produto' : 'Cadastrar produto'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>

            {/* Foto do produto */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                Foto do produto
              </span>
              <div className="aspect-[4/3] w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 overflow-hidden flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name || 'Foto do produto'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-gray-400 dark:text-zinc-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1.5 opacity-60" />
                    <span className="text-xs block">Envie ou informe a foto do produto</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Enviando foto...' : 'Enviar foto'}</span>
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="min-h-[42px] inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover</span>
                  </button>
                )}
              </div>

              <input
                type="url"
                aria-label="URL da foto do produto"
                value={imageUrl || ''}
                onChange={(e) => setImageUrl(e.target.value.trim() || null)}
                placeholder="Ou cole a URL da foto do produto"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label
                htmlFor="prod-name"
                className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
              >
                Nome do produto *
              </label>
              <input
                id="prod-name"
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pomada Modeladora Matte 100g"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label
                htmlFor="prod-desc"
                className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
              >
                Descrição *
              </label>
              <textarea
                id="prod-desc"
                rows={3}
                required
                maxLength={600}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva benefícios, modo de uso, volume ou diferenciais do produto"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="prod-price"
                  className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
                >
                  Preço (R$) *
                </label>
                <input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <div>
                <label
                  htmlFor="prod-stock"
                  className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
                >
                  Estoque (unid.) *
                </label>
                <input
                  id="prod-stock"
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="prod-category"
                className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
              >
                Categoria
              </label>
              <select
                id="prod-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <option value="">Sem categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-zinc-800 cursor-pointer">
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">
                  Visível na loja
                </span>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-[#D4AF37] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-zinc-800 cursor-pointer">
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">
                  Produto em destaque
                </span>
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="h-4 w-4 accent-[#D4AF37] cursor-pointer"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>
                {saving
                  ? 'Salvando...'
                  : editingId
                    ? 'Salvar produto'
                    : 'Cadastrar produto'}
              </span>
            </button>
          </form>

          {/* Lista de Produtos, Estoque e Valores */}
          <section className="lg:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto por nome ou descrição..."
                  className="w-full min-h-[42px] pl-10 pr-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <select
                aria-label="Filtrar por categoria"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-gray-700 dark:text-zinc-200"
              >
                <option value="all">Todas categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="uncategorized">Sem categoria</option>
              </select>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-gray-200/70 dark:bg-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-2">
                <Package className="w-8 h-8 text-gray-400 dark:text-zinc-600 mx-auto" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
                  {products.length === 0
                    ? 'Preencha foto, nome, descrição, preço e estoque no formulário ao lado para iniciar seu catálogo.'
                    : 'Ajuste os filtros ou a busca para visualizar outros itens.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const categoryName = product.categoryId
                    ? categoryMap.get(product.categoryId) || 'Sem categoria'
                    : 'Sem categoria';

                  return (
                    <article
                      key={product.id}
                      className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4"
                    >
                      <div className="w-full sm:w-28 aspect-[4/3] sm:aspect-square rounded-xl bg-gray-100 dark:bg-zinc-950 overflow-hidden flex items-center justify-center shrink-0">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400 dark:text-zinc-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-zinc-400">
                            <span>{categoryName}</span>
                            <span aria-hidden="true">·</span>
                            <span className={product.active ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-400'}>
                              {product.active ? 'Ativo' : 'Oculto'}
                            </span>
                            {product.featured && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#9A7410] dark:text-[#D4AF37] font-medium">Destaque</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                              {product.name}
                            </h3>
                            <span className="text-sm font-bold text-gray-900 dark:text-[#D4AF37] tabular-nums whitespace-nowrap">
                              {formatBRL(product.price)}
                            </span>
                          </div>

                          {product.description && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                          {/* Controle rápido de estoque */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-zinc-400">Estoque:</span>
                            <div className="inline-flex items-center border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                disabled={adjustingId === product.id || product.stock <= 0}
                                onClick={() => handleQuickStock(product.id, -1)}
                                aria-label={`Diminuir estoque de ${product.name}`}
                                className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span
                                className={`px-2.5 text-xs font-bold tabular-nums ${
                                  product.stock === 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : product.stock <= 3
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {product.stock}
                              </span>
                              <button
                                type="button"
                                disabled={adjustingId === product.id}
                                onClick={() => handleQuickStock(product.id, 1)}
                                aria-label={`Aumentar estoque de ${product.name}`}
                                className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(product)}
                              className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>

                            {confirmDeleteId === product.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDelete(product.id)}
                                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="min-h-[36px] px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(product.id)}
                                className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
