import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  SkipForward,
  UserCheck,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { SEGMENTS, getSegment } from '../../lib/segments';
import { SegmentIcon } from '../../components/SegmentIcon';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import {
  DEFAULT_RETURN_DAYS,
  MAX_RETURN_DAYS,
  MIN_RETURN_DAYS,
  OnboardingPatchInput,
  OnboardingSnapshot,
  OnboardingStepId,
  getNextOnboardingStep,
  getPreviousOnboardingStep,
  isValidOnboardingStepId
} from '../../lib/onboarding';

interface OnboardingServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  active: boolean;
}

interface OnboardingProfessionalItem {
  id: string;
  name: string;
  active: boolean;
}

interface DayHoursConfig {
  isClosed: boolean;
  open: string;
  close: string;
  hasLunchBreak: boolean;
  lunchOpen: string;
  lunchClose: string;
}

interface OnboardingApiPayload {
  snapshot: OnboardingSnapshot;
  shop: {
    id: string;
    name: string;
    slug: string;
    segment: string;
    whatsapp: string;
    address: string;
    logoUrl: string | null;
  };
  services: OnboardingServiceItem[];
  professionals: OnboardingProfessionalItem[];
  hours: Record<string, DayHoursConfig>;
}

const DAYS = [
  { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' }
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Todos (16)',
  beauty: 'Beleza & Estética',
  health: 'Saúde & Bem-estar',
  creative: 'Criativo & Studio',
  technical: 'Técnico & Projetos'
};

function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getStoredOwnerName(): string {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return String(parsed?.name || '').trim();
  } catch {
    return '';
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshBusinessConfig } = useBusinessConfig();

  const [data, setData] = useState<OnboardingApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stepError, setStepError] = useState('');
  const [savingStep, setSavingStep] = useState(false);
  const [activeStep, setActiveStep] = useState<OnboardingStepId>('niche');
  const [showCompletionView, setShowCompletionView] = useState(false);

  // Step 1: Niche
  const [selectedSegmentId, setSelectedSegmentId] = useState('barbershop');
  const [nicheSearch, setNicheSearch] = useState('');
  const [nicheCategory, setNicheCategory] = useState<string>('all');

  // Step 2: Services
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('45');
  const [newServicePrice, setNewServicePrice] = useState('60');
  const [addingService, setAddingService] = useState(false);
  const [seedingServiceName, setSeedingServiceName] = useState<string | null>(null);

  // Step 3: Professionals
  const [newProfessionalName, setNewProfessionalName] = useState('');
  const [newProfessionalCommission, setNewProfessionalCommission] = useState('50');
  const [addingProfessional, setAddingProfessional] = useState(false);

  // Step 4: Hours
  const [hoursDraft, setHoursDraft] = useState<Record<string, DayHoursConfig>>({});

  // Step 5: Public Link
  const [whatsappDraft, setWhatsappDraft] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Step 6: Return Period
  const [returnDaysDraft, setReturnDaysDraft] = useState<string>(String(DEFAULT_RETURN_DAYS));
  const [returnDaysTouched, setReturnDaysTouched] = useState(false);

  const applyPayloadToDrafts = useCallback((payload: OnboardingApiPayload, initializeStep: boolean) => {
    setData(payload);
    setSelectedSegmentId(payload.shop.segment || payload.snapshot.segmentId);
    setHoursDraft(payload.hours || {});
    setWhatsappDraft(payload.shop.whatsapp || '');
    setReturnDaysDraft(String(payload.snapshot.returnDays ?? DEFAULT_RETURN_DAYS));
    setReturnDaysTouched(false);

    if (initializeStep) {
      const requestedStep = searchParams.get('step');
      if (isValidOnboardingStepId(requestedStep)) {
        setActiveStep(requestedStep);
      } else {
        setActiveStep(payload.snapshot.recommendedStep);
      }
    }
  }, [searchParams]);

  const fetchOnboarding = useCallback(async (initializeStep = false) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/admin/login', { replace: true });
      return;
    }
    setLoadError('');
    if (initializeStep) setLoading(true);
    try {
      const res = await fetch('/api/admin/onboarding', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(json.error || 'Não foi possível carregar os dados da configuração guiada.');
        return;
      }
      applyPayloadToDrafts(json as OnboardingApiPayload, initializeStep);
    } catch {
      setLoadError('Erro de conexão ao carregar o onboarding. Tente novamente.');
    } finally {
      if (initializeStep) setLoading(false);
    }
  }, [applyPayloadToDrafts, navigate]);

  useEffect(() => {
    fetchOnboarding(true);
  }, [fetchOnboarding]);

  const patchOnboarding = async (patch: OnboardingPatchInput): Promise<OnboardingApiPayload | null> => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/onboarding', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(patch)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || 'Não foi possível salvar o progresso.');
    }
    applyPayloadToDrafts(json as OnboardingApiPayload, false);
    return json as OnboardingApiPayload;
  };

  const activePreset = useMemo(() => {
    return getSegment(selectedSegmentId || data?.snapshot.segmentId);
  }, [selectedSegmentId, data?.snapshot.segmentId]);

  const terms = activePreset.terms;

  const filteredSegments = useMemo(() => {
    const query = nicheSearch.trim().toLowerCase();
    return Object.values(SEGMENTS).filter((seg) => {
      const matchesCat = nicheCategory === 'all' || seg.category === nicheCategory;
      if (!matchesCat) return false;
      if (!query) return true;
      return (
        seg.name.toLowerCase().includes(query) ||
        seg.terms.business.toLowerCase().includes(query) ||
        seg.terms.professionalPlural.toLowerCase().includes(query) ||
        seg.terms.servicePlural.toLowerCase().includes(query)
      );
    });
  }, [nicheCategory, nicheSearch]);

  const goToStep = async (nextStep: OnboardingStepId, extraPatch: OnboardingPatchInput = {}) => {
    setStepError('');
    setShowCompletionView(false);
    setActiveStep(nextStep);
    setSearchParams({ step: nextStep }, { replace: true });
    try {
      await patchOnboarding({
        status: data?.snapshot.state.status === 'completed' ? 'completed' : 'in_progress',
        currentStep: nextStep,
        ...extraPatch
      });
    } catch {
      // Keep UI responsive even if progress persistence fails transiently
    }
  };

  const handleExitAndContinueLater = async () => {
    setSavingStep(true);
    try {
      await patchOnboarding({
        status: data?.snapshot.state.status === 'completed' ? 'completed' : 'in_progress',
        currentStep: activeStep
      });
      toast.success('Progresso salvo! Você pode continuar quando quiser pelo Dashboard.');
      navigate('/admin');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível salvar o progresso.');
      navigate('/admin');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 1 handler: Confirm or change niche
  const handleConfirmNiche = async () => {
    if (!data) return;
    setStepError('');
    setSavingStep(true);
    const token = localStorage.getItem('token');
    try {
      const nicheChanged = selectedSegmentId !== data.shop.segment;
      if (nicheChanged) {
        const chosenPreset = getSegment(selectedSegmentId);
        const shopRes = await fetch('/api/admin/shop', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            segment: chosenPreset.id,
            primaryColor: chosenPreset.defaultColors.primary,
            secondaryColor: chosenPreset.defaultColors.secondary
          })
        });
        const shopJson = await shopRes.json().catch(() => ({}));
        if (!shopRes.ok) {
          throw new Error(shopJson.error || 'Erro ao atualizar o nicho do estabelecimento.');
        }
        await refreshBusinessConfig();
      }

      const nextStep = getNextOnboardingStep('niche') || 'services';
      await patchOnboarding({
        status: 'in_progress',
        nicheConfirmed: true,
        completeStep: 'niche',
        currentStep: nextStep
      });
      toast.success(`Nicho confirmado: ${getSegment(selectedSegmentId).name}`);
      setActiveStep(nextStep);
      setSearchParams({ step: nextStep }, { replace: true });
    } catch (err: any) {
      setStepError(err?.message || 'Não foi possível salvar o nicho.');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 2 handlers: Services
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');
    const cleanName = newServiceName.trim();
    const duration = Number(newServiceDuration);
    const price = Number(String(newServicePrice).replace(',', '.'));

    if (!cleanName) {
      setStepError(`Informe o nome do ${terms.service.toLowerCase()}.`);
      return;
    }
    if (!Number.isFinite(duration) || duration < 5 || duration > 600) {
      setStepError('Informe uma duração válida entre 5 e 600 minutos.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setStepError('Informe um valor válido (0 ou maior).');
      return;
    }

    setAddingService(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: cleanName,
          durationMinutes: duration,
          price
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Erro ao cadastrar ${terms.service.toLowerCase()}.`);
      }
      setNewServiceName('');
      toast.success(`${terms.service} cadastrado com sucesso!`);
      await fetchOnboarding(false);
    } catch (err: any) {
      setStepError(err?.message || `Erro ao cadastrar ${terms.service.toLowerCase()}.`);
    } finally {
      setAddingService(false);
    }
  };

  const handleAddSuggestedService = async (suggested: { name: string; durationMinutes: number; price: number }) => {
    setStepError('');
    setSeedingServiceName(suggested.name);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: suggested.name,
          durationMinutes: suggested.durationMinutes,
          price: suggested.price
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao adicionar sugestão.');
      }
      toast.success(`"${suggested.name}" adicionado ao catálogo.`);
      await fetchOnboarding(false);
    } catch (err: any) {
      setStepError(err?.message || 'Não foi possível adicionar este item.');
    } finally {
      setSeedingServiceName(null);
    }
  };

  const handleAdvanceFromServices = async () => {
    setStepError('');
    setSavingStep(true);
    try {
      const activeServices = (data?.services || []).filter((s) => s.active);
      const nextStep = getNextOnboardingStep('services') || 'professionals';
      await patchOnboarding({
        status: 'in_progress',
        currentStep: nextStep,
        ...(activeServices.length > 0 ? { completeStep: 'services' } : { skipStep: 'services' })
      });
      setActiveStep(nextStep);
      setSearchParams({ step: nextStep }, { replace: true });
    } catch (err: any) {
      setStepError(err?.message || 'Erro ao avançar etapa.');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 3 handlers: Professionals
  const handleAddProfessional = async (customName?: string) => {
    setStepError('');
    const targetName = (customName ?? newProfessionalName).trim();
    const commission = Number(newProfessionalCommission);
    if (!targetName) {
      setStepError(`Informe o nome do ${terms.professional.toLowerCase()}.`);
      return;
    }
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      setStepError('A comissão deve estar entre 0% e 100%.');
      return;
    }

    setAddingProfessional(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/barbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: targetName,
          commission_percentage: commission
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Erro ao cadastrar ${terms.professional.toLowerCase()}.`);
      }
      setNewProfessionalName('');
      toast.success(`${terms.professional} adicionado com sucesso!`);
      await fetchOnboarding(false);
    } catch (err: any) {
      setStepError(err?.message || `Não foi possível adicionar ${terms.professional.toLowerCase()}.`);
    } finally {
      setAddingProfessional(false);
    }
  };

  const handleAdvanceFromProfessionals = async (skipAsSolo = false) => {
    setStepError('');
    setSavingStep(true);
    try {
      const activePros = (data?.professionals || []).filter((p) => p.active);
      const nextStep = getNextOnboardingStep('professionals') || 'hours';
      await patchOnboarding({
        status: 'in_progress',
        currentStep: nextStep,
        ...(activePros.length > 0
          ? { completeStep: 'professionals' }
          : { skipStep: 'professionals', soloOperation: skipAsSolo })
      });
      setActiveStep(nextStep);
      setSearchParams({ step: nextStep }, { replace: true });
    } catch (err: any) {
      setStepError(err?.message || 'Erro ao avançar etapa.');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 4 handlers: Operating Hours
  const applyHoursPreset = (presetType: 'mon_fri' | 'tue_sat') => {
    const next: Record<string, DayHoursConfig> = {};
    DAYS.forEach(({ key }) => {
      const isClosed =
        presetType === 'mon_fri'
          ? key === 'saturday' || key === 'sunday'
          : key === 'monday' || key === 'sunday';
      next[key] = {
        isClosed,
        open: '09:00',
        close: presetType === 'mon_fri' ? '18:00' : '19:00',
        hasLunchBreak: false,
        lunchOpen: '12:00',
        lunchClose: '13:00'
      };
    });
    setHoursDraft(next);
    setStepError('');
  };

  const updateDayHour = (dayKey: string, field: keyof DayHoursConfig, value: string | boolean) => {
    setHoursDraft((prev) => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || {
          isClosed: false,
          open: '09:00',
          close: '18:00',
          hasLunchBreak: false,
          lunchOpen: '12:00',
          lunchClose: '13:00'
        }),
        [field]: value
      }
    }));
  };

  const handleSaveHoursStep = async () => {
    setStepError('');
    const openDays = DAYS.filter(({ key }) => hoursDraft[key] && !hoursDraft[key].isClosed);
    if (openDays.length === 0) {
      setStepError('Mantenha pelo menos 1 dia aberto para que a agenda pública ofereça horários.');
      return;
    }
    for (const { key, label } of openDays) {
      const cfg = hoursDraft[key];
      if (!cfg.open || !cfg.close || cfg.close <= cfg.open) {
        setStepError(`Em ${label}, o horário de fechamento precisa ser maior que o de abertura.`);
        return;
      }
      if (cfg.hasLunchBreak && (!cfg.lunchOpen || !cfg.lunchClose || cfg.lunchClose <= cfg.lunchOpen)) {
        setStepError(`Em ${label}, o fim do intervalo precisa ser maior que o início.`);
        return;
      }
    }

    setSavingStep(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(hoursDraft)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar horários.');
      }

      const nextStep = getNextOnboardingStep('hours') || 'public_link';
      await patchOnboarding({
        status: 'in_progress',
        completeStep: 'hours',
        currentStep: nextStep
      });
      toast.success('Horários de atendimento salvos!');
      setActiveStep(nextStep);
      setSearchParams({ step: nextStep }, { replace: true });
    } catch (err: any) {
      setStepError(err?.message || 'Não foi possível salvar os horários.');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 5 handlers: Public Link
  const publicBookingUrl = data?.shop.slug
    ? `${window.location.origin}/b/${data.shop.slug}`
    : '';

  const handleCopyPublicLink = async () => {
    if (!publicBookingUrl) return;
    try {
      await navigator.clipboard.writeText(publicBookingUrl);
      setCopiedLink(true);
      toast.success('Link público copiado!');
      setTimeout(() => setCopiedLink(false), 2500);
      await patchOnboarding({
        publicLinkReviewed: true,
        completeStep: 'public_link',
        currentStep: 'public_link'
      });
    } catch {
      toast.error('Não foi possível copiar automaticamente. Selecione e copie o link exibido.');
    }
  };

  const handleConfirmPublicLink = async () => {
    if (!data) return;
    setStepError('');
    setSavingStep(true);
    const token = localStorage.getItem('token');
    try {
      const cleanPhone = whatsappDraft.trim();
      if (cleanPhone !== (data.shop.whatsapp || '').trim()) {
        const shopRes = await fetch('/api/admin/shop', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ whatsapp: cleanPhone })
        });
        if (!shopRes.ok) {
          const shopErr = await shopRes.json().catch(() => ({}));
          throw new Error(shopErr.error || 'Não foi possível atualizar o WhatsApp comercial.');
        }
      }

      const nextStep = getNextOnboardingStep('public_link') || 'return_period';
      await patchOnboarding({
        status: 'in_progress',
        publicLinkReviewed: true,
        completeStep: 'public_link',
        currentStep: nextStep
      });
      setActiveStep(nextStep);
      setSearchParams({ step: nextStep }, { replace: true });
    } catch (err: any) {
      setStepError(err?.message || 'Não foi possível confirmar o link público.');
    } finally {
      setSavingStep(false);
    }
  };

  // Step 6 handler: Return Period & Complete Onboarding
  const handleCompleteOnboarding = async (skipReturnPeriod = false) => {
    setStepError('');
    const parsedDays = Math.round(Number(returnDaysDraft));
    if (!skipReturnPeriod && (!Number.isFinite(parsedDays) || parsedDays < MIN_RETURN_DAYS || parsedDays > MAX_RETURN_DAYS)) {
      setStepError(`Informe um prazo entre ${MIN_RETURN_DAYS} e ${MAX_RETURN_DAYS} dias.`);
      return;
    }

    setSavingStep(true);
    try {
      const patch: OnboardingPatchInput = {
        status: 'completed',
        currentStep: 'return_period'
      };
      if (skipReturnPeriod) {
        patch.skipStep = 'return_period';
      } else {
        patch.returnPeriodReviewed = true;
        patch.completeStep = 'return_period';
        // Only write inactivityReturnDays if user changed it or already customized it, preserving 20-day default untouched otherwise
        if (returnDaysTouched || parsedDays !== (data?.snapshot.returnDays ?? DEFAULT_RETURN_DAYS)) {
          patch.inactivityReturnDays = parsedDays;
        }
      }
      await patchOnboarding(patch);
      toast.success('Configuração guiada concluída!');
      setShowCompletionView(true);
    } catch (err: any) {
      setStepError(err?.message || 'Não foi possível concluir o onboarding.');
    } finally {
      setSavingStep(false);
    }
  };

  const handleSkipCurrentStep = async () => {
    setStepError('');
    const nextStep = getNextOnboardingStep(activeStep);
    if (!nextStep) {
      await handleCompleteOnboarding(true);
      return;
    }
    setSavingStep(true);
    try {
      await patchOnboarding({
        status: 'in_progress',
        skipStep: activeStep,
        currentStep: nextStep
      });
      setActiveStep(nextStep);
      setSearchParams({ step: nextStep }, { replace: true });
    } catch (err: any) {
      setStepError(err?.message || 'Não foi possível pular esta etapa.');
    } finally {
      setSavingStep(false);
    }
  };

  const handleGoBack = async () => {
    const prevStep = getPreviousOnboardingStep(activeStep);
    if (!prevStep) return;
    await goToStep(prevStep);
  };

  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Carregando configuração guiada">
        <div className="h-20 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 h-80 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl" />
          <div className="lg:col-span-8 h-96 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Error State
  if (loadError || !data) {
    return (
      <div
        role="alert"
        className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 sm:p-8 max-w-xl mx-auto text-center space-y-4"
      >
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white font-serif">
            Não foi possível abrir o onboarding
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {loadError || 'Erro inesperado ao carregar os dados do estabelecimento.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => fetchOnboarding(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { snapshot, services, professionals } = data;
  const activeServices = services.filter((s) => s.active);
  const activeProfessionals = professionals.filter((p) => p.active);
  const currentStepIndex = snapshot.steps.findIndex((s) => s.id === activeStep);
  const currentStepMeta = snapshot.steps[currentStepIndex] || snapshot.steps[0];
  const prevStepId = getPreviousOnboardingStep(activeStep);
  const ownerStoredName = getStoredOwnerName();

  // Completion / Success Screen
  if (showCompletionView) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Configuração guiada finalizada · {snapshot.completedCount}/{snapshot.totalCount} etapas concluídas
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-serif text-balance">
                {snapshot.readiness.bookingReady
                  ? 'Seu link de agendamento está pronto para receber o primeiro agendamento.'
                  : 'Progresso salvo! Seu painel está liberado para uso.'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
                {snapshot.readiness.bookingReady
                  ? `Compartilhe o endereço /b/${snapshot.shopSlug} com seus ${terms.clientPlural.toLowerCase()} para começar a receber agendamentos reais.`
                  : 'Você já pode usar todo o painel normalmente e finalizar as pendências abaixo quando preferir.'}
              </p>
            </div>
          </div>

          {publicBookingUrl && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                  Link público de agendamento
                </p>
                <p className="text-sm font-mono text-gray-900 dark:text-[#D4AF37] truncate mt-0.5">
                  {publicBookingUrl}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyPublicLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:border-[#D4AF37] transition-colors whitespace-nowrap"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-[#D4AF37]" />}
                  {copiedLink ? 'Copiado' : 'Copiar link'}
                </button>
                <a
                  href={`/b/${snapshot.shopSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir página
                </a>
              </div>
            </div>
          )}

          {snapshot.pendingSteps.length > 0 && (
            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Itens pendentes que ficarão disponíveis no seu Dashboard ({snapshot.pendingSteps.length})
              </h2>
              <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
                {snapshot.pendingSteps.map((step) => (
                  <li key={step.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{step.title}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">{step.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(step.id)}
                      className="text-xs font-bold text-[#B8901F] dark:text-[#D4AF37] hover:underline whitespace-nowrap shrink-0"
                    >
                      Completar agora
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowCompletionView(false)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Revisar etapas
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#D4AF37] text-black text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <span>Ir para o Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
            <span className="font-semibold text-[#B8901F] dark:text-[#D4AF37]">Configuração inicial</span>
            <span aria-hidden="true">·</span>
            <span>{activePreset.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              {snapshot.completedCount} de {snapshot.totalCount} etapas concluídas ({snapshot.progressPercent}%)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-serif text-balance">
            Prepare seu espaço para o primeiro agendamento
          </h1>
        </div>

        <button
          type="button"
          disabled={savingStep}
          onClick={handleExitAndContinueLater}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-[#D4AF37] transition-colors self-start sm:self-auto whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
        >
          <span>Sair e continuar depois</span>
        </button>
      </header>

      {/* Progress Bar */}
      <div
        className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={snapshot.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da configuração inicial"
      >
        <div
          className="h-full bg-[#D4AF37] transition-all duration-300"
          style={{ width: `${Math.max(snapshot.progressPercent, 8)}%` }}
        />
      </div>

      {/* Mobile Horizontal Step Switcher */}
      <nav
        aria-label="Etapas do onboarding"
        className="lg:hidden flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
      >
        {snapshot.steps.map((step) => {
          const isCurrent = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => goToStep(step.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                isCurrent
                  ? 'bg-black text-white border-black dark:bg-[#D4AF37] dark:text-black dark:border-[#D4AF37]'
                  : step.completed
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300'
              }`}
            >
              {step.completed ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <span className="font-mono tabular-nums">{step.order}.</span>
              )}
              <span>{step.shortTitle}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Step Rail */}
        <aside className="hidden lg:block lg:col-span-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 space-y-5">
          <nav aria-label="Lista de etapas" className="space-y-1.5">
            {snapshot.steps.map((step) => {
              const isCurrent = step.id === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => goToStep(step.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                    isCurrent
                      ? 'bg-gray-950 text-white border-gray-950 dark:bg-[#D4AF37]/15 dark:text-white dark:border-[#D4AF37]'
                      : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-zinc-800/60 text-gray-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {step.completed ? (
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          isCurrent ? 'text-[#D4AF37]' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      />
                    ) : (
                      <Circle
                        className={`w-4 h-4 ${
                          isCurrent ? 'text-[#D4AF37]' : 'text-gray-300 dark:text-zinc-700'
                        }`}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold truncate">
                        {step.order}. {step.shortTitle}
                      </span>
                      <span
                        className={`text-[11px] font-medium whitespace-nowrap ${
                          isCurrent
                            ? 'text-zinc-300 dark:text-[#D4AF37]'
                            : step.completed
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-400 dark:text-zinc-500'
                        }`}
                      >
                        {step.statusLabel}
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-0.5 line-clamp-2 ${
                        isCurrent ? 'text-zinc-300 dark:text-zinc-400' : 'text-gray-500 dark:text-zinc-400'
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-2">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              Status da página pública
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
              {snapshot.readiness.bookingReady
                ? 'Tudo pronto para receber agendamentos reais no seu link.'
                : `Falta concluir: ${snapshot.readiness.missingForBooking.join(', ')}.`}
            </p>
          </div>
        </aside>

        {/* Active Step Card */}
        <section
          aria-labelledby="onboarding-step-title"
          className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-7 space-y-6"
        >
          <div className="space-y-1.5 pb-4 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
              <span className="font-semibold text-[#B8901F] dark:text-[#D4AF37]">
                Etapa {currentStepMeta.order} de {snapshot.totalCount}
              </span>
              {currentStepMeta.optional && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Opcional</span>
                </>
              )}
              {currentStepMeta.completed && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {currentStepMeta.detectedFromExistingData ? 'Já configurado' : 'Concluída'}
                  </span>
                </>
              )}
            </div>
            <h2
              id="onboarding-step-title"
              className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-serif"
            >
              {currentStepMeta.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
              {currentStepMeta.description}
            </p>
          </div>

          {stepError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{stepError}</span>
            </div>
          )}

          {/* STEP 1: NICHE */}
          {activeStep === 'niche' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-200 dark:border-zinc-800 flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${activePreset.defaultColors.primary}20`,
                    color: activePreset.defaultColors.primary
                  }}
                >
                  <SegmentIcon iconName={activePreset.icon} className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Nicho selecionado atualmente
                  </p>
                  <p className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {activePreset.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Termos no painel: {activePreset.terms.professionalPlural} · {activePreset.terms.servicePlural} · {activePreset.terms.clientPlural}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <label htmlFor="onboarding-niche-search" className="sr-only">
                      Buscar entre os 16 nichos
                    </label>
                    <input
                      id="onboarding-niche-search"
                      type="text"
                      value={nicheSearch}
                      onChange={(e) => setNicheSearch(e.target.value)}
                      placeholder="Buscar nicho (ex: estética, psicologia, pilates, pet shop...)"
                      className="w-full min-h-[44px] bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setNicheCategory(catKey)}
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        nicheCategory === catKey
                          ? 'bg-black text-white dark:bg-[#D4AF37] dark:text-black'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {filteredSegments.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-zinc-400 border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                    Nenhum nicho encontrado para "{nicheSearch}". Limpe a busca para ver todos os 16 nichos.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {filteredSegments.map((seg) => {
                      const isSelected = selectedSegmentId === seg.id;
                      return (
                        <button
                          key={seg.id}
                          type="button"
                          onClick={() => setSelectedSegmentId(seg.id)}
                          className={`text-left p-3.5 rounded-xl border transition-colors flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                            isSelected
                              ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                              : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950/40'
                          }`}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                              backgroundColor: `${seg.defaultColors.primary}20`,
                              color: seg.defaultColors.primary
                            }}
                          >
                            <SegmentIcon iconName={seg.icon} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {seg.name}
                              </span>
                              {isSelected && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate mt-0.5">
                              {seg.terms.professionalPlural} · {seg.terms.servicePlural}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: SERVICES */}
          {activeStep === 'services' && (
            <div className="space-y-6">
              {activeServices.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {terms.servicePlural} já cadastrados ({activeServices.length})
                    </p>
                    <Link
                      to="/admin/services"
                      className="text-xs font-semibold text-[#B8901F] dark:text-[#D4AF37] hover:underline whitespace-nowrap"
                    >
                      Gerenciar catálogo completo
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    {activeServices.map((srv) => (
                      <div
                        key={srv.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 bg-white dark:bg-zinc-950/30"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {srv.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                            {srv.durationMinutes} min
                          </p>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-[#D4AF37] tabular-nums shrink-0">
                          R$ {formatCurrency(srv.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 text-center space-y-2">
                  <Scissors className="w-7 h-7 text-[#D4AF37] mx-auto opacity-80" />
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Nenhum registro em {terms.servicePlural.toLowerCase()} ainda
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
                    Cadastre ao menos 1 {terms.service.toLowerCase()} abaixo ou adicione uma sugestão pronta para {activePreset.name}.
                  </p>
                </div>
              )}

              {/* Quick Add Service Form */}
              <form
                onSubmit={handleAddService}
                className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-3"
              >
                <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                  Adicionar novo item em {terms.servicePlural.toLowerCase()}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label htmlFor="onb-service-name" className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      Nome ({terms.service})
                    </label>
                    <input
                      id="onb-service-name"
                      type="text"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder={activePreset.suggestedServices[0]?.name || `Ex: ${terms.service} padrão`}
                      className="w-full min-h-[44px] bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="onb-service-duration" className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      Duração (min)
                    </label>
                    <input
                      id="onb-service-duration"
                      type="number"
                      min={5}
                      max={600}
                      value={newServiceDuration}
                      onChange={(e) => setNewServiceDuration(e.target.value)}
                      className="w-full min-h-[44px] bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="onb-service-price" className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      Valor (R$)
                    </label>
                    <input
                      id="onb-service-price"
                      type="number"
                      step="0.01"
                      min={0}
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      className="w-full min-h-[44px] bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={addingService}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-black dark:bg-zinc-800 text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {addingService ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-[#D4AF37]" />}
                  <span>Adicionar {terms.service.toLowerCase()}</span>
                </button>
              </form>

              {/* Suggested Services for Active Niche */}
              {activePreset.suggestedServices.length > 0 && (
                <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-2.5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                    Sugestões rápidas para {activePreset.name} (1 clique para incluir)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activePreset.suggestedServices.map((sug) => {
                      const alreadyExists = activeServices.some(
                        (s) => s.name.trim().toLowerCase() === sug.name.trim().toLowerCase()
                      );
                      const isAddingThis = seedingServiceName === sug.name;
                      return (
                        <button
                          key={sug.name}
                          type="button"
                          disabled={alreadyExists || Boolean(seedingServiceName)}
                          onClick={() => handleAddSuggestedService(sug)}
                          className={`text-left p-3 rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 ${
                            alreadyExists
                              ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/15 text-emerald-700 dark:text-emerald-400 cursor-default'
                              : 'border-gray-200 dark:border-zinc-800 hover:border-[#D4AF37] bg-white dark:bg-zinc-950/40 text-gray-800 dark:text-zinc-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{sug.name}</p>
                            <p className="text-[11px] text-gray-500 dark:text-zinc-400 tabular-nums">
                              {sug.durationMinutes} min · R$ {formatCurrency(sug.price)}
                            </p>
                          </div>
                          {alreadyExists ? (
                            <Check className="w-4 h-4 shrink-0" />
                          ) : isAddingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          ) : (
                            <Plus className="w-4 h-4 text-[#D4AF37] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PROFESSIONALS */}
          {activeStep === 'professionals' && (
            <div className="space-y-6">
              {activeProfessionals.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {terms.professionalPlural} ativos na agenda ({activeProfessionals.length})
                    </p>
                    <Link
                      to="/admin/barbers"
                      className="text-xs font-semibold text-[#B8901F] dark:text-[#D4AF37] hover:underline whitespace-nowrap"
                    >
                      Gerenciar equipe completa
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    {activeProfessionals.map((pro) => (
                      <div
                        key={pro.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 bg-white dark:bg-zinc-950/30"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <UserCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {pro.name}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                          Ativo
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 text-center space-y-3">
                  <Users className="w-7 h-7 text-[#D4AF37] mx-auto opacity-80" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      Nenhum registro em {terms.professionalPlural.toLowerCase()} ainda
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
                      Para que seus {terms.clientPlural.toLowerCase()} escolham um horário no link público, ative ao menos 1 {terms.professional.toLowerCase()} (pode ser você mesmo). Se preferir, você pode pular e configurar depois.
                    </p>
                  </div>
                  {ownerStoredName && (
                    <button
                      type="button"
                      disabled={addingProfessional}
                      onClick={() => handleAddProfessional(ownerStoredName)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#D4AF37] text-black text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {addingProfessional ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span>Adicionar "{ownerStoredName}" como {terms.professional.toLowerCase()}</span>
                    </button>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                  Adicionar {terms.professional.toLowerCase()} (opcional se sua equipe já estiver pronta)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8">
                    <label htmlFor="onb-pro-name" className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      Nome ({terms.professional})
                    </label>
                    <input
                      id="onb-pro-name"
                      type="text"
                      value={newProfessionalName}
                      onChange={(e) => setNewProfessionalName(e.target.value)}
                      placeholder={`Nome do ${terms.professional.toLowerCase()}`}
                      className="w-full min-h-[44px] bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor="onb-pro-commission" className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      Comissão (%)
                    </label>
                    <input
                      id="onb-pro-commission"
                      type="number"
                      min={0}
                      max={100}
                      value={newProfessionalCommission}
                      onChange={(e) => setNewProfessionalCommission(e.target.value)}
                      className="w-full min-h-[44px] bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={addingProfessional}
                  onClick={() => handleAddProfessional()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-black dark:bg-zinc-800 text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {addingProfessional ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-[#D4AF37]" />}
                  <span>Adicionar {terms.professional.toLowerCase()}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: OPERATING HOURS */}
          {activeStep === 'hours' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                  Atalhos rápidos:
                </span>
                <button
                  type="button"
                  onClick={() => applyHoursPreset('mon_fri')}
                  className="px-3 py-1.5 min-h-[36px] rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:border-[#D4AF37] transition-colors"
                >
                  Seg a Sex · 09:00–18:00
                </button>
                <button
                  type="button"
                  onClick={() => applyHoursPreset('tue_sat')}
                  className="px-3 py-1.5 min-h-[36px] rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-200 hover:border-[#D4AF37] transition-colors"
                >
                  Ter a Sáb · 09:00–19:00
                </button>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                {DAYS.map(({ key, label }) => {
                  const cfg = hoursDraft[key] || {
                    isClosed: false,
                    open: '09:00',
                    close: '18:00',
                    hasLunchBreak: false,
                    lunchOpen: '12:00',
                    lunchClose: '13:00'
                  };
                  return (
                    <div
                      key={key}
                      className="p-3.5 sm:p-4 bg-white dark:bg-zinc-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center justify-between sm:justify-start gap-3 min-w-[190px]">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {label}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateDayHour(key, 'isClosed', !cfg.isClosed)}
                          className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors ${
                            !cfg.isClosed
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                          }`}
                        >
                          {!cfg.isClosed ? 'Aberto' : 'Fechado'}
                        </button>
                      </div>

                      {!cfg.isClosed && (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="sr-only" htmlFor={`onb-open-${key}`}>
                            Abertura {label}
                          </label>
                          <input
                            id={`onb-open-${key}`}
                            type="time"
                            value={cfg.open || '09:00'}
                            onChange={(e) => updateDayHour(key, 'open', e.target.value)}
                            className="min-h-[40px] bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                          />
                          <span className="text-xs text-gray-400">às</span>
                          <label className="sr-only" htmlFor={`onb-close-${key}`}>
                            Fechamento {label}
                          </label>
                          <input
                            id={`onb-close-${key}`}
                            type="time"
                            value={cfg.close || '18:00'}
                            onChange={(e) => updateDayHour(key, 'close', e.target.value)}
                            className="min-h-[40px] bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                          />
                          <button
                            type="button"
                            onClick={() => updateDayHour(key, 'hasLunchBreak', !cfg.hasLunchBreak)}
                            className={`px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border transition-colors ${
                              cfg.hasLunchBreak
                                ? 'border-[#D4AF37] text-[#B8901F] dark:text-[#D4AF37]'
                                : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400'
                            }`}
                          >
                            {cfg.hasLunchBreak ? 'Com pausa' : '+ Pausa'}
                          </button>
                          {cfg.hasLunchBreak && (
                            <div className="flex items-center gap-1.5 w-full sm:w-auto pt-1 sm:pt-0">
                              <input
                                type="time"
                                aria-label={`Início da pausa ${label}`}
                                value={cfg.lunchOpen || '12:00'}
                                onChange={(e) => updateDayHour(key, 'lunchOpen', e.target.value)}
                                className="min-h-[36px] bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                              />
                              <span className="text-xs text-gray-400">–</span>
                              <input
                                type="time"
                                aria-label={`Fim da pausa ${label}`}
                                value={cfg.lunchClose || '13:00'}
                                onChange={(e) => updateDayHour(key, 'lunchClose', e.target.value)}
                                className="min-h-[36px] bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: PUBLIC LINK */}
          {activeStep === 'public_link' && (
            <div className="space-y-6">
              <div className="p-4 sm:p-5 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-200 dark:border-zinc-800 space-y-4">
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                      Endereço público de agendamento
                    </p>
                    <p className="text-sm sm:text-base font-mono font-bold text-gray-900 dark:text-[#D4AF37] break-all mt-0.5">
                      {publicBookingUrl || 'Link público ainda não definido'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!publicBookingUrl}
                    onClick={handleCopyPublicLink}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link copiado' : 'Copiar link público'}</span>
                  </button>
                  {snapshot.shopSlug && (
                    <a
                      href={`/b/${snapshot.shopSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-700 dark:text-gray-200 hover:border-[#D4AF37] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Testar visualização do link</span>
                    </a>
                  )}
                  <Link
                    to="/admin/profile"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#B8901F] dark:text-[#D4AF37] hover:underline"
                  >
                    Personalizar cores, logo e QR Code
                  </Link>
                </div>
              </div>

              {/* Readiness Breakdown */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Prontidão para o primeiro agendamento real
                </h3>
                <ul className="divide-y divide-gray-100 dark:divide-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden text-sm">
                  <li className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-gray-700 dark:text-zinc-200">{terms.servicePlural} ativos no catálogo</span>
                    <span className={snapshot.readiness.hasServices ? 'text-xs font-bold text-emerald-600 dark:text-emerald-400' : 'text-xs font-bold text-amber-600 dark:text-amber-400'}>
                      {snapshot.readiness.hasServices ? `Pronto (${activeServices.length})` : 'Pendente'}
                    </span>
                  </li>
                  <li className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-gray-700 dark:text-zinc-200">{terms.professionalPlural} ativos na agenda</span>
                    <span className={snapshot.readiness.hasProfessionals ? 'text-xs font-bold text-emerald-600 dark:text-emerald-400' : 'text-xs font-bold text-amber-600 dark:text-amber-400'}>
                      {snapshot.readiness.hasProfessionals ? `Pronto (${activeProfessionals.length})` : 'Pendente'}
                    </span>
                  </li>
                  <li className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-gray-700 dark:text-zinc-200">Horários com dias abertos</span>
                    <span className={snapshot.readiness.hasOpenHours ? 'text-xs font-bold text-emerald-600 dark:text-emerald-400' : 'text-xs font-bold text-amber-600 dark:text-amber-400'}>
                      {snapshot.readiness.hasOpenHours ? 'Pronto' : 'Pendente'}
                    </span>
                  </li>
                </ul>
              </div>

              {/* Optional WhatsApp check */}
              <div className="space-y-1.5">
                <label htmlFor="onb-whatsapp" className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                  WhatsApp exibido na página pública (opcional)
                </label>
                <input
                  id="onb-whatsapp"
                  type="tel"
                  value={whatsappDraft}
                  onChange={(e) => setWhatsappDraft(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full sm:max-w-sm min-h-[44px] bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                />
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Nenhuma mensagem é enviada automaticamente; o número aparece apenas como contato na sua página pública.
                </p>
              </div>
            </div>
          )}

          {/* STEP 6: RETURN PERIOD */}
          {activeStep === 'return_period' && (
            <div className="space-y-5">
              <div className="p-4 sm:p-5 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-200 dark:border-zinc-800 space-y-4">
                <div className="flex items-start gap-3">
                  <RotateCcw className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      Prazo de retorno para {terms.clientPlural.toLowerCase()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                      Quando um(a) {terms.client.toLowerCase()} ficar mais de{' '}
                      <strong className="text-gray-900 dark:text-white tabular-nums">{returnDaysDraft || DEFAULT_RETURN_DAYS} dias</strong>{' '}
                      sem um novo agendamento, o nome aparecerá na aba de recuperação em Marketing &amp; Mensagens para você reengajar manualmente quando quiser.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                  <label htmlFor="onb-return-days" className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                    Dias sem retorno:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="onb-return-days"
                      type="number"
                      min={MIN_RETURN_DAYS}
                      max={MAX_RETURN_DAYS}
                      value={returnDaysDraft}
                      onChange={(e) => {
                        setReturnDaysDraft(e.target.value);
                        setReturnDaysTouched(true);
                      }}
                      className="w-28 min-h-[44px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
                    />
                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                      dias {Number(returnDaysDraft) === DEFAULT_RETURN_DAYS ? '(padrão atual)' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { days: 15, label: '15 dias' },
                    { days: 20, label: '20 dias (padrão)' },
                    { days: 30, label: '30 dias' },
                    { days: 45, label: '45 dias' },
                    { days: 60, label: '60 dias' }
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => {
                        setReturnDaysDraft(String(opt.days));
                        setReturnDaysTouched(true);
                      }}
                      className={`px-3 py-2 min-h-[38px] rounded-xl text-xs font-semibold transition-colors tabular-nums ${
                        Number(returnDaysDraft) === opt.days
                          ? 'bg-black text-white dark:bg-[#D4AF37] dark:text-black'
                          : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-[#D4AF37]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Você poderá alterar esse prazo a qualquer momento em{' '}
                <Link to="/admin/settings" className="text-[#B8901F] dark:text-[#D4AF37] font-semibold hover:underline">
                  Configurações
                </Link>
                . Nenhum registro em {terms.clientPlural.toLowerCase()}, agendamento ou mensagem é criado automaticamente.
              </p>
            </div>
          )}

          {/* Footer Action Bar */}
          <div className="pt-5 border-t border-gray-100 dark:border-zinc-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {prevStepId && (
                <button
                  type="button"
                  disabled={savingStep}
                  onClick={handleGoBack}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              )}

              <button
                type="button"
                disabled={savingStep}
                onClick={handleSkipCurrentStep}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                <SkipForward className="w-4 h-4" />
                <span>{activeStep === 'return_period' ? 'Pular e concluir' : 'Pular por enquanto'}</span>
              </button>
            </div>

            <div className="flex items-center justify-end">
              {activeStep === 'niche' && (
                <button
                  type="button"
                  disabled={savingStep}
                  onClick={handleConfirmNiche}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#D4AF37] text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingStep && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Confirmar nicho e continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeStep === 'services' && (
                <button
                  type="button"
                  disabled={savingStep}
                  onClick={handleAdvanceFromServices}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#D4AF37] text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingStep && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{activeServices.length > 0 ? 'Continuar' : 'Continuar mesmo assim'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeStep === 'professionals' && (
                <button
                  type="button"
                  disabled={savingStep}
                  onClick={() => handleAdvanceFromProfessionals(activeProfessionals.length === 0)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#D4AF37] text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingStep && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{activeProfessionals.length > 0 ? 'Continuar' : 'Atendo sozinho · Continuar'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeStep === 'hours' && (
                <button
                  type="button"
                  disabled={savingStep}
                  onClick={handleSaveHoursStep}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#D4AF37] text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingStep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  <span>Salvar horários e continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeStep === 'public_link' && (
                <button
                  type="button"
                  disabled={savingStep}
                  onClick={handleConfirmPublicLink}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#D4AF37] text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingStep && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Confirmar link e continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {activeStep === 'return_period' && (
                <button
                  type="button"
                  disabled={savingStep}
                  onClick={() => handleCompleteOnboarding(false)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#D4AF37] text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingStep ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Salvar e concluir onboarding</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
