import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, Upload, Check, Copy, ExternalLink, Layout as LayoutIcon, 
  Wand2, Scissors, User, Calendar, MessageCircle, Instagram, MapPin,
  Save, Image as ImageIcon, Smartphone, ToggleLeft, ToggleRight,
  ArrowRight, Globe, Phone, Map, Shield, Info
} from 'lucide-react';
import { getPalette } from 'colorthief';
import { slugify } from '../../lib/slugify';
import { supabase } from '../../db/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function VisualIdentity() {
  const [shop, setShop] = useState<any>(null);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#D4AF37');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [bookingLayout, setBookingLayout] = useState('standard');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [address, setAddress] = useState('');
  
  const [showWhatsapp, setShowWhatsapp] = useState(true);
  const [showInstagram, setShowInstagram] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [suggestedPalettes, setSuggestedPalettes] = useState<any[]>([]);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchShopInfo();
  }, []);

  const fetchShopInfo = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/shop-info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setShop(data);
      setName(data.name || '');
      setLogoUrl(data.logo_url);
      setBannerUrl(data.banner_url);
      setPrimaryColor(data.primary_color || '#D4AF37');
      setSecondaryColor(data.secondary_color || '#000000');
      setBookingLayout(data.booking_layout || 'standard');
      setSlug(data.slug || '');
      setPhone(data.phone || '');
      setInstagram(data.instagram || '');
      setMapsUrl(data.maps_url || '');
      setAddress(data.address || '');
      setShowWhatsapp(data.show_whatsapp !== false);
      setShowInstagram(data.show_instagram !== false);
      setShowAddress(data.show_address !== false);

      if (data.logo_url) {
        extractPalettes(data.logo_url);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar informações');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !shop) return;

    // Use URL.createObjectURL for instant local preview
    const localPreviewUrl = URL.createObjectURL(file);
    if (type === 'logo') {
      setLogoUrl(localPreviewUrl);
      setUploadingLogo(true);
      extractPalettes(localPreviewUrl);
    } else {
      setBannerUrl(localPreviewUrl);
      setUploadingBanner(true);
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${shop.id}/${fileName}`;

      console.log(`[UPLOAD] Starting server-side upload for ${type}:`, filePath);

      // Convert file to base64
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Server upload failed');
      }

      const { publicUrl } = await res.json();
      console.log(`[UPLOAD_SUCCESS] Public URL:`, publicUrl);

      if (type === 'logo') {
        setLogoUrl(publicUrl);
      } else {
        setBannerUrl(publicUrl);
      }
      toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} enviado com sucesso!`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Erro ao enviar ${type}. Certifique-se que o bucket 'barbearias-assets' existe.`);
      // Revert preview on error
      if (type === 'logo') setLogoUrl(shop.logo_url);
      else setBannerUrl(shop.banner_url);
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingBanner(false);
    }
  };

  const extractPalettes = (imageUrl: string) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    img.onload = async () => {
      try {
        const palette = await (getPalette as any)(img, 8);
        if (!palette || !Array.isArray(palette)) throw new Error('Invalid palette');
        
        const hexColors = palette.map((rgb: any) => {
          if (!Array.isArray(rgb)) return '#000000';
          return '#' + rgb.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
        });
        
        const uniqueColors = Array.from(new Set(hexColors)).filter(c => c !== '#ffffff' && c !== '#000000');
        
        const suggestions = [
          { name: 'Profissional', primary: uniqueColors[0] || hexColors[0], secondary: '#111111' },
          { name: 'Vibrante', primary: uniqueColors[1] || hexColors[1] || '#D4AF37', secondary: uniqueColors[0] || hexColors[0] },
          { name: 'Dark Mode', primary: '#D4AF37', secondary: '#000000' }
        ];
        
        setSuggestedPalettes(suggestions);
      } catch (e) {
        console.error('Failed to extract colors:', e);
      }
    };
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/shop', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          logoUrl,
          bannerUrl,
          primaryColor,
          secondaryColor,
          bookingLayout,
          slug,
          phone,
          instagram,
          mapsUrl,
          address,
          showWhatsapp,
          showInstagram,
          showAddress
        })
      });

      if (res.ok) {
        toast.success('Identidade visual salva com sucesso!');
        fetchShopInfo();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao salvar');
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

  return (
    <div className="max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* PANEL EDIT */}
        <div className="flex-1 w-full space-y-6">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Identidade Visual</h1>
              <p className="text-gray-500 text-sm">Personalize o visual da sua página de agendamento</p>
            </div>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-black dark:bg-[#D4AF37] text-white dark:text-black px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GERAL */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Globe className="w-4 h-4" /> Informações do Site
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Nome da Barbearia</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-[#D4AF37] dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    placeholder="Ex: Barber Shop Doiseme"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Link Único (/b/link)</label>
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-950 border border-transparent focus-within:border-[#D4AF37] dark:border-zinc-800 rounded-xl px-4 py-3">
                    <span className="text-gray-400 text-xs italic opacity-50">doiseme.com/b/</span>
                    <input 
                      type="text" 
                      value={slug}
                      onChange={e => setSlug(slugify(e.target.value))}
                      className="bg-transparent text-sm font-mono outline-none flex-1 min-w-0"
                      placeholder="seu-nome"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* MIDIA */}
            <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Mídias da Marca
              </h2>
              <div className="flex gap-4">
                <div 
                  onClick={() => logoInputRef.current?.click()}
                  className="w-24 h-24 bg-gray-50 dark:bg-zinc-950 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:border-[#D4AF37] transition-all relative overflow-hidden"
                >
                  {uploadingLogo ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#D4AF37] border-t-transparent" />
                  ) : logoUrl ? (
                    <img src={logoUrl} className="w-full h-full object-contain p-2" alt="Logo" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-gray-300 mb-1" />
                      <span className="text-[8px] font-bold text-gray-400 uppercase">Logo</span>
                    </>
                  )}
                  <input type="file" ref={logoInputRef} onChange={(e) => handleFileUpload(e, 'logo')} className="hidden" accept="image/*" />
                </div>

                <div 
                  onClick={() => bannerInputRef.current?.click()}
                  className="flex-1 h-24 bg-gray-50 dark:bg-zinc-950 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:border-[#D4AF37] transition-all relative overflow-hidden"
                >
                  {uploadingBanner ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#D4AF37] border-t-transparent" />
                  ) : bannerUrl ? (
                    <img src={bannerUrl} className="w-full h-full object-cover" alt="Banner" />
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-gray-300 mb-1" />
                      <span className="text-[8px] font-bold text-gray-400 uppercase">Banner de Fundo</span>
                    </>
                  )}
                  <input type="file" ref={bannerInputRef} onChange={(e) => handleFileUpload(e, 'banner')} className="hidden" accept="image/*" />
                </div>
              </div>
            </section>
          </div>

          {/* CORES */}
          <section className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Palette className="w-4 h-4" /> Cores Personalizadas
              </h2>
              <div className="flex flex-wrap gap-2">
                {suggestedPalettes.map((p, i) => (
                  <button 
                    key={i}
                    onClick={() => { setPrimaryColor(p.primary); setSecondaryColor(p.secondary); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all hover:scale-105"
                  >
                    <div className="flex -space-x-1">
                      <div className="w-3 h-3 rounded-full border border-white" style={{ backgroundColor: p.primary }} />
                      <div className="w-3 h-3 rounded-full border border-white" style={{ backgroundColor: p.secondary }} />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-gray-500">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <input 
                    type="color" 
                    value={primaryColor} 
                    onChange={e => setPrimaryColor(e.target.value)} 
                    className="w-20 h-20 rounded-2xl border-0 cursor-pointer overflow-hidden p-0 shadow-lg"
                  />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10 pointer-events-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Destaque</label>
                  <input 
                    type="text" 
                    value={primaryColor.toUpperCase()} 
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="bg-transparent font-mono text-lg font-bold border-b-2 border-gray-200 dark:border-zinc-800 outline-none w-28 py-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="relative">
                  <input 
                    type="color" 
                    value={secondaryColor} 
                    onChange={e => setSecondaryColor(e.target.value)} 
                    className="w-20 h-20 rounded-2xl border-0 cursor-pointer overflow-hidden p-0 shadow-lg"
                  />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10 pointer-events-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Fundo / Texto</label>
                  <input 
                    type="text" 
                    value={secondaryColor.toUpperCase()} 
                    onChange={e => setSecondaryColor(e.target.value)}
                    className="bg-transparent font-mono text-lg font-bold border-b-2 border-gray-200 dark:border-zinc-800 outline-none w-28 py-1"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* CONTATOS */}
          <section className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> Canais de Atendimento
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-950 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-green-500 uppercase">
                    <Phone className="w-4 h-4" /> WhatsApp
                  </div>
                  <button onClick={() => setShowWhatsapp(!showWhatsapp)} className="outline-none">
                    {showWhatsapp ? <ToggleRight className="w-8 h-8 text-green-500" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                  </button>
                </div>
                <input 
                  type="text" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 ring-[#D4AF37]"
                  placeholder="(53) 99912-3456"
                />
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-950 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-pink-500 uppercase">
                    <Instagram className="w-4 h-4" /> Instagram
                  </div>
                  <button onClick={() => setShowInstagram(!showInstagram)} className="outline-none">
                    {showInstagram ? <ToggleRight className="w-8 h-8 text-pink-500" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                  </button>
                </div>
                <input 
                  type="text" 
                  value={instagram}
                  onChange={e => setInstagram(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 ring-[#D4AF37]"
                  placeholder="@seu_perfil"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-950 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-500 uppercase">
                  <MapPin className="w-4 h-4" /> Endereço da Barbearia
                </div>
                <button onClick={() => setShowAddress(!showAddress)} className="outline-none">
                  {showAddress ? <ToggleRight className="w-8 h-8 text-blue-500" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                </button>
              </div>
              <input 
                type="text" 
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none mb-2 focus:ring-1 ring-[#D4AF37]"
                placeholder="Ex: Av. Principal, 450 - Centro, Pelotas"
              />
              <div className="flex items-center gap-3">
                 <label className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Google Maps URL:</label>
                 <input 
                  type="text" 
                  value={mapsUrl}
                  onChange={e => setMapsUrl(e.target.value)}
                  className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-[10px] outline-none"
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          </section>
        </div>

        {/* PREVIEW CONTAINER */}
        <div className="w-full lg:w-[400px] border-l border-gray-100 dark:border-zinc-800 pl-0 lg:pl-8">
          <div className="sticky top-8 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Preview em Tempo Real
              </h2>
              <a 
                href={bookingUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest flex items-center gap-1 hover:underline"
              >
                Abrir Site <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative mx-auto w-full aspect-[9/19] bg-[#0a0a0a] rounded-[3.5rem] border-[10px] border-zinc-900 shadow-2xl overflow-hidden group">
              {/* STATUS BAR */}
              <div className="absolute top-0 left-0 right-0 h-7 z-20 flex justify-between px-10 pt-3">
                <span className="text-[10px] text-white font-medium">9:41</span>
                <div className="flex gap-1.5 items-center">
                  <div className="w-4 h-2 rounded-full bg-white/20" />
                </div>
              </div>

              {/* DYNAMIC CONTENT AREA */}
              <div className="absolute inset-0 overflow-y-auto hide-scrollbar pt-7">
                {/* Simulated Header Banner */}
                <div className="relative h-44 bg-zinc-800 overflow-hidden">
                  {bannerUrl ? (
                    <img src={bannerUrl} className="w-full h-full object-cover" alt="Banner" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center opacity-40">
                      <ImageIcon className="w-10 h-10 text-white" />
                    </div>
                  )}
                  {/* Floating Logo */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                     <motion.div 
                       layoutId="logo-preview"
                       className="w-24 h-24 bg-[#0a0a0a] rounded-[2rem] p-4 shadow-2xl border border-white/10 flex items-center justify-center"
                     >
                      {logoUrl ? (
                        <img src={logoUrl} className="w-full h-full object-contain" alt="Logo" />
                      ) : (
                        <Scissors className="w-10 h-10 text-white/10" />
                      )}
                     </motion.div>
                  </div>
                </div>

                {/* Content */}
                <div className="mt-14 text-center px-8">
                  <h3 className="text-2xl font-bold text-white font-serif tracking-tight">{name || 'Sua Barbearia'}</h3>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    {showWhatsapp && phone && (
                      <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                        <MessageCircle className="w-4 h-4 text-green-500" />
                      </div>
                    )}
                    {showInstagram && instagram && (
                      <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                        <Instagram className="w-4 h-4 text-pink-500" />
                      </div>
                    )}
                    {showAddress && address && (
                      <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                        <MapPin className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                  
                  <p className="text-[8px] text-white/30 uppercase tracking-[0.4em] font-bold mt-6">Agendamento Online</p>

                  {/* UI Elements */}
                  <div className="mt-10 space-y-4">
                    <div className="flex gap-2 mb-8 px-4">
                      <div className="h-1 flex-1 rounded-full" style={{ backgroundColor: primaryColor }} />
                      <div className="h-1 flex-1 rounded-full bg-white/10" />
                      <div className="h-1 flex-1 rounded-full bg-white/10" />
                    </div>

                    <div className="text-xs text-left font-bold text-white/60 mb-2 uppercase tracking-widest pl-1">Escolha o serviço</div>
                    
                    <div className="p-5 rounded-3xl bg-white/5 border border-white/10 flex justify-between items-center group transition-all" style={{ borderColor: `${primaryColor}40` }}>
                      <div className="text-left">
                         <div className="text-sm font-bold text-white">Corte Degradê</div>
                         <div className="text-[10px] text-white/40">45 minutos</div>
                      </div>
                      <div className="text-sm font-bold" style={{ color: primaryColor }}>R$ 50,00</div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white/5 border border-white/5 flex justify-between items-center opacity-40">
                      <div className="text-left">
                         <div className="text-sm font-bold text-white">Barba Completa</div>
                         <div className="text-[10px] text-white/40">30 minutos</div>
                      </div>
                      <div className="text-sm font-bold" style={{ color: primaryColor }}>R$ 35,00</div>
                    </div>

                    {/* ACTION BUTTON */}
                    <div className="pt-6">
                      <div className="py-4 rounded-3xl text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95" style={{ backgroundColor: primaryColor, color: secondaryColor }}>
                         Agendar Agora <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {showAddress && address && (
                    <div className="mt-12 text-[10px] text-white/40 border-t border-white/5 pt-8 pb-10">
                      <MapPin className="w-5 h-5 mx-auto mb-3 text-white/20" />
                      <p className="leading-relaxed">{address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* HOME INDICATOR */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1.5 bg-white/15 rounded-full" />
            </div>

            {/* SHARE CARD */}
            <div className="mt-6 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Globe className="w-24 h-24" />
              </div>
              <div className="relative z-10 space-y-5">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Link de Divulgação</span>
                  <div className="bg-gray-50 dark:bg-zinc-950 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 text-xs font-mono text-blue-500 break-all select-all">
                    {window.location.origin}/b/{slug || '...'}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={copyToClipboard}
                    className="flex-1 bg-black dark:bg-[#D4AF37] text-white dark:text-black py-4 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar Link'}
                  </button>
                  <a 
                    href={bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-14 h-14 bg-gray-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors border border-gray-100 dark:border-zinc-800"
                  >
                    <ExternalLink className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .phone-frame {
          box-shadow: 
            0 80px 150px -30px rgba(0,0,0,0.6),
            inset 0 0 50px rgba(255,255,255,0.03);
        }
      `}</style>
    </div>
  );
}
