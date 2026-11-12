import React, { useState, useEffect } from 'react';
import { 
  Target, Plus, MessageCircle, Trash2, Calendar, 
  Bell, AlertCircle, Megaphone, Users, Clock, Send, Sparkles 
} from 'lucide-react';

export default function Campaigns() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'notifications'>('campaigns');
  
  // Campaigns State
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('Olá (cliente), estamos com novidades...');
  const [daysActive, setDaysActive] = useState(7);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [inactiveClients, setInactiveClients] = useState<any[]>([]);
  const [loadingInactive, setLoadingInactive] = useState(false);

  const fetchCampaignsAndClients = async () => {
    const token = localStorage.getItem('token');
    
    // Fetch Campaigns
    fetch(`/api/admin/campaigns`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(console.error);

    // Fetch Clients for the lists
    fetch(`/api/admin/clients`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => setClients(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const fetchNotificationsAndInactive = async () => {
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
      })
      .catch(console.error);
      
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
  };

  useEffect(() => {
    fetchCampaignsAndClients();
    fetchNotificationsAndInactive();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, messageTemplate, daysActive })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setName('');
        setMessageTemplate('Olá (cliente), estamos com novidades...');
        setDaysActive(7);
        fetchCampaignsAndClients();
      } else {
        alert('Erro ao criar campanha');
      }
    } catch (err) {
      alert('Erro de rede na criação');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza? A campanha será apagada (isto não afeta as mensagens já enviadas).')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/admin/campaigns/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (activeCampaign && activeCampaign.id === id) setActiveCampaign(null);
    fetchCampaignsAndClients();
  };

  const getNotificationData = (messageStr: string) => {
    try {
      if (messageStr.startsWith('{')) {
        return JSON.parse(messageStr);
      }
    } catch(e) { }
    return { text: messageStr };
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            Marketing & Mensagens
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Central de comunicação, disparos de WhatsApp e avisos inteligentes
          </p>
        </div>

        {activeTab === 'campaigns' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-black dark:bg-[#D4AF37] text-white dark:text-black px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm active:scale-95 text-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Nova Campanha
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 gap-4">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'campaigns'
              ? 'border-black dark:border-[#D4AF37] text-black dark:text-[#D4AF37]'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Campanhas de WhatsApp</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 font-mono">
            {campaigns.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'notifications'
              ? 'border-black dark:border-[#D4AF37] text-black dark:text-[#D4AF37]'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notificações & Alertas</span>
          {unreadNotificationsCount > 0 ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-mono font-bold">
              {unreadNotificationsCount}
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 font-mono">
              {notifications.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CAMPANHAS */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaigns List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">Campanhas Criadas</h2>
            {campaigns.length === 0 ? (
              <div className="p-8 border border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl text-center text-gray-500 dark:text-gray-400">
                <Target className="w-8 h-8 mx-auto mb-3 opacity-40 text-[#D4AF37]" />
                <p className="text-sm font-medium">Nenhuma campanha ativa.</p>
                <p className="text-xs text-gray-400 mt-1">Clique em "Nova Campanha" para criar disparos personalizados.</p>
              </div>
            ) : (
              campaigns.map(camp => {
                let data: any = {};
                try {
                  data = JSON.parse(camp.message);
                } catch(e) {
                  data = { template: camp.message };
                }
                const isActive = activeCampaign?.id === camp.id;
                
                return (
                  <div 
                    key={camp.id}
                    onClick={() => setActiveCampaign(camp)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isActive 
                        ? 'bg-[#D4AF37]/10 border-[#D4AF37] ring-1 ring-[#D4AF37]' 
                        : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-[#D4AF37]/50 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-1">{camp.title}</h3>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(camp.id); }} 
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded-lg transition-colors"
                        title="Excluir campanha"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> 
                      Expira em: {data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('pt-BR') : 'Sem data'}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Campaign Execution Area */}
          <div className="lg:col-span-2">
            {activeCampaign ? (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100">
                    Disparo: {activeCampaign.title}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Envie a mensagem diretamente via WhatsApp com o nome do cliente preenchido.
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Modelo da Mensagem
                  </p>
                  <p className="text-gray-800 dark:text-gray-200 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                    {(() => {
                      try {
                        return JSON.parse(activeCampaign.message).template || activeCampaign.message;
                      } catch {
                        return activeCampaign.message;
                      }
                    })()}
                  </p>
                </div>

                <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 dark:bg-zinc-800/80 px-4 py-3 border-b border-gray-200 dark:border-zinc-800 font-medium text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider">Base de Contatos ({clients.length})</span>
                    <span className="text-[11px] text-gray-500">1 clique para abrir o WhatsApp</span>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
                    {clients.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm">Nenhum cliente cadastrado no momento.</div>
                    ) : (
                      clients.map(c => {
                        let template = '';
                        try {
                          template = JSON.parse(activeCampaign.message).template || '';
                        } catch {
                          template = activeCampaign.message || '';
                        }
                        const messageBody = template.replace(/\(cliente\)/gi, c.name || 'Cliente');
                        const rawPhone = (c.phone || '').replace(/\D/g, '');
                        const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
                        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageBody)}`;

                        return (
                          <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                            <div>
                              <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{c.name || 'Sem nome'}</div>
                              <div className="text-xs text-gray-500 font-mono">{c.phone || 'Sem telefone'}</div>
                            </div>
                            
                            <a 
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex flex-shrink-0 items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#20bd5a] transition-all active:scale-95 shadow-sm"
                            >
                              <MessageCircle className="w-4 h-4" /> Enviar Mensagem
                            </a>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] border border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-8 text-center bg-white dark:bg-zinc-900/50">
                <MessageCircle className="w-12 h-12 mb-4 opacity-30 text-[#D4AF37]" />
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-1">Selecione uma campanha</h3>
                <p className="text-xs text-gray-400 max-w-sm">
                  Escolha uma campanha na coluna ao lado para visualizar a prévia e começar os disparos para seus clientes.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NOTIFICAÇÕES & ALERTAS */}
      {activeTab === 'notifications' && (
        <div className="space-y-8">
          {/* Feed de Notificações */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#D4AF37]" /> Histórico de Agendamentos & Avisos
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {(notifications || []).map(notif => {
                  const data = getNotificationData(notif.message);
                  let whatsappUrl = '';
                  
                  if (data.clientPhone || notif.phone) {
                    const rawPhone = (data.clientPhone || notif.phone).replace(/\D/g, '');
                    const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
                    if (data.clientName && data.date && data.time && data.barberName) {
                      const msg = `Olá ${data.clientName}, seu agendamento foi marcado para as ${data.time} com ${data.barberName}. Estamos te aguardando!`;
                      whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                    } else {
                      whatsappUrl = `https://wa.me/${cleanPhone}`;
                    }
                  }

                  return (
                    <div key={notif.id} className={`p-5 flex items-start gap-4 transition-colors ${notif.read ? 'bg-white dark:bg-zinc-900' : 'bg-amber-50/40 dark:bg-amber-950/20'}`}>
                      <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-700 dark:text-amber-400">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                            {notif.type === 'new_appointment' ? 'Novo Agendamento Confirmado' : 'Aviso do Sistema'}
                          </h4>
                          <span className="text-xs text-gray-400">
                            {new Date(notif.createdAt || notif.created_at || new Date()).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-xs mb-3">{data.text}</p>
                        
                        {whatsappUrl && (
                          <a 
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#20bd5a] transition-all"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Lembrar no WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!notifications || notifications.length === 0) && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                    Nenhuma notificação registrada recentemente.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Automação: Clientes inativos há mais de 20 dias */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Recuperação de Clientes Inativos ({`> 20 dias`})
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-6">
              {loadingInactive ? (
                <p className="text-gray-500 text-sm animate-pulse">Buscando clientes inativos...</p>
              ) : inactiveClients.length > 0 ? (
                <div className="space-y-3">
                  {inactiveClients.map((client, idx) => {
                    const rawPhone = (client.phone || '').replace(/\D/g, '');
                    const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
                    const msg = `Olá, faz algum tempo que não nos vemos! Vamos agendar o seu próximo atendimento para manter o seu cuidado em dia?`;
                    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl gap-4">
                        <div>
                          <div className="font-bold text-red-900 dark:text-red-300 text-sm">{client.name}</div>
                          <div className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5">
                            Último atendimento: {client.lastDate} {client.lastBarberName ? `com ${client.lastBarberName}` : ''}
                          </div>
                        </div>
                        <a 
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#20bd5a] transition-all whitespace-nowrap active:scale-95 shadow-sm"
                        >
                          <MessageCircle className="w-4 h-4" /> Reengajar no WhatsApp
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 text-sm">
                  Nenhum cliente está inativo há mais de 20 dias no momento.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Campanha */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-zinc-800">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100">Criar Nova Campanha</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Nome da Campanha
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Promoção Volta às Aulas / Especial do Mês"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Mensagem Base
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Utilize o marcador <span className="font-mono bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-red-500 font-bold">(cliente)</span> para substituir dinamicamente pelo nome de cada cliente.
                </p>
                <textarea 
                  required
                  rows={4}
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                  Duração Ativa (Dias)
                </label>
                <input 
                  type="number" 
                  min="1"
                  max="60"
                  required
                  value={daysActive}
                  onChange={e => setDaysActive(Number(e.target.value))}
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-black dark:bg-[#D4AF37] text-white dark:text-black rounded-xl font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
