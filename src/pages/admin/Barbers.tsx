import { useState, useEffect, FormEvent } from 'react';
import { Plus, User, Check, X } from 'lucide-react';

export default function Barbers() {
  const [barbers, setBarbers] = useState<any[]>([]);
  const [newBarber, setNewBarber] = useState('');

  const fetchBarbers = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/barbers', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBarbers(data);
        else console.error('Expected array for barbers, got:', data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchBarbers();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBarber) return;
    
    const token = localStorage.getItem('token');
    await fetch('/api/admin/barbers', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: newBarber })
    });
    setNewBarber('');
    fetchBarbers();
  };

  const toggleActive = async (barber: any) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/admin/barbers/${barber.id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ active: !barber.active, name: barber.name })
    });
    fetchBarbers();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Profissionais</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie a equipe da barbearia</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 mb-8">
          <input 
            type="text" 
            value={newBarber}
            onChange={e => setNewBarber(e.target.value)}
            placeholder="Nome do profissional"
            className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 outline-none focus:border-black dark:focus:border-gray-500 transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button type="submit" className="bg-black dark:bg-[#D4AF37] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-[#b0912e] transition-colors">
            <Plus className="w-5 h-5" /> Adicionar
          </button>
        </form>

        <div className="space-y-4">
          {(barbers || []).map(barber => (
            <div key={barber.id} className="flex items-center justify-between p-4 border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 rounded-xl hover:border-gray-200 dark:hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-50 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-400 dark:text-gray-300" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-lg">{barber.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{barber.active ? 'Ativo' : 'Inativo'}</div>
                </div>
              </div>
              <button 
                onClick={() => toggleActive(barber)}
                className={`w-12 h-6 rounded-full relative transition-colors ${barber.active ? 'bg-green-500' : 'bg-gray-200 dark:bg-zinc-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${barber.active ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          ))}
          {(!barbers || barbers.length === 0) && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum profissional cadastrado.</div>
          )}
        </div>
      </div>
    </div>
  );
}
