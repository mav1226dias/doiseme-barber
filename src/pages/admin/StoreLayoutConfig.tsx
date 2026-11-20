import React, { useEffect, useRef, useState } from 'react';
import {
  Save,
  Upload,
  Trash2,
  Store,
  Palette,
  Eye,
  ShoppingBag,
  ArrowRight,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import StoreAdminHeader, { uploadStoreImage } from '../../components/StoreAdminHeader';
import {
  DEFAULT_STORE_BUTTON_LABEL,
  isLightHex,
  type VirtualStoreLayout
} from '../../lib/virtualStore';

const COLOR_PRESETS = [
  {
    id: 'boutique-light',
    name: 'Claro Editorial',
    primaryColor: '#111827',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#F8FAFC',
    textColor: '#111827'
  },
  {
    id: 'gold-dark',
    name: 'Ouro Noturno',
    primaryColor: '#D4AF37',
    backgroundColor: '#0A0A0B',
    surfaceColor: '#16161A',
    textColor: '#F8FAFC'
  },
  {
    id: 'warm-paper',
    name: 'Papel Quente',
    primaryColor: '#9A6B2F',
    backgroundColor: '#FAF7F2',
    surfaceColor: '#F2ECE3',
    textColor: '#1F1A17'
  },
  {
    id: 'slate-emerald',
    name: 'Ardósia & Verde',
    primaryColor: '#059669',
    backgroundColor: '#F8FAFC',
    surfaceColor: '#FFFFFF',
    textColor: '#0F172A'
  }
];

export default function StoreLayoutConfig() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [shopId, setShopId] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [shopName, setShopName] = useState('');

  const [layout, setLayout] = useState<VirtualStoreLayout>({
    enabled: false,
    showPublicButton: false,
    buttonLabel: DEFAULT_STORE_BUTTON_LABEL,
    storeName: '',
    tagline: '',
    logoUrl: null,
    bannerUrl: null,
    primaryColor: '#D4AF37',
    backgroundColor: '#FFFFFF',
    surfaceColor: '#F8FAFC',
    textColor: '#111827',
    whatsappNumber: ''
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
        throw new Error(data?.error || 'Não foi possível carregar as configurações da loja virtual.');
      }
      setShopId(data.shop?.id || '');
      setShopSlug(data.shop?.slug || '');
      setShopName(data.shop?.name || '');
      if (data.layout) {
        setLayout(data.layout);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Erro ao carregar dados da loja virtual.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, []);

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'logo' | 'banner'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    if (kind === 'logo') setUploadingLogo(true);
    else setUploadingBanner(true);

    try {
      const publicUrl = await uploadStoreImage(file, kind, shopId);
      setLayout((prev) => ({
        ...prev,
        [kind === 'logo' ? 'logoUrl' : 'bannerUrl']: publicUrl
      }));
      toast.success(kind === 'logo' ? 'Logo da loja enviada!' : 'Banner da loja enviado!');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar imagem.');
    } finally {
      if (kind === 'logo') setUploadingLogo(false);
      else setUploadingBanner(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingLogo || uploadingBanner) {
      toast.error('Aguarde o envio da imagem terminar antes de salvar.');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/store/layout', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(layout)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao salvar layout da loja.');
      }
      if (data.layout) setLayout(data.layout);
      toast.success('Layout da loja virtual salvo com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const previewBtnTextColor = isLightHex(layout.primaryColor) ? '#111827' : '#FFFFFF';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-2xl bg-gray-200/70 dark:bg-zinc-900 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-96 rounded-2xl bg-gray-200/70 dark:bg-zinc-900 animate-pulse" />
          <div className="lg:col-span-5 h-96 rounded-2xl bg-gray-200/70 dark:bg-zinc-900 animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <StoreAdminHeader
          shopSlug={shopSlug}
          title="Layout da Loja Virtual"
          description="Personalize a aparência, logo, cores e a exibição do botão opcional na página pública."
        />
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StoreAdminHeader
        shopSlug={shopSlug}
        storeEnabled={layout.enabled}
        title="Layout da Loja Virtual"
        description="Configure identidade visual, logo, banner, paleta de cores e o botão opcional na página pública de agendamento."
      />

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna de Formulário */}
        <div className="lg:col-span-7 space-y-6">
          {/* Ativação e Botão Opcional na Página Pública */}
          <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#B8901F] dark:text-[#D4AF37]" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Publicação e acesso pela página pública
              </h2>
            </div>

            <div className="space-y-4">
              <label className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 cursor-pointer">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Ativar loja virtual
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Libera o catálogo público em {shopSlug ? `/b/${shopSlug}/loja` : '/b/seu-link/loja'} para clientes visualizarem categorias e produtos.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={layout.enabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setLayout((prev) => ({
                      ...prev,
                      enabled: checked,
                      showPublicButton: checked ? (prev.showPublicButton || true) : false
                    }));
                  }}
                  className="mt-1 h-5 w-5 accent-[#D4AF37] rounded cursor-pointer shrink-0"
                />
              </label>

              <label className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 cursor-pointer">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Mostrar espaço opcional na página pública de agendamento
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Exibe o botão clicável opcional na página /b/{shopSlug || 'sua-loja'} para levar o cliente diretamente à loja virtual.
                  </p>
                </div>
                <input
                  type="checkbox"
                  disabled={!layout.enabled}
                  checked={layout.enabled && layout.showPublicButton}
                  onChange={(e) =>
                    setLayout((prev) => ({ ...prev, showPublicButton: e.target.checked }))
                  }
                  className="mt-1 h-5 w-5 accent-[#D4AF37] rounded cursor-pointer disabled:opacity-40 shrink-0"
                />
              </label>

              <div>
                <label
                  htmlFor="store-button-label"
                  className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
                >
                  Texto do botão na página pública
                </label>
                <input
                  id="store-button-label"
                  type="text"
                  maxLength={60}
                  value={layout.buttonLabel}
                  onChange={(e) => setLayout((prev) => ({ ...prev, buttonLabel: e.target.value }))}
                  placeholder={DEFAULT_STORE_BUTTON_LABEL}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
            </div>
          </section>

          {/* Identidade, Logo e Banner */}
          <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#B8901F] dark:text-[#D4AF37]" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Identidade, logo e banner
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="store-name"
                  className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
                >
                  Nome exibido na loja
                </label>
                <input
                  id="store-name"
                  type="text"
                  maxLength={80}
                  value={layout.storeName}
                  onChange={(e) => setLayout((prev) => ({ ...prev, storeName: e.target.value }))}
                  placeholder={shopName || 'Nome da Loja'}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>

              <div>
                <label
                  htmlFor="store-whatsapp"
                  className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
                >
                  WhatsApp para receber pedidos
                </label>
                <input
                  id="store-whatsapp"
                  type="text"
                  maxLength={30}
                  value={layout.whatsappNumber}
                  onChange={(e) => setLayout((prev) => ({ ...prev, whatsappNumber: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="store-tagline"
                className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5"
              >
                Descrição curta / subtítulo da vitrine
              </label>
              <textarea
                id="store-tagline"
                rows={2}
                maxLength={220}
                value={layout.tagline}
                onChange={(e) => setLayout((prev) => ({ ...prev, tagline: e.target.value }))}
                placeholder="Ex: Produtos profissionais disponíveis para retirada ou entrega."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            {/* Logo Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-2.5">
                <span className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                  Logo da loja virtual
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0">
                    {layout.logoUrl ? (
                      <img
                        src={layout.logoUrl}
                        alt="Logo da loja"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Store className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => handleUpload(e, 'logo')}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingLogo ? 'Enviando...' : 'Enviar logo'}</span>
                    </button>
                    {layout.logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLayout((prev) => ({ ...prev, logoUrl: null }))}
                        className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Banner Upload */}
              <div className="space-y-2.5">
                <span className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                  Banner de destaque (opcional)
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-16 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0">
                    {layout.bannerUrl ? (
                      <img
                        src={layout.bannerUrl}
                        alt="Banner da loja"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => handleUpload(e, 'banner')}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingBanner}
                      onClick={() => bannerInputRef.current?.click()}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingBanner ? 'Enviando...' : 'Enviar banner'}</span>
                    </button>
                    {layout.bannerUrl && (
                      <button
                        type="button"
                        onClick={() => setLayout((prev) => ({ ...prev, bannerUrl: null }))}
                        className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Cores da Loja */}
          <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#B8901F] dark:text-[#D4AF37]" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Paleta de cores da vitrine
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setLayout((prev) => ({
                      ...prev,
                      primaryColor: preset.primaryColor,
                      backgroundColor: preset.backgroundColor,
                      surfaceColor: preset.surfaceColor,
                      textColor: preset.textColor
                    }))
                  }
                  className="min-h-[40px] inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:border-[#D4AF37] transition-colors"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/15"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/15 -ml-2"
                    style={{ backgroundColor: preset.backgroundColor }}
                  />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'primaryColor' as const, label: 'Cor principal (botões e destaque)' },
                { key: 'backgroundColor' as const, label: 'Cor de fundo da página' },
                { key: 'surfaceColor' as const, label: 'Cor dos cards de produto' },
                { key: 'textColor' as const, label: 'Cor principal dos textos' }
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label
                    htmlFor={`color-${field.key}`}
                    className="block text-xs font-semibold text-gray-700 dark:text-zinc-300"
                  >
                    {field.label}
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      id={`color-${field.key}`}
                      type="color"
                      value={layout[field.key]}
                      onChange={(e) =>
                        setLayout((prev) => ({ ...prev, [field.key]: e.target.value.toUpperCase() }))
                      }
                      className="h-11 w-12 rounded-lg border border-gray-200 dark:border-zinc-700 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={layout[field.key]}
                      onChange={(e) =>
                        setLayout((prev) => ({ ...prev, [field.key]: e.target.value.toUpperCase() }))
                      }
                      maxLength={7}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-mono uppercase text-gray-900 dark:text-white tabular-nums"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saving || uploadingLogo || uploadingBanner}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar layout da loja'}</span>
            </button>
          </div>
        </div>

        {/* Coluna de Pré-visualização ao Vivo */}
        <aside className="lg:col-span-5 space-y-5 lg:sticky lg:top-6">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-200">
                <Eye className="w-4 h-4 text-[#B8901F] dark:text-[#D4AF37]" />
                <span>Pré-visualização em tempo real</span>
              </div>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {layout.enabled ? 'Ativa' : 'Oculta'}
              </span>
            </div>

            {/* Preview do espaço opcional na página pública */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                Botão opcional na página pública (/b/{shopSlug || 'sua-loja'})
              </div>
              <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/70 dark:bg-zinc-950/60">
                {layout.enabled && layout.showPublicButton ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {layout.storeName || shopName || 'Loja Virtual'}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                        Produtos disponíveis para pedido
                      </div>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0"
                      style={{ backgroundColor: layout.primaryColor, color: previewBtnTextColor }}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{layout.buttonLabel || DEFAULT_STORE_BUTTON_LABEL}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-1">
                    Botão desativado na página pública. Ative a loja e marque a exibição opcional para mostrar.
                  </p>
                )}
              </div>
            </div>

            {/* Preview da vitrine */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                Aparência da vitrine (/b/{shopSlug || 'sua-loja'}/loja)
              </div>
              <div
                className="rounded-2xl border overflow-hidden transition-colors"
                style={{
                  backgroundColor: layout.backgroundColor,
                  color: layout.textColor,
                  borderColor: isLightHex(layout.backgroundColor) ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'
                }}
              >
                {layout.bannerUrl && (
                  <div className="h-24 w-full overflow-hidden">
                    <img
                      src={layout.bannerUrl}
                      alt="Prévia do banner"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    {layout.logoUrl ? (
                      <img
                        src={layout.logoUrl}
                        alt="Prévia da logo"
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-xl object-contain p-1 border"
                        style={{
                          backgroundColor: layout.surfaceColor,
                          borderColor: isLightHex(layout.backgroundColor) ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'
                        }}
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: layout.surfaceColor }}
                      >
                        <Store className="w-5 h-5" style={{ color: layout.primaryColor }} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">
                        {layout.storeName || shopName || 'Loja Virtual'}
                      </div>
                      <div className="text-xs opacity-70 line-clamp-2">
                        {layout.tagline || 'Catálogo oficial do estabelecimento'}
                      </div>
                    </div>
                  </div>

                  {/* Mini card de exemplo */}
                  <div
                    className="p-3 rounded-xl border flex items-center justify-between gap-3"
                    style={{
                      backgroundColor: layout.surfaceColor,
                      borderColor: isLightHex(layout.backgroundColor) ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <div>
                      <div className="text-[11px] opacity-60">Categoria exemplo</div>
                      <div className="text-xs font-semibold">Produto em destaque</div>
                      <div className="text-xs font-bold tabular-nums mt-0.5" style={{ color: layout.primaryColor }}>
                        R$ 79,90
                      </div>
                    </div>
                    <span
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap"
                      style={{ backgroundColor: layout.primaryColor, color: previewBtnTextColor }}
                    >
                      Adicionar
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
