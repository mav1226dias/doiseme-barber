import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  Layers,
  Image as ImageIcon,
  X,
  RefreshCw,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import StoreAdminHeader, { uploadStoreImage } from '../../components/StoreAdminHeader';
import type { VirtualStoreCategory, VirtualStoreProduct } from '../../lib/virtualStore';

export default function StoreCategories() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shopId, setShopId] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [storeEnabled, setStoreEnabled] = useState(false);
  const [categories, setCategories] = useState<VirtualStoreCategory[]>([]);
  const [products, setProducts] = useState<VirtualStoreProduct[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
        throw new Error(data?.error || 'Erro ao carregar categorias da loja.');
      }
      setShopId(data.shop?.id || '');
      setShopSlug(data.shop?.slug || '');
      setStoreEnabled(Boolean(data.layout?.enabled));
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err: any) {
      setLoadError(err?.message || 'Erro de conexão ao carregar categorias.');
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
    setImageUrl(null);
    setActive(true);
  };

  const startEdit = (cat: VirtualStoreCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
    setImageUrl(cat.imageUrl || null);
    setActive(cat.active);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    setUploading(true);
    try {
      const publicUrl = await uploadStoreImage(file, 'category', shopId);
      setImageUrl(publicUrl);
      toast.success('Foto da categoria enviada!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar foto da categoria.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Informe um nome com pelo menos 2 caracteres.');
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
        ? `/api/admin/store/categories/${editingId}`
        : '/api/admin/store/categories';
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
          imageUrl,
          active
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao salvar categoria.');
      }
      if (Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
      toast.success(editingId ? 'Categoria atualizada!' : 'Categoria cadastrada!');
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível salvar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/store/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao excluir categoria.');
      if (Array.isArray(data.categories)) setCategories(data.categories);
      if (Array.isArray(data.products)) setProducts(data.products);
      if (editingId === id) resetForm();
      setConfirmDeleteId(null);
      toast.success('Categoria removida.');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível excluir a categoria.');
    }
  };

  const countProductsInCategory = (categoryId: string) =>
    products.filter((p) => p.categoryId === categoryId).length;

  return (
    <div className="space-y-6">
      <StoreAdminHeader
        shopSlug={shopSlug}
        storeEnabled={storeEnabled}
        title="Categorias da Loja"
        description="Cadastre categorias e adicione fotos de demonstração visual para organizar a vitrine da sua loja virtual."
      />

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
          {/* Formulário de Cadastro / Edição */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {editingId ? 'Editar categoria' : 'Nova categoria'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar edição</span>
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor="cat-name"
                className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
              >
                Nome da categoria *
              </label>
              <input
                id="cat-name"
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cuidados com Barba, Perfumaria, Kits"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label
                htmlFor="cat-desc"
                className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
              >
                Descrição curta (opcional)
              </label>
              <textarea
                id="cat-desc"
                rows={2}
                maxLength={240}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resumo visual para apresentar a linha de produtos"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            {/* Foto de demonstração visual */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                Foto de demonstração visual da categoria
              </span>

              <div className="aspect-[16/10] w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 overflow-hidden flex items-center justify-center relative">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name || 'Foto da categoria'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-gray-400 dark:text-zinc-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1.5 opacity-60" />
                    <span className="text-xs block">Nenhuma foto selecionada</span>
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
                    <span>Remover foto</span>
                  </button>
                )}
              </div>

              <input
                type="url"
                aria-label="URL da foto da categoria"
                value={imageUrl || ''}
                onChange={(e) => setImageUrl(e.target.value.trim() || null)}
                placeholder="Ou cole o endereço (URL) de uma imagem"
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <label className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 cursor-pointer">
              <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">
                Exibir categoria na vitrine pública
              </span>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-[#D4AF37] cursor-pointer"
              />
            </label>

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
                    ? 'Salvar alterações'
                    : 'Cadastrar categoria'}
              </span>
            </button>
          </form>

          {/* Lista Visual de Categorias */}
          <section className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Categorias cadastradas
              </h2>
              <span className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-56 rounded-2xl bg-gray-200/70 dark:bg-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-2">
                <Layers className="w-8 h-8 text-gray-400 dark:text-zinc-600 mx-auto" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Nenhuma categoria cadastrada
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Crie sua primeira categoria ao lado e adicione uma foto de demonstração para destacar suas linhas de produtos na loja virtual.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categories.map((cat) => {
                  const prodCount = countProductsInCategory(cat.id);
                  return (
                    <article
                      key={cat.id}
                      className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="aspect-[16/10] w-full bg-gray-100 dark:bg-zinc-950 overflow-hidden flex items-center justify-center">
                          {cat.imageUrl ? (
                            <img
                              src={cat.imageUrl}
                              alt={cat.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-gray-400 dark:text-zinc-600 p-4">
                              <ImageIcon className="w-7 h-7 mb-1 opacity-60" />
                              <span className="text-[11px]">Sem foto visual</span>
                            </div>
                          )}
                        </div>

                        <div className="p-4 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                            <span className={cat.active ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-400'}>
                              {cat.active ? 'Ativa' : 'Oculta'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {prodCount} {prodCount === 1 ? 'produto' : 'produtos'}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            {cat.name}
                          </h3>
                          {cat.description && (
                            <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">
                              {cat.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="px-4 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          className="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {confirmDeleteId === cat.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDelete(cat.id)}
                              className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[38px] px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(cat.id)}
                            className="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        )}
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
