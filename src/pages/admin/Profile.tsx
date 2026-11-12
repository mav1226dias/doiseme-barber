import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Instagram, MapPin, Save, Globe, MessageCircle, 
  Upload, Scissors, Image as ImageIcon, Check, Copy, ExternalLink, Smartphone,
  Sparkles, Layers, Palette, QrCode, Printer
} from 'lucide-react';
import { supabase } from '../../db/supabase';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { SEGMENTS, getSegment } from '../../lib/segments';
import { SegmentIcon } from '../../components/SegmentIcon';
import QRCodeCard from '../../components/QRCodeCard';

function isLightColor(hexColor?: string): boolean {
  if (!hexColor) return false;
  const hex = hexColor.replace('#', '');
  if (hex.length < 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

const QUICK_THEMES = [
  {
    id: 'dark-luxury',
    name: 'Luxo Noturno',
    primary: '#D4AF37',
    background: '#0A0A0A',
    text: '#FFFFFF',
  },
  {
    id: 'clean-white',
    name: 'Clean White',
    primary: '#2563EB',
    background: '#FFFFFF',
    text: '#0F172A',
  },
  {
    id: 'dark-slate',
    name: 'Slate Moderno',
    primary: '#10B981',
    background: '#0F172A',
    text: '#F8FAFC',
  },
  {
    id: 'nude-rose',
    name: 'Rosé Glamour',
    primary: '#E11D48',
    background: '#FDF8F6',
    text: '#292524',
  },
  {
    id: 'onyx-minimal',
    name: 'Onyx Black',
    primary: '#FAFAFA',
    background: '#000000',
    text: '#E4E4E7',
  },
  {
    id: 'cyber-purple',
    name: 'Purple Neon',
    primary: '#8B5CF6',
    background: '#09090B',
    text: '#FFFFFF',
  }
];

export default function Profile() {
  const [shop, setShop] = useState<any>(null);
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('barbershop');
  const [primaryColor, setPrimaryColor] = useState('#D4AF37');
  const [backgroundColor, setBackgroundColor] = useState('#0a0a0a');
  const [textColor, setTextColor] = useState('#ffffff');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copied, setCopied] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchShopInfo();
  }, []);

  const fetchShopInfo = async () => {
    const token = localStorage.getItem('token');
    try {
      const cacheBuster = new Date().getTime();
      const res = await fetch(`/api/admin/shop-info?t=${cacheBuster}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setShop(data);
      setName(data.name || '');
      setSegment(data.segment || 'barbershop');
      const loadedPreset = getSegment(data.segment || 'barbershop');
      
      let prim = data.primary_color || data.primaryColor || loadedPreset.defaultColors.primary || '#D4AF37';
      let bg = data.background_color || data.backgroundColor || data.secondary_color || loadedPreset.defaultColors.secondary || '#0a0a0a';
      let txt = data.text_color || data.textColor || '#ffffff';

      if (data.booking_layout && typeof data.booking_layout === 'string' && data.booking_layout.startsWith('{')) {
        try {
          const parsed = JSON.parse(data.booking_layout);
          if (parsed.primaryColor) prim = parsed.primaryColor;
          if (parsed.backgroundColor) bg = parsed.backgroundColor;
          if (parsed.textColor) txt = parsed.textColor;
        } catch (e) {}
      }

      setPrimaryColor(prim);
      setBackgroundColor(bg);
      setTextColor(txt);

      setInstagram(data.instagram || '');
      setWhatsapp(data.whatsapp || data.phone || '');
      setAddress(data.address || '');
      setMapsUrl(data.maps_url || '');
      setSlug(data.slug || '');
      setLogoUrl(data.logo_url);
      setBannerUrl(data.banner_url);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar informações');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !shop) return;

    const localPreviewUrl = URL.createObjectURL(file);
    if (type === 'logo') {
      setLogoUrl(localPreviewUrl);
      setUploadingLogo(true);
    } else {
      setBannerUrl(localPreviewUrl);
      setUploadingBanner(true);
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${shop.id}/${fileName}`;

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const split = (reader.result as string).split(',');
          resolve(split[1]);
        };
        reader.readAsDataURL(file);
      });

      const base64Content = await base64Promise;
      const token = localStorage.getItem('token');

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          filePath,
          content: base64Content,
          contentType: file.type
        })
      });

      if (!res.ok) throw new Error('Upload failed');
      const { publicUrl } = await res.json();

      if (type === 'logo') setLogoUrl(publicUrl);
      else setBannerUrl(publicUrl);
      
      toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} atualizado!`);
    } catch (error) {
      toast.error('Erro no upload');
      if (type === 'logo') setLogoUrl(shop.logo_url);
      else setBannerUrl(shop.banner_url);
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    if (uploadingLogo || uploadingBanner) {
      toast.error('Aguarde o upload das imagens terminar');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      // Sanitize instagram handle before sending
      let sanitizedInstagram = instagram.trim();
      if (sanitizedInstagram) {
        sanitizedInstagram = sanitizedInstagram.replace(/\/+$/, '');
        if (sanitizedInstagram.includes('instagram.com/')) {
          sanitizedInstagram = sanitizedInstagram.split('instagram.com/').pop() || '';
        }
        sanitizedInstagram = sanitizedInstagram.replace(/^@/, '');
      }

      const payload = {
        name,
        segment,
        instagram: sanitizedInstagram,
        whatsapp,
        address,
        mapsUrl,
        slug,
        logoUrl: logoUrl || shop?.logo_url,
        bannerUrl: bannerUrl || shop?.banner_url,
        primaryColor,
        primary_color: primaryColor,
        backgroundColor,
        background_color: backgroundColor,
        secondaryColor: backgroundColor,
        secondary_color: backgroundColor,
        textColor,
        text_color: textColor,
        bookingLayout: JSON.stringify({
          layout: 'grid',
          primaryColor,
          backgroundColor,
          textColor
        }),
        showWhatsapp: shop?.show_whatsapp ?? true,
        showInstagram: shop?.show_instagram ?? true,
        showAddress: shop?.show_address ?? true
      };

      console.log('[DEBUG] Saving Payload:', payload);

      const res = await fetch('/api/admin/shop', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (res.ok) {
        toast.success('Perfil atualizado com sucesso!');
        setShop(result);
        setInstagram(sanitizedInstagram); // Reflect cleaned version
        setTimeout(fetchShopInfo, 500);
      } else {
        toast.error(result.error || 'Erro ao salvar');
        if (result.details) console.error('[SAVE_ERROR_DETAILS]', result.details);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro de conexão ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const bookingUrl = `${window.location.origin}/b/${slug}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copiado!');
  };

  const currentSegmentPreset = getSegment(segment);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            Perfil do Estabelecimento
          </h1>
          <p className="text-gray-500 text-sm">
            Configure seu nicho ({currentSegmentPreset.name}), termos e informações públicas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a 
            href={`/b/${slug || shop?.id}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95"
          >
            <ExternalLink className="w-5 h-5" />
            VER SITE PÚBLICO
          </a>
          <button 
            onClick={handleSave}
            disabled={saving || uploadingLogo || uploadingBanner}
            className="flex items-center gap-2 bg-black dark:bg-[#D4AF37] text-white dark:text-black px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'SALVANDO...' : (uploadingLogo || uploadingBanner) ? 'CARREGANDO IMAGEM...' : 'SALVAR ALTERAÇÕES'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-6">
          
          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Fotos do Perfil
            </h2>
            <div className="flex flex-col sm:flex-row gap-6">
              <div 
                onClick={() => logoInputRef.current?.click()}
                className="w-32 h-32 bg-gray-50 dark:bg-zinc-950 rounded-3xl border-2 border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:border-[#D4AF37] transition-all relative overflow-hidden shrink-0"
              >
                {uploadingLogo ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#D4AF37] border-t-transparent" />
                ) : logoUrl ? (
                  <img src={logoUrl} className="w-full h-full object-contain p-2" alt="Logo" />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-300 mb-1" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Logo</span>
                  </>
                )}
                <input type="file" ref={logoInputRef} onChange={(e) => handleFileUpload(e, 'logo')} className="hidden" accept="image/*" />
              </div>

              <div 
                onClick={() => bannerInputRef.current?.click()}
                className="flex-1 h-32 bg-gray-50 dark:bg-zinc-950 rounded-3xl border-2 border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:border-[#D4AF37] transition-all relative overflow-hidden"
              >
                {uploadingBanner ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#D4AF37] border-t-transparent" />
                ) : bannerUrl ? (
                  <img src={bannerUrl} className="w-full h-full object-cover" alt="Banner" />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-gray-300 mb-1" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Banner / Capa</span>
                  </>
                )}
                <input type="file" ref={bannerInputRef} onChange={(e) => handleFileUpload(e, 'banner')} className="hidden" accept="image/*" />
              </div>
            </div>
          </section>

          {/* Identidade Visual, Cores & Customização do Site */}
          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#D4AF37]" /> Personalização de Cores do Site
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Ajuste o plano de fundo, a cor das letras e os elementos visuais da sua página de agendamento (/b/{slug || '...' }).
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 self-start sm:self-auto shrink-0">
                <SegmentIcon iconName={currentSegmentPreset.icon} className="w-3.5 h-3.5" />
                <span>{currentSegmentPreset.name}</span>
              </span>
            </div>

            {/* Temas Prontos em 1 Clique */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                Temas Rápidos Recomendados
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {QUICK_THEMES.map(theme => {
                  const isCurrent = 
                    primaryColor.toLowerCase() === theme.primary.toLowerCase() &&
                    backgroundColor.toLowerCase() === theme.background.toLowerCase() &&
                    textColor.toLowerCase() === theme.text.toLowerCase();

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(theme.primary);
                        setBackgroundColor(theme.background);
                        setTextColor(theme.text);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                        isCurrent
                          ? 'border-black dark:border-white bg-gray-50 dark:bg-zinc-800 shadow-sm ring-1 ring-black dark:ring-white'
                          : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: theme.background }} title="Fundo" />
                        <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: theme.primary }} title="Destaque" />
                        <span className="w-4 h-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: theme.text }} title="Texto" />
                      </div>
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">
                        {theme.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Os 3 Controles de Cores Individuais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              
              {/* 1. Elementos Visuais (Destaques, Botões, Ícones) */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> Elementos Visuais
                  </label>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
                </div>
                <p className="text-[11px] text-gray-500">
                  Botões, destaques, ícones, preços e indicador de etapas.
                </p>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                  />
                  <input 
                    type="text" 
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 font-mono text-xs uppercase font-bold text-gray-900 dark:text-white"
                    placeholder="#D4AF37"
                  />
                </div>
                {/* Swatches rápidos */}
                <div className="flex items-center gap-1.5 pt-1">
                  {['#D4AF37', '#2563EB', '#10B981', '#E11D48', '#8B5CF6', '#F59E0B'].map(hex => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setPrimaryColor(hex)}
                      className="w-5 h-5 rounded-md border border-black/10 hover:scale-110 transition-transform shrink-0"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>
              </div>

              {/* 2. Plano de Fundo (Background) */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" /> Plano de Fundo
                  </label>
                  <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: backgroundColor }} />
                </div>
                <p className="text-[11px] text-gray-500">
                  Cor de fundo geral do canvas da página pública de agendamento.
                </p>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={backgroundColor}
                    onChange={e => setBackgroundColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                  />
                  <input 
                    type="text" 
                    value={backgroundColor}
                    onChange={e => setBackgroundColor(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 font-mono text-xs uppercase font-bold text-gray-900 dark:text-white"
                    placeholder="#0A0A0A"
                  />
                </div>
                {/* Swatches rápidos */}
                <div className="flex items-center gap-1.5 pt-1">
                  {['#0A0A0A', '#000000', '#0F172A', '#FFFFFF', '#FDF8F6', '#F8FAFC'].map(hex => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setBackgroundColor(hex)}
                      className="w-5 h-5 rounded-md border border-black/10 hover:scale-110 transition-transform shrink-0"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>
              </div>

              {/* 3. Cor das Letras (Tipografia) */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-emerald-500" /> Cor das Letras
                  </label>
                  <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: textColor }} />
                </div>
                <p className="text-[11px] text-gray-500">
                  Tipografia de títulos, descrições, rótulos e nomes no site.
                </p>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={textColor}
                    onChange={e => setTextColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                  />
                  <input 
                    type="text" 
                    value={textColor}
                    onChange={e => setTextColor(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 font-mono text-xs uppercase font-bold text-gray-900 dark:text-white"
                    placeholder="#FFFFFF"
                  />
                </div>
                {/* Swatches rápidos */}
                <div className="flex items-center gap-1.5 pt-1">
                  {['#FFFFFF', '#F8FAFC', '#E4E4E7', '#0F172A', '#18181B', '#334155'].map(hex => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setTextColor(hex)}
                      className="w-5 h-5 rounded-md border border-black/10 hover:scale-110 transition-transform shrink-0"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>
              </div>

            </div>

            {/* Pré-visualização Interativa em Tempo Real */}
            <div className="pt-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-2">
                Pré-visualização ao Vivo das 3 Cores no Agendamento
              </label>
              
              <div 
                className="p-5 rounded-2xl border transition-all relative overflow-hidden shadow-md"
                style={{ 
                  backgroundColor: backgroundColor, 
                  color: textColor,
                  borderColor: isLightColor(backgroundColor) ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
                }}
              >
                {/* Glow suave do elemento visual */}
                <div 
                  className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none" 
                  style={{ backgroundColor: primaryColor }} 
                />

                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: primaryColor }} 
                      />
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                        {name || 'Nome do seu Estabelecimento'}
                      </span>
                    </div>
                    <div className="text-base font-bold">
                      Corte Masculino & Barba Completa
                    </div>
                    <div className="text-xs opacity-70">
                      Profissional Selecionado • 45 minutos
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold opacity-60">Valor</div>
                      <div className="text-lg font-bold font-mono tabular-nums" style={{ color: primaryColor }}>
                        R$ 65,00
                      </div>
                    </div>

                    <button 
                      type="button"
                      className="px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-transform active:scale-95 whitespace-nowrap"
                      style={{ 
                        backgroundColor: primaryColor,
                        color: isLightColor(primaryColor) ? '#000000' : '#ffffff'
                      }}
                    >
                      Agendar Horário
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <User className="w-4 h-4" /> Informações Básicas
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">
                  Nicho de Atuação / Segmento
                </label>
                <select
                  value={segment}
                  onChange={e => {
                    const newSeg = e.target.value;
                    setSegment(newSeg);
                    const preset = getSegment(newSeg);
                    setPrimaryColor(preset.defaultColors.primary);
                    setBackgroundColor(preset.defaultColors.secondary);
                  }}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100 outline-none transition-all cursor-pointer"
                >
                  {Object.values(SEGMENTS).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.terms.business} • {s.terms.clientPlural})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1 ml-1">
                  Alterne entre Psicologia, Estética, Barbearia, etc. para adaptar os termos e recursos do sistema.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">
                  Nome do Estabelecimento ({currentSegmentPreset.terms.business})
                </label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-[#D4AF37] dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  placeholder={`Ex: Meu ${currentSegmentPreset.terms.business}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Link Único (doiseme.com/b/{slug || '...' })</label>
                <input 
                  type="text" 
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-[#D4AF37] dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono outline-none transition-all"
                  placeholder="seu-link-agendamento"
                />
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Globe className="w-4 h-4" /> Redes Sociais & Contato
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Instagram (link completo)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500">
                    <Instagram className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={instagram}
                    onChange={e => setInstagram(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-[#D4AF37] dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition-all"
                    placeholder="https://instagram.com/seu-perfil"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">WhatsApp (com DDD)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-[#D4AF37] dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition-all"
                    placeholder="Ex: 53999112233"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Localização
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Endereço Físico</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-[#D4AF37] dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  placeholder="Rua, Número, Bairro, Cidade - UF"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Link do Google Maps</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input 
                    type="text" 
                    value={mapsUrl}
                    onChange={e => setMapsUrl(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-[#D4AF37] dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition-all"
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Globe className="w-4 h-4" /> Site de Agendamento
            </h2>
            <div className="p-4 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800">
               <p className="text-[10px] text-gray-400 mb-2 uppercase font-bold text-center">Seu link oficial</p>
               <p className="text-xs font-mono text-[#D4AF37] break-all text-center">{bookingUrl}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={copyToClipboard}
                className="flex-1 bg-black dark:bg-[#D4AF37] text-white dark:text-black py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
              <a 
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="w-12 h-12 bg-gray-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all"
              >
                <ExternalLink className="w-5 h-5 text-gray-500" />
              </a>
            </div>
          </section>

          {/* QR Code & Divulgação */}
          <QRCodeCard
            bookingUrl={bookingUrl}
            shopName={name || currentSegmentPreset.terms.business}
            primaryColor={primaryColor || currentSegmentPreset.defaultColors.primary || '#D4AF37'}
            businessTerm={currentSegmentPreset.terms.business}
            className="!p-6 !rounded-2xl"
          />

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Visualização Mobile
            </h2>
            <div 
              className="aspect-[9/16] rounded-[2.5rem] border-[8px] border-zinc-900 shadow-2xl relative overflow-hidden transition-colors"
              style={{ backgroundColor: backgroundColor, color: textColor }}
            >
               {/* Mini Preview */}
               <div className="absolute inset-0 flex flex-col pt-4 items-center">
                  <div className="w-full h-24 bg-black/20 relative overflow-hidden mb-8">
                     {bannerUrl && <img src={bannerUrl} className="w-full h-full object-cover opacity-60" />}
                     <div 
                       className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-2xl border p-2 shadow-xl flex items-center justify-center transition-colors"
                       style={{ 
                         backgroundColor: backgroundColor,
                         borderColor: isLightColor(backgroundColor) ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'
                       }}
                     >
                        {logoUrl ? (
                          <img src={logoUrl} className="w-full h-full object-contain" alt="Logo" />
                        ) : (
                          <SegmentIcon iconName={currentSegmentPreset.icon} className="w-8 h-8" style={{ color: primaryColor }} />
                        )}
                     </div>
                  </div>
                  
                  <h4 className="text-[11px] font-bold px-4 text-center mt-2" style={{ color: textColor }}>
                    {name || `Meu ${currentSegmentPreset.terms.business}`}
                  </h4>
                  
                  <div className="flex gap-2 mt-4">
                     <div className={`w-6 h-6 rounded-full ${instagram ? 'bg-pink-500/20 text-pink-500' : 'bg-black/10 dark:bg-white/10 opacity-40'} flex items-center justify-center`}>
                        <Instagram className="w-3 h-3" />
                     </div>
                     <div className={`w-6 h-6 rounded-full ${whatsapp ? 'bg-green-500/20 text-green-500' : 'bg-black/10 dark:bg-white/10 opacity-40'} flex items-center justify-center`}>
                        <MessageCircle className="w-3 h-3" />
                     </div>
                     <div className={`w-6 h-6 rounded-full ${mapsUrl ? 'bg-blue-500/20 text-blue-500' : 'bg-black/10 dark:bg-white/10 opacity-40'} flex items-center justify-center`}>
                        <MapPin className="w-3 h-3" />
                     </div>
                  </div>
                  
                  <div className="mt-6 px-4 w-full space-y-2">
                     <div 
                       className="h-10 w-full rounded-xl p-2.5 flex items-center justify-between border text-[10px]"
                       style={{ 
                         backgroundColor: isLightColor(backgroundColor) ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                         borderColor: isLightColor(backgroundColor) ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'
                       }}
                     >
                       <span className="font-semibold truncate">Serviço Principal</span>
                       <span className="font-bold shrink-0" style={{ color: primaryColor }}>R$ 45,00</span>
                     </div>
                     
                     <div 
                       className="h-9 w-full rounded-xl mt-3 flex items-center justify-center text-[10px] font-bold shadow-md transition-all" 
                       style={{ 
                         backgroundColor: primaryColor,
                         color: isLightColor(primaryColor) ? '#000000' : '#ffffff'
                       }}
                     >
                        Agendar Horário
                     </div>
                  </div>
               </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
