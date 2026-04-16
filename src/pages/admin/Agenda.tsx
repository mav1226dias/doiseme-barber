import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Scissors, Check, X } from 'lucide-react';

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-serif">Agenda</h1>
          <p className="text-gray-500 mt-1">Gerencie os agendamentos do dia</p>
        </div>
        <input 
          type="date" 
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-200 rounded-xl p-3 outline-none focus:border-black font-medium"
        />
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="space-y-4">
          {(appointments || []).map(apt => (
            <div key={apt.id} className={`flex flex-col md:flex-row md:items-center justify-between p-5 border rounded-xl transition-colors ${
              apt.status === 'cancelled' ? 'bg-red-50 border-red-100 opacity-60' :
              apt.status === 'completed' ? 'bg-green-50 border-green-100' :
              'border-gray-200 hover:border-gray-300'
            }`}>
              <div className="flex items-start gap-4 mb-4 md:mb-0">
                <div className="bg-black text-white px-4 py-2 rounded-lg font-mono font-bold text-lg">
                  {apt.startTime}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-lg">{apt.clientName}</div>
                  <div className="text-gray-500 text-sm flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1"><User className="w-4 h-4" /> {apt.barberName}</span>
                    <span className="flex items-center gap-1"><Scissors className="w-4 h-4" /> {apt.serviceName}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 mt-2">
                    WhatsApp: {apt.clientPhone}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {apt.status === 'scheduled' && (
                  <>
                    <button 
                      onClick={() => updateStatus(apt.id, 'completed')}
                      className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg font-medium hover:bg-green-200 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Concluir
                    </button>
                    <button 
                      onClick={() => updateStatus(apt.id, 'cancelled')}
                      className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors"
                    >
                      <X className="w-4 h-4" /> Cancelar
                    </button>
                  </>
                )}
                {apt.status === 'completed' && (
                  <span className="text-green-700 font-medium px-4 py-2 bg-green-100 rounded-lg">Concluído</span>
                )}
                {apt.status === 'cancelled' && (
                  <span className="text-red-700 font-medium px-4 py-2 bg-red-100 rounded-lg">Cancelado</span>
                )}
              </div>
            </div>
          ))}
          {(!appointments || appointments.length === 0) && (
            <div className="text-center py-12 text-gray-500">
              <CalendarIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              Nenhum agendamento para esta data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
