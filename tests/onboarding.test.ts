import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RETURN_DAYS,
  ONBOARDING_STEP_IDS,
  applyOnboardingPatch,
  computeOnboardingSnapshot,
  getNextOnboardingStep,
  getPreviousOnboardingStep,
  mergeSettingsPreservingMetadata,
  normalizeReturnDays,
  resolveReturnDays,
  shouldShowTrialModal
} from '../src/lib/onboarding.js';
import { SEGMENTS } from '../src/lib/segments.js';

describe('Onboarding guiado — Novo cadastro', () => {
  it('inicia novo estabelecimento vazio com nicho, retorno padrão de 20 dias e sem dados fictícios', () => {
    const snapshot = computeOnboardingSnapshot({
      shop: {
        id: 'shop-new-1',
        name: 'Clínica Aurora',
        slug: 'clinica-aurora',
        segment: 'aesthetics'
      },
      rawConfig: {
        _onboarding: {
          status: 'not_started',
          currentStep: 'niche',
          completedSteps: [],
          skippedSteps: []
        }
      },
      activeServicesCount: 0,
      activeProfessionalsCount: 0
    });

    assert.equal(snapshot.segmentId, 'aesthetics');
    assert.equal(snapshot.returnDays, DEFAULT_RETURN_DAYS);
    assert.equal(snapshot.isReturnDaysCustom, false);
    assert.equal(snapshot.completedCount, 0);
    assert.equal(snapshot.totalCount, ONBOARDING_STEP_IDS.length);
    assert.equal(snapshot.recommendedStep, 'niche');
    assert.equal(snapshot.shouldPromptOnboarding, true);
    assert.equal(snapshot.readiness.bookingReady, false);
    assert.ok(snapshot.readiness.missingForBooking.some((m) => m.includes('procedimento')));
    assert.ok(snapshot.readiness.missingForBooking.some((m) => m.includes('esteticista')));
  });

  it('detecta serviços iniciais e profissional dono já criados no cadastro sem pedir novamente', () => {
    const snapshot = computeOnboardingSnapshot({
      shop: {
        id: 'shop-new-2',
        name: 'Studio Pilates Vida',
        slug: 'pilates-vida',
        segment: 'pilates'
      },
      rawConfig: {
        _onboarding: {
          status: 'not_started',
          currentStep: 'niche',
          completedSteps: [],
          skippedSteps: []
        }
      },
      activeServicesCount: 3,
      activeProfessionalsCount: 1
    });

    const byId = Object.fromEntries(snapshot.steps.map((s) => [s.id, s]));
    assert.equal(byId.services.completed, true);
    assert.equal(byId.services.detectedFromExistingData, true);
    assert.equal(byId.services.statusLabel, 'Detectado');
    assert.equal(byId.professionals.completed, true);
    assert.equal(byId.professionals.detectedFromExistingData, true);
    assert.equal(byId.hours.completed, false);
    assert.equal(byId.public_link.completed, false);
    assert.equal(byId.return_period.completed, false);
    assert.equal(snapshot.returnDays, 20);
    assert.equal(snapshot.readiness.bookingReady, true);
  });
});

