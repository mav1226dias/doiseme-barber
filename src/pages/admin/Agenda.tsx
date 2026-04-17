import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Scissors, Check, X, ShieldAlert } from 'lucide-react';

export default function Agenda() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<any[]>([]);

  const fetchAppointments = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/admin/appointments?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAppointments(data);
        else console.error('Expected array for appointments, got:', data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchAppointments();
  }, [date]);

  const updateStatus = async (id: string, status: string) => {
    if (!window.confirm(`Tem certeza que deseja ${status === 'cancelled' ? 'cancelar' : status === 'blocked' ? 'bloquear' : 'concluir'} este horário?`)) return;
    
    const token = localStorage.getItem('token');
    await fetch(`/api/admin/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    fetchAppointments();
  };

  const handleCreateBlock = async (time: string, barberIdStr: string) => {
    const token = localStorage.getItem('token');
    await fetch('/api/admin/appointments/block', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ date, startTime: time, barberId: barberIdStr })
    });
    fetchAppointments();
  };

  // Group by barber
  const barbersMap = new Map();
  appointments.forEach(apt => {
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
        <input 
          type="date" 
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white rounded-xl p-3 outline-none focus:border-black font-medium"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
        
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
                  {barber.apts.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((apt: any) => {
                    const isBlocked = apt.status === 'blocked';
                    const isCancelled = apt.status === 'cancelled';
                    const isCompleted = apt.status === 'completed';

                    let bgColor = 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'; // Scheduled
                    if (isBlocked) bgColor = 'bg-gray-200 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 opacity-60';
                    if (isCancelled) bgColor = 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 opacity-60';
                    if (isCompleted) bgColor = 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20';

                    return (
                      <div key={apt.id} className={`p-4 border rounded-xl relative group transition-colors ${bgColor}`}>
                        
                        {/* Time Badge */}
                        <div className="bg-black dark:bg-zinc-700 text-white dark:text-gray-100 text-xs px-2 py-1 rounded inline-block font-mono font-bold font-tracking-wider mb-2">
                          {apt.startTime}
                        </div>
                        
                        {/* Content */}
                        {!isBlocked ? (
                           <div>
                            <div className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1" title={apt.clientName}>{apt.clientName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{apt.serviceName}</div>
                            
                            {apt.status === 'scheduled' && (
                              <div className="mt-3 flex gap-2">
                                <button onClick={() => updateStatus(apt.id, 'completed')} className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 flex-1 py-1 rounded font-medium hover:bg-green-200 dark:hover:bg-green-900/50">Concluir</button>
                                <button onClick={() => updateStatus(apt.id, 'cancelled')} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded font-medium hover:bg-red-200 dark:hover:bg-red-900/50">Cancelar</button>
                                <button onClick={() => updateStatus(apt.id, 'blocked')} className="text-xs bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded font-medium hover:bg-gray-200 dark:hover:bg-zinc-600" title="Bloquear"><ShieldAlert className="w-4 h-4 mx-auto"/></button>
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
  );
}
