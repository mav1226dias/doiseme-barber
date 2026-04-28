import React, { useState, useEffect, useRef } from 'react';
import { Palette, Upload, Check, Copy, ExternalLink, Layout as LayoutIcon, Wand2, Scissors, User, Calendar, MessageCircle, Instagram, MapPin } from 'lucide-react';
import { getPalette } from 'colorthief';

export default function VisualIdentity() {
  const [shop, setShop] = useState<any>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#D4AF37');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [bookingLayout, setBookingLayout] = useState('standard');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [suggestedPalettes, setSuggestedPalettes] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/shop-info', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setShop(data);
        setLogo(data.logo_url);
        setPrimaryColor(data.primary_color || '#D4AF37');
        setSecondaryColor(data.secondary_color || '#000000');
        setBookingLayout(data.booking_layout || 'standard');
        setSlug(data.slug || '');
        setPhone(data.phone || '');
        setInstagram(data.instagram || '');
        setMapsUrl(data.maps_url || '');
      })
      .catch(console.error);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogo(base64);
        extractPalettes(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractPalettes = (imageUrl: string) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    img.onload = async () => {
      try {
        const palette = await getPalette(img, { colorCount: 5 });
        const hexColors = (palette || []).map((color: any) => color.hex());
        
        // Generate a few palette combinations
        const suggestions = [
          { name: 'Identidade Pura', primary: hexColors[0], secondary: '#000000' },
          { name: 'Elegante', primary: hexColors[1] || hexColors[0], secondary: '#1a1a1a' },
          { name: 'Contraste', primary: hexColors[2] || hexColors[0], secondary: '#0f0f0f' }
        ];
        setSuggestedPalettes(suggestions);
        setPrimaryColor(hexColors[0]);
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
          logoUrl: logo,
          primaryColor,
          secondaryColor,
          bookingLayout,
          slug,
          phone,
          instagram,
          mapsUrl
        })
      });
      if (res.ok) {
        alert('Identidade visual salva com sucesso!');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const bookingUrl = `${window.location.origin}/b/${slug}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Identidade Visual</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure o visual que seus clientes verão ao agendar</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-black dark:bg-[#D4AF37] text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg"
        >
          {saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Settings Column */}
        <div className="xl:col-span-12 lg:col-span-1 border-b border-gray-100 dark:border-zinc-800 pb-8">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Logo Card */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Logotipo
                </h2>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-2xl flex items-center justify-center cursor-pointer hover:border-[#D4AF37] transition-colors overflow-hidden bg-gray-50 dark:bg-zinc-950/50"
                >
                  {logo ? (
                    <img src={logo} alt="Logo Preview" className="max-w-[80%] max-h-[80%] object-contain" />
                  ) : (
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2 text-gray-400">
                         <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-gray-400">Upload do logo</span>
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
              </div>

              {/* Palette Card */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Wand2 className="w-4 h-4" /> Sugestões de Paleta
                </h2>
                {suggestedPalettes.length > 0 ? (
                  <div className="space-y-3">
                    {suggestedPalettes.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => { setPrimaryColor(p.primary); setSecondaryColor(p.secondary); }}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group"
                      >
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{p.name}</span>
                        <div className="flex gap-1">
                          <div className="w-6 h-6 rounded-md border border-black/5" style={{ backgroundColor: p.primary }} />
                          <div className="w-6 h-6 rounded-md border border-black/5" style={{ backgroundColor: p.secondary }} />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Suba seu logo para ver sugestões automáticas baseadas nas suas cores.</p>
                )}
              </div>

              {/* Manual Colors & Layout */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Personalização
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Cor Principal</label>
                    <div className="flex gap-2">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 border-0 cursor-pointer rounded-lg overflow-hidden" />
                      <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 rounded-lg px-3 text-xs font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">WhatsApp</label>
                    <input 
                      type="text" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      placeholder="(53) 99999-9999"
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Instagram (@)</label>
                    <input 
                      type="text" 
                      value={instagram} 
                      onChange={e => setInstagram(e.target.value)} 
                      placeholder="@barbearia"
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Link Google Maps</label>
                    <input 
                      type="text" 
                      value={mapsUrl} 
                      onChange={e => setMapsUrl(e.target.value)} 
                      placeholder="https://goo.gl/maps/..."
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block text-center">Sugestão: Use 3 cores para contraste perfeito</label>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Layout da Página</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'standard', name: 'Padrão' },
                        { id: 'classic', name: 'Clássico' },
                        { id: 'modern', name: 'Moderno' }
                      ].map(l => (
                        <button
                          key={l.id}
                          onClick={() => setBookingLayout(l.id)}
                          className={`text-[10px] font-bold p-2 rounded-lg border uppercase tracking-wider transition-all ${
                            bookingLayout === l.id ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'border-gray-200 dark:border-zinc-800 text-gray-400 hover:border-gray-300'
                          }`}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
           </div>
        </div>

        {/* Live Preview Container */}
        <div className="xl:col-span-12 space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <LayoutIcon className="w-6 h-6 text-[#D4AF37]" /> Prévia do Site de Agendamento
              </h2>
              <div className="flex gap-2 bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
           </div>

           {/* Mobile Phone Mockup for Preview */}
           <div className="mx-auto max-w-[400px] border-[12px] border-zinc-900 rounded-[3rem] shadow-2xl bg-[#0a0a0a] overflow-hidden relative min-h-[700px]">
              {/* Status Bar */}
              <div className="h-6 bg-transparent flex justify-between px-6 items-center pt-2">
                <span className="text-[10px] text-white font-bold">9:41</span>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 border border-white/20 rounded-sm" />
                </div>
              </div>

              {/* Dynamic Content Preview */}
              <div className="p-4 pt-10 text-white font-sans">
                 <div className="text-center mb-10">
                    {logo ? (
                      <img src={logo} className="h-16 mx-auto mb-4 object-contain" alt="Preview Logo" />
                    ) : (
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                        <Scissors className="w-8 h-8 text-white/20" />
                      </div>
                    )}
                    <h1 className="text-2xl font-bold font-serif">{shop?.name || 'Sua Barbearia'}</h1>
                    <p className="text-[8px] text-white/40 uppercase tracking-[0.2em] mt-1">Agendamento Online</p>
                 </div>

                 {/* Step Bar */}
                 <div className="flex gap-1.5 mb-8 px-4">
                    <div className="h-0.5 flex-1 rounded-full" style={{ backgroundColor: primaryColor }} />
                    <div className="h-0.5 flex-1 rounded-full bg-white/10" />
                    <div className="h-0.5 flex-1 rounded-full bg-white/10" />
                 </div>

                 {/* Mock Services */}
                 <div className="space-y-3 px-2">
                    <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                       <Scissors className="w-4 h-4" style={{ color: primaryColor }} /> Escolha o serviço
                    </h3>
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 flex justify-between items-center" style={{ borderColor: primaryColor }}>
                       <div>
                          <div className="font-medium text-sm">Corte Degradê</div>
                          <div className="text-[10px] text-white/40">45 minutos</div>
                       </div>
                       <div className="font-bold text-sm" style={{ color: primaryColor }}>R$ 50,00</div>
                    </div>
                    <div className="p-4 rounded-2xl border border-white/10 bg-black/40 flex justify-between items-center opacity-50">
                       <div>
                          <div className="font-medium text-sm">Barba Completa</div>
                          <div className="text-[10px] text-white/40">30 minutos</div>
                       </div>
                       <div className="font-bold text-sm" style={{ color: primaryColor }}>R$ 35,00</div>
                    </div>
                 </div>

                 {/* Mock Footer */}
                 <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-3 gap-2 px-2">
                    <div className={`bg-white/5 p-3 rounded-xl flex items-center justify-center border border-white/5 transition-opacity ${!phone && 'opacity-20'}`}>
                       <MessageCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <div className={`bg-white/5 p-3 rounded-xl flex items-center justify-center border border-white/5 transition-opacity ${!instagram && 'opacity-20'}`}>
                       <Instagram className="w-4 h-4 text-pink-500" />
                    </div>
                    <div className={`bg-white/5 p-3 rounded-xl flex items-center justify-center border border-white/5 transition-opacity ${!mapsUrl && 'opacity-20'}`}>
                       <MapPin className="w-4 h-4 text-blue-500" />
                    </div>
                 </div>
              </div>

              {/* URL Input Bottom (Shareable Link Preview) */}
              <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-zinc-800/80 backdrop-blur-md p-4 rounded-3xl border border-white/10 space-y-3">
                   <div className="text-[10px] text-gray-400 break-all font-mono">.../b/{slug}</div>
                   <button 
                    onClick={copyToClipboard}
                    className="w-full flex items-center justify-center gap-2 bg-white text-black py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                   >
                     {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                     {copied ? 'Copiado!' : 'Copiar Link'}
                   </button>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