describe('Onboarding guiado — Retomada de progresso, navegação e etapas opcionais', () => {
  it('salva progresso, permite sair e retomar exatamente da etapa pendente', () => {
    const t1 = '2026-06-01T10:00:00.000Z';
    let rawConfig: Record<string, any> = {};

    // Etapa 1 concluída -> avança para etapa 2
    rawConfig = applyOnboardingPatch(
      rawConfig,
      {
        status: 'in_progress',
        nicheConfirmed: true,
        completeStep: 'niche',
        currentStep: 'services'
      },
      t1
    );

    const midSnapshot = computeOnboardingSnapshot({
      shop: { id: 'shop-resume', name: 'Espaço Mente Clara', slug: 'mente-clara', segment: 'psychology' },
      rawConfig,
      activeServicesCount: 0,
      activeProfessionalsCount: 0
    });

    assert.equal(midSnapshot.state.status, 'in_progress');
    assert.equal(midSnapshot.state.currentStep, 'services');
    assert.equal(midSnapshot.recommendedStep, 'services');
    assert.equal(midSnapshot.steps.find((s) => s.id === 'niche')?.completed, true);

    // Usuário cadastra serviços e sai na etapa de horários
    rawConfig = applyOnboardingPatch(
      rawConfig,
      {
        completeStep: 'services',
        skipStep: 'professionals',
        currentStep: 'hours'
      },
      '2026-06-01T10:15:00.000Z'
    );

    const resumed = computeOnboardingSnapshot({
      shop: { id: 'shop-resume', name: 'Espaço Mente Clara', slug: 'mente-clara', segment: 'psychology' },
      rawConfig,
      activeServicesCount: 2,
      activeProfessionalsCount: 0
    });

    assert.equal(resumed.recommendedStep, 'hours');
    assert.equal(resumed.steps.find((s) => s.id === 'professionals')?.skipped, true);
    assert.equal(resumed.steps.find((s) => s.id === 'professionals')?.pending, true);
    assert.equal(resumed.steps.find((s) => s.id === 'professionals')?.statusLabel, 'Pulado por enquanto');
  });

  it('permite voltar etapas, pular opcionais e concluir sem bloquear o painel mantendo pendências no Dashboard', () => {
    assert.equal(getPreviousOnboardingStep('niche'), null);
    assert.equal(getPreviousOnboardingStep('hours'), 'professionals');
    assert.equal(getNextOnboardingStep('niche'), 'services');
    assert.equal(getNextOnboardingStep('return_period'), null);

    let rawConfig: Record<string, any> = {};
    rawConfig = applyOnboardingPatch(rawConfig, {
      nicheConfirmed: true,
      skipStep: 'professionals',
      publicLinkReviewed: true,
      status: 'completed'
    });
    rawConfig = applyOnboardingPatch(rawConfig, {
      skipStep: 'return_period',
      status: 'completed'
    });

    const afterFinish = computeOnboardingSnapshot({
      shop: { id: 'shop-skip', name: 'Pet Care Sul', slug: 'pet-care-sul', segment: 'pet_shop' },
      rawConfig,
      activeServicesCount: 1,
      activeProfessionalsCount: 0
    });

    assert.equal(afterFinish.state.status, 'completed');
    assert.equal(afterFinish.shouldPromptOnboarding, false);
    // Ainda exibe pendências no painel para etapas puladas/não concluídas
    const pendingIds = afterFinish.pendingSteps.map((s) => s.id);
    assert.deepEqual(pendingIds, ['professionals', 'hours', 'return_period']);
    // Prazo de retorno padrão de 20 dias permanece intacto quando pulado
    assert.equal(afterFinish.returnDays, 20);
    assert.equal(afterFinish.isReturnDaysCustom, false);
  });
});

