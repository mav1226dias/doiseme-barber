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
  ChevronDown,
  ChevronUp,
  Compass,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import type { OnboardingStepId, OnboardingStatus, OnboardingReadiness } from '../../lib/onboarding';

interface ChecklistStep {
  id: OnboardingStepId;
  order: number;
  title: string;
  shortTitle: string;
  description: string;
  optional: boolean;
  completed: boolean;
  detectedFromExistingData: boolean;
  skipped: boolean;
  pending: boolean;
  statusLabel: string;
  path: string;
  onboardingPath: string;
  cta: string;
  reviewCta: string;
}

interface OnboardingChecklistData {
  shopSlug: string;
  shopName: string;
  segmentId?: string;
  segmentName?: string;
  returnDays?: number;
  completedCount: number;
  totalCount: number;
  progressPercent?: number;
  recommendedStep?: OnboardingStepId;
  shouldPromptOnboarding?: boolean;
  onboardingStatus?: OnboardingStatus;
  readiness?: OnboardingReadiness;
  steps: ChecklistStep[];
  pendingSteps?: ChecklistStep[];
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
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklistCollapsed, setChecklistCollapsed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('doiseme_dashboard_checklist_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [showCompletedSteps, setShowCompletedSteps] = useState(false);
  const [dismissedCompletedBanner, setDismissedCompletedBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem('doiseme_onboarding_completed_dismissed') === '1';
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
    setChecklistError(null);
    fetch('/api/admin/onboarding-checklist', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar configurações pendentes.');
        return res.json();
      })
      .then((data) => {
        if (data?.steps) setChecklist(data);
      })
      .catch(() => {
        setChecklistError('Não foi possível carregar o progresso da configuração inicial.');
      });
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
      toast.success('Link público de agendamento copiado!');
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

  const toggleChecklistCollapsed = () => {
    setChecklistCollapsed((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('doiseme_dashboard_checklist_collapsed', next ? '1' : '0');
      } catch {
        // ignore storage failure
      }
      return next;
    });
  };

  const handleDismissCompletedBanner = () => {
    setDismissedCompletedBanner(true);
    try {
      localStorage.setItem('doiseme_onboarding_completed_dismissed', '1');
    } catch {
      // ignore storage failure
    }
  };

  const pendingSteps = checklist ? (checklist.pendingSteps ?? checklist.steps.filter((s) => !s.completed)) : [];
  const completedSteps = checklist ? checklist.steps.filter((s) => s.completed) : [];
  const allStepsCompleted = Boolean(checklist && pendingSteps.length === 0);
  const progressPercent = checklist
    ? (checklist.progressPercent ?? Math.round((checklist.completedCount / Math.max(1, checklist.totalCount)) * 100))
    : 0;
  const onboardingResumePath = checklist?.recommendedStep
    ? `/admin/onboarding?step=${checklist.recommendedStep}`
    : '/admin/onboarding';
  const onboardingPrimaryLabel =
    checklist?.onboardingStatus === 'not_started'
      ? 'Iniciar configuração guiada'
      : checklist?.onboardingStatus === 'completed'
        ? 'Abrir guia de configuração'
        : 'Continuar configuração guiada';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Dashboard</h1>
            <span className="text-xs font-semibold text-[#B8901F] dark:text-[#D4AF37]">
              · {segmentPreset.name}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Visão geral · {terms.business} · Métricas de desempenho
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-gray-200 dark:border-zinc-800">
          <Filter className="w-5 h-5 text-gray-400 ml-2 shrink-0" />
          <input
            type="date"
            aria-label="Data inicial"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 text-sm font-medium tabular-nums"
          />
          <span className="text-gray-400 text-xs">até</span>
          <input
            type="date"
            aria-label="Data final"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 text-sm font-medium mr-2 tabular-nums"
          />
        </div>
      </div>

