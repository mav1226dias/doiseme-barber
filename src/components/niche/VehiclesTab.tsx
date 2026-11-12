import React, { useState, useEffect } from 'react';
import { Car, Plus, Trash2, Wrench, AlertCircle, MessageCircle, Sparkles, Check, Gauge, Fuel } from 'lucide-react';
import { toast } from 'sonner';

interface VehiclesTabProps {
  clientId: string;
  clientName: string;
  clientPhone: string;
}

const FUEL_LEVELS = ['Reserva', '1/4 de Tanque', '1/2 de Tanque', '3/4 de Tanque', 'Tanque Cheio'];

export default function VehiclesTab({ clientId, clientName, clientPhone }: VehiclesTabProps) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [nextOilKm, setNextOilKm] = useState('');
  const [fuelLevel, setFuelLevel] = useState('1/2 de Tanque');
  const [damages, setDamages] = useState('');
  const [notes, setNotes] = useState('');

  const fetchVehicles = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
      }
    } catch (err: any) {
      toast.error('Erro ao buscar veículos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [clientId]);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !brand.trim() || !model.trim()) {
      toast.error('Placa, marca e modelo são obrigatórios');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plate: plate.trim().toUpperCase(),
          brand: brand.trim(),
          model: model.trim(),
          year: year.trim(),
          color: color.trim(),
          current_km: currentKm ? Number(currentKm) : null,
          next_oil_change_km: nextOilKm ? Number(nextOilKm) : null,
          fuel_level: fuelLevel,
          pre_existing_damages: damages.trim(),
          notes: notes.trim()
        })
      });

      if (!res.ok) throw new Error('Erro ao salvar veículo');
      toast.success('Veículo registrado com sucesso!');
      setIsFormOpen(false);
      // Reset
      setPlate('');
      setBrand('');
      setModel('');
      setYear('');
      setColor('');
      setCurrentKm('');
      setNextOilKm('');
      setDamages('');
      setNotes('');
      fetchVehicles();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar veículo');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string, carName: string) => {
    if (!window.confirm(`Deseja remover o veículo ${carName}?`)) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/vehicles/${vehicleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao excluir veículo');
      toast.success('Veículo removido com sucesso!');
      fetchVehicles();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover veículo');
    }
  };

  const sendWhatsAppVehicleReady = (v: any) => {
    if (!clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    const cleanPhone = clientPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá, ${clientName}! 🚗✨\n\nInformamos que os serviços no seu veículo *${v.brand} ${v.model}* (Placa: *${v.plate}*) foram concluídos com sucesso e ele já está pronto para retirada! 🛠️`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-sky-50 dark:bg-sky-950/20 p-5 rounded-2xl border border-sky-200 dark:border-sky-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
              Veículos & Ordens de {clientName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Controle de placa, quilometragem, histórico de troca de óleo, checklist de avarias e status de entrega.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-xl shadow-md transition-all self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Veículo</span>
        </button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <form onSubmit={handleSaveVehicle} className="bg-white dark:bg-zinc-900 border border-sky-300 dark:border-sky-800/50 rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-500" />
              Novo Veículo / Checklist de Entrada
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Placa do Veículo *
              </label>
              <input
                type="text"
                required
                value={plate}
                onChange={e => setPlate(e.target.value)}
                placeholder="Ex: ABC-1234 ou BRA2E19"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs font-mono uppercase focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Marca *
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="Ex: Toyota, Honda, VW"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Modelo *
              </label>
              <input
                type="text"
                required
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="Ex: Corolla, Civic, Golf"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Ano & Cor
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  placeholder="2022"
                  className="w-full px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
                <input
                  type="text"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  placeholder="Preto"
                  className="w-full px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Quilometragem Atual (Km)
              </label>
              <input
                type="number"
                value={currentKm}
                onChange={e => setCurrentKm(e.target.value)}
                placeholder="Ex: 45000"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Próxima Troca de Óleo (Km)
              </label>
              <input
                type="number"
                value={nextOilKm}
                onChange={e => setNextOilKm(e.target.value)}
                placeholder="Ex: 55000"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Nível de Combustível na Entrada
              </label>
              <select
                value={fuelLevel}
                onChange={e => setFuelLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              >
                {FUEL_LEVELS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Checklist de Avarias Pré-existentes (Riscos, amassados, peças soltas)
              </label>
              <textarea
                rows={2}
                value={damages}
                onChange={e => setDamages(e.target.value)}
                placeholder="Ex: Pequeno risco na lateral direita traseira, calota dianteira esquerda com ralado."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Observações Técnicas / Peças e Produtos Usados
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Vitrificação 9H aplicada, filtro de cabine trocado, óleo 5w30 Sintético."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-xs focus:ring-2 focus:ring-sky-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-xl shadow-md disabled:opacity-50"
            >
              {saving ? 'Registrando...' : 'Registrar Veículo'}
            </button>
          </div>
        </form>
      )}

      {/* Vehicle Cards List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Carregando veículos...</div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-8">
          <Car className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
          <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">Nenhum veículo registrado para este cliente</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Cadastre veículos para salvar placas, controle de quilometragem, histórico de troca de óleo e checklist de entrada.
          </p>
          <button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 px-4 py-2 bg-sky-600 text-white font-medium text-xs rounded-xl shadow hover:bg-sky-500"
          >
            Registrar Primeiro Veículo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles.map(v => {
            const isOilDue = v.current_km && v.next_oil_change_km && v.current_km >= v.next_oil_change_km;
            return (
              <div
                key={v.id}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:border-sky-400 dark:hover:border-sky-600 transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                          {v.brand} {v.model}
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold border border-zinc-300 dark:border-zinc-700">
                            {v.plate}
                          </span>
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          {v.color || 'Cor não inf.'} {v.year ? `• Ano ${v.year}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteVehicle(v.id, `${v.brand} ${v.model}`)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                      title="Remover veículo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Km and Oil Status */}
                  <div className="grid grid-cols-2 gap-2 mt-3.5">
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <Gauge className="w-3.5 h-3.5" />
                        <span>Km Atual</span>
                      </div>
                      <span className="font-bold text-xs text-gray-900 dark:text-gray-100 mt-0.5 block">
                        {v.current_km ? `${Number(v.current_km).toLocaleString('pt-BR')} km` : 'Não informado'}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border ${
                      isOilDue 
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50' 
                        : 'bg-gray-50 dark:bg-zinc-800/60 border-gray-100 dark:border-zinc-800'
                    }`}>
                      <div className={`flex items-center gap-1.5 text-[11px] ${isOilDue ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Troca de Óleo</span>
                      </div>
                      <span className={`text-xs font-bold mt-0.5 block ${isOilDue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {v.next_oil_change_km ? `${Number(v.next_oil_change_km).toLocaleString('pt-BR')} km` : 'Não agendada'}
                        {isOilDue && ' (Vencida!)'}
                      </span>
                    </div>
                  </div>

                  {/* Damages & Fuel */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Fuel className="w-3.5 h-3.5 text-amber-500" />
                      {v.fuel_level || 'Combustível N/I'}
                    </span>
                    {v.pre_existing_damages ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Possui avarias registradas</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Sem avarias registradas</span>
                    )}
                  </div>

                  {/* Damages details */}
                  {v.pre_existing_damages && (
                    <div className="mt-2 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-2.5 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                      <strong>Checklist:</strong> {v.pre_existing_damages}
                    </div>
                  )}

                  {v.notes && (
                    <div className="mt-2 bg-gray-50 dark:bg-zinc-800/40 p-2.5 rounded-xl text-xs text-gray-600 dark:text-gray-300">
                      <strong>Obs:</strong> {v.notes}
                    </div>
                  )}
                </div>

                {/* WhatsApp Ready Button */}
                <button
                  onClick={() => sendWhatsAppVehicleReady(v)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Avisar no WhatsApp: Veículo Pronto para Retirada 🚗</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
