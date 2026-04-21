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
      .then(res => res.json())
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
        <h1 className="text-3xl font-bold text-gray-900 font-serif">Serviços</h1>
        <p className="text-gray-500 mt-1">Gerencie os serviços oferecidos</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <input 
            type="text" 
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nome do serviço"
            className="border border-gray-200 rounded-xl p-3 outline-none focus:border-black"
          />
          <input 
            type="number" 
            value={formData.duration}
            onChange={e => setFormData({ ...formData, duration: e.target.value })}
            placeholder="Duração (min)"
            className="border border-gray-200 rounded-xl p-3 outline-none focus:border-black"
          />
          <input 
            type="number" 
            step="0.01"
            value={formData.price}
            onChange={e => setFormData({ ...formData, price: e.target.value })}
            placeholder="Valor (R$)"
            className="border border-gray-200 rounded-xl p-3 outline-none focus:border-black"
          />
          <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
            <Plus className="w-5 h-5" /> Adicionar
          </button>
        </form>

        <div className="space-y-4">
          {(services || []).map(service => (
            <div key={service.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                  <Scissors className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-lg">{service.name}</div>
                  <div className="text-sm text-gray-500">{service.durationMinutes} minutos</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="font-bold text-gray-900 text-lg">R$ {service.price.toFixed(2)}</div>
                <button 
                  onClick={() => handleDelete(service.id)}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {(!services || services.length === 0) && (
            <div className="text-center py-8 text-gray-500">Nenhum serviço cadastrado.</div>
          )}
        </div>
      </div>
    </div>
  );
}
