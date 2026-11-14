import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  DollarSign,
  Calendar as CalendarIcon,
  Filter,
  TrendingDown,
  Wallet,
  CheckCircle2,
  Circle,
  ArrowRight,
  Copy,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  path: string;
  cta: string;
}

interface OnboardingChecklistData {
  shopSlug: string;
  shopName: string;
  completedCount: number;
  totalCount: number;
  steps: ChecklistStep[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { terms, segmentPreset } = useBusinessConfig();
  const [stats, setStats] = useState({
    totalAppointments: 0,
    totalRevenue: 0,
    totalCommissions: 0,
    totalExpenses: 0,
    netProfit: 0,
    appointmentsByBarber: [] as any[]
  });

  const [checklist, setChecklist] = useState<OnboardingChecklistData | null>(null);
  const [dismissedChecklist, setDismissedChecklist] = useState<boolean>(() => {
    try {
      return localStorage.getItem('doiseme_onboarding_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [copiedLink, setCopiedLink] = useState(false);

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
          if (payload.role === 'barber') {
            navigate('/admin/agenda', { replace: true });
            return;
          }
        }
      } catch {
        // AdminLayout handles malformed tokens
      }
    }

    fetchOnboardingChecklist();
  }, [navigate]);

  const fetchOnboardingChecklist = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/admin/onboarding-checklist', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.steps) setChecklist(data);
      })
      .catch(() => {});
  };

  const fetchDashboard = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/admin/dashboard?start=${dateRange.start}&end=${dateRange.end}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
          return { error: 'Sessão expirada' };
        }
        if (res.status === 403) {
          return { error: 'Acesso restrito' };
        }
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        return { error: `Erro do servidor (${res.status}).` };
      })
      .then((data) => {
        if (data.error) {
          if (data.error !== 'Sessão expirada' && data.error !== 'Acesso restrito') {
            toast.error(data.details || data.error);
          }
        } else {
          setStats((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => toast.error('Erro de conexão ao carregar métricas do dashboard.'));
  };

  useEffect(() => {
    fetchDashboard();
  }, [dateRange]);

  const handleCopyBookingLink = async () => {
    if (!checklist?.shopSlug) return;
    const url = `${window.location.origin}/b/${checklist.shopSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Link de agendamento copiado!');
      setTimeout(() => setCopiedLink(false), 2500);

      const token = localStorage.getItem('token');
      await fetch('/api/admin/onboarding-confirm-share', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOnboardingChecklist();
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  const handleDismissChecklist = () => {
    setDismissedChecklist(true);
    try {
      localStorage.setItem('doiseme_onboarding_dismissed', '1');
    } catch {
      // ignore storage failure
    }
  };

  const allStepsCompleted = Boolean(checklist && checklist.completedCount >= checklist.totalCount);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Dashboard</h1>
            <span className="text-xs font-semibold text-[#D4AF37]">
              · {segmentPreset.name}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Visão geral da sua {terms.business.toLowerCase()} e métricas de desempenho
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-gray-200 dark:border-zinc-800">
          <Filter className="w-5 h-5 text-gray-400 ml-2 shrink-0" />
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

      {/* Checklist de Primeiros Passos */}
      {checklist && !dismissedChecklist && (
        <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Primeiros Passos
                <span className="text-gray-400 dark:text-zinc-500 font-mono tabular-nums">
                  ({checklist.completedCount}/{checklist.totalCount})
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white font-serif mt-0.5">
                {allStepsCompleted
                  ? 'Tudo pronto! Seu painel está configurado para receber clientes.'
                  : 'Complete a configuração inicial do seu estabelecimento'}
              </h2>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
              {checklist.shopSlug && (
                <button
                  type="button"
                  onClick={handleCopyBookingLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      Link copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Copiar /b/{checklist.shopSlug}
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleDismissChecklist}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
                title="Ocultar guia de primeiros passos"
              >
                <X className="w-4 h-4" />
                Ocultar
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D4AF37] transition-all duration-300"
              style={{ width: `${Math.round((checklist.completedCount / checklist.totalCount) * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {checklist.steps.map((step, index) => (
              <div
                key={step.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                  step.completed
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200/80 dark:border-emerald-900/40'
                    : 'bg-gray-50/60 dark:bg-zinc-950/40 border-gray-200 dark:border-zinc-800'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-gray-400 tabular-nums">
                      0{index + 1}
                    </span>
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 dark:text-zinc-700 shrink-0" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{step.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{step.description}</p>
                </div>

                <Link
                  to={step.path}
                  className={`inline-flex items-center justify-between text-xs font-semibold pt-2 border-t border-gray-200/70 dark:border-zinc-800 ${
                    step.completed
                      ? 'text-emerald-700 dark:text-emerald-400 hover:underline'
                      : 'text-[#B8901F] dark:text-[#D4AF37] hover:underline'
                  }`}
                >
                  <span>{step.completed ? 'Revisar etapa' : step.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium">Faturamento Bruto</h3>
            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center shrink-0 ml-2">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            R$ {stats.totalRevenue.toFixed(2)}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium">Agendamentos</h3>
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0 ml-2">
              <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            {stats.totalAppointments}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium">Despesas/Comissões</h3>
            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0 ml-2">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            R$ {(stats.totalExpenses + stats.totalCommissions).toFixed(2)}
          </div>
        </div>

        <div className="bg-black dark:bg-[#D4AF37] p-4 sm:p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base text-white/70 dark:text-black/70 font-medium">Lucro Líquido</h3>
            <div className="w-10 h-10 bg-white/20 dark:bg-black/20 rounded-full flex items-center justify-center shrink-0 ml-2">
              <Wallet className="w-5 h-5 text-white dark:text-black" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white dark:text-black tabular-nums">
            R$ {stats.netProfit.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6 font-serif">
          Atendimentos por {terms.professional}
        </h3>
        <div className="space-y-3 sm:space-y-4">
          {(stats.appointmentsByBarber || []).map((barber, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center border border-gray-200 dark:border-zinc-700">
                  <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{barber.name}</span>
              </div>
              <div className="flex flex-col items-end tabular-nums">
                <div className="font-bold text-gray-900 dark:text-gray-100">
                  {barber.count} {terms.servicePlural.toLowerCase()}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">R$ {barber.revenue?.toFixed(2)}</div>
              </div>
            </div>
          ))}
          {(!stats.appointmentsByBarber || stats.appointmentsByBarber.length === 0) && (
            <div className="text-gray-500 dark:text-gray-400 text-center py-4">Nenhum dado disponível</div>
          )}
        </div>
      </div>
    </div>
  );
}
