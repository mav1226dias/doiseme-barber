import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, User, Scissors, Check, MapPin, Instagram, MessageCircle } from 'lucide-react';

export default function Booking() {
  const { slug } = useParams();
  const [shop, setShop] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    service_id: '',
    barber_id: '',
    date: '',
    time: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    
    fetch(`/api/public/shop/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Shop not found');
        return res.json();
      })
      .then(data => {
        setShop(data);
        
        // Fetch services & barbers for this specific shop
        fetch(`/api/barbershops/${data.id}/services`)
          .then(res => res.json())
          .then(setServices)
          .catch(console.error);
          
        fetch(`/api/barbershops/${data.id}/barbers`)
          .then(res => res.json())
          .then(setBarbers)
          .catch(console.error);
      })
      .catch(err => {
        console.error(err);
        setError(slug || 'URL invalida');
      });
  }, [slug]);

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
  const handlePrev = () => setStep(s => s - 1);

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

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
          <Scissors className="w-10 h-10 text-white/20" />
        </div>
        <h2 className="text-3xl font-bold mb-4 font-serif">Página de agendamento não encontrada</h2>
        <p className="text-white/50 max-w-xs mx-auto mb-8">
          A barbearia com o link "{error}" não foi encontrada. Verifique se o link está correto no painel administrativo.
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

  if (!shop) return <div className="flex items-center justify-center min-h-[60vh] text-white/50">Carregando...</div>;

  const bgStyle = shop.primary_color ? { borderColor: shop.primary_color, color: shop.primary_color } : {};
  const btnStyle = shop.primary_color ? { backgroundColor: shop.primary_color } : { backgroundColor: '#D4AF37' };

  if (success) {
    const barber = barbers.find(b => b.id.toString() === formData.barber_id);
    const message = `Fala ${barber?.name}, agendei meu horário para o dia ${formData.date.split('-').reverse().join('/')} às ${formData.time}.`;
    const whatsappUrl = `https://wa.me/55${shop.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    return (
      <div className="max-w-md mx-auto mt-20 px-4 text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-3xl font-bold mb-4 font-serif">Agendado com sucesso!</h2>
        <p className="text-white/60 mb-8">
          Seu horário está confirmado. Te esperamos no dia {formData.date.split('-').reverse().join('/')} às {formData.time}.
        </p>
        <a 
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-4 rounded-xl font-bold hover:bg-[#20bd5a] transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          Confirmar via WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-12 px-4 pb-20">
      <div className="text-center mb-12">
        {shop.logo_url ? (
          <img src={shop.logo_url} alt={shop.name} className="h-24 mx-auto mb-6 object-contain" />
        ) : (
          <Scissors className="w-16 h-16 mx-auto mb-6 opacity-20" />
        )}
        <h1 className="text-4xl font-bold mb-4 font-serif tracking-tight">{shop.name}</h1>
        <p className="text-white/50 uppercase tracking-widest text-[10px] font-semibold">Agendamento Online</p>
      </div>

      <div className={`shadow-2xl transition-all ${
        shop.booking_layout === 'classic' 
          ? 'bg-[#1a1a1a] border-[#D4AF37]/30 rounded-none p-10' 
          : shop.booking_layout === 'modern'
            ? 'bg-white/5 backdrop-blur-xl border-white/20 rounded-[3rem] p-4'
            : 'bg-[#141414] border-white/10 rounded-3xl p-6 md:p-8'
      }`}>
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full ${step >= i ? '' : 'bg-white/10'}`} style={step >= i ? btnStyle : {}} />
          ))}
        </div>

        {/* Step 1: Service */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-medium mb-6 flex items-center gap-2">
              <Scissors className="w-5 h-5" style={bgStyle} /> Escolha o serviço
            </h3>
            {(services || []).map(service => (
              <button
                key={service.id}
                onClick={() => { setFormData({ ...formData, service_id: service.id.toString() }); handleNext(); }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  formData.service_id === service.id.toString() 
                    ? 'bg-white/5' 
                    : 'border-white/10 hover:border-white/30 bg-black/50'
                }`}
                style={formData.service_id === service.id.toString() ? { borderColor: shop.primary_color } : {}}
              >
                <div className="text-left">
                  <div className="font-medium text-lg">{service.name}</div>
                  <div className="text-white/50 text-sm">{service.durationMinutes} min</div>
                </div>
                <div className="font-bold" style={bgStyle}>R$ {service.price.toFixed(2)}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Barber */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-medium mb-6 flex items-center gap-2">
              <User className="w-5 h-5" style={bgStyle} /> Escolha o profissional
            </h3>
            {(barbers || []).map(barber => (
              <button
                key={barber.id}
                onClick={() => { setFormData({ ...formData, barber_id: barber.id.toString() }); handleNext(); }}
                className={`w-full flex items-center p-4 rounded-2xl border transition-all ${
                  formData.barber_id === barber.id.toString() 
                    ? 'bg-white/5' 
                    : 'border-white/10 hover:border-white/30 bg-black/50'
                }`}
                style={formData.barber_id === barber.id.toString() ? { borderColor: shop.primary_color } : {}}
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mr-4">
                  <User className="w-6 h-6 text-white/50" />
                </div>
                <div className="font-medium text-lg">{barber.name}</div>
              </button>
            ))}
            <button onClick={handlePrev} className="mt-6 text-white/50 hover:text-white text-sm">Voltar</button>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-medium mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5" style={bgStyle} /> Data e Horário
             </h3>
            
            <div>
              <label className="block text-sm text-white/50 mb-2 uppercase tracking-wider">Data</label>
              <input 
                type="date" 
                min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value, time: '' })}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[#D4AF37] outline-none"
              />
            </div>

            {formData.date && (
              <div>
                <label className="block text-sm text-white/50 mb-2 uppercase tracking-wider">Horários Disponíveis</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {availableSlots.length > 0 ? availableSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setFormData({ ...formData, time: slot })}
                      className={`py-3 rounded-xl border font-mono text-sm transition-all ${
                        formData.time === slot
                          ? 'text-black font-bold'
                          : 'border-white/10 hover:border-white/30 bg-black/50'
                      }`}
                      style={formData.time === slot ? { ...btnStyle, borderColor: shop.primary_color } : {}}
                    >
                      {slot}
                    </button>
                  )) : (
                    <div className="col-span-full text-center py-4 text-white/50 text-sm">Nenhum horário disponível nesta data.</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button onClick={handlePrev} className="text-white/50 hover:text-white text-sm">Voltar</button>
              <button 
                onClick={handleNext}
                disabled={!formData.date || !formData.time}
                className="bg-white text-black px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Details */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xl font-medium mb-6">Seus dados</h3>
            
            <div>
              <label className="block text-sm text-white/50 mb-2 uppercase tracking-wider">Nome completo</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: João Silva"
                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[#D4AF37] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-white/50 mb-2 uppercase tracking-wider">WhatsApp</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-[#D4AF37] outline-none"
              />
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 mt-6">
              <div className="text-sm text-white/50 mb-1">Resumo do Agendamento</div>
              <div className="font-medium">
                {services.find(s => s.id.toString() === formData.service_id)?.name} com {barbers.find(b => b.id.toString() === formData.barber_id)?.name}
              </div>
              <div className="font-mono text-sm mt-1" style={bgStyle}>
                {formData.date.split('-').reverse().join('/')} às {formData.time}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button onClick={handlePrev} className="text-white/50 hover:text-white text-sm">Voltar</button>
              <button 
                onClick={handleSubmit}
                disabled={!formData.name || !formData.phone || loading}
                className="text-black px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                style={btnStyle}
              >
                {loading ? 'Agendando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
        {shop.phone && (
          <a href={`https://wa.me/55${shop.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl transition-colors">
            <MessageCircle className="w-5 h-5 text-[#25D366]" />
            <span className="font-medium">WhatsApp</span>
          </a>
        )}
        {shop.instagram && (
          <a href={`https://instagram.com/${shop.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl transition-colors">
            <Instagram className="w-5 h-5 text-[#E1306C]" />
            <span className="font-medium">@{shop.instagram.replace('@', '')}</span>
          </a>
        )}
        {shop.maps_url && (
          <a href={shop.maps_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl transition-colors">
            <MapPin className="w-5 h-5 text-[#4285F4]" />
            <span className="font-medium">Como chegar</span>
          </a>
        )}
      </div>
    </div>
  );
}