describe('Estabelecimento já parcialmente configurado e preservação de dados existentes', () => {
  it('reconhece estabelecimento legado parcialmente configurado sem pedir dados existentes e mantém padrão de 20 dias', () => {
    const legacyConfig = {
      monday: { open: '09:00', close: '18:00', isClosed: false },
      tuesday: { open: '09:00', close: '18:00', isClosed: false },
      _scheduleConfirmed: true
      // Sem _onboarding e sem inactivityReturnDays (conta antiga)
    };

    const snapshot = computeOnboardingSnapshot({
      shop: {
        id: 'shop-legacy',
        name: 'Auto Estética Prime',
        slug: 'auto-prime',
        segment: 'auto_detailing'
      },
      rawConfig: legacyConfig,
      activeServicesCount: 5,
      activeProfessionalsCount: 2
    });

    const byId = Object.fromEntries(snapshot.steps.map((s) => [s.id, s]));
    assert.equal(byId.niche.completed, true);
    assert.equal(byId.services.completed, true);
    assert.equal(byId.professionals.completed, true);
    assert.equal(byId.hours.completed, true);
    assert.equal(byId.public_link.completed, false);
    assert.equal(byId.return_period.completed, false);
    assert.equal(snapshot.recommendedStep, 'public_link');
    assert.equal(snapshot.returnDays, 20);
    assert.equal(snapshot.isReturnDaysCustom, false);
    assert.equal(snapshot.readiness.bookingReady, true);
  });

  it('preserva _onboarding, _shareConfirmed e inactivityReturnDays ao salvar horários em /api/admin/settings', () => {
    const existingRaw = {
      monday: { open: '09:00', close: '18:00', isClosed: false },
      _shareConfirmed: true,
      inactivityReturnDays: 30,
      _onboarding: {
        status: 'in_progress',
        currentStep: 'hours',
        completedSteps: ['niche', 'services'],
        skippedSteps: ['professionals']
      }
    };

    const merged = mergeSettingsPreservingMetadata(
      existingRaw,
      {
        monday: { open: '08:00', close: '19:00', isClosed: false },
        saturday: { open: '08:00', close: '14:00', isClosed: false }
      },
      true
    );

    assert.equal(merged.monday.open, '08:00');
    assert.equal(merged.saturday.close, '14:00');
    assert.equal(merged._scheduleConfirmed, true);
    assert.equal(merged._shareConfirmed, true);
    assert.equal(merged.inactivityReturnDays, 30);
    assert.deepEqual(merged._onboarding, existingRaw._onboarding);
  });

  it('valida limites do prazo de retorno e preserva padrão de 20 dias quando ausente', () => {
    assert.deepEqual(resolveReturnDays(null), { returnDays: 20, isCustom: false });
    assert.deepEqual(resolveReturnDays({}), { returnDays: 20, isCustom: false });
    assert.deepEqual(resolveReturnDays({ inactivityReturnDays: 45 }), { returnDays: 45, isCustom: true });
    assert.equal(normalizeReturnDays(0), null);
    assert.equal(normalizeReturnDays(-5), null);
    assert.equal(normalizeReturnDays(400), null);
    assert.equal(normalizeReturnDays('30'), 30);

    assert.throws(() => {
      applyOnboardingPatch({}, { inactivityReturnDays: 0 });
    });
  });
});

describe('Vocabulário dinâmico para todos os 16 nichos (sem rótulos fixos de Barbearia)', () => {
  it('adapta corretamente termos para nichos distintos (Estética, Psicologia, Pilates, Pet Shop, Estética Automotiva, Marcenaria)', () => {
    const samples = [
      { id: 'aesthetics', service: 'procedimentos', professional: 'especialistas', client: 'pacientes' },
      { id: 'psychology', service: 'sessões', professional: 'psicólogos', client: 'pacientes' },
      { id: 'pilates', service: 'aulas', professional: 'instrutores', client: 'alunos' },
      { id: 'pet_shop', service: 'serviços', professional: 'tosadores', client: 'tutores' },
      { id: 'auto_detailing', service: 'serviços', professional: 'profissionais', client: 'clientes' },
      { id: 'woodwork', service: 'serviços', professional: 'marceneiros', client: 'clientes' }
    ];

    for (const sample of samples) {
      const snap = computeOnboardingSnapshot({
        shop: {
          id: `shop-${sample.id}`,
          name: `Negócio ${sample.id}`,
          slug: `negocio-${sample.id}`,
          segment: sample.id
        },
        rawConfig: {},
        activeServicesCount: 0,
        activeProfessionalsCount: 0
      });

      const joinedText = snap.steps.map((s) => `${s.title} ${s.description} ${s.cta}`).join(' ').toLowerCase();
      assert.ok(joinedText.includes(sample.service), `Esperado "${sample.service}" no nicho ${sample.id}`);
      assert.ok(joinedText.includes(sample.professional), `Esperado "${sample.professional}" no nicho ${sample.id}`);
      assert.ok(joinedText.includes(sample.client), `Esperado "${sample.client}" no nicho ${sample.id}`);
      assert.ok(!joinedText.includes('barbearia'), `Não deve citar barbearia no nicho ${sample.id}`);
      assert.ok(!joinedText.includes('barbeiro'), `Não deve citar barbeiro no nicho ${sample.id}`);
    }
  });

  it('cobre todos os 16 nichos registrados em SEGMENTS sem vazamento de termos de Barbearia', () => {
    const allSegments = Object.values(SEGMENTS);
    assert.equal(allSegments.length, 16);
    assert.equal(Object.keys(SEGMENTS).length, 16);

    for (const seg of allSegments) {
      const snap = computeOnboardingSnapshot({
        shop: {
          id: `shop-all-${seg.id}`,
          name: seg.name,
          slug: `slug-${seg.id}`,
          segment: seg.id
        },
        rawConfig: {},
        activeServicesCount: 0,
        activeProfessionalsCount: 0
      });

      assert.equal(snap.segmentId, seg.id);
      assert.equal(snap.segmentName, seg.name);
      assert.equal(snap.steps.length, 6);

      if (seg.id !== 'barbershop') {
        const allCopy = [
          ...snap.steps.map((s) => `${s.title} ${s.shortTitle} ${s.description} ${s.cta} ${s.reviewCta}`),
          ...snap.readiness.missingForBooking
        ]
          .join(' ')
          .toLowerCase();

        assert.ok(!allCopy.includes('barbearia'), `Termo fixo "barbearia" vazou no nicho ${seg.id}`);
        assert.ok(!allCopy.includes('barbeiro'), `Termo fixo "barbeiro" vazou no nicho ${seg.id}`);
      }
    }
  });
});

