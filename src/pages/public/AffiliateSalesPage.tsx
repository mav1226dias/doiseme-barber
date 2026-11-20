import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CreditCard,
  Handshake,
  Menu,
  MessageCircle,
  ShieldCheck,
  X
} from 'lucide-react';
import ownerControlImg from '../../assets/images/sales_owner_control_1795203706375.jpg';
import { normalizeReferralCode, saveReferralCode, trackAffiliateClick, trackSalesChannelClick, trackSalesChannelVisit } from '../../lib/referral';
import {
  SalesGrowthPillarsSection,
  SalesPainDiagnosisSection,
  SalesRoiCalculatorSection
} from '../../components/SalesConversionSections';

interface SalesPlanOption {
  id: string;
  name: string;
  subtitle: string;
  regularMonthlyPrice: number;
  regularAnnualPrice: number;
  monthlyPrice: number;
  annualPrice: number;
  promoApplied?: boolean;
  highlighted?: boolean;
  badge?: string;
  features: string[];
}

interface PartnerSummary {
  valid: boolean;
  code: string;
  firstName: string;
  niche: string | null;
}

const PLAN_PRIORITY: Record<string, number> = {
  premium: 0,
  profissional: 1,
  essencial: 2
};

const sortPlansByProfitability = (list: SalesPlanOption[]) =>
  [...list].sort((a, b) => (PLAN_PRIORITY[a.id] ?? 99) - (PLAN_PRIORITY[b.id] ?? 99));

