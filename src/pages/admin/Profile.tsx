import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Instagram, MapPin, Save, Globe, MessageCircle, 
  Upload, Scissors, Image as ImageIcon, Check, Copy, ExternalLink, Smartphone
} from 'lucide-react';
import { supabase } from '../../db/supabase';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export default function Profile() {
  const [shop, setShop] = useState<any>(null);
  const [name, setName] = useState('');
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
        instagram: sanitizedInstagram,
        whatsapp,
        address,
        mapsUrl,
        slug,
        logoUrl: logoUrl || shop?.logo_url,
        bannerUrl: bannerUrl || shop?.banner_url,
        primaryColor: shop?.primary_color || '#D4AF37',
        secondaryColor: shop?.secondary_color || '#000000',
        bookingLayout: shop?.booking_layout || 'grid',
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Perfil da Barbearia</h1>
          <p className="text-gray-500 text-sm">Gerencie as informações públicas da sua unidade</p>
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

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <User className="w-4 h-4" /> Informações Básicas
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block mb-1">Nome da Barbearia</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-transparent focus:border-[#D4AF37] dark:border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  placeholder="Nome do seu negócio"
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

          <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Visualização Mobile
            </h2>
            <div className="aspect-[9/16] bg-zinc-950 rounded-[2.5rem] border-[8px] border-zinc-900 shadow-2xl relative overflow-hidden">
               {/* Mini Preview */}
               <div className="absolute inset-0 flex flex-col pt-4 items-center">
                  <div className="w-full h-24 bg-zinc-900 relative overflow-hidden mb-8">
                     {bannerUrl && <img src={bannerUrl} className="w-full h-full object-cover opacity-60" />}
                     <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-2xl bg-zinc-950 border border-white/10 p-2 shadow-xl">
                        {logoUrl ? <img src={logoUrl} className="w-full h-full object-contain" /> : <Scissors className="w-full h-full text-zinc-800" />}
                     </div>
                  </div>
                  
                  <h4 className="text-white text-[10px] font-bold px-4 text-center mt-2">{name || 'Minha Barbearia'}</h4>
                  
                  <div className="flex gap-2 mt-4">
                     <div className={`w-6 h-6 rounded-full ${instagram ? 'bg-pink-500/20 text-pink-500' : 'bg-zinc-900 text-zinc-700'} flex items-center justify-center`}>
                        <Instagram className="w-3 h-3" />
                     </div>
                     <div className={`w-6 h-6 rounded-full ${whatsapp ? 'bg-green-500/20 text-green-500' : 'bg-zinc-900 text-zinc-700'} flex items-center justify-center`}>
                        <MessageCircle className="w-3 h-3" />
                     </div>
                     <div className={`w-6 h-6 rounded-full ${mapsUrl ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-900 text-zinc-700'} flex items-center justify-center`}>
                        <MapPin className="w-3 h-3" />
                     </div>
                  </div>
                  
                  <div className="mt-6 px-4 w-full space-y-1.5">
                     <div className="h-4 w-full bg-zinc-900 rounded-md animate-pulse" />
                     <div className="h-6 w-full bg-zinc-900 rounded-md animate-pulse" />
                     <div className="h-6 w-full bg-zinc-900 rounded-md animate-pulse" />
                     <div className="h-8 w-full bg-[#D4AF37] opacity-40 rounded-lg mt-2" />
                  </div>
               </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
