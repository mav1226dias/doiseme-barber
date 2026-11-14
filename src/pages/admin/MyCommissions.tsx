import { useState, useEffect } from 'react';
import { Wallet, Calendar as CalendarIcon, DollarSign, Percent, Filter, TrendingDown, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';

interface CommissionItem {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: string;
  clientName: string;
  serviceName: string;
  price: number;
  commissionEarned: number;
}

interface DrawItem {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export default function MyCommissions() {
  const { terms } = useBusinessConfig();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { start, end };
  });

  const [summary, setSummary] = useState({
    barber: { id: '', name: '' },
    commissionPercentage: 50,
    completedCount: 0,
    scheduledCount: 0,
    totalRevenue: 0,
    totalCommission: 0,
    totalDraws: 0,
    netPayable: 0,
    items: [] as CommissionItem[],
    draws: [] as DrawItem[]
  });

  const fetchCommissions = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(
        `/api/admin/my-commissions?start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao carregar comissões');
      } else {
        setSummary(data);
      }
    } catch {
      toast.error('Erro de conexão ao carregar suas comissões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, [dateRange.start, dateRange.end]);

  const formatBRL = (val: number) =>
    Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (iso: string) => {
    if (!iso || !iso.includes('-')) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            Minhas Comissões
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {summary.barber?.name ? `${summary.barber.name} · ` : ''}Acompanhe seus {terms.servicePlural.toLowerCase()} concluídos e repasses do período
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-gray-200 dark:border-zinc-800 shrink-0">
          <Filter className="w-4 h-4 text-gray-400 ml-2 shrink-0" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 text-sm font-medium tabular-nums"
          />
          <span className="text-gray-400 text-xs">até</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 text-sm font-medium mr-2 tabular-nums"
          />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Atendimentos Concluídos</span>
            <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
              {loading ? '—' : summary.completedCount}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
              {summary.scheduledCount} agendado(s) no período
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Produção Bruta</span>
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
              R$ {loading ? '—' : formatBRL(summary.totalRevenue)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-[#D4AF37]" />
              Taxa de comissão: {summary.commissionPercentage}%
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Vales / Adiantamentos</span>
            <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              R$ {loading ? '—' : formatBRL(summary.totalDraws)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
              {summary.draws.length} lançamento(s) descontado(s)
            </p>
          </div>
        </div>

        <div className="bg-black dark:bg-[#D4AF37] p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/80 dark:text-black/80 font-medium">Líquido a Receber</span>
            <Wallet className="w-5 h-5 text-white dark:text-black shrink-0" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white dark:text-black tabular-nums">
              R$ {loading ? '—' : formatBRL(summary.netPayable)}
            </div>
            <p className="text-xs text-white/70 dark:text-black/70 mt-1 tabular-nums">
              Comissão bruta: R$ {formatBRL(summary.totalCommission)}
            </p>
          </div>
        </div>
      </div>

      {/* Appointments Breakdown Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-serif">
              Extrato de Atendimentos
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Apenas atendimentos concluídos ou confirmados entram no cálculo de repasse
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : summary.items.length === 0 ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400 text-sm">
            Nenhum atendimento concluído encontrado entre {formatDate(dateRange.start)} e {formatDate(dateRange.end)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-950/50">
                  <th className="py-3 px-4 font-semibold">Data / Hora</th>
                  <th className="py-3 px-4 font-semibold">{terms.client}</th>
                  <th className="py-3 px-4 font-semibold">{terms.service}</th>
                  <th className="py-3 px-4 font-semibold text-right">Valor</th>
                  <th className="py-3 px-4 font-semibold text-right">Sua Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {summary.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
                      {formatDate(item.date)} · {item.startTime}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {item.clientName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{item.serviceName}</td>
                    <td className="py-3 px-4 text-right font-mono text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
                      R$ {formatBRL(item.price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                      R$ {formatBRL(item.commissionEarned)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Draws / Advances Section */}
      {summary.draws.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-zinc-800">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 font-serif">
              Vales &amp; Adiantamentos Descontados
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {summary.draws.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{d.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                    {formatDate(d.date)}
                  </p>
                </div>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  - R$ {formatBRL(d.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
