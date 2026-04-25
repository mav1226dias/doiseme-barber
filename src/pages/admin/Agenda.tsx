// watch triggered
import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Scissors, Check, X, ShieldAlert, Plus } from 'lucide-react';

export default function Agenda() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [barbersListOptions, setBarbersListOptions] = useState<any[]>([]);
  const [servicesListOptions, setServicesListOptions] = useState<any[]>([]);

  // Modals state
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // New Appt form
  const [newAppt, setNewAppt] = useState({
    clientName: '',
    clientPhone: '',
    serviceId: '',
    barberId: '',
    time: '09:00'
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
      .then(data => setBarbersListOptions(data || []))
      .catch(console.error);
    fetch('/api/admin/services', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => setServicesListOptions(data || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchAppointments();
    loadOptions();
  }, [date]);

  const updateStatus = async (id: string, status: string) => {
    if (!window.confirm(`Tem certeza que deseja ${status === 'cancelled' ? 'cancelar' : status === 'blocked' ? 'bloquear' : 'concluir'} este horário?`)) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/admin/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    fetchAppointments();
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          clientName: newAppt.clientName,
          clientPhone: newAppt.clientPhone,
          serviceId: newAppt.serviceId,
          barberId: newAppt.barberId,
          date,
          startTime: newAppt.time
        })
      });
      if (res.ok) {
        setIsApptModalOpen(false);
        setNewAppt({ clientName: '', clientPhone: '', serviceId: '', barberId: '', time: '09:00' });
        fetchAppointments();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao criar');
      }
    } catch (e) {
      alert('Erro de rede');
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
      setIsBlockModalOpen(false);
      setNewBlock({ ...newBlock, startTime: '09:00', endTime: '10:00' });
      fetchAppointments();
    } catch (error) {
      alert('Erro ao bloquear');
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
            onClick={() => setIsApptModalOpen(true)}
            className="flex items-center gap-2 bg-[#D4AF37] text-white px-4 py-2.5 rounded-xl font-medium hover:bg-[#b0912e] transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Marcação
          </button>
          <button 
            onClick={() => setIsBlockModalOpen(true)}
            className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
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
                            {apt.startTime}
                          </div>
                          {!isBlocked ? (
                            <div>
                              <div className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1" title={apt.clientName}>{apt.clientName}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{apt.serviceName}</div>
                              {apt.status === 'scheduled' && (
                                <div className="mt-3 flex gap-2">
                                  <button onClick={() => updateStatus(apt.id, 'completed')} className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 flex-1 py-1 rounded font-medium hover:bg-green-200 dark:hover:bg-green-900/50">Concluir</button>
                                  <button onClick={() => updateStatus(apt.id, 'cancelled')} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded font-medium hover:bg-red-200 dark:hover:bg-red-900/50">Cancelar</button>
                                </div>
                              )}
                              {isCompleted && <div className="text-xs font-medium text-green-600 dark:text-green-400 mt-2">Concluído ✓</div>}
                              {isCancelled && <div className="text-xs font-medium text-red-500 dark:text-red-400 mt-2">Cancelado ✖</div>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-zinc-800">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100">Nova Marcação</h2>
              <button onClick={() => setIsApptModalOpen(false)} className="text-gray-500"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateAppointment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input required type="text" value={newAppt.clientName} onChange={e => setNewAppt({...newAppt, clientName: e.target.value})} className="w-full border rounded-xl p-2 outline-none dark:bg-zinc-800 dark:border-zinc-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input required type="text" value={newAppt.clientPhone} onChange={e => setNewAppt({...newAppt, clientPhone: e.target.value})} className="w-full border rounded-xl p-2 outline-none dark:bg-zinc-800 dark:border-zinc-700 font-mono" placeholder="5511999999999" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profissional</label>
                <select required value={newAppt.barberId} onChange={e => setNewAppt({...newAppt, barberId: e.target.value})} className="w-full border rounded-xl p-2 outline-none dark:bg-zinc-800 dark:border-zinc-700">
                  <option value="">Selecione...</option>
                  {barbersListOptions.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serviço</label>
                <select required value={newAppt.serviceId} onChange={e => setNewAppt({...newAppt, serviceId: e.target.value})} className="w-full border rounded-xl p-2 outline-none dark:bg-zinc-800 dark:border-zinc-700">
                  <option value="">Selecione...</option>
                  {servicesListOptions.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - R${s.price}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horário de Início</label>
                <input required type="time" value={newAppt.time} onChange={e => setNewAppt({...newAppt, time: e.target.value})} className="w-full border rounded-xl p-2 outline-none dark:bg-zinc-800 dark:border-zinc-700" />
              </div>
              <button disabled={loading} type="submit" className="w-full py-3 bg-[#D4AF37] text-white rounded-xl font-bold hover:bg-[#b0912e] transition-colors disabled:opacity-50 mt-4">
                {loading ? 'Salvando...' : 'Salvar Agendamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 dark:border-zinc-800">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100">Bloquear Horário</h2>
              <button onClick={() => setIsBlockModalOpen(false)} className="text-gray-500"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateBlock} className="p-6 space-y-4">
              <p className="text-sm text-gray-500 mb-4">Isto criará blocos de indisponibilidade para o período. Útil para folgas do dia e pausas.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profissional</label>
                <select required value={newBlock.barberId} onChange={e => setNewBlock({...newBlock, barberId: e.target.value})} className="w-full border rounded-xl p-2 outline-none dark:bg-zinc-800 dark:border-zinc-700">
                  <option value="">Selecione...</option>
                  {barbersListOptions.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                  <input required type="time" value={newBlock.startTime} onChange={e => setNewBlock({...newBlock, startTime: e.target.value})} className="w-full border rounded-xl p-2 outline-none dark:bg-zinc-800 dark:border-zinc-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fim (Opcional)</label>
                  <input type="time" value={newBlock.endTime} onChange={e => setNewBlock({...newBlock, endTime: e.target.value})} className="w-full border rounded-xl p-2 outline-none dark:bg-zinc-800 dark:border-zinc-700" />
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 mt-4">
                {loading ? 'Bloqueando...' : 'Confirmar Bloqueio'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
