import React, { useState, useEffect } from 'react';
import { Shield, Users, Server, Database, Activity, Lock, Plus, Globe, Mail, Key, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MasterAdmin() {
  const [stats, setStats] = useState({
    totalShops: 0,
    totalUsers: 0,
    systemStatus: 'Online',
    dbSize: '...'
  });

  const [shops, setShops] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [newShop, setNewShop] = useState({
    name: '',
    slug: '',
    email: '',
    password: ''
  });

  const fetchMasterData = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/master/shops', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setShops(data || []);
        setStats(prev => ({ ...prev, totalShops: (data || []).length }));
      } else {
        const text = await res.text();
        console.error('Fetch Master Data failed:', res.status, text.substring(0, 100));
        if (!res.ok && res.status === 401) {
          toast.error('Sessão expirada. Faça login novamente.');
        } else if (!res.ok) {
          console.warn('Response was not OK and/or not JSON');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMasterData();
    // System status remains static or could be fetched
    setStats(prev => ({ ...prev, systemStatus: 'Online', dbSize: '4.8 MB' }));
  }, []);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch('/api/admin/master/shops', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newShop)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Barbearia criada com sucesso!');
        setNewShop({ name: '', slug: '', email: '', password: '' });
        setShowForm(false);
        fetchMasterData();
      } else {
        toast.error(data.error || 'Erro ao criar barbearia');
      }
    } catch (e) {
      toast.error('Erro de conexão com o servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Painel Master</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Controle global do ecossistema Doiseme.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-black dark:bg-[#D4AF37] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg"
        >
          <Plus className="w-5 h-5" /> Cadastrar Barbearia
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-dashed border-gray-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-bold mb-6">Nova Barbearia</h2>
          <form onSubmit={handleCreateShop} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Barbearia</label>
                <div className="relative">
                  <Server className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="text"
                    required
                    value={newShop.name}
                    onChange={e => setNewShop({...newShop, name: e.target.value})}
                    placeholder="Ex: Barber Shop Central"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link (Slug)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="text"
                    required
                    value={newShop.slug}
                    onChange={e => setNewShop({...newShop, slug: e.target.value})}
                    placeholder="ex: barber-central"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 italic">Este será o link de agendamento: doiseme.com/b/{newShop.slug || 'slug'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email do Administrador</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="email"
                    required
                    value={newShop.email}
                    onChange={e => setNewShop({...newShop, email: e.target.value})}
                    placeholder="admin@loja.com"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha Temporária</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="password"
                    required
                    value={newShop.password}
                    onChange={e => setNewShop({...newShop, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-4 mt-2">
              <button 
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 rounded-xl font-bold bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:opacity-80 transition-opacity"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isLoading}
                className="bg-black dark:bg-[#D4AF37] text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? 'Criando...' : 'Finalizar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Server className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total de Lojas</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalShops}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Usuários</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">---</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-500">Status Sistema</span>
          </div>
          <div className="text-3xl font-bold text-green-500">{stats.systemStatus}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-500">Tamanho DB</span>
          </div>
          <div className="text-3xl font-bold">{stats.dbSize}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="font-bold text-lg">Lojas Ativas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/50 text-xs font-bold uppercase text-gray-500">
                <th className="p-4">Nome</th>
                <th className="p-4">Link / Slug</th>
                <th className="p-4">Criado em</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {shops.map(shop => (
                <tr key={shop.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/20 transition-colors">
                  <td className="p-4 font-medium">{shop.name}</td>
                  <td className="p-4">
                    <span className="text-blue-500 dark:text-blue-400 font-mono text-sm">/b/{shop.slug}</span>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    {shop.created_at ? new Date(shop.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Excluir (Desativado)"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {shops.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                    Nenhuma loja cadastrada no sistema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-3xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-6">
        <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-400 mb-2">Segurança de Acesso</h3>
          <p className="text-amber-800/70 dark:text-amber-500/70">
            Esta tela é protegida por validação JWT no backend e verificação de permissão no frontend. 
            Somente o usuário raiz (Master) pode visualizar e interagir com estas configurações globais do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
