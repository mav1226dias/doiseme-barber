import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, X, ShieldAlert, Plus, Brain, Sparkles, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import PatientRecordModal from '../../components/PatientRecordModal';
import ConfirmModal from '../../components/ConfirmModal';

export default function Agenda() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [segment, setSegment] = useState('barbershop');
  const [selectedClientForRecord, setSelectedClientForRecord] = useState<any | null>(null);
  
  const [barbersListOptions, setBarbersListOptions] = useState<any[]>([]);
  const [servicesListOptions, setServicesListOptions] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('admin');
  const [ownBarberId, setOwnBarberId] = useState<string>('');

  // Modals state
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<any | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ id: string; status: string } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Create / Edit Appt form
  const [newAppt, setNewAppt] = useState({
    clientName: '',
    clientPhone: '',
    serviceId: '',
    barberId: '',
    apptDate: date,
    time: '09:00',
    notes: ''
  });

  // Block form
  const [newBlock, setNewBlock] = useState({
    barberId: '',
    startTime: '09:00',
    endTime: '10:00'
  });

  const fetchAppointments = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/admin/appointments?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (res.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
          return [];
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => {
        if (Array.isArray(data)) setAppointments(data);
      })
      .catch(console.error);
  };

  const loadOptions = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/barbers', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setBarbersListOptions(list);
        if (list.length === 1 && list[0]?.id) {
          setNewAppt(prev => prev.barberId ? prev : { ...prev, barberId: list[0].id });
          setNewBlock(prev => prev.barberId ? prev : { ...prev, barberId: list[0].id });
        }
      })
      .catch(console.error);
    fetch('/api/admin/services', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => setServicesListOptions(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
          if (payload.role) setUserRole(payload.role);
          if (payload.barberId) {
            setOwnBarberId(payload.barberId);
            setNewAppt(prev => ({ ...prev, barberId: payload.barberId }));
            setNewBlock(prev => ({ ...prev, barberId: payload.barberId }));
          }
        }
      } catch {
        // ignore decode issue
      }
    }

    fetchAppointments();
    loadOptions();

    fetch('/api/admin/shop-info', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (data?.segment) setSegment(data.segment); })
      .catch(console.error);
  }, [date]);

  const updateStatus = (id: string, status: string) => {
    setPendingStatusUpdate({ id, status });
  };

  const handleConfirmStatusUpdate = async () => {
    if (!pendingStatusUpdate) return;
    setUpdatingStatus(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/appointments/${pendingStatusUpdate.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: pendingStatusUpdate.status })
      });
      if (res.ok) {
        toast.success('Status atualizado!');
        setPendingStatusUpdate(null);
        fetchAppointments();
      } else {
        toast.error('Erro ao atualizar horário.');
      }
    } catch {
      toast.error('Erro de rede ao atualizar horário.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    if (!isApptModalOpen && !isBlockModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        setIsApptModalOpen(false);
        setEditingAppt(null);
        setIsBlockModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isApptModalOpen, isBlockModalOpen, loading]);

  const openCreateApptModal = () => {
    setEditingAppt(null);
    setNewAppt({
      clientName: '',
      clientPhone: '',
      serviceId: '',
      barberId: ownBarberId || (barbersListOptions.length === 1 ? barbersListOptions[0]?.id || '' : ''),
      apptDate: date,
      time: '09:00',
      notes: ''
    });
    setIsApptModalOpen(true);
  };

  const openEditApptModal = (apt: any) => {
    setEditingAppt(apt);
    setNewAppt({
      clientName: apt.clientName || '',
      clientPhone: apt.clientPhone || '',
      serviceId: apt.serviceId || '',
      barberId: apt.barberId || ownBarberId || '',
      apptDate: apt.date || date,
      time: apt.startTime || '09:00',
      notes: apt.notes || ''
    });
    setIsApptModalOpen(true);
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const endpoint = editingAppt
        ? `/api/admin/appointments/${encodeURIComponent(editingAppt.id)}`
        : '/api/admin/appointments';
      const method = editingAppt ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clientName: newAppt.clientName,
          clientPhone: newAppt.clientPhone,
          serviceId: newAppt.serviceId,
          barberId: newAppt.barberId,
          date: newAppt.apptDate || date,
          startTime: newAppt.time,
          notes: newAppt.notes
        })
      });
      if (res.ok) {
        toast.success(editingAppt ? 'Agendamento atualizado com sucesso!' : 'Agendamento criado com sucesso!');
        setIsApptModalOpen(false);
        setEditingAppt(null);
        setNewAppt({
          clientName: '',
          clientPhone: '',
          serviceId: '',
          barberId: ownBarberId || '',
          apptDate: date,
          time: '09:00',
          notes: ''
        });
        fetchAppointments();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Erro ao salvar agendamento');
      }
    } catch {
      toast.error('Erro de rede ao salvar agendamento');
    }
    setLoading(false);
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/admin/appointments/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          date,
          startTime: newBlock.startTime,
          endTime: newBlock.endTime,
          barberId: newBlock.barberId
        })
      });
      toast.success('Horário bloqueado!');
      setIsBlockModalOpen(false);
      setNewBlock({ ...newBlock, startTime: '09:00', endTime: '10:00' });
      fetchAppointments();
    } catch {
      toast.error('Erro ao bloquear horário');
    }
    setLoading(false);
  };

  const barbersMap = new Map();
  const filteredAppointments = appointments.filter(apt => {
    if (filterStatus === 'all') return true;
    return apt.status === filterStatus;
  });

  filteredAppointments.forEach(apt => {
    const bName = apt.barberName || 'Barbeiro';
    if (!barbersMap.has(bName)) barbersMap.set(bName, { name: bName, id: apt.barberId, apts: [] });
    barbersMap.get(bName).apts.push(apt);
  });

  const barbersList = Array.from(barbersMap.values());

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Agenda Diária</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie e visualize horários</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            type="button"
            onClick={openCreateApptModal}
            className="flex items-center gap-2 bg-[#D4AF37] text-black px-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Nova Marcação
          </button>
          <button 
            type="button"
            onClick={() => setIsBlockModalOpen(true)}
            className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <ShieldAlert className="w-4 h-4" /> Bloquear Horário
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <input 
            type="date" 
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white rounded-xl p-2.5 outline-none focus:border-black font-medium"
          />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white rounded-xl p-2.5 outline-none focus:border-black dark:focus:border-white font-medium"
          >
            <option value="all">Todos os Status</option>
            <option value="scheduled">Agendados</option>
            <option value="completed">Concluídos</option>
            <option value="cancelled">Cancelados</option>
            <option value="blocked">Bloqueados</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          {barbersList.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-zinc-700 mb-4" />
              Nenhum agendamento para esta data.
            </div>
          ) : (
            <div className="flex gap-6 min-w-[700px]">
              {barbersList.map((barber: any, bIdx) => (
                <div key={bIdx} className="flex-1 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 dark:bg-zinc-800/80 p-4 border-b border-gray-100 dark:border-zinc-800 text-center font-bold text-gray-900 dark:text-gray-100 text-lg font-serif">
                    {barber.name}
                  </div>
                  <div className="p-4 space-y-3">
                    {barber.apts.sort((a:any, b:any) => a.startTime.localeCompare(b.startTime)).map((apt: any) => {
                      const isBlocked = apt.status === 'blocked';
                      const isCancelled = apt.status === 'cancelled';
                      const isCompleted = apt.status === 'completed';

                      let bgColor = 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700';
                      if (isBlocked) bgColor = 'bg-gray-200 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 opacity-60';
                      if (isCancelled) bgColor = 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 opacity-60';
                      if (isCompleted) bgColor = 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20';

                      return (
                        <div key={apt.id} className={`p-4 border rounded-xl relative group transition-colors ${bgColor}`}>
                          <div className="bg-black dark:bg-zinc-700 text-white dark:text-gray-100 text-xs px-2 py-1 rounded inline-block font-mono font-bold tracking-wider mb-2">
                            {apt.startTime}{apt.endTime && apt.endTime !== apt.startTime ? ` – ${apt.endTime}` : ''}
                          </div>
                          {!isBlocked ? (
                            <div>
                              <div className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1" title={apt.clientName}>{apt.clientName}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{apt.serviceName}</div>
                              {apt.notes && (
                                <div className="mt-2 text-xs bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300">
                                  <span className="font-bold text-[10px] uppercase text-amber-700 dark:text-amber-400 mr-1">Briefing:</span>
                                  {apt.notes}
                                </div>
                              )}
                              {apt.status === 'scheduled' && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(apt.id, 'completed')}
                                    className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 flex-1"
                                  >
                                    Concluir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditApptModal(apt)}
                                    className="text-xs bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-zinc-600 inline-flex items-center gap-1"
                                    title="Editar agendamento"
                                  >
                                    <Edit2 className="w-3 h-3 text-[#D4AF37]" />
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(apt.id, 'cancelled')}
                                    className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/50"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              )}
                              {isCompleted && <div className="text-xs font-medium text-green-600 dark:text-green-400 mt-2">Concluído ✓</div>}
                              {isCancelled && <div className="text-xs font-medium text-red-500 dark:text-red-400 mt-2">Cancelado ✖</div>}

                              {(apt.clientId || apt.clientName) && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedClientForRecord({
                                    id: apt.clientId || apt.id,
                                    name: apt.clientName,
                                    phone: apt.clientPhone || ''
                                  })}
                                  className={`mt-2.5 w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                                    segment === 'aesthetics' || segment === 'lash_design' || segment === 'beauty_salon'
                                      ? 'bg-[#E0A98B]/15 text-[#C47C62] dark:text-[#E0A98B] border border-[#E0A98B]/30 hover:bg-[#E0A98B]/25'
                                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                                  }`}
                                >
                                  {segment === 'aesthetics' || segment === 'lash_design' || segment === 'beauty_salon' ? (
                                    <Sparkles className="w-3.5 h-3.5 text-[#C47C62] dark:text-[#E0A98B]" />
                                  ) : (
                                    <Brain className="w-3.5 h-3.5 text-indigo-500" />
                                  )}
                                  <span>
                                    {segment === 'aesthetics' || segment === 'lash_design' || segment === 'beauty_salon'
                                      ? 'Ficha Estética / Fotos'
                                      : segment === 'psychology'
                                      ? 'Prontuário / Evolução'
                                      : segment === 'woodwork'
                                      ? 'Projetos & Medidas'
                                      : segment === 'architecture'
                                      ? 'Projetos & Obras'
                                      : segment === 'photography'
                                      ? 'Ensaios & Galerias'
                                      : segment === 'video_production'
                                      ? 'Produções & Entregas'
                                      : 'Ficha / Anotações'}
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col h-full justify-between">
                              <div className="text-gray-600 dark:text-gray-400 font-medium">Bloqueado</div>
                              <button onClick={() => updateStatus(apt.id, 'cancelled')} className="text-xs text-gray-500 dark:text-gray-400 mt-2 underline hover:text-gray-900 dark:hover:text-white">Liberar horário</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isApptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => !loading && (setIsApptModalOpen(false), setEditingAppt(null))}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center gap-3 shrink-0">
              <div>
                <h2 className="text-lg font-bold font-serif text-gray-900 dark:text-white">
                  {editingAppt ? 'Editar Agendamento' : 'Nova Marcação'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {editingAppt ? 'Altere horário, serviço, profissional ou dados do cliente' : 'Agende manualmente um novo atendimento'}
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setIsApptModalOpen(false);
                  setEditingAppt(null);
                }}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800"
                aria-label="Fechar janela"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAppointment} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Nome *</label>
                    <input
                      required
                      type="text"
                      value={newAppt.clientName}
                      onChange={e => setNewAppt({ ...newAppt, clientName: e.target.value })}
                      className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">WhatsApp *</label>
                    <input
                      required
                      type="text"
                      value={newAppt.clientPhone}
                      onChange={e => setNewAppt({ ...newAppt, clientPhone: e.target.value })}
                      className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-mono tabular-nums focus:border-[#D4AF37]"
                      placeholder="5553999999999"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Profissional *</label>
                  <select
                    required
                    disabled={userRole === 'barber'}
                    value={newAppt.barberId}
                    onChange={e => setNewAppt({ ...newAppt, barberId: e.target.value })}
                    className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white disabled:opacity-70 focus:border-[#D4AF37]"
                  >
                    <option value="">Selecione...</option>
                    {barbersListOptions.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Serviço *</label>
                  <select
                    required
                    value={newAppt.serviceId}
                    onChange={e => setNewAppt({ ...newAppt, serviceId: e.target.value })}
                    className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:border-[#D4AF37]"
                  >
                    <option value="">Selecione...</option>
                    {servicesListOptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - R${s.price}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Data *</label>
                    <input
                      required
                      type="date"
                      value={newAppt.apptDate}
                      onChange={e => setNewAppt({ ...newAppt, apptDate: e.target.value })}
                      className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:border-[#D4AF37] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Horário de Início *</label>
                    <input
                      required
                      type="time"
                      value={newAppt.time}
                      onChange={e => setNewAppt({ ...newAppt, time: e.target.value })}
                      className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:border-[#D4AF37] tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Observações / Briefing (Opcional)</label>
                  <textarea
                    rows={2}
                    value={newAppt.notes}
                    onChange={e => setNewAppt({ ...newAppt, notes: e.target.value })}
                    placeholder="Detalhes do atendimento, medidas, referências..."
                    className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white resize-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-950/60 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setIsApptModalOpen(false);
                    setEditingAppt(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={loading}
                  type="submit"
                  className="px-5 py-2.5 bg-black dark:bg-[#D4AF37] text-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : editingAppt ? 'Salvar Alterações' : 'Agendar Horário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBlockModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => !loading && setIsBlockModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="text-lg font-bold font-serif text-gray-900 dark:text-white">Bloquear Horário</h2>
              <button
                type="button"
                disabled={loading}
                onClick={() => setIsBlockModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800"
                aria-label="Fechar janela"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBlock}>
              <div className="p-6 space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Isto criará blocos de indisponibilidade para o período. Útil para folgas do dia e pausas.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Profissional *</label>
                  <select
                    required
                    disabled={userRole === 'barber'}
                    value={newBlock.barberId}
                    onChange={e => setNewBlock({ ...newBlock, barberId: e.target.value })}
                    className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white disabled:opacity-70"
                  >
                    <option value="">Selecione...</option>
                    {barbersListOptions.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Início *</label>
                    <input
                      required
                      type="time"
                      value={newBlock.startTime}
                      onChange={e => setNewBlock({ ...newBlock, startTime: e.target.value })}
                      className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Fim (Opcional)</label>
                    <input
                      type="time"
                      value={newBlock.endTime}
                      onChange={e => setNewBlock({ ...newBlock, endTime: e.target.value })}
                      className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm outline-none bg-white dark:bg-zinc-800 text-gray-900 dark:text-white tabular-nums"
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-950/60 border-t border-gray-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={loading}
                  type="submit"
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Bloqueando...' : 'Confirmar Bloqueio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Record Modal */}
      {selectedClientForRecord && (
        <PatientRecordModal
          clientId={selectedClientForRecord.id}
          clientName={selectedClientForRecord.name || 'Paciente'}
          clientPhone={selectedClientForRecord.phone || ''}
          segment={segment}
          onClose={() => setSelectedClientForRecord(null)}
        />
      )}

      <ConfirmModal
        open={Boolean(pendingStatusUpdate)}
        title={
          pendingStatusUpdate?.status === 'cancelled'
            ? 'Cancelar horário?'
            : pendingStatusUpdate?.status === 'blocked'
            ? 'Bloquear horário?'
            : 'Concluir atendimento?'
        }
        description={`Tem certeza que deseja ${
          pendingStatusUpdate?.status === 'cancelled'
            ? 'cancelar'
            : pendingStatusUpdate?.status === 'blocked'
            ? 'bloquear'
            : 'concluir'
        } este horário?`}
        confirmLabel="Confirmar"
        variant={pendingStatusUpdate?.status === 'completed' ? 'warning' : 'danger'}
        loading={updatingStatus}
        onConfirm={handleConfirmStatusUpdate}
        onCancel={() => !updatingStatus && setPendingStatusUpdate(null)}
      />
    </div>
  );
}
