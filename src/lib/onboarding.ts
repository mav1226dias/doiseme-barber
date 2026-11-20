import { getSegment, SEGMENTS, SegmentPreset } from './segments.js';

export const DEFAULT_RETURN_DAYS = 20;
export const MIN_RETURN_DAYS = 1;
export const MAX_RETURN_DAYS = 365;

export const ONBOARDING_STEP_IDS = [
  'niche',
  'services',
  'professionals',
  'hours',
  'public_link',
  'return_period'
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export interface StoredOnboardingState {
  status: OnboardingStatus;
  currentStep?: OnboardingStepId | null;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  soloOperation?: boolean;
  nicheConfirmed?: boolean;
  publicLinkReviewed?: boolean;
  returnPeriodReviewed?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
}

export interface OnboardingStepSnapshot {
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

export interface OnboardingReadiness {
  hasServices: boolean;
  hasProfessionals: boolean;
  hasOpenHours: boolean;
  hasSlug: boolean;
  bookingReady: boolean;
  missingForBooking: string[];
}

export interface OnboardingSnapshotInput {
  shop: {
    id?: string;
    name?: string | null;
    slug?: string | null;
    segment?: string | null;
    whatsapp?: string | null;
    phone?: string | null;
    logo_url?: string | null;
    address?: string | null;
  };
  rawConfig?: Record<string, any> | null;
  activeServicesCount: number;
  activeProfessionalsCount: number;
  hasShopPhoto?: boolean;
}

export interface OnboardingSnapshot {
  shopId: string;
  shopName: string;
  shopSlug: string;
  segmentId: string;
  segmentName: string;
  terms: SegmentPreset['terms'];
  returnDays: number;
  isReturnDaysCustom: boolean;
  state: StoredOnboardingState;
  steps: OnboardingStepSnapshot[];
  pendingSteps: OnboardingStepSnapshot[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  recommendedStep: OnboardingStepId;
  shouldPromptOnboarding: boolean;
  readiness: OnboardingReadiness;
}

export interface OnboardingPatchInput {
  status?: OnboardingStatus;
  currentStep?: OnboardingStepId | null;
  completeStep?: OnboardingStepId;
  skipStep?: OnboardingStepId;
  unskipStep?: OnboardingStepId;
  soloOperation?: boolean;
  nicheConfirmed?: boolean;
  publicLinkReviewed?: boolean;
  returnPeriodReviewed?: boolean;
  inactivityReturnDays?: number;
}

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function isValidOnboardingStepId(value: unknown): value is OnboardingStepId {
  return typeof value === 'string' && (ONBOARDING_STEP_IDS as readonly string[]).includes(value);
}

export function normalizeReturnDays(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < MIN_RETURN_DAYS || rounded > MAX_RETURN_DAYS) return null;
  return rounded;
}

export function resolveReturnDays(rawConfig?: Record<string, any> | null): {
  returnDays: number;
  isCustom: boolean;
} {
  const configured = normalizeReturnDays(rawConfig?.inactivityReturnDays);
  if (configured !== null) {
    return { returnDays: configured, isCustom: true };
  }
  return { returnDays: DEFAULT_RETURN_DAYS, isCustom: false };
}

export function normalizeStoredOnboardingState(raw: any): StoredOnboardingState {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const validStatuses: OnboardingStatus[] = ['not_started', 'in_progress', 'completed', 'dismissed'];
  const status: OnboardingStatus = validStatuses.includes(obj.status) ? obj.status : 'not_started';
  const completedSteps: OnboardingStepId[] = Array.isArray(obj.completedSteps)
    ? Array.from(new Set<OnboardingStepId>(obj.completedSteps.filter(isValidOnboardingStepId)))
    : [];
  const skippedSteps: OnboardingStepId[] = Array.isArray(obj.skippedSteps)
    ? Array.from(new Set<OnboardingStepId>(obj.skippedSteps.filter(isValidOnboardingStepId)))
    : [];
  const currentStep = isValidOnboardingStepId(obj.currentStep) ? obj.currentStep : null;

  return {
    status,
    currentStep,
    completedSteps,
    skippedSteps,
    soloOperation: Boolean(obj.soloOperation),
    nicheConfirmed: Boolean(obj.nicheConfirmed),
    publicLinkReviewed: Boolean(obj.publicLinkReviewed),
    returnPeriodReviewed: Boolean(obj.returnPeriodReviewed),
    startedAt: typeof obj.startedAt === 'string' ? obj.startedAt : null,
    completedAt: typeof obj.completedAt === 'string' ? obj.completedAt : null,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null
  };
}

export function applyOnboardingPatch(
  rawConfig: Record<string, any> | null | undefined,
  patch: OnboardingPatchInput,
  nowIso: string = new Date().toISOString()
): Record<string, any> {
  const baseConfig: Record<string, any> =
    rawConfig && typeof rawConfig === 'object' ? { ...rawConfig } : {};
  const current = normalizeStoredOnboardingState(baseConfig._onboarding);

  const completedSet = new Set<OnboardingStepId>(current.completedSteps);
  const skippedSet = new Set<OnboardingStepId>(current.skippedSteps);

  if (patch.completeStep && isValidOnboardingStepId(patch.completeStep)) {
    completedSet.add(patch.completeStep);
    skippedSet.delete(patch.completeStep);
  }

  if (patch.skipStep && isValidOnboardingStepId(patch.skipStep)) {
    if (!completedSet.has(patch.skipStep)) {
      skippedSet.add(patch.skipStep);
    }
  }

  if (patch.unskipStep && isValidOnboardingStepId(patch.unskipStep)) {
    skippedSet.delete(patch.unskipStep);
  }

  const nextState: StoredOnboardingState = {
    ...current,
    completedSteps: Array.from(completedSet),
    skippedSteps: Array.from(skippedSet),
    startedAt: current.startedAt || nowIso,
    updatedAt: nowIso
  };

  if (patch.currentStep !== undefined) {
    nextState.currentStep = isValidOnboardingStepId(patch.currentStep) ? patch.currentStep : null;
  }
  if (patch.soloOperation !== undefined) {
    nextState.soloOperation = Boolean(patch.soloOperation);
  }
  if (patch.nicheConfirmed !== undefined) {
    nextState.nicheConfirmed = Boolean(patch.nicheConfirmed);
    if (patch.nicheConfirmed) {
      completedSet.add('niche');
      skippedSet.delete('niche');
    }
  }
  if (patch.publicLinkReviewed !== undefined) {
    nextState.publicLinkReviewed = Boolean(patch.publicLinkReviewed);
    if (patch.publicLinkReviewed) {
      completedSet.add('public_link');
      skippedSet.delete('public_link');
      baseConfig._shareConfirmed = true;
    }
  }
  if (patch.returnPeriodReviewed !== undefined) {
    nextState.returnPeriodReviewed = Boolean(patch.returnPeriodReviewed);
    if (patch.returnPeriodReviewed) {
      completedSet.add('return_period');
      skippedSet.delete('return_period');
    }
  }

  nextState.completedSteps = Array.from(completedSet);
  nextState.skippedSteps = Array.from(skippedSet);

  if (patch.status) {
    nextState.status = patch.status;
    if (patch.status === 'completed') {
      nextState.completedAt = nowIso;
    }
  } else if (nextState.status === 'not_started') {
    nextState.status = 'in_progress';
  }

  if (patch.inactivityReturnDays !== undefined) {
    const validDays = normalizeReturnDays(patch.inactivityReturnDays);
    if (validDays === null) {
      throw new Error(`O prazo de retorno deve ser um número entre ${MIN_RETURN_DAYS} e ${MAX_RETURN_DAYS} dias.`);
    }
    baseConfig.inactivityReturnDays = validDays;
    nextState.returnPeriodReviewed = true;
    if (!nextState.completedSteps.includes('return_period')) {
      nextState.completedSteps.push('return_period');
    }
    nextState.skippedSteps = nextState.skippedSteps.filter((id) => id !== 'return_period');
  }

  baseConfig._onboarding = nextState;
  return baseConfig;
}

export function mergeSettingsPreservingMetadata(
  existingRawConfig: Record<string, any> | null | undefined,
  incomingBody: Record<string, any> | null | undefined,
  confirmSchedule: boolean = true
): Record<string, any> {
  const existing = existingRawConfig && typeof existingRawConfig === 'object' ? { ...existingRawConfig } : {};
  const incoming = incomingBody && typeof incomingBody === 'object' ? incomingBody : {};

  const merged: Record<string, any> = { ...existing };

  for (const day of DAY_KEYS) {
    if (incoming[day] && typeof incoming[day] === 'object') {
      merged[day] = {
        ...(existing[day] && typeof existing[day] === 'object' ? existing[day] : {}),
        ...incoming[day]
      };
    }
  }

  if (incoming.inactivityReturnDays !== undefined) {
    const validDays = normalizeReturnDays(incoming.inactivityReturnDays);
    if (validDays === null) {
      throw new Error(`O prazo de retorno deve estar entre ${MIN_RETURN_DAYS} e ${MAX_RETURN_DAYS} dias.`);
    }
    merged.inactivityReturnDays = validDays;
  }

  if (confirmSchedule) {
    merged._scheduleConfirmed = true;
  }

  return merged;
}

function hasAnyOpenDay(rawConfig?: Record<string, any> | null): boolean {
  if (!rawConfig || typeof rawConfig !== 'object') {
    // Default shop schedule has Tue-Sat open
    return true;
  }
  const presentDays = DAY_KEYS.filter((day) => rawConfig[day] && typeof rawConfig[day] === 'object');
  if (presentDays.length === 0) return true;
  return presentDays.some((day) => !rawConfig[day].isClosed);
}

export function getNextOnboardingStep(current: OnboardingStepId): OnboardingStepId | null {
  const idx = ONBOARDING_STEP_IDS.indexOf(current);
  if (idx < 0 || idx >= ONBOARDING_STEP_IDS.length - 1) return null;
  return ONBOARDING_STEP_IDS[idx + 1];
}

export function getPreviousOnboardingStep(current: OnboardingStepId): OnboardingStepId | null {
  const idx = ONBOARDING_STEP_IDS.indexOf(current);
  if (idx <= 0) return null;
  return ONBOARDING_STEP_IDS[idx - 1];
}

export function computeOnboardingSnapshot(input: OnboardingSnapshotInput): OnboardingSnapshot {
  const shop = input.shop || {};
  const rawConfig = input.rawConfig && typeof input.rawConfig === 'object' ? input.rawConfig : {};
  const preset = getSegment(shop.segment);
  const terms = preset.terms;
  const stored = normalizeStoredOnboardingState(rawConfig._onboarding);
  const { returnDays, isCustom: isReturnDaysCustom } = resolveReturnDays(rawConfig);

  const hasValidSlug = Boolean(shop.slug && String(shop.slug).trim().length >= 3);
  const hasServices = Number(input.activeServicesCount || 0) > 0;
  const hasProfessionals = Number(input.activeProfessionalsCount || 0) > 0;
  const hasScheduleConfirmed = Boolean(rawConfig._scheduleConfirmed);
  const hasOpenHours = hasAnyOpenDay(rawConfig);
  const hasExistingEstablishedSetup = hasServices && hasProfessionals && hasScheduleConfirmed;

  const hasExplicitNiche = Boolean(shop.segment && SEGMENTS[String(shop.segment).trim().toLowerCase()]);
  const nicheCompleted = Boolean(
    stored.nicheConfirmed ||
    stored.completedSteps.includes('niche') ||
    (hasExplicitNiche && hasExistingEstablishedSetup)
  );
  const nicheDetected = hasExplicitNiche && (hasExistingEstablishedSetup || !stored.nicheConfirmed);

  const servicesCompleted = hasServices;
  const servicesDetected = hasServices && !stored.completedSteps.includes('services');

  const professionalsCompleted = hasProfessionals;
  const professionalsDetected = hasProfessionals && !stored.completedSteps.includes('professionals');

  const hoursCompleted = hasScheduleConfirmed && hasOpenHours;
  const hoursDetected = hoursCompleted && !stored.completedSteps.includes('hours');

  const publicLinkCompleted =
    hasValidSlug &&
    Boolean(
      rawConfig._shareConfirmed ||
      stored.publicLinkReviewed ||
      stored.completedSteps.includes('public_link')
    );
  const publicLinkDetected = Boolean(
    hasValidSlug &&
    rawConfig._shareConfirmed &&
    !stored.publicLinkReviewed
  );

  const returnPeriodCompleted = Boolean(
    stored.returnPeriodReviewed ||
    stored.completedSteps.includes('return_period') ||
    isReturnDaysCustom
  );
  const returnPeriodDetected = isReturnDaysCustom && !stored.returnPeriodReviewed;

  const servicePluralLower = terms.servicePlural.toLowerCase();
  const professionalPluralLower = terms.professionalPlural.toLowerCase();
  const clientPluralLower = terms.clientPlural.toLowerCase();

  const buildStep = (
    id: OnboardingStepId,
    order: number,
    config: {
      title: string;
      shortTitle: string;
      description: string;
      optional: boolean;
      completed: boolean;
      detectedFromExistingData: boolean;
      path: string;
      cta: string;
      reviewCta: string;
    }
  ): OnboardingStepSnapshot => {
    const skipped = !config.completed && stored.skippedSteps.includes(id);
    const pending = !config.completed;
    let statusLabel = 'Pendente';
    if (config.completed) {
      statusLabel = config.detectedFromExistingData ? 'Detectado' : 'Concluído';
    } else if (skipped) {
      statusLabel = 'Pulado por enquanto';
    }
    return {
      id,
      order,
      ...config,
      skipped,
      pending,
      statusLabel,
      onboardingPath: `/admin/onboarding?step=${id}`
    };
  };

  const steps: OnboardingStepSnapshot[] = [
    buildStep('niche', 1, {
      title: 'Confirmar nicho do estabelecimento',
      shortTitle: 'Nicho',
      description: `Nicho ativo: ${preset.name}. Ajusta os rótulos do painel para ${professionalPluralLower}, ${servicePluralLower} e ${clientPluralLower}.`,
      optional: false,
      completed: nicheCompleted,
      detectedFromExistingData: nicheDetected,
      path: '/admin/profile',
      cta: 'Confirmar nicho',
      reviewCta: 'Alterar nicho'
    }),
    buildStep('services', 2, {
      title: `Cadastrar ou revisar ${servicePluralLower}`,
      shortTitle: terms.servicePlural,
      description: hasServices
        ? `${input.activeServicesCount} ${input.activeServicesCount === 1 ? terms.service.toLowerCase() : servicePluralLower} ativos disponíveis para agendamento.`
        : `Adicione ao menos um ${terms.service.toLowerCase()} com duração e valor para liberar o agendamento público.`,
      optional: false,
      completed: servicesCompleted,
      detectedFromExistingData: servicesDetected,
      path: '/admin/services',
      cta: `Cadastrar ${servicePluralLower}`,
      reviewCta: `Revisar ${servicePluralLower}`
    }),
    buildStep('professionals', 3, {
      title: `Configurar ${professionalPluralLower}`,
      shortTitle: terms.professionalPlural,
      description: hasProfessionals
        ? `${input.activeProfessionalsCount} ${input.activeProfessionalsCount === 1 ? terms.professional.toLowerCase() : professionalPluralLower} ativos na agenda.`
        : `Cadastre quem realiza os atendimentos (você ou sua equipe) ou pule se quiser configurar depois.`,
      optional: true,
      completed: professionalsCompleted,
      detectedFromExistingData: professionalsDetected,
      path: '/admin/barbers',
      cta: `Configurar ${professionalPluralLower}`,
      reviewCta: `Revisar ${professionalPluralLower}`
    }),
    buildStep('hours', 4, {
      title: 'Definir horários de atendimento',
      shortTitle: 'Horários',
      description: hoursCompleted
        ? 'Horários de abertura, fechamento e intervalos confirmados na agenda.'
        : 'Revise os dias abertos e horários de funcionamento usados para gerar horários disponíveis.',
      optional: false,
      completed: hoursCompleted,
      detectedFromExistingData: hoursDetected,
      path: '/admin/settings',
      cta: 'Definir horários',
      reviewCta: 'Ajustar horários'
    }),
    buildStep('public_link', 5, {
      title: 'Conferir link público de agendamento',
      shortTitle: 'Link público',
      description: hasValidSlug
        ? `Confira e compartilhe /b/${shop.slug} para receber o primeiro agendamento de ${clientPluralLower}.`
        : 'Defina o endereço público do seu estabelecimento para receber agendamentos online.',
      optional: false,
      completed: publicLinkCompleted,
      detectedFromExistingData: publicLinkDetected,
      path: '/admin/profile',
      cta: 'Conferir link',
      reviewCta: 'Ver link público'
    }),
    buildStep('return_period', 6, {
      title: 'Revisar prazo de retorno',
      shortTitle: 'Retorno',
      description: `Prazo atual: ${returnDays} dias sem novo agendamento para sinalizar ${clientPluralLower} para retorno.`,
      optional: true,
      completed: returnPeriodCompleted,
      detectedFromExistingData: returnPeriodDetected,
      path: '/admin/settings',
      cta: 'Revisar prazo',
      reviewCta: 'Ajustar prazo'
    })
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const pendingSteps = steps.filter((s) => s.pending);

  // Determine the smartest starting/resume step without re-asking completed data
  let recommendedStep: OnboardingStepId = 'niche';
  if (stored.status === 'in_progress' && stored.currentStep && isValidOnboardingStepId(stored.currentStep)) {
    const savedStep = steps.find((s) => s.id === stored.currentStep);
    if (savedStep && !savedStep.completed) {
      recommendedStep = savedStep.id;
    } else {
      const firstNotDone = steps.find((s) => !s.completed && !s.skipped) || steps.find((s) => !s.completed);
      recommendedStep = firstNotDone ? firstNotDone.id : 'public_link';
    }
  } else {
    const firstNotDone = steps.find((s) => !s.completed && !s.skipped) || steps.find((s) => !s.completed);
    recommendedStep = firstNotDone ? firstNotDone.id : 'public_link';
  }

  const missingForBooking: string[] = [];
  if (!hasServices) missingForBooking.push(`Cadastrar ao menos 1 ${terms.service.toLowerCase()}`);
  if (!hasProfessionals) missingForBooking.push(`Ativar ao menos 1 ${terms.professional.toLowerCase()}`);
  if (!hasOpenHours) missingForBooking.push('Definir ao menos 1 dia aberto nos horários');
  if (!hasValidSlug) missingForBooking.push('Definir o link público (/b/seu-espaco)');

  const bookingReady = missingForBooking.length === 0;
  const shouldPromptOnboarding =
    stored.status !== 'completed' &&
    stored.status !== 'dismissed' &&
    pendingSteps.length > 0;

  return {
    shopId: String(shop.id || ''),
    shopName: String(shop.name || ''),
    shopSlug: String(shop.slug || ''),
    segmentId: preset.id,
    segmentName: preset.name,
    terms,
    returnDays,
    isReturnDaysCustom,
    state: stored,
    steps,
    pendingSteps,
    completedCount,
    totalCount,
    progressPercent,
    recommendedStep,
    shouldPromptOnboarding,
    readiness: {
      hasServices,
      hasProfessionals,
      hasOpenHours,
      hasSlug: hasValidSlug,
      bookingReady,
      missingForBooking
    }
  };
}

export interface TrialModalCheckInput {
  role: 'master' | 'admin' | 'barber' | null;
  isMaster: boolean;
  isImpersonating: boolean;
  planId?: string | null;
  expiresAt?: string | null;
  pathname: string;
  alreadyShownInSession: boolean;
  nowMs?: number;
}

export function shouldShowTrialModal(input: TrialModalCheckInput): {
  show: boolean;
  daysRemaining: number;
} {
  if (input.isMaster || input.isImpersonating || input.role !== 'admin') {
    return { show: false, daysRemaining: 0 };
  }
  if (String(input.planId || 'trial') !== 'trial') {
    return { show: false, daysRemaining: 0 };
  }
  if (!input.expiresAt) {
    return { show: false, daysRemaining: 0 };
  }

  const normalizedPath = (input.pathname || '').replace(/\/+$/, '') || '/';
  // Strictly show ONLY on the first entry screen (/admin)
  if (normalizedPath !== '/admin') {
    return { show: false, daysRemaining: 0 };
  }

  const now = input.nowMs ?? Date.now();
  const expiresMs = new Date(input.expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) {
    return { show: false, daysRemaining: 0 };
  }

  const msLeft = expiresMs - now;
  if (msLeft < 0) {
    return { show: false, daysRemaining: 0 };
  }

  const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  if (input.alreadyShownInSession) {
    return { show: false, daysRemaining };
  }

  return { show: true, daysRemaining };
}
