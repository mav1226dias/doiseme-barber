// watch triggered
import React, { useState, useEffect } from 'react';
import { Target, Plus, MessageCircle, Trash2, Calendar } from 'lucide-react';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // View specific campaign
  const [activeCampaign, setActiveCampaign] = useState<any | null>(null);

  // Form
  const [name, setName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('Olá (cliente), estamos com novidades...');
  const [daysActive, setDaysActive] = useState(7);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    
    // Fetch Campaigns
    fetch(`/api/admin/campaigns`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(console.error);

    // Fetch Clients for the lists
    fetch(`/api/admin/clients`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setClients(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
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
        fetchData();
      } else {
        alert('Erro ao criar campanha');
      }
    } catch (err) {
      alert('Erro de rede na criação');
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm('Tem certeza? A campanha será apagada (isto não afeta as mensagens já enviadas).')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/admin/campaigns/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // Remove if we are viewing it
    if (activeCampaign && activeCampaign.id === id) setActiveCampaign(null);
    fetchData();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Campanhas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Envio em massa com mensagens dinâmicas</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#D4AF37] text-white px-4 py-2 rounded-xl font-medium hover:bg-[#b0912e] transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova Campanha
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaigns List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Campanhas Ativas</h2>
          {campaigns.length === 0 ? (
            <div className="p-6 border border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl text-center text-gray-500 dark:text-gray-400">
              <Target className="w-8 h-8 mx-auto mb-3 opacity-50" />
              Nenhuma campanha ativa.
            </div>
          ) : (
            campaigns.map(camp => {
              const data = JSON.parse(camp.message);
              const isActive = activeCampaign?.id === camp.id;
              
              return (
                <div 
                  key={camp.id}
                  onClick={() => setActiveCampaign(camp)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-colors ${isActive ? 'bg-[#D4AF37]/10 border-[#D4AF37] ring-1 ring-[#D4AF37]' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-[#D4AF37]/50'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{camp.title}</h3>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(camp.id); }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Expira em: {new Date(data.expiresAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Campaign Execution Area */}
        <div className="lg:col-span-2">
          {activeCampaign ? (
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100 mb-2">Execução: {activeCampaign.title}</h2>
              <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 mb-6">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Modelo da Mensagem (Preview):</p>
                <p className="text-gray-900 dark:text-gray-100 font-mono text-sm whitespace-pre-wrap">
                  {JSON.parse(activeCampaign.message).template}
                </p>
              </div>

              <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="bg-gray-50 dark:bg-zinc-800/80 p-3 border-b border-gray-200 dark:border-zinc-800 font-medium text-sm text-gray-600 dark:text-gray-300">
                  Base de Clientes ({clients.length})
                </div>
                <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
                  {clients.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">Nenhum cliente cadastrado.</div>
                  ) : (
                    clients.map(c => {
                      const template = JSON.parse(activeCampaign.message).template || '';
                      // Replace "(cliente)" with actual name
                      const messageBody = template.replace(/\(cliente\)/gi, c.name || 'Cliente');
                      
                      const rawPhone = (c.phone || '').replace(/\D/g, '');
                      const cleanPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
                      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageBody)}`;

                      return (
                        <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <div>
                            <div className="font-bold text-gray-900 dark:text-gray-100">{c.name || 'Sem nome'}</div>
                            <div className="text-sm text-gray-500 font-mono">{c.phone}</div>
                          </div>
                          
                          <a 
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-shrink-0 items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#20bd5a] transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" /> Enviar Mensagem
                          </a>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[300px] border border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-6 text-center">
              <MessageCircle className="w-12 h-12 mb-4 opacity-50" />
              <p>Selecione uma campanha na lista ao lado para começar os disparos.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-zinc-800">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-gray-100">Criar Nova Campanha</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Campanha</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Promocao Dia dos Pais"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem Base</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Utilize a palavra <span className="font-mono bg-gray-100 dark:bg-zinc-700 px-1 rounded text-red-500">(cliente)</span> para que o sistema substitua automaticamente pelo nome real de cada um na hora do envio.</p>
                <textarea 
                  required
                  rows={4}
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duração Ativa (Dias)</label>
                <input 
                  type="number" 
                  min="1"
                  max="30"
                  required
                  value={daysActive}
                  onChange={e => setDaysActive(Number(e.target.value))}
                  className="w-full border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-3 outline-none focus:border-[#D4AF37]"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#D4AF37] text-white rounded-xl font-bold hover:bg-[#b0912e] transition-colors disabled:opacity-50"
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
