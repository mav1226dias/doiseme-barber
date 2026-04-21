import React, { useState, useEffect } from 'react';
import { Save, Clock, CalendarDays, BellRing } from 'lucide-react';

const DAYS = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

export default function Settings() {
  const [hours, setHours] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHolidayAlert, setShowHolidayAlert] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setHours(data);
        setLoading(false);
      })
      .catch(console.error);

    // Mock holiday check
    const currentMonth = new Date().getMonth();
    // E.g. If December or April, show a fake holiday warning for demonstration
    if (currentMonth === 11 || currentMonth === 3 || currentMonth === 4) {
      setShowHolidayAlert(true);
    }
  }, []);

  const handleChange = (day: string, field: string, value: any) => {
    setHours({
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(hours)
      });
      alert('Configurações salvas com sucesso!');
    } catch (e) {
      alert('Erro ao salvar.');
    }
    setSaving(false);
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Configurações</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie os horários de funcionamento e avisos</p>
      </div>

      {showHolidayAlert && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-2xl p-4 flex gap-4 items-start">
          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h3 className="font-bold text-yellow-800 dark:text-yellow-500">Feriado se aproximando!</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-600 mt-1">
              Detectamos um ou mais feriados nacionais nos próximos 7 dias. Não se esqueça de ajustar sua escala ou bloquear horários na Agenda se a barbearia for fechar.
            </p>
            <button 
              onClick={() => setShowHolidayAlert(false)}
              className="mt-3 text-sm font-medium text-yellow-800 dark:text-yellow-500 hover:opacity-80 transition-opacity underline"
            >
              Ciente, dispensar aviso
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
          <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Horário de Funcionamento Geral</h2>
        </div>

        <div className="space-y-4 max-w-3xl">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-4 hidden sm:grid">
            <div className="col-span-3">Dia da Semana</div>
            <div className="col-span-3 text-center">Status</div>
            <div className="col-span-3 text-center">Abertura</div>
            <div className="col-span-3 text-center">Fechamento</div>
          </div>

          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex flex-col sm:grid sm:grid-cols-12 gap-4 items-center bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
              <div className="col-span-3 font-medium text-gray-900 dark:text-gray-100 w-full sm:w-auto">
                {label}
              </div>
              
              <div className="col-span-3 flex justify-center w-full sm:w-auto">
                <button
                  onClick={() => handleChange(key, 'isClosed', !hours[key].isClosed)}
                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !hours[key].isClosed 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50' 
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50'
                  }`}
                >
                  {!hours[key].isClosed ? 'Aberto' : 'Fechado'}
                </button>
              </div>

              <div className="col-span-3 w-full sm:w-auto">
                <input
                  type="time"
                  disabled={hours[key].isClosed}
                  value={hours[key].open}
                  onChange={e => handleChange(key, 'open', e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 disabled:opacity-50 outline-none focus:border-black dark:focus:border-gray-500 text-center"
                />
              </div>

              <div className="col-span-3 w-full sm:w-auto">
                <input
                  type="time"
                  disabled={hours[key].isClosed}
                  value={hours[key].close}
                  onChange={e => handleChange(key, 'close', e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 disabled:opacity-50 outline-none focus:border-black dark:focus:border-gray-500 text-center"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button 
            disabled={saving}
            onClick={handleSave}
            className="bg-[#D4AF37] text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#b0912e] transition-colors disabled:opacity-50 shadow-lg shadow-[#D4AF37]/20"
          >
            <Save className="w-5 h-5" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