describe('Pop-up de período de testes — exibição única na primeira tela', () => {
  const now = new Date('2026-06-01T12:00:00.000Z').getTime();
  const expiresInFiveDays = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();

  it('exibe uma única vez na primeira tela (/admin) para conta em trial ativo', () => {
    const firstEntry = shouldShowTrialModal({
      role: 'admin',
      isMaster: false,
      isImpersonating: false,
      planId: 'trial',
      expiresAt: expiresInFiveDays,
      pathname: '/admin',
      alreadyShownInSession: false,
      nowMs: now
    });
    assert.deepEqual(firstEntry, { show: true, daysRemaining: 5 });

    const secondEntrySameSession = shouldShowTrialModal({
      role: 'admin',
      isMaster: false,
      isImpersonating: false,
      planId: 'trial',
      expiresAt: expiresInFiveDays,
      pathname: '/admin',
      alreadyShownInSession: true,
      nowMs: now
    });
    assert.equal(secondEntrySameSession.show, false);
  });

  it('não exibe em subtelas como /admin/onboarding, /admin/agenda ou /admin/assinatura', () => {
    for (const path of ['/admin/onboarding', '/admin/agenda', '/admin/services', '/admin/assinatura']) {
      const result = shouldShowTrialModal({
        role: 'admin',
        isMaster: false,
        isImpersonating: false,
        planId: 'trial',
        expiresAt: expiresInFiveDays,
        pathname: path,
        alreadyShownInSession: false,
        nowMs: now
      });
      assert.equal(result.show, false, `Pop-up não deve aparecer em ${path}`);
    }
  });

  it('não exibe para plano pago, master, profissional comum, impersonação ou trial expirado', () => {
    assert.equal(
      shouldShowTrialModal({
        role: 'admin',
        isMaster: false,
        isImpersonating: false,
        planId: 'pro',
        expiresAt: expiresInFiveDays,
        pathname: '/admin',
        alreadyShownInSession: false,
        nowMs: now
      }).show,
      false
    );

    assert.equal(
      shouldShowTrialModal({
        role: 'master',
        isMaster: true,
        isImpersonating: false,
        planId: 'trial',
        expiresAt: expiresInFiveDays,
        pathname: '/admin',
        alreadyShownInSession: false,
        nowMs: now
      }).show,
      false
    );

    assert.equal(
      shouldShowTrialModal({
        role: 'admin',
        isMaster: false,
        isImpersonating: true,
        planId: 'trial',
        expiresAt: expiresInFiveDays,
        pathname: '/admin',
        alreadyShownInSession: false,
        nowMs: now
      }).show,
      false
    );

    assert.equal(
      shouldShowTrialModal({
        role: 'admin',
        isMaster: false,
        isImpersonating: false,
        planId: 'trial',
        expiresAt: new Date(now - 60_000).toISOString(),
        pathname: '/admin',
        alreadyShownInSession: false,
        nowMs: now
      }).show,
      false
    );
  });
});
