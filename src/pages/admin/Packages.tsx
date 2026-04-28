import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Smartphone, User, Scissors, Package, CreditCard, CheckCircle2 } from 'lucide-react';

export default function Packages() {
  const [packages, setPackages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [newPackage, setNewPackage] = useState({
    clientName: '',
    clientWhatsapp: '',
    packageName: '',
    totalQuantity: 3,
    pricePaid: ''
  });

  const fetchPackages = async () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/packages', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPackages(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackage.clientName || !newPackage.clientWhatsapp || !newPackage.packageName || !newPackage.pricePaid) {
      alert('Preencha todos os campos');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newPackage)
      });
      if (res.ok) {
        setNewPackage({
          clientName: '',
          clientWhatsapp: '',
          packageName: '',
          totalQuantity: 3,
          pricePaid: ''
        });
        fetchPackages();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/packages/search?whatsapp=${searchQuery}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSearchResults(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUsePackage = async (id: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/packages/use/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        handleSearch(); // Refresh search results
        fetchPackages(); // Refresh listing
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Excluir este pacote permanentemente?')) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/admin/packages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchPackages();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Pacotes de Serviços</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie planos pré-pagos e fidelidade dos clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-[#D4AF37]" /> Novo Pacote
            </h2>
            <form onSubmit={handleAddPackage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Cliente</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={newPackage.clientName}
                    onChange={e => setNewPackage({...newPackage, clientName: e.target.value})}
                    placeholder="Nome completo"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp (Filtro)</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={newPackage.clientWhatsapp}
                    onChange={e => setNewPackage({...newPackage, clientWhatsapp: e.target.value})}
                    placeholder="Somente números"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Pacote</label>
                <input 
                  type="text" 
                  value={newPackage.packageName}
                  onChange={e => setNewPackage({...newPackage, packageName: e.target.value})}
                  placeholder="Ex: Combo 3 Cortes"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantidade</label>
                  <input 
                    type="number" 
                    value={newPackage.totalQuantity}
                    onChange={e => setNewPackage({...newPackage, totalQuantity: Number(e.target.value)})}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Pago (R$)</label>
                  <input 
                    type="number" 
                    value={newPackage.pricePaid}
                    onChange={e => setNewPackage({...newPackage, pricePaid: e.target.value})}
                    placeholder="0,00"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-black dark:bg-[#D4AF37] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                Registrar Pacote
              </button>
            </form>
          </div>

          {/* Quick Search for Deduction */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm mt-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" /> Baixar Uso
            </h2>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="WhatsApp do cliente"
                className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none focus:border-blue-500"
              />
              <button 
                onClick={handleSearch}
                className="bg-blue-500 text-white p-2 rounded-xl"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {searchResults.map(res => (
                <div key={res.id} className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700">
                  <div className="font-bold text-sm">{res.package_name}</div>
                  <div className="text-xs text-gray-500 mb-2">{res.client_name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-blue-600">{res.remaining_quantity} / {res.total_quantity}</span>
                    <button 
                      onClick={() => handleUsePackage(res.id)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-600 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Usar 1
                    </button>
                  </div>
                </div>
              ))}
              {searchQuery && searchResults.length === 0 && (
                <p className="text-center text-sm text-gray-500 p-4">Nenhum pacote ativo encontrado.</p>
              )}
            </div>
          </div>
        </div>

        {/* Listing */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pacotes Ativos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">
                  <tr>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Pacote</th>
                    <th className="px-6 py-4">Saldos</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {packages.map(pkg => (
                    <tr key={pkg.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 dark:text-gray-100">{pkg.client_name}</div>
                        <div className="text-xs text-gray-500">{pkg.client_whatsapp}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">{pkg.package_name}</div>
                        <div className="text-xs text-gray-400">R$ {pkg.price_paid.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-500" 
                              style={{ width: `${(pkg.remaining_quantity / pkg.total_quantity) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold">{pkg.remaining_quantity}/{pkg.total_quantity}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {packages.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">Nenhum pacote registrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
