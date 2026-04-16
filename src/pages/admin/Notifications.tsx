import { useState, useEffect } from 'react';
import { Bell, MessageCircle } from 'lucide-react';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/notifications', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotifications(data);
        else console.error('Expected array for notifications, got:', data);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 font-serif">Notificações</h1>
        <p className="text-gray-500 mt-1">Acompanhe as novidades e alertas</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {(notifications || []).map(notif => (
            <div key={notif.id} className={`p-6 flex items-start gap-4 ${notif.read ? 'bg-white' : 'bg-blue-50/50'}`}>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900">
                    {notif.type === 'new_appointment' ? 'Novo Agendamento' : 'Alerta de Cliente'}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {new Date(notif.createdAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-4">{notif.message}</p>
                
                {notif.phone && (
                  <a 
                    href={`https://wa.me/55${notif.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Somos da Doiseme Barber Shop.')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#20bd5a] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> Enviar Mensagem
                  </a>
                )}
              </div>
            </div>
          ))}
          {(!notifications || notifications.length === 0) && (
            <div className="text-center py-12 text-gray-500">
              Nenhuma notificação no momento.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
