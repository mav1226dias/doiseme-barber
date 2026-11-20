import { Link, useLocation } from 'react-router-dom';
import { Palette, Layers, Package, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface StoreAdminHeaderProps {
  shopSlug?: string;
  storeEnabled?: boolean;
  title: string;
  description: string;
}

const STORE_TABS = [
  { path: '/admin/loja/layout', label: 'Layout da Loja', icon: Palette },
  { path: '/admin/loja/categorias', label: 'Categorias', icon: Layers },
  { path: '/admin/loja/estoque', label: 'Estoque e Valores', icon: Package }
];

export async function uploadStoreImage(file: File, folder: 'logo' | 'banner' | 'category' | 'product', shopId: string): Promise<string> {
  const token = localStorage.getItem('token');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png';
  const filePath = `shops/${shopId}/store-${folder}-${Date.now()}.${safeExt}`;

  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const parts = result.split(',');
      if (parts.length < 2) {
        reject(new Error('Não foi possível ler a imagem selecionada.'));
        return;
      }
      resolve(parts[1]);
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'));
    reader.readAsDataURL(file);
  });

  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      filePath,
      content: base64Content,
      contentType: file.type
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.publicUrl) {
    throw new Error(data?.error || 'Não foi possível enviar a imagem.');
  }
  return data.publicUrl;
}

export default function StoreAdminHeader({
  shopSlug,
  storeEnabled,
  title,
  description
}: StoreAdminHeaderProps) {
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  const storePath = shopSlug ? `/b/${shopSlug}/loja` : '';

  const handleCopyStoreLink = async () => {
    if (!storePath) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${storePath}`);
      setCopied(true);
      toast.success('Link da loja virtual copiado!');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  return (
    <header className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
            <span className="font-semibold text-[#9A7410] dark:text-[#D4AF37]">Loja Virtual</span>
            {storeEnabled !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span className={storeEnabled ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-500 dark:text-zinc-400'}>
                  {storeEnabled ? 'Ativa no público' : 'Desativada no público'}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-serif">
            {title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-2xl">
            {description}
          </p>
        </div>

        {storePath && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyStoreLink}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#B8901F] dark:text-[#D4AF37]" />}
              <span>{copied ? 'Link copiado' : `Copiar ${storePath}`}</span>
            </button>
            <a
              href={storePath}
              target="_blank"
              rel="noreferrer"
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <span>Abrir loja virtual</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Navegação entre as 3 abas dedicadas da Loja Virtual */}
      <nav
        aria-label="Abas da Loja Virtual"
        className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl w-fit max-w-full"
      >
        {STORE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#B8901F] dark:text-[#D4AF37]' : ''}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
