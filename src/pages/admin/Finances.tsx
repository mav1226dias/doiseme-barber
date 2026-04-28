import React, { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, Printer, User, FileText } from 'lucide-react';

const CATEGORIES = [
  { id: 'rent', label: 'Aluguel' },
  { id: 'supplies', label: 'Materiais/Produtos' },
  { id: 'utilities', label: 'Luz/Água/Internet' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'draw', label: 'Vale (Adiantamento)' },
  { id: 'other', label: 'Outros' }
];

export default function Finances() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'other',
    date: new Date().toISOString().split('T')[0],
    barberId: ''
  });
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalCommissions: 0,
    totalExpenses: 0,
    totalAppointments: 0,
    netProfit: 0,
    appointmentsByBarber: [] as any[]
  });

  const fetchFinances = async () => {
    const token = localStorage.getItem('token');
    
    // Fetch summary stats from dashboard API
    fetch('/api/admin/dashboard', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        try {
           const data = text ? JSON.parse(text) : {};
           if (data && !data.error) setStats(data);
        } catch (e) { console.error("Parse error dashboard", e); }
      })
      .catch(console.error);

    // Fetch expenses
    fetch('/api/admin/expenses', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        try {
          const data = text ? JSON.parse(text) : [];
          if (Array.isArray(data)) setExpenses(data);
          else setExpenses([]);
        } catch (e) {
          console.error("Parse error expenses", e);
          setExpenses([]);
        }
      })
      .catch(err => {
        console.error(err);
        setExpenses([]);
      });

    // Fetch barbers for draws
    fetch('/api/admin/barbers', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text();
        try {
          const data = text ? JSON.parse(text) : [];
          setBarbers(data);
        } catch (e) { console.error("Parse error barbers", e); }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchFinances();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) return;
    if (newExpense.category === 'draw' && !newExpense.barberId) {
      alert('Selecione o profissional para o vale');
      return;
    }

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
          date: new Date().toISOString().split('T')[0],
          barberId: ''
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Printable Report Section (Hidden in UI) */}
      <div className="hidden print:block print:p-8 bg-white text-black min-h-screen">
        <div className="border-b-4 border-black pb-4 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Relatório Financeiro</h1>
            <p className="text-gray-600 font-medium">Barbearia Master • {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase">Competência</p>
            <p className="text-xl">{new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-8">
          <div className="border-2 border-black p-4">
            <h3 className="font-bold uppercase text-xs mb-2 bg-black text-white p-1 text-center">Entradas Totais</h3>
            <div className="text-2xl font-bold text-center py-2">R$ {stats.totalRevenue.toFixed(2)}</div>
            <div className="text-[10px] text-center text-gray-500 uppercase">{stats.totalAppointments} Atendimentos</div>
          </div>
          <div className="border-2 border-black p-4">
            <h3 className="font-bold uppercase text-xs mb-2 bg-black text-white p-1 text-center">Saídas Totais</h3>
            <div className="text-2xl font-bold text-center py-2 text-red-600">- R$ {(stats.totalExpenses + stats.totalCommissions).toFixed(2)}</div>
            <div className="text-[10px] text-center text-gray-500 uppercase">Custos + Comissões</div>
          </div>
          <div className="border-2 border-black p-4 bg-gray-50">
            <h3 className="font-bold uppercase text-xs mb-2 bg-black text-white p-1 text-center">Lucro Líquido</h3>
            <div className="text-2xl font-black text-center py-2">R$ {stats.netProfit.toFixed(2)}</div>
            <div className="text-[10px] text-center text-gray-400 uppercase">Saldo Final</div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-bold uppercase border-b-2 border-black mb-4 pb-1">Comissões & Acertos por Profissional</h3>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-gray-100">
                <th className="p-2 text-xs uppercase">Profissional</th>
                <th className="p-2 text-xs uppercase">Geral</th>
                <th className="p-2 text-xs uppercase">Comissão %</th>
                <th className="p-2 text-xs uppercase">Bruto</th>
                <th className="p-2 text-xs uppercase">Vales</th>
                <th className="p-2 text-xs uppercase text-right">Líquido a Pagar</th>
              </tr>
            </thead>
            <tbody>
              {(stats.appointmentsByBarber || []).map((barber: any, idx) => {
                const commission = (barber.revenue * (barber.commission_percentage || 50)) / 100;
                const draws = expenses.filter(e => e.category === 'draw' && e.barber_id === barber.id)
                  .reduce((acc, e) => acc + e.amount, 0);
                
                return (
                  <tr key={idx} className="border-b border-gray-300">
                    <td className="p-2 font-bold">{barber.name}</td>
                    <td className="p-2 text-sm">R$ {barber.revenue.toFixed(2)}</td>
                    <td className="p-2 text-sm">{barber.commission_percentage || 50}%</td>
                    <td className="p-2 text-sm">R$ {commission.toFixed(2)}</td>
                    <td className="p-2 text-sm text-red-600">- R$ {draws.toFixed(2)}</td>
                    <td className="p-2 text-right font-black text-lg">R$ {(commission - draws).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="font-bold uppercase border-b-2 border-black mb-4 pb-1">Discriminação de Custos (Saídas)</h3>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-gray-100">
                <th className="p-2 text-xs uppercase">Data</th>
                <th className="p-2 text-xs uppercase">Descrição</th>
                <th className="p-2 text-xs uppercase">Categoria</th>
                <th className="p-2 text-xs uppercase text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="p-2">{expense.date}</td>
                  <td className="p-2">
                    {expense.description}
                    {expense.category === 'draw' && ` (${barbers.find(b => b.id === expense.barber_id)?.name})`}
                  </td>
                  <td className="p-2 uppercase text-[10px]">{CATEGORIES.find(c => c.id === expense.category)?.label}</td>
                  <td className="p-2 text-right font-bold">R$ {expense.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-20 text-center flex justify-around">
          <div className="border-t border-black w-64 pt-2">Assinatura Administrativa</div>
          <div className="border-t border-black w-64 pt-2">Data do Encerramento</div>
        </div>
      </div>

      {/* Main UI Screen Section */}
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Contabilidade</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie as finanças, comissões e despesas da barbearia</p>
          </div>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-black dark:bg-[#D4AF37] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg"
          >
            <Printer className="w-5 h-5" /> Imprimir Relatório
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-8">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-gray-500 font-medium">Receita Bruta</h3>
              <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">R$ {stats.totalRevenue?.toFixed(2) || '0.00'}</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-gray-500 font-medium">Comissões Acordadas</h3>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">R$ {stats.totalCommissions?.toFixed(2) || '0.00'}</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-gray-500 font-medium">Custos & Despesas</h3>
              <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">R$ {stats.totalExpenses?.toFixed(2) || '0.00'}</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm border-l-4 border-l-[#D4AF37]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-gray-500 font-medium">Lucro Líquido</h3>
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                <Wallet className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">R$ {stats.netProfit?.toFixed(2) || '0.00'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Commissions Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" /> Acertos dos Profissionais
                </h2>
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-full uppercase font-bold tracking-wider">
                  Mês Atual
                </span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/30 dark:bg-zinc-800/20">
                {(stats.appointmentsByBarber || []).map((barber: any, idx) => {
                  const comm = (barber.revenue * (barber.commission_percentage || 50)) / 100;
                  const barberDraws = expenses
                    .filter(e => e.category === 'draw' && e.barber_id === barber.id)
                    .reduce((acc, e) => acc + e.amount, 0);

                  return (
                    <div key={idx} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="font-bold text-lg text-gray-900 dark:text-white">{barber.name}</div>
                        <div className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-2 py-1 rounded font-bold">
                          {barber.commission_percentage || 50}% Comissão
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Comissão Bruta</span>
                          <span className="font-medium">R$ {comm.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Vales Retirados</span>
                          <span className="text-red-500">- R$ {barberDraws.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <span className="text-xs font-bold uppercase text-gray-400">Total a Pagar</span>
                        <span className="text-2xl font-black text-blue-600">
                          R$ {(comm - barberDraws).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expenses List */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Fluxo de Caixa (Saídas)</h2>
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                {Array.isArray(expenses) && expenses.map(expense => (
                  <div key={expense.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${expense.category === 'draw' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-zinc-800'}`}>
                        {expense.category === 'draw' ? <Wallet className="w-5 h-5 text-blue-600" /> : <DollarSign className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">
                          {expense.description}
                          {expense.category === 'draw' && (
                            <span className="text-xs font-normal text-blue-500 ml-2">
                              • {barbers.find(b => b.id === expense.barber_id)?.name || 'Profissional'}
                            </span>
                          )}
                        </h4>
                        <div className="flex gap-3 text-sm text-gray-500 mt-1">
                          <span className={`${expense.category === 'draw' ? 'text-blue-600' : ''} uppercase text-[10px] font-bold tracking-wider`}>
                            {CATEGORIES.find(c => c.id === expense.category)?.label}
                          </span>
                          <span>{expense.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className={`text-lg font-bold ${expense.category === 'draw' ? 'text-blue-600' : 'text-red-500'}`}>
                        - R$ {expense.amount.toFixed(2)}
                      </div>
                      <button 
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#D4AF37]" /> Novo Lançamento
              </h2>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                  <select 
                    value={newExpense.category}
                    onChange={e => setNewExpense({...newExpense, category: e.target.value, barberId: e.target.value !== 'draw' ? '' : newExpense.barberId})}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none focus:border-[#D4AF37]"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {newExpense.category === 'draw' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Barbeiro / Profissional</label>
                    <select 
                      value={newExpense.barberId}
                      onChange={e => setNewExpense({...newExpense, barberId: e.target.value})}
                      className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl px-4 py-2 outline-none"
                    >
                      <option value="">Selecione...</option>
                      {barbers.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                  <input 
                    type="text" 
                    value={newExpense.description}
                    onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                    placeholder={newExpense.category === 'draw' ? 'Ex: Vale adiantamento' : 'Ex: Luz'}
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
                    placeholder="0.00"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2 outline-none focus:border-[#D4AF37]"
                  />
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
                  className={`w-full text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity ${newExpense.category === 'draw' ? 'bg-blue-600' : 'bg-black dark:bg-[#D4AF37]'}`}
                >
                  <Plus className="w-5 h-5" /> Adicionar Lançamento
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