      {/* Erro silencioso recuperável ao carregar checklist */}
      {checklistError && !checklist && (
        <div
          role="status"
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <p className="text-sm text-gray-600 dark:text-zinc-300">{checklistError}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchOnboardingChecklist}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-800 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Tentar novamente
            </button>
            <Link
              to="/admin/onboarding"
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Abrir configuração guiada
            </Link>
          </div>
        </div>
      )}

      {/* Configurações pendentes / Onboarding guiado */}
      {checklist && !allStepsCompleted && (
        <section
          aria-labelledby="pending-setup-heading"
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#9A7410] dark:text-[#D4AF37]">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {checklist.onboardingStatus === 'completed'
                    ? 'Configurações pendentes'
                    : 'Configuração inicial'}
                </span>
                <span className="text-gray-400 dark:text-zinc-500 font-mono tabular-nums">
                  · {checklist.completedCount}/{checklist.totalCount} concluídas ({progressPercent}%)
                </span>
                {checklist.readiness?.bookingReady ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    · Agendamento público pronto
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-zinc-400">
                    · {pendingSteps.length} {pendingSteps.length === 1 ? 'pendência' : 'pendências'}
                  </span>
                )}
              </div>

              <h2
                id="pending-setup-heading"
                className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-serif"
              >
                {checklist.readiness?.bookingReady
                  ? `Faltam ${pendingSteps.length} ajustes opcionais para finalizar seu painel`
                  : `Conclua os itens abaixo para publicar seu primeiro agendamento`}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                to={onboardingResumePath}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <span>{onboardingPrimaryLabel}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>

              {checklist.shopSlug && (
                <button
                  type="button"
                  onClick={handleCopyBookingLink}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Link copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#B8901F] dark:text-[#D4AF37]" />
                      Copiar /b/{checklist.shopSlug}
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={toggleChecklistCollapsed}
                aria-expanded={!checklistCollapsed}
                className="min-h-[44px] inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                {checklistCollapsed ? (
                  <>
                    <span>Mostrar pendências</span>
                    <ChevronDown className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Recolher</span>
                    <ChevronUp className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Barra de progresso */}
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da configuração inicial"
            className="w-full h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-[#D4AF37] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {!checklistCollapsed && (
            <div className="space-y-4">
              <ul className="divide-y divide-gray-200/80 dark:divide-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                {pendingSteps.map((step) => (
                  <li
                    key={step.id}
                    className="p-4 bg-gray-50/50 dark:bg-zinc-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {step.skipped ? (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300 dark:text-zinc-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-xs font-mono font-semibold text-gray-400 dark:text-zinc-500 tabular-nums">
                            0{step.order}
                          </span>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {step.title}
                          </h3>
                          <span className="text-xs text-gray-500 dark:text-zinc-400">
                            · {step.skipped ? 'Pulado por enquanto' : step.optional ? 'Opcional' : 'Pendente'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pl-7 sm:pl-0">
                      <Link
                        to={step.onboardingPath}
                        className="min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-gray-900 dark:text-gray-100 hover:border-[#D4AF37] hover:text-[#9A7410] dark:hover:text-[#D4AF37] transition-colors whitespace-nowrap"
                      >
                        <span>{step.cta}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>

              {completedSteps.length > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCompletedSteps((v) => !v)}
                    aria-expanded={showCompletedSteps}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {showCompletedSteps ? 'Ocultar' : 'Ver'} etapas já configuradas ({completedSteps.length})
                    </span>
                    {showCompletedSteps ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {showCompletedSteps && (
                    <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {completedSteps.map((step) => (
                        <li
                          key={step.id}
                          className="p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/15 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{step.shortTitle}</span>
                              <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400 shrink-0">
                                · {step.statusLabel}
                              </span>
                            </div>
                          </div>
                          <Link
                            to={step.onboardingPath}
                            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                          >
                            Revisar
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Confirmação discreta quando 100% configurado */}
      {checklist && allStepsCompleted && !dismissedCompletedBanner && (
        <section
          aria-label="Configuração inicial concluída"
          className="bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Configuração inicial concluída ({checklist.completedCount}/{checklist.totalCount})
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Seu link público está pronto para receber agendamentos de {terms.clientPlural.toLowerCase()} e o retorno está configurado para {checklist.returnDays ?? 20} dias.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pl-8 sm:pl-0">
            {checklist.shopSlug && (
              <button
                type="button"
                onClick={handleCopyBookingLink}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-[#D4AF37]" />}
                <span>{copiedLink ? 'Link copiado' : `Copiar /b/${checklist.shopSlug}`}</span>
              </button>
            )}
            <Link
              to="/admin/onboarding"
              className="min-h-[40px] inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Revisar guia
            </Link>
            <button
              type="button"
              onClick={handleDismissCompletedBanner}
              className="min-h-[40px] inline-flex items-center px-2 py-1.5 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Dispensar
            </button>
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
