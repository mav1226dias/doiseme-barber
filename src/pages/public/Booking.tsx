import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  User, 
  Check, 
  MapPin, 
  Instagram, 
  MessageCircle, 
  ChevronRight,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { getSegment, DEFAULT_SEGMENT_ID } from '../../lib/segments';
import { SegmentIcon } from '../../components/SegmentIcon';

interface ServiceItem {
  id: string | number;
  name: string;
  durationMinutes: number;
  price: number;
  imageUrl?: string | null;
  image_url?: string | null;
}

interface BarberItem {
  id: string | number;
  name: string;
  active: boolean;
  serviceIds?: string[];
  photoUrl?: string | null;
  photo_url?: string | null;
}

export default function Booking() {
  const { slug } = useParams();
  const [shop, setShop] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<BarberItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Booking Form State: Step 1 (barber), Step 2 (service), Step 3 (date/time), Step 4 (client info)
  const [formData, setFormData] = useState({
    barber_id: '',
    service_id: '',
    date: '',
    time: '',
    name: '',
    phone: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Link do estabelecimento não fornecido');
      return;
    }
    
    const cacheBuster = new Date().getTime();
    fetch(`/api/public/shop/${slug}?t=${cacheBuster}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errorMsg = data.error || 'Estabelecimento não encontrado';
          const detailsMsg = data.details || 'Verifique se o link está correto.';
          setApiError(errorMsg);
          setErrorDetails(detailsMsg);
          throw new Error(errorMsg);
        }
        return data;
      })
      .then(data => {
        setShop(data);
        setApiError(null);
        setErrorDetails(null);
        
        // Fetch professionals & services for this specific shop
        fetch(`/api/barbershops/${data.id}/barbers`)
          .then(res => res.json())
          .then(bData => {
            if (Array.isArray(bData)) setBarbers(bData.filter(b => b.active !== false));
          })
          .catch(err => console.error('[BOOKING_ERROR] Barbers fetch fail:', err));

        fetch(`/api/barbershops/${data.id}/services`)
          .then(res => res.json())
          .then(sData => {
            if (Array.isArray(sData)) setServices(sData);
          })
          .catch(err => console.error('[BOOKING_ERROR] Services fetch fail:', err));
      })
      .catch(err => {
        console.error('[BOOKING_CATCH]', err);
        setError(slug || 'URL inválida');
      });
  }, [slug]);

  // Query availability when date and barber are selected
  useEffect(() => {
    if (formData.date && formData.barber_id && shop) {
      fetch(`/api/barbershops/${shop.id}/availability?date=${formData.date}&barberId=${formData.barber_id}`)
        .then(async res => {
          const text = await res.text();
          return text ? JSON.parse(text) : [];
        })
        .then(setAvailableSlots)
        .catch(console.error);
    }
  }, [formData.date, formData.barber_id, shop]);

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => Math.max(1, s - 1));

  // The niche preset is strictly determined by the shop's database configuration (fixed layout per business)
  const currentPreset = useMemo(() => {
    return getSegment(shop?.segment || shop?.business_type || DEFAULT_SEGMENT_ID);
  }, [shop]);

  // Effective professionals list (fallback to suggested team if empty)
  const effectiveBarbers = useMemo(() => {
    if (barbers && barbers.length > 0) {
      return barbers;
    }
    return [
      { id: 'prof-default-1', name: `Equipe Principal (${currentPreset.terms.professional})`, active: true, serviceIds: [] }
    ];
  }, [barbers, currentPreset]);

  // Selected professional object
  const selectedBarber = useMemo(() => {
    return effectiveBarbers.find(b => b.id.toString() === formData.barber_id);
  }, [effectiveBarbers, formData.barber_id]);

  // Effective services list, filtered by the professional selected in Step 1
  const availableServices = useMemo(() => {
    // If shop has no services in DB, use preset suggested services
    const baseServices = (services && services.length > 0) 
      ? services 
      : currentPreset.suggestedServices.map((s, idx) => ({
          id: `sug-${idx}`,
          name: s.name,
          durationMinutes: s.durationMinutes,
          price: s.price
        }));

    // If a professional was selected and has specific serviceIds assigned, filter by them
    if (selectedBarber && Array.isArray(selectedBarber.serviceIds) && selectedBarber.serviceIds.length > 0) {
      const allowedIds = selectedBarber.serviceIds.map(String);
      const filtered = baseServices.filter(s => allowedIds.includes(s.id.toString()));
      if (filtered.length > 0) {
        return filtered;
      }
    }

    // Default: professional performs all available services
    return baseServices;
  }, [services, currentPreset, selectedBarber]);

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

  // Colors & Styles from Database or Fallback
  let primaryColor = shop?.primary_color || shop?.primaryColor || currentPreset.defaultColors.primary || '#D4AF37';
  let bgColor = shop?.background_color || shop?.backgroundColor || shop?.secondary_color || currentPreset.defaultColors.secondary || '#0a0a0a';
  let textColor = shop?.text_color || shop?.textColor || '#ffffff';

  if (shop?.booking_layout && typeof shop.booking_layout === 'string' && shop.booking_layout.startsWith('{')) {
    try {
      const parsed = JSON.parse(shop.booking_layout);
      if (parsed.primaryColor) primaryColor = parsed.primaryColor;
      if (parsed.backgroundColor) bgColor = parsed.backgroundColor;
      if (parsed.textColor) textColor = parsed.textColor;
    } catch (e) {}
  }

  const isBgLight = isLightColor(bgColor);
  const isPrimaryLight = isLightColor(primaryColor);
  const buttonTextColor = isPrimaryLight ? '#000000' : '#ffffff';

  const bgStyle = { color: primaryColor };
  const borderStyle = { borderColor: primaryColor };
  const btnStyle = { 
    backgroundColor: primaryColor,
    color: buttonTextColor
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbershopId: shop.id,
          barberId: formData.barber_id,
          serviceId: formData.service_id,
          clientName: formData.name,
          clientPhone: formData.phone,
          date: formData.date,
          startTime: formData.time
        })
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        alert('Erro ao agendar. Tente novamente.');
      }
    } catch (error) {
      alert('Erro ao agendar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (apiError || error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <SegmentIcon iconName={currentPreset.icon} className="w-10 h-10 text-white/30" />
        </div>
        <h2 className="text-3xl font-bold mb-4 font-serif text-white">{apiError || 'Página não encontrada'}</h2>
        <p className="text-white/50 max-w-xs mx-auto mb-8 text-sm">
          {errorDetails || `O estabelecimento com o link "${slug}" não foi encontrado. Verifique se o link está correto.`}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a href="/admin" className="bg-white text-black font-bold py-3 px-8 rounded-xl hover:bg-gray-200 transition-colors">
            Ir para o Painel
          </a>
          <button onClick={() => window.location.reload()} className="text-white/50 hover:text-white text-sm">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white/50 gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-sm font-medium tracking-wide">Carregando agendamento...</span>
      </div>
    );
  }

  if (success) {
    const barber = effectiveBarbers.find(b => b.id.toString() === formData.barber_id);
    const selectedService = availableServices.find(s => s.id.toString() === formData.service_id);
    const message = `Olá! Realizei o agendamento de ${selectedService?.name || currentPreset.terms.service} com ${barber?.name || currentPreset.terms.professional} para o dia ${formData.date.split('-').reverse().join('/')} às ${formData.time}.`;
    const phoneNum = shop.whatsapp || shop.phone;
    const whatsappUrl = `https://wa.me/55${phoneNum?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    return (
      <div 
        className="min-h-screen flex items-center justify-center px-4 transition-colors"
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        <div className="max-w-md w-full text-center py-12">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className={`text-3xl font-bold mb-3 ${currentPreset.layoutTheme.fontFamily}`} style={{ color: textColor }}>
            Agendado com sucesso!
          </h2>
          <p className="mb-8 text-sm leading-relaxed" style={{ color: textColor, opacity: 0.75 }}>
            Seu horário com <strong style={{ color: textColor }}>{barber?.name}</strong> para <strong style={{ color: textColor }}>{selectedService?.name}</strong> está confirmado para o dia {formData.date.split('-').reverse().join('/')} às {formData.time}.
          </p>
          <a 
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-4 rounded-xl font-bold hover:bg-[#20bd5a] transition-all shadow-lg active:scale-95"
          >
            <MessageCircle className="w-5 h-5" />
            Confirmar via WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen relative overflow-hidden transition-colors"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      
      {/* Dynamic Ambient Glow matching the chosen primary visual element color */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 pointer-events-none opacity-20 blur-[130px] rounded-full" 
        style={{ background: primaryColor }} 
      />

      <div className="max-w-xl mx-auto mt-6 px-4 pb-20 relative z-10">
        
        {/* Banner */}
        {shop.banner_url && (
          <div className="w-full h-44 mb-[-64px] rounded-t-3xl overflow-hidden relative shadow-lg">
            <img src={shop.banner_url} className="w-full h-full object-cover" alt="Banner" />
            <div 
              className="absolute inset-0"
              style={{
                background: isBgLight
                  ? 'linear-gradient(to top, rgba(255,255,255,0.9), transparent)'
                  : 'linear-gradient(to top, rgba(10,10,10,0.9), transparent)'
              }}
            />
          </div>
        )}

        {/* Shop Header & Niche Identity (Fixed to shop) */}
        <div className="text-center mb-8 relative z-10">
          <div className="relative inline-block mb-4">
            {shop.logo_url ? (
              <img 
                src={shop.logo_url} 
                alt={shop.name} 
                className="h-24 w-24 mx-auto object-contain rounded-2xl border p-2 shadow-2xl transition-all" 
                style={{
                  backgroundColor: isBgLight ? '#ffffff' : 'rgba(24, 24, 27, 0.85)',
                  borderColor: isBgLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'
                }}
              />
            ) : (
              <div 
                className="h-24 w-24 mx-auto rounded-2xl flex items-center justify-center border shadow-2xl transition-all"
                style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}30` }}
              >
                <SegmentIcon iconName={currentPreset.icon} className="w-10 h-10" style={bgStyle} />
              </div>
            )}
          </div>

          <h1 
            className={`text-3xl sm:text-4xl font-bold mb-2 tracking-tight drop-shadow-sm ${currentPreset.layoutTheme.fontFamily}`}
            style={{ color: textColor }}
          >
            {shop.name}
          </h1>

          {/* Clean Unboxed Niche Identity & Tagline */}
          <div className="flex flex-col items-center gap-1.5 mb-5">
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide border shadow-sm"
              style={{
                backgroundColor: isBgLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.06)',
                borderColor: isBgLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)',
                color: textColor
              }}
            >
              <SegmentIcon iconName={currentPreset.icon} className="w-3.5 h-3.5" style={bgStyle} />
              <span>{currentPreset.layoutTheme.badge}</span>
            </div>
            <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: textColor, opacity: 0.7 }}>
              {currentPreset.layoutTheme.tagline}
            </p>
          </div>
          
          {/* Social Links */}
          <div className="flex items-center justify-center gap-3 mb-2">
            {(shop.whatsapp || shop.phone) && shop.show_whatsapp !== false && (() => {
              const pureNumber = (shop.whatsapp || shop.phone).replace(/\D/g, '');
              const finalNumber = pureNumber.startsWith('55') ? pureNumber : `55${pureNumber}`;
              return (
                <a 
                  href={`https://wa.me/${finalNumber}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all shadow-md" 
                  title="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              );
            })()}
            {shop.instagram && shop.show_instagram !== false && (
              <a 
                href={shop.instagram.startsWith('http') ? shop.instagram : `https://instagram.com/${shop.instagram.replace('@', '')}`} 
                target="_blank" 
                rel="noreferrer" 
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E1306C]/10 text-[#E1306C] hover:bg-[#E1306C] hover:text-white transition-all shadow-md" 
                title="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
            )}
            {shop.maps_url && shop.show_address !== false && (
              <a 
                href={shop.maps_url} 
                target="_blank" 
                rel="noreferrer" 
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[#4285F4]/10 text-[#4285F4] hover:bg-[#4285F4] hover:text-white transition-all shadow-md" 
                title="Como chegar"
              >
                <MapPin className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Main Niche Container with dynamic theme canvas */}
        <div 
          className="p-6 sm:p-8 transition-all border rounded-3xl shadow-xl backdrop-blur-md"
          style={{
            backgroundColor: isBgLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 20, 0.85)',
            borderColor: isBgLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)',
            color: textColor
          }}
        >
          
          {/* Step Progress Indicators */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div 
                key={i} 
                className="h-1.5 flex-1 rounded-full transition-all" 
                style={step >= i ? btnStyle : { backgroundColor: isBgLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)' }} 
              />
            ))}
          </div>

          {/* STEP 1: Escolha Primeiro o Profissional */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-semibold flex items-center gap-2 ${currentPreset.layoutTheme.fontFamily}`} style={{ color: textColor }}>
                  <User className="w-5 h-5" style={bgStyle} />
                  <span>Escolha o(a) {currentPreset.terms.professional.toLowerCase()}</span>
                </h3>
                <span className="text-xs" style={{ color: textColor, opacity: 0.55 }}>{effectiveBarbers.length} profissionais</span>
              </div>

              <div className="space-y-2.5">
                {effectiveBarbers.map(barber => {
                  const isSelected = formData.barber_id === barber.id.toString();
                  const barberServicesCount = Array.isArray(barber.serviceIds) && barber.serviceIds.length > 0 
                    ? barber.serviceIds.length 
                    : services.length;

                  return (
                    <button
                      key={barber.id}
                      onClick={() => { 
                        setFormData({ 
                          ...formData, 
                          barber_id: barber.id.toString(),
                          service_id: '' // reset service if barber changes
                        }); 
                        handleNext(); 
                      }}
                      className="w-full flex items-center p-4 rounded-xl border text-left transition-all"
                      style={{
                        backgroundColor: isSelected 
                          ? (isBgLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)')
                          : (isBgLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.35)'),
                        borderColor: isSelected 
                          ? primaryColor 
                          : (isBgLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)'),
                        color: textColor
                      }}
                    >
                      {barber.photoUrl || barber.photo_url ? (
                        <div 
                          className="w-12 h-12 rounded-2xl overflow-hidden mr-4 shrink-0 border transition-all"
                          style={borderStyle}
                        >
                          <img 
                            src={barber.photoUrl || barber.photo_url || ''} 
                            alt={barber.name} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center mr-4 shrink-0 border transition-all"
                          style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}30` }}
                        >
                          <SegmentIcon iconName={currentPreset.icon} className="w-6 h-6" style={bgStyle} />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-base" style={{ color: textColor }}>{barber.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: textColor, opacity: 0.6 }}>
                          {currentPreset.terms.professional} • {barberServicesCount > 0 ? `${barberServicesCount} ${currentPreset.terms.servicePlural.toLowerCase()}` : 'Todos os serviços'}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-40" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Escolha Depois o Tipo de Serviço (filtrado pelo profissional selecionado) */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xl font-semibold flex items-center gap-2 ${currentPreset.layoutTheme.fontFamily}`} style={{ color: textColor }}>
                  <SegmentIcon iconName={currentPreset.icon} className="w-5 h-5" style={bgStyle} />
                  <span>Escolha o {currentPreset.terms.service.toLowerCase()}</span>
                </h3>
                <span className="text-xs" style={{ color: textColor, opacity: 0.55 }}>{availableServices.length} disponíveis</span>
              </div>

              {selectedBarber && (
                <div 
                  className="text-xs mb-3 flex items-center gap-2 px-3.5 py-2 rounded-xl border"
                  style={{ 
                    backgroundColor: `${primaryColor}10`, 
                    borderColor: `${primaryColor}25`,
                    color: textColor
                  }}
                >
                  <SegmentIcon iconName={currentPreset.icon} className="w-3.5 h-3.5" style={bgStyle} />
                  <span>Atendimento exclusivo com: <strong style={{ color: textColor }}>{selectedBarber.name}</strong></span>
                </div>
              )}

              <div className="space-y-2.5">
                {availableServices.map(service => {
                  const isSelected = formData.service_id === service.id.toString();
                  return (
                    <button
                      key={service.id}
                      onClick={() => { 
                        setFormData({ ...formData, service_id: service.id.toString() }); 
                        handleNext(); 
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all"
                      style={{
                        backgroundColor: isSelected 
                          ? (isBgLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)')
                          : (isBgLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.35)'),
                        borderColor: isSelected 
                          ? primaryColor 
                          : (isBgLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)'),
                        color: textColor
                      }}
                    >
                      <div className="flex items-center gap-3.5">
                        {service.imageUrl || service.image_url ? (
                          <div 
                            className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border transition-all"
                            style={borderStyle}
                          >
                            <img 
                              src={service.imageUrl || service.image_url || ''} 
                              alt={service.name} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                            style={{ backgroundColor: `${primaryColor}12`, borderColor: `${primaryColor}25` }}
                          >
                            <SegmentIcon iconName={currentPreset.icon} className="w-4 h-4" style={bgStyle} />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-base" style={{ color: textColor }}>{service?.name || 'Serviço'}</div>
                          <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: textColor, opacity: 0.6 }}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{service?.durationMinutes || 30} min</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-base font-bold tabular-nums shrink-0 ml-4 font-mono" style={bgStyle}>
                        R$ {Number(service?.price || 0).toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4">
                <button 
                  onClick={handlePrev} 
                  className="text-xs flex items-center gap-1 transition-colors opacity-70 hover:opacity-100"
                  style={{ color: textColor }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar para escolha de {currentPreset.terms.professional.toLowerCase()}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Data e Horário */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className={`text-xl font-semibold mb-2 flex items-center gap-2 ${currentPreset.layoutTheme.fontFamily}`} style={{ color: textColor }}>
                <Calendar className="w-5 h-5" style={bgStyle} /> 
                <span>Data e Horário</span>
              </h3>
              
              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: textColor, opacity: 0.7 }}>
                  Data do Atendimento
                </label>
                <input 
                  type="date" 
                  min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value, time: '' })}
                  className="w-full rounded-xl p-3.5 border outline-none transition-all text-sm"
                  style={{
                    backgroundColor: isBgLight ? '#ffffff' : 'rgba(0, 0, 0, 0.45)',
                    borderColor: formData.date ? primaryColor : (isBgLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)'),
                    color: isBgLight ? '#111827' : '#ffffff'
                  }}
                />
              </div>

              {formData.date && (
                <div>
                  <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: textColor, opacity: 0.7 }}>
                    Horários Disponíveis
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {(availableSlots.length > 0 ? availableSlots : ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00']).map(slot => (
                      <button
                        key={slot}
                        onClick={() => setFormData({ ...formData, time: slot })}
                        className="py-2.5 rounded-xl border text-sm font-mono tabular-nums transition-all"
                        style={formData.time === slot 
                          ? { ...btnStyle, borderColor: primaryColor }
                          : {
                              backgroundColor: isBgLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)',
                              borderColor: isBgLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.12)',
                              color: textColor
                            }
                        }
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4">
                <button 
                  onClick={handlePrev} 
                  className="text-xs flex items-center gap-1 transition-colors opacity-70 hover:opacity-100"
                  style={{ color: textColor }}
                >
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                <button 
                  onClick={handleNext}
                  disabled={!formData.date || !formData.time}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
                  style={btnStyle}
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Seus Dados e Confirmação */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className={`text-xl font-semibold mb-2 ${currentPreset.layoutTheme.fontFamily}`} style={{ color: textColor }}>
                Seus Dados de Contato
              </h3>
              
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: textColor, opacity: 0.7 }}>
                  Nome do(a) {currentPreset.terms.client}
                </label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João da Silva"
                  className="w-full rounded-xl p-3.5 border outline-none transition-all text-sm"
                  style={{
                    backgroundColor: isBgLight ? '#ffffff' : 'rgba(0, 0, 0, 0.45)',
                    borderColor: isBgLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)',
                    color: isBgLight ? '#111827' : '#ffffff'
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: textColor, opacity: 0.7 }}>
                  WhatsApp (para confirmação e lembretes)
                </label>
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl p-3.5 border outline-none transition-all text-sm"
                  style={{
                    backgroundColor: isBgLight ? '#ffffff' : 'rgba(0, 0, 0, 0.45)',
                    borderColor: isBgLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)',
                    color: isBgLight ? '#111827' : '#ffffff'
                  }}
                />
              </div>

              {/* Booking Summary Box */}
              <div 
                className="p-4 rounded-xl border mt-4 space-y-2"
                style={{
                  backgroundColor: isBgLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: isBgLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <div className="text-xs uppercase tracking-wider font-semibold opacity-60">Resumo do Agendamento</div>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const curService = availableServices.find(s => s.id.toString() === formData.service_id);
                      const sPhoto = curService?.imageUrl || curService?.image_url;
                      if (!sPhoto) return null;
                      return (
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border" style={borderStyle}>
                          <img src={sPhoto} alt="Procedimento" className="w-full h-full object-cover" />
                        </div>
                      );
                    })()}
                    <div>
                      <div className="font-semibold text-base" style={{ color: textColor }}>
                        {availableServices.find(s => s.id.toString() === formData.service_id)?.name}
                      </div>
                      <div className="text-xs mt-0.5 opacity-75 flex items-center gap-1.5">
                        {(selectedBarber?.photoUrl || selectedBarber?.photo_url) && (
                          <img 
                            src={selectedBarber.photoUrl || selectedBarber.photo_url || ''} 
                            alt="" 
                            className="w-4 h-4 rounded-full object-cover inline-block" 
                          />
                        )}
                        <span>Profissional: <strong style={{ color: textColor }}>{selectedBarber?.name}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="font-bold text-base font-mono tabular-nums shrink-0" style={bgStyle}>
                    R$ {Number(availableServices.find(s => s.id.toString() === formData.service_id)?.price || 0).toFixed(2)}
                  </div>
                </div>
                <div 
                  className="font-mono text-xs tabular-nums pt-1 border-t"
                  style={{
                    borderColor: isBgLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
                    opacity: 0.8
                  }}
                >
                  📅 {formData.date.split('-').reverse().join('/')} às ⏰ {formData.time}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button 
                  onClick={handlePrev} 
                  className="text-xs flex items-center gap-1 transition-colors opacity-70 hover:opacity-100"
                  style={{ color: textColor }}
                >
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={!formData.name || !formData.phone || loading}
                  className="px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg active:scale-95"
                  style={btnStyle}
                >
                  {loading ? 'Confirmando...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Trust & Protection */}
        <div className="mt-12 text-center text-xs space-y-2 opacity-60" style={{ color: textColor }}>
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500/80" />
            <span>Agendamento protegido e garantido por {shop.name}</span>
          </div>
          <p>© {new Date().getFullYear()} • Plataforma DoisemePRO</p>
        </div>

      </div>
    </div>
  );
}
