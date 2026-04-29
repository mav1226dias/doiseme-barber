import { useState, useEffect, FormEvent } from 'react';
import { Plus, Scissors, Trash2 } from 'lucide-react';

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: '', duration: '', price: '' });

  const fetchServices = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/services', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
          return [];
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
      })
      .then(data => {
        if (Array.isArray(data)) setServices(data);
        else console.error('Expected array for services, got:', data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.duration || !formData.price) return;
    
    const token = localStorage.getItem('token');
    await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: formData.name,
        durationMinutes: parseInt(formData.duration),
        price: parseFloat(formData.price)
      })
    });
    setFormData({ name: '', duration: '', price: '' });
    fetchServices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/admin/services/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchServices();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Serviços</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie os serviços oferecidos</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <input 
            type="text" 
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nome do serviço"
            className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 outline-none focus:border-black dark:focus:border-gray-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <input 
            type="number" 
            value={formData.duration}
            onChange={e => setFormData({ ...formData, duration: e.target.value })}
            placeholder="Duração (min)"
            className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 outline-none focus:border-black dark:focus:border-gray-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <input 
            type="number" 
            step="0.01"
            value={formData.price}
            onChange={e => setFormData({ ...formData, price: e.target.value })}
            placeholder="Valor (R$)"
            className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 outline-none focus:border-black dark:focus:border-gray-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button type="submit" className="bg-black dark:bg-[#D4AF37] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-[#b0912e] transition-colors">
            <Plus className="w-5 h-5" /> Adicionar
          </button>
        </form>

        <div className="space-y-4">
          {(services || []).map(service => (
            <div key={service.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 rounded-xl hover:border-gray-200 dark:hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-700 rounded-full flex items-center justify-center shrink-0">
                  <Scissors className="w-6 h-6 text-gray-400 dark:text-gray-300" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-lg">{service.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{service.durationMinutes} minutos</div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                <div className="font-bold text-gray-900 dark:text-gray-100 text-lg">R$ {service.price.toFixed(2)}</div>
                <button 
                  onClick={() => handleDelete(service.id)}
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {(!services || services.length === 0) && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum serviço cadastrado.</div>
          )}
        </div>
      </div>
    </div>
  );
}
