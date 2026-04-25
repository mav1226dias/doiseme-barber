import { useState, useEffect } from 'react';
import { Bell, MessageCircle, AlertCircle } from 'lucide-react';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [loadingInactive, setLoadingInactive] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/notifications', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => {
        if (Array.isArray(data)) setNotifications(data);
        else console.error('Expected array for notifications, got:', data);
      })
      .catch(console.error);
      
    // Fetch inactive clients
    setLoadingInactive(true);
    fetch('/api/admin/inactive-clients', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => {
        if (Array.isArray(data)) setInactiveClients(data);
      })
      .catch(console.error)
      .finally(() => setLoadingInactive(false));
  }, []);

  const getNotificationData = (messageStr: string) => {
    try {
      if (messageStr.startsWith('{')) {
        return JSON.parse(messageStr);
      }
    } catch(e) { }
    // Fallback if old plain string
    return { text: messageStr };
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Notificações Inteligentes</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Acompanhe as novidades, alertas e automações</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-zinc-800">
          {(notifications || []).map(notif => {
            const data = getNotificationData(notif.message);
            let whatsappUrl = '';
            
            // Format phone properly 55 + number
            if (data.clientPhone || notif.phone) {
              const rawPhone = (data.clientPhone || notif.phone).replace(/\D/g, '');
              const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
              if (data.clientName && data.date && data.time && data.barberName) {
                const msg = `Fala ${data.clientName}, seu horário foi marcado para as ${data.time} com o ${data.barberName}. Estamos te aguardando!`;
                whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
              } else {
                whatsappUrl = `https://wa.me/${cleanPhone}`;
              }
            }

            return (
              <div key={notif.id} className={`p-6 flex items-start gap-4 transition-colors ${notif.read ? 'bg-white dark:bg-zinc-900' : 'bg-blue-50/50 dark:bg-blue-900/10'}`}>
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {notif.type === 'new_appointment' ? 'Novo Agendamento' : 'Alerta de Cliente'}
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(notif.createdAt || notif.created_at || new Date()).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{data.text}</p>
                  
                  {whatsappUrl && (
                    <a 
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#20bd5a] transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" /> Enviar WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {(!notifications || notifications.length === 0) && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Nenhuma notificação no momento.
            </div>
          )}
        </div>
      </div>
      
      {/* Automação: Clientes inativos há mais de 20 dias */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-serif mb-4 flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-[#D4AF37]" />
          Clientes Inativos {`> 20 dias`}
        </h2>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden p-6">
          {loadingInactive ? (
            <p className="text-gray-500 dark:text-gray-400 animate-pulse">Buscando clientes inativos...</p>
          ) : inactiveClients.length > 0 ? (
            <div className="space-y-4">
              {inactiveClients.map((client, idx) => {
                const rawPhone = (client.phone || '').replace(/\D/g, '');
                const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
                const msg = `Oi, sou o ${client.lastBarberName || 'Barbeiro'} da Doiseme Barber Shop. Vi que está chegando a hora de dar um trato no visual. Vamos marcar um horário?`;
                const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

                return (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50/50 dark:bg-red-900/10 border border-red-100/50 dark:border-red-900/20 rounded-xl gap-4">
                    <div>
                      <div className="font-bold text-red-900 dark:text-red-300">{client.name}</div>
                      <div className="text-sm text-red-700/80 dark:text-red-400/80 mt-1">Último atendimento: {client.lastDate} com {client.lastBarberName}</div>
                    </div>
                    <a 
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#20bd5a] transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4" /> Chamar WhatsApp
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Nenhum cliente inativo há mais de 20 dias.</p>
          )}
        </div>
      </div>
    </div>
  );
}