const PROMO_FALLBACK_PLANS: SalesPlanOption[] = [
  {
    id: 'premium',
    name: 'Plano Completo',
    subtitle: 'Máxima retenção de clientes, remarketing no WhatsApp e financeiro completo sem limites',
    regularMonthlyPrice: 139.90,
    regularAnnualPrice: 1197.00,
    monthlyPrice: 119.90,
    annualPrice: 997.00,
    promoApplied: true,
    highlighted: true,
    badge: 'Mais Lucrativo · Recomendado',
    features: [
      'Radar de clientes sumidos + remarketing em 1 clique no WhatsApp',
      'Campanhas promocionais para encher dias parados e atrair novos clientes',
      'Pacotes de sessões e planos de recorrência para caixa previsível',
      'Controle financeiro completo: entradas, despesas, comissões e lucro real',
      'Profissionais ilimitados + suporte prioritário no WhatsApp'
    ]
  },
  {
    id: 'profissional',
    name: 'Plano Pro',
    subtitle: 'Controle de agenda, equipe e financeiro completo para até 4 profissionais',
    regularMonthlyPrice: 119.90,
    regularAnnualPrice: 1039.00,
    monthlyPrice: 99.90,
    annualPrice: 859.00,
    promoApplied: true,
    highlighted: false,
    badge: 'Equipe até 4',
    features: [
      'Até 4 profissionais ativos com agenda inteligente 24h',
      'Controle financeiro diário de entradas, despesas e lucro',
      'Cálculo automático de comissões sem planilhas manuais',
      'Histórico completo de clientes para aumentar a fidelização'
    ]
  },
  {
    id: 'essencial',
    name: 'Agenda Individual',
    subtitle: 'Organize horários, fidelize clientes e controle seu caixa trabalhando sozinho',
    regularMonthlyPrice: 79.90,
    regularAnnualPrice: 659.00,
    monthlyPrice: 59.90,
    annualPrice: 479.00,
    promoApplied: true,
    highlighted: false,
    badge: '1 Profissional',
    features: [
      'Link exclusivo de captação e agendamento 24h na bio e WhatsApp',
      'Agenda inteligente sem conflitos e bloqueio de folgas em 1 clique',
      'Controle financeiro diário no celular e histórico completo de clientes',
      'Fim dos horários perdidos por demora para responder no WhatsApp'
    ]
  }
];

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AffiliateSalesPage() {
  const { code } = useParams<{ code: string }>();
  const normalizedCode = normalizeReferralCode(code);

  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [plans, setPlans] = useState<SalesPlanOption[]>(PROMO_FALLBACK_PLANS);
  const [partner, setPartner] = useState<PartnerSummary | null>(null);
  const [checkedPartner, setCheckedPartner] = useState<boolean>(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    trackSalesChannelVisit('propria');
    if (normalizedCode) {
      saveReferralCode(normalizedCode);
    }

    let cancelled = false;

    if (normalizedCode) {
      fetch(`/api/public/affiliate/${encodeURIComponent(normalizedCode)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          if (data?.valid) {
            saveReferralCode(data.code);
            trackAffiliateClick(data.code);
            setPartner({
              valid: true,
              code: data.code,
              firstName: data.firstName,
              niche: data.niche || null
            });
            if (Array.isArray(data.plans) && data.plans.length > 0) {
              setPlans(sortPlansByProfitability(data.plans));
            }
          } else {
            setPartner(null);
          }
        })
        .catch(() => {
          if (!cancelled) setPartner(null);
        })
        .finally(() => {
          if (!cancelled) setCheckedPartner(true);
        });
    } else {
      setCheckedPartner(true);
    }

    fetch('/api/public/support-contact')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.configured && data?.whatsapp) {
          setSupportWhatsapp(data.whatsapp);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [normalizedCode]);

  const effectiveRefCode = partner?.code || normalizedCode || '';
  const buildRegisterUrl = (extraParams?: { plano?: string; ciclo?: string }) => {
    const params = new URLSearchParams();
    if (effectiveRefCode) params.set('ref', effectiveRefCode);
    if (extraParams?.plano) params.set('plano', extraParams.plano);
    if (extraParams?.ciclo) params.set('ciclo', extraParams.ciclo);
    const qs = params.toString();
    return qs ? `/cadastro?${qs}` : '/cadastro';
  };

  const promoApplied = Boolean(partner?.valid || normalizedCode);
  const featuredPlan = plans.find((p) => p.id === 'premium') || plans[0];
  const featuredVipMonthly = (featuredPlan?.annualPrice || 997) / 12;

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#0A0A0A] text-white font-sans antialiased selection:bg-[#D4AF37] selection:text-black">
      {/* Top Bar (Strict 3-Zone Contract: Brand — Nav Links — 1 Primary CTA) */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-md w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-8">
          <Link to="/" className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <span className="font-serif text-lg sm:text-xl font-bold tracking-[0.14em] uppercase text-white">
              Doiseme
            </span>
            <span className="text-xs font-extrabold tracking-widest uppercase text-[#D4AF37]">
              PRO
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-300">
            <a href="#problema" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              O Problema
            </a>
            <a href="#como-lucrar" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Como Lucrar
            </a>
            <a href="#simulador" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Simulador
            </a>
            <a href="#oferta-planos" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Oferta VIP
            </a>
            <Link to="/admin/login" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Entrar
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="#oferta-planos"
              className="hidden sm:inline-flex items-center gap-2 bg-[#D4AF37] text-black font-bold text-sm px-4 py-2 rounded-lg hover:bg-[#e3c04f] transition-colors whitespace-nowrap shrink-0"
            >
              Garantir oferta grátis
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden p-2 text-zinc-300 hover:text-white rounded-lg border border-white/10 shrink-0"
              aria-label="Abrir menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#101010] px-4 py-4 space-y-2.5">
            <a href="#problema" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              O Problema
            </a>
            <a href="#como-lucrar" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              Retenção, Marketing &amp; Caixa
            </a>
            <a href="#simulador" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              Simulador de Retorno
            </a>
            <a href="#oferta-planos" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-[#D4AF37] font-semibold">
              Ver Oferta Promocional
            </a>
            <Link to="/admin/login" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              Já sou cliente · Entrar
            </Link>
            <Link
              to={buildRegisterUrl({ plano: 'premium', ciclo: billingCycle })}
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center justify-center gap-2 w-full bg-[#D4AF37] text-black font-bold text-sm py-2.5 rounded-lg"
            >
              Começar 7 dias grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section: Pain + Retention/Finance Promise + Partner VIP Anchor */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-24">
          {checkedPartner && normalizedCode && !partner && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs sm:text-sm text-amber-200">
              O código de convite informado não está ativo no momento, mas você ainda pode iniciar seu teste gratuito de 7 dias abaixo.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-center space-y-5 sm:space-y-6">
              {partner ? (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#D4AF37] font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 shrink-0" />
                    Convite oficial de {partner.firstName}
                  </span>
                  <span className="text-zinc-600" aria-hidden="true">·</span>
                  <span className="text-emerald-400">Condição VIP aplicada</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#D4AF37] font-semibold">
                  <span>Retenção de Clientes</span>
                  <span className="text-zinc-600" aria-hidden="true">·</span>
                  <span className="text-zinc-300 font-normal">Controle Financeiro na Palma da Mão</span>
                </div>
              )}

              <h1
                className="font-serif font-bold text-white leading-[1.08] tracking-tight text-balance break-words"
                style={{ fontSize: 'clamp(1.85rem, 4.3vw, 3.6rem)' }}
              >
                Pare de perder clientes que somem e tenha o controle financeiro do seu negócio na palma da mão.
              </h1>

              <p className="text-sm sm:text-lg text-zinc-300 leading-relaxed max-w-2xl">
                O <strong className="text-white">DoisemePRO</strong> resgata clientes inativos com remarketing no WhatsApp, atrai novos horários 24h por dia e mostra seu lucro líquido real no celular — por menos de <strong className="text-white">R$ 2,78 por dia</strong> neste convite VIP.
              </p>

              {/* Partner VIP Discount Spotlight */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-white/10">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#D4AF37]">Plano Completo VIP (Retenção + Marketing + Caixa)</p>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1 tabular-nums">
                    <span className="text-xs text-zinc-500 line-through">R$ 139,90/mês</span>
                    <span className="text-lg font-bold text-white">R$ {formatBRL(featuredVipMonthly)}/mês</span>
                    <span className="text-xs font-semibold text-emerald-400">(ou R$ 119,90 no mensal)</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-300">Plano Pro Equipe (até 4 profissionais)</p>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1 tabular-nums">
                    <span className="text-xs text-zinc-500 line-through">R$ 119,90/mês</span>
                    <span className="text-lg font-bold text-white">R$ 71,58/mês</span>
                    <span className="text-xs font-semibold text-emerald-400">(Economize até R$ 579)</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <a
                  href="#oferta-planos"
                  className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-sm sm:text-base px-5 sm:px-6 py-3.5 rounded-xl hover:bg-[#e3c04f] transition-colors text-center"
                >
                  <span>Ativar 7 dias grátis com desconto</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                </a>
                <a
                  href="#simulador"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/[0.03] text-white font-semibold text-sm px-5 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-center"
                >
                  Simular meu retorno financeiro
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-400">
                <span>7 dias grátis sem cartão</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Sem fidelidade no mensal</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Funciona direto no celular</span>
              </div>
            </div>

            {/* Right Visual Anchor */}
            <div className="lg:col-span-5 relative min-h-[280px] sm:min-h-[340px] lg:min-h-[480px] rounded-2xl overflow-hidden border border-white/10 bg-[#141414]">
              <img
                src={ownerControlImg}
                alt="Gestora acompanhando agenda cheia e controle financeiro real no celular com DoisemePRO"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div
                className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(10,10,10,0.06) 0%, rgba(10,10,10,0.65) 56%, rgba(10,10,10,0.95) 100%)'
                }}
              >
                <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
                  Retenção + Financeiro + Marketing
                </p>
                <p className="text-base sm:text-xl font-bold text-white mt-1.5 leading-snug">
                  Clientes voltando no prazo certo, novos horários fechando 24h e lucro líquido claro na tela.
                </p>
                <p className="text-xs text-zinc-300 mt-2">
                  Um único cliente recuperado no mês já paga o sistema inteiro e gera lucro imediato.
                </p>
              </div>
            </div>
          </div>

          {/* 4-Column Quantified Outcomes Strip Below Hero */}
          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-[#D4AF37] tabular-nums">1 a 2 clientes</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Recuperados no mês já pagam o Plano Completo VIP — todo o restante é lucro no bolso
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-white tabular-nums">15 · 20 · 30d</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Radar de retorno que avisa quem sumiu para reativação direta no WhatsApp
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-emerald-400 tabular-nums">R$ 681 off</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                De economia real no Plano Completo Anual garantindo sua conta por este convite
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-white tabular-nums">24h / dia</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Link exclusivo e campanhas atraindo novos agendamentos enquanto você atende
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 01: Pain & Silent Revenue Leaks */}
      <SalesPainDiagnosisSection />

      {/* Section 02: 4 Profit Engines (Retention, Finance, Marketing/Remarketing, 24h Booking) */}
      <SalesGrowthPillarsSection />

      {/* Section 03: Interactive ROI Simulator with Partner VIP Price */}
      <SalesRoiCalculatorSection
        planMonthlyPrice={featuredVipMonthly}
        planName="Plano Completo VIP (no anual)"
        ctaHref="#oferta-planos"
        ctaLabel="Ativar 7 dias grátis com condição VIP"
      />

      {/* Section 04: Promotional Pricing Section (Highest-Margin Plans FIRST) */}
      <section id="oferta-planos" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              {partner
                ? `Condição Promocional Exclusiva · Parceiro ${partner.firstName}`
                : 'Tabela Promocional Liberada neste Convite'}
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              Escolha seu plano, teste 7 dias grátis e trave o valor promocional nas renovações.
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto bg-[#141414] border border-white/15 rounded-xl p-1 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors text-center ${
                billingCycle === 'annual'
                  ? 'bg-[#D4AF37] text-black'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <span className="sm:hidden">Anual (-50%)</span>
              <span className="hidden sm:inline">Anual VIP (Até R$ 681 off)</span>
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors text-center ${
                billingCycle === 'monthly'
                  ? 'bg-[#D4AF37] text-black'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <span className="sm:hidden">Mensal (-R$ 20)</span>
              <span className="hidden sm:inline">Mensal (-R$ 20/mês)</span>
            </button>
          </div>
        </div>

        {/* Comparison Notice */}
        <div className="mb-8 sm:mb-10 p-4 sm:p-5 rounded-2xl border border-[#D4AF37]/30 bg-[#15130D] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-bold text-white">
              {billingCycle === 'annual'
                ? 'Vantagem máxima no Anual VIP: você une o desconto do parceiro à redução anual.'
                : 'Vantagem no Mensal Promocional: R$ 20,00 mais barato todo mês sobre o valor oficial do site.'}
            </p>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {billingCycle === 'annual'
                ? 'Comparado ao mensal padrão, o Plano Completo Anual reduz seu custo em até R$ 681,80 ao ano — menos de R$ 2,78 por dia para recuperar clientes e controlar todo o financeiro.'
                : 'Você começa com 7 dias grátis, trava R$ 240,00/ano de desconto mesmo pagando mês a mês e pode cancelar quando quiser.'}
            </p>
          </div>
          {promoApplied && (
            <div className="text-xs font-semibold text-emerald-400 shrink-0">
              Desconto vinculado ao seu cadastro
            </div>
          )}
        </div>

        {/* 3 Plan Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const isTopProfitPlan = plan.id === 'premium';
            const isMidTeamPlan = plan.id === 'profissional';

            const regularMonthly = plan.regularMonthlyPrice || plan.monthlyPrice + 20;
            const regularAnnual = plan.regularAnnualPrice || plan.annualPrice + 180;
            const monthlyEquivalentAnnual = plan.annualPrice / 12;
            const displayPrice =
              billingCycle === 'annual' ? monthlyEquivalentAnnual : plan.monthlyPrice;

            const monthlySavings = Math.max(0, regularMonthly - plan.monthlyPrice);
            const annualVsRegularMonthlySavings = Math.max(0, regularMonthly * 12 - plan.annualPrice);
            const annualExtraPartnerSavings = Math.max(0, regularAnnual - plan.annualPrice);

            return (
              <div
                key={plan.id}
                className={`min-w-0 rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-colors ${
                  isTopProfitPlan
                    ? 'bg-[#19150B] border-2 border-[#D4AF37]'
                    : isMidTeamPlan
                      ? 'bg-[#141414] border border-[#D4AF37]/35'
                      : 'bg-[#111111] border border-white/10'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isTopProfitPlan
                          ? 'text-[#D4AF37]'
                          : isMidTeamPlan
                            ? 'text-zinc-200'
                            : 'text-zinc-500'
                      }`}
                    >
                      {isTopProfitPlan ? 'Mais Lucrativo · Recomendado' : plan.badge || ''}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{plan.subtitle}</p>

                  <div className="pt-3 pb-4 border-y border-white/10 space-y-1.5">
                    {billingCycle === 'annual' ? (
                      <>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-400 tabular-nums">
                          <span>Tabela padrão:</span>
                          <span className="line-through text-zinc-500">R$ {formatBRL(regularMonthly)}/mês</span>
                          <span aria-hidden="true">·</span>
                          <span className="line-through text-zinc-500">R$ {formatBRL(regularAnnual)}/ano</span>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-1.5 tabular-nums pt-1">
                          <span className="text-sm text-zinc-400">R$</span>
                          <span className={`text-3xl sm:text-4xl font-bold ${isTopProfitPlan ? 'text-[#D4AF37]' : 'text-white'}`}>
                            {formatBRL(displayPrice)}
                          </span>
                          <span className="text-sm text-zinc-400">/mês no anual</span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#D4AF37] font-semibold tabular-nums">
                          R$ {formatBRL(plan.annualPrice)}/ano · Economize R$ {formatBRL(annualVsRegularMonthlySavings)}
                        </p>
                        <p className="text-xs text-emerald-400 tabular-nums">
                          Inclui R$ {formatBRL(annualExtraPartnerSavings)} de bônus extra neste link
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-400 tabular-nums">
                          <span>Valor oficial:</span>
                          <span className="line-through text-zinc-500">R$ {formatBRL(regularMonthly)}/mês</span>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-1.5 tabular-nums pt-1">
                          <span className="text-sm text-zinc-400">R$</span>
                          <span className={`text-3xl sm:text-4xl font-bold ${isTopProfitPlan ? 'text-[#D4AF37]' : 'text-white'}`}>
                            {formatBRL(displayPrice)}
                          </span>
                          <span className="text-sm text-zinc-400">/mês</span>
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-400 font-semibold tabular-nums">
                          Economia de R$ {formatBRL(monthlySavings)}/mês (R$ {formatBRL(monthlySavings * 12)}/ano)
                        </p>
                        <p className="text-xs text-zinc-400">
                          Sem fidelidade · Cancele quando quiser no painel
                        </p>
                      </>
                    )}
                  </div>

                  <ul className="space-y-2.5 text-sm text-zinc-200">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={buildRegisterUrl({ plano: plan.id, ciclo: billingCycle })}
                  onClick={() => trackSalesChannelClick('propria', `${plan.id}_${billingCycle}`)}
                  className={`mt-7 w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-colors text-center ${
                    isTopProfitPlan
                      ? 'bg-[#D4AF37] text-black hover:bg-[#e3c04f]'
                      : isMidTeamPlan
                        ? 'bg-white text-black hover:bg-zinc-200'
                        : 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  <span>
                    {isTopProfitPlan ? 'Testar Plano Completo 7 dias grátis' : 'Ativar 7 dias grátis neste plano'}
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-zinc-400 text-center">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
            Teste completo por 7 dias antes de pagar qualquer valor
          </span>
          <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#D4AF37] shrink-0" />
            PIX instantâneo ou Cartão via Mercado Pago
          </span>
        </div>
      </section>

      {/* Section 05: FAQ / Objection Handling & Final CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Dúvidas Frequentes
          </p>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
            Tudo transparente para você começar hoje sem risco.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mb-12">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Preciso cadastrar cartão nos 7 dias grátis?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Não. Você cria sua conta agora só com nome e e-mail e já testa o radar de retorno, controle financeiro e agenda online sem cadastrar cartão.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">O preço promocional continua nas renovações?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sim. Criando sua conta por este link de parceiro, o desconto fica gravado no seu estabelecimento tanto nas assinaturas mensais quanto nas anuais.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Consigo acompanhar caixa e clientes pelo celular?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sim. Tudo roda direto no navegador do celular e do computador sem precisar baixar aplicativo — tanto para você quanto para seus clientes agendarem.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Posso mudar de plano ou cancelar depois?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Pode sim. Você troca de plano, migra para o anual ou cancela sem multa diretamente dentro da aba Assinatura no seu painel.
            </p>
          </div>
        </div>

        <div className="bg-[#15130D] border border-[#D4AF37]/40 rounded-3xl p-6 sm:p-10 text-center space-y-5">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white text-balance">
            Pare de perder clientes e assuma o controle financeiro do seu negócio hoje.
          </h2>
          <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto">
            Teste o Plano Completo grátis por 7 dias, sem compromisso e com condição promocional garantida.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
            <Link
              to={buildRegisterUrl({ plano: 'premium', ciclo: billingCycle })}
              className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-sm sm:text-base px-6 py-3.5 rounded-xl hover:bg-[#e3c04f] transition-colors text-center"
            >
              <span>Começar meus 7 dias grátis agora</span>
              <ArrowRight className="w-5 h-5 shrink-0" />
            </Link>
            {supportWhatsapp && (
              <a
                href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                  `Olá! Vi a oferta pelo link${partner ? ` do parceiro ${partner.firstName} (${partner.code})` : ''} e quero tirar uma dúvida sobre o DoisemePRO.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-white/15 bg-black/40 text-zinc-200 font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-center"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Tirar dúvida no WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 bg-[#070707]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-9 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold tracking-wider uppercase text-white">Doiseme</span>
            <span className="text-xs font-extrabold text-[#D4AF37]">PRO</span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="text-xs text-zinc-500">Retenção de Clientes &amp; Controle Financeiro</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 text-xs sm:text-sm">
            <Link to="/" className="hover:text-white transition-colors">
              Página Principal
            </Link>
            <Link to="/termos" className="hover:text-white transition-colors">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">
              Privacidade (LGPD)
            </Link>
            <Link to="/admin/login" className="hover:text-white transition-colors">
              Acessar Painel
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
