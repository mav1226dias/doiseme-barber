import React, { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Wallet, Calendar } from 'lucide-react';

const CATEGORIES = [
  { id: 'rent', label: 'Aluguel' },
  { id: 'supplies', label: 'Materiais/Produtos' },
  { id: 'utilities', label: 'Luz/Água/Internet' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'other', label: 'Outros' }
];

export default function Finances() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'other',
    date: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCommissions: 0,
    totalExpenses: 0,
    netProfit: 0
  });

  const fetchFinances = async () => {
    const token = localStorage.getItem('token');
    
    // Fetch summary stats from dashboard API
    fetch('/api/admin/dashboard', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);

    // Fetch expenses
    fetch('/api/admin/expenses', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setExpenses(data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchFinances();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newExpense)
      });
      if (res.ok) {
        setNewExpense({
          description: '',
          amount: '',
          category: 'other',
          date: new Date().toISOString().split('T')[0]
        });
        fetchFinances();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Excluir esta despesa?')) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/admin/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchFinances();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Contabilidade</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as finanças, comissões e despesas da barbearia</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-gray-500 font-medium">Receita Bruta</h3>
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">R$ {stats.totalRevenue?.toFixed(2) || '0.00'}</div>
          <div className="mt-2 text-xs text-gray-400">Últimos 30 dias</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-gray-500 font-medium">Comissões</h3>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">R$ {stats.totalCommissions?.toFixed(2) || '0.00'}</div>
          <div className="mt-2 text-xs text-gray-400">Pago aos barbeiros</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-gray-500 font-medium">Despesas</h3>
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">R$ {stats.totalExpenses?.toFixed(2) || '0.00'}</div>
          <div className="mt-2 text-xs text-gray-400">Custos fixos e extras</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm border-l-4 border-l-[#D4AF37]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-gray-500 font-medium">Lucro Líquido</h3>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
              <Wallet className="w-5 h-5 text-[#D4AF37]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">R$ {stats.netProfit?.toFixed(2) || '0.00'}</div>
          <div className="mt-2 text-xs text-gray-400 font-medium text-[#D4AF37]">Saldo final do negócio</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* New Expense Form */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm sticky top-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#D4AF37]" /> Lançar Despesa
            </h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <input 
                  type="text" 
                  value={newExpense.description}
                  onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                  placeholder="Ex: Aluguel da sala"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={newExpense.amount}
                  onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                  placeholder="0,00"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                <select 
                  value={newExpense.category}
                  onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
                <input 
                  type="date" 
                  value={newExpense.date}
                  onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-black dark:bg-[#D4AF37] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                Adicionar Despesa
              </button>
            </form>
          </div>
        </div>

        {/* Expenses List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Registro de Despesas</h2>
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {expenses.map(expense => (
                <div key={expense.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">{expense.description}</h4>
                      <div className="flex gap-3 text-sm text-gray-500 mt-1">
                        <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs capitalize">{expense.category}</span>
                        <span>{expense.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-lg font-bold text-red-500">- R$ {expense.amount.toFixed(2)}</div>
                    <button 
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && (
                <div className="p-12 text-center text-gray-500">Nenhuma despesa registrada.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
