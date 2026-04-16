import { useState, useEffect } from 'react';
import { Users, DollarSign, Calendar as CalendarIcon } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalAppointments: 0,
    totalRevenue: 0,
    appointmentsByBarber: [] as any[]
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) console.error('Dashboard error:', data.error);
        else setStats(data);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 font-serif">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base text-gray-500 font-medium">Total de Agendamentos</h3>
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0 ml-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalAppointments}</div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base text-gray-500 font-medium">Faturamento Total</h3>
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center shrink-0 ml-2">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">
            R$ {stats.totalRevenue.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-gray-900 mb-4 sm:mb-6 font-serif">Atendimentos por Profissional</h3>
        <div className="space-y-3 sm:space-y-4">
          {(stats.appointmentsByBarber || []).map((barber, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200">
                  <Users className="w-5 h-5 text-gray-500" />
                </div>
                <span className="font-medium text-gray-900">{barber.name}</span>
              </div>
              <div className="font-bold text-gray-900">{barber.count} agendamentos</div>
            </div>
          ))}
          {(!stats.appointmentsByBarber || stats.appointmentsByBarber.length === 0) && (
            <div className="text-gray-500 text-center py-4">Nenhum dado disponível</div>
          )}
        </div>
      </div>
    </div>
  );
}
