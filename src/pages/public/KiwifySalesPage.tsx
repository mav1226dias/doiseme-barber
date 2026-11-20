import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CreditCard,
  Menu,
  MessageCircle,
  ShieldCheck,
  X
} from 'lucide-react';
import ownerControlImg from '../../assets/images/sales_owner_control_1795203706375.jpg';
import { SalesPlatformChannel, trackSalesChannelClick, trackSalesChannelVisit } from '../../lib/referral';
import {
  SalesGrowthPillarsSection,
  SalesPainDiagnosisSection,
  SalesRoiCalculatorSection
} from '../../components/SalesConversionSections';

interface KiwifyPlanOption {
  id: string;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  highlighted?: boolean;
  badge?: string;
  features: string[];
}

const PLAN_PRIORITY: Record<string, number> = {
  premium: 0,
  profissional: 1,
  essencial: 2
};

const sortPlansByPriority = (list: KiwifyPlanOption[]) =>
  [...list].sort((a, b) => (PLAN_PRIORITY[a.id] ?? 99) - (PLAN_PRIORITY[b.id] ?? 99));

const DEFAULT_PLANS: KiwifyPlanOption[] = [
  {
    id: 'premium',
    name: 'Plano Completo',
    subtitle: 'Máxima retenção de clientes, remarketing no WhatsApp e financeiro completo sem limites',
    monthlyPrice: 139.90,
    annualPrice: 1197.00,
    highlighted: true,
    badge: 'Mais Vendido · Completo',
    features: [
      'Radar de clientes sumidos + remarketing em 1 clique no WhatsApp',
      'Campanhas promocionais para encher dias parados e atrair novos clientes',
      'Pacotes de sessões e planos de recorrência para caixa previsível',
      'Controle financeiro completo: entradas, despesas, comissões e lucro líquido',
      'Profissionais ilimitados + página profissional de agendamento 24h'
    ]
  },
  {
    id: 'profissional',
    name: 'Plano Pro',
    subtitle: 'Controle de agenda, equipe e financeiro completo para até 4 profissionais',
    monthlyPrice: 119.90,
    annualPrice: 1039.00,
    highlighted: false,
    badge: 'Equipe até 4',
    features: [
      'Até 4 profissionais com agenda inteligente 24h e zero conflitos',
      'Controle financeiro na palma da mão (caixa diário e despesas)',
      'Cálculo automático de comissões sem planilhas manuais',
      'Histórico completo de atendimentos e manutenção de clientes'
    ]
  },
  {
    id: 'essencial',
    name: 'Agenda Individual',
    subtitle: 'Organize atendimentos, fidelize clientes e controle o caixa trabalhando sozinho',
    monthlyPrice: 79.90,
    annualPrice: 659.00,
    highlighted: false,
    badge: '1 Profissional',
    features: [
      'Link exclusivo de captação e agendamento 24h na bio e WhatsApp',
      'Agenda inteligente sem conflitos e bloqueio de folgas em 1 clique',
      'Controle financeiro diário no celular e histórico completo de clientes',
      'Fim dos horários perdidos por demora para responder mensagens'
    ]
  }
];

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHANNEL_LABELS: Record<SalesPlatformChannel, string> = {
  propria: 'Plataforma Própria',
  kiwify: 'Kiwify',
  eduzz: 'Eduzz',
  hotmart: 'Hotmart'
};

const VALID_CHANNELS: readonly SalesPlatformChannel[] = ['propria', 'kiwify', 'eduzz', 'hotmart'];

export default function KiwifySalesPage({ defaultChannel = 'kiwify' }: { defaultChannel?: SalesPlatformChannel }) {
  const location = useLocation();
  const { platform } = useParams<{ platform?: string }>();
  const normalizedParam = String(platform || '').trim().toLowerCase() as SalesPlatformChannel;
  const activeChannel: SalesPlatformChannel = VALID_CHANNELS.includes(normalizedParam)
    ? normalizedParam
    : defaultChannel;
  const channelLabel = CHANNEL_LABELS[activeChannel];

  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [plans, setPlans] = useState<KiwifyPlanOption[]>(DEFAULT_PLANS);
  const [checkoutLinks, setCheckoutLinks] = useState<Record<string, string>>({});
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    trackSalesChannelVisit(activeChannel);
    let cancelled = false;

    fetch(`/api/public/sales-config/${encodeURIComponent(activeChannel)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(sortPlansByPriority(data.plans));
        }
        const linksObj = data.checkoutLinks || data.kiwifyLinks;
        if (linksObj && typeof linksObj === 'object') {
          setCheckoutLinks(linksObj);
        }
        if (data.supportWhatsapp) {
          setSupportWhatsapp(String(data.supportWhatsapp));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeChannel]);

  const getCheckoutHref = (planId: string, cycle: 'annual' | 'monthly'): { externalUrl: string | null; fallbackTo: string } => {
    const key = `${planId}_${cycle}`;
    const altKey = `${planId}_${cycle === 'annual' ? 'monthly' : 'annual'}`;
    const rawUrl = checkoutLinks[key] || checkoutLinks[altKey];
    if (rawUrl) {
      try {
        const target = new URL(rawUrl);
        const currentParams = new URLSearchParams(location.search);
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck', 'ref'].forEach((param) => {
          const val = currentParams.get(param);
          if (val && !target.searchParams.has(param)) {
            target.searchParams.set(param, val);
          }
        });
        return { externalUrl: target.toString(), fallbackTo: '' };
      } catch {
        // Fallback below if malformed URL
      }
    }
    return {
      externalUrl: null,
      fallbackTo: `/cadastro?plano=${encodeURIComponent(planId)}&ciclo=${encodeURIComponent(cycle)}&origem=${encodeURIComponent(activeChannel)}`
    };
  };

  const featuredPlan = plans.find((p) => p.id === 'premium') || plans[0];
  const featuredAnnualMonthly = (featuredPlan?.annualPrice || 1197) / 12;

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#0A0A0A] text-white font-sans antialiased selection:bg-[#D4AF37] selection:text-black">
      {/* Top Bar (Strict 3-Zone Contract: Brand — 4 Single-Line Links — 1 Primary CTA) */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-md w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
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
            <a href="#planos" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Planos
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="#planos"
              className="hidden sm:inline-flex items-center gap-2 bg-[#D4AF37] text-black font-bold text-sm px-4 py-2 rounded-lg hover:bg-[#e3c04f] transition-colors whitespace-nowrap shrink-0"
            >
              Assinar agora
              <ArrowRight className="w-4 h-4 shrink-0" />
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
            <a href="#planos" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-[#D4AF37] font-semibold">
              Ver Planos e Preços
            </a>
            <a
              href="#planos"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center justify-center gap-2 w-full bg-[#D4AF37] text-black font-bold text-sm py-2.5 rounded-lg"
            >
              Garantir meu acesso
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-center space-y-6">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#D4AF37] font-semibold">
                <span>Retenção de Clientes</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-zinc-300 font-normal">Controle Financeiro na Palma da Mão</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-zinc-300 font-normal">Marketing &amp; Remarketing</span>
              </div>

              <h1
                className="font-serif font-bold text-white leading-[1.08] tracking-tight text-balance"
                style={{ fontSize: 'clamp(2rem, 4.3vw, 3.65rem)' }}
              >
                Pare de perder clientes que somem e tenha o controle financeiro do seu negócio na palma da mão.
              </h1>

              <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl">
                O <strong className="text-white">DoisemePRO</strong> resgata clientes inativos com remarketing no WhatsApp, atrai novos agendamentos 24h por dia e mostra exatamente quanto sobra de lucro no seu caixa — custando menos que <strong className="text-white">2 atendimentos por mês</strong>.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <a
                  href="#planos"
                  className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-sm sm:text-base px-6 py-3.5 rounded-xl hover:bg-[#e3c04f] transition-colors text-center whitespace-nowrap"
                >
                  <span>Quero controlar meu caixa e clientes</span>
                  <ArrowRight className="w-5 h-5 shrink-0" />
                </a>
                <a
                  href="#simulador"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/[0.03] text-white font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-center whitespace-nowrap"
                >
                  Simular meu retorno financeiro
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-400">
                <span>Acesso imediato no celular e computador</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Garantia incondicional de 7 dias</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Sem instalar aplicativo</span>
              </div>
            </div>

            {/* Right Visual Anchor */}
            <div className="lg:col-span-5 relative min-h-[300px] sm:min-h-[360px] lg:min-h-[480px] rounded-2xl overflow-hidden border border-white/10 bg-[#141414]">
              <img
                src={ownerControlImg}
                alt="Dona de negócio acompanhando agendamentos e lucro financeiro na palma da mão pelo celular"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div
                className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(10,10,10,0.06) 0%, rgba(10,10,10,0.65) 56%, rgba(10,10,10,0.96) 100%)'
                }}
              >
                <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
                  Seu negócio sob controle no celular
                </p>
                <p className="text-lg sm:text-xl font-bold text-white mt-1.5 leading-snug">
                  Clientes voltando no prazo certo, agenda cheia e lucro líquido claro na tela.
                </p>
                <p className="text-xs sm:text-sm text-zinc-300 mt-2">
                  Sem perder dinheiro no improviso e sem depender só de anúncios pagos para faturar.
                </p>
              </div>
            </div>
          </div>

          {/* 4-Column Quantified Outcomes Strip Below Hero */}
          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-[#D4AF37] tabular-nums">2 atendimentos</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Recuperados no mês já pagam a assinatura inteira — todo o resto é lucro líquido
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">15 · 20 · 30d</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Radar de retorno que avisa quem sumiu para resgatar com remarketing no WhatsApp
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">Caixa na mão</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Entradas, despesas, comissões da equipe e lucro real atualizados direto no celular
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">24h / dia</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Link de agendamento e campanhas atraindo novos clientes mesmo quando você está ocupado
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 01: Pain & Silent Revenue Leaks */}
      <SalesPainDiagnosisSection />

      {/* Section 02: 4 Profit Engines (Retention, Finance, Marketing/Remarketing, 24h Booking) */}
      <SalesGrowthPillarsSection />

      {/* Section 03: Interactive ROI Simulator (Price vs Recovered & New Revenue) */}
      <SalesRoiCalculatorSection
        planMonthlyPrice={featuredAnnualMonthly}
        planName="Plano Completo (no anual)"
        ctaHref="#planos"
        ctaLabel="Escolher meu plano e começar hoje"
      />

      {/* Section 04: Pricing Plans (Checkout Ready) */}
      <section id="planos" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Investimento pequeno, retorno imediato no caixa
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              Escolha o plano ideal e comece a recuperar clientes ainda esta semana.
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto bg-[#141414] border border-white/15 rounded-xl p-1 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors text-center whitespace-nowrap ${
                billingCycle === 'annual'
                  ? 'bg-[#D4AF37] text-black'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Anual (Economize até 28%)
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors text-center whitespace-nowrap ${
                billingCycle === 'monthly'
                  ? 'bg-[#D4AF37] text-black'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Mensal (Sem fidelidade)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const isTopPlan = plan.id === 'premium';
            const isMidPlan = plan.id === 'profissional';
            const monthlyEquivalent = plan.annualPrice / 12;
            const displayPrice = billingCycle === 'annual' ? monthlyEquivalent : plan.monthlyPrice;
            const annualSavings = Math.max(0, plan.monthlyPrice * 12 - plan.annualPrice);
            const dailyEquivalent = displayPrice / 30;
            const { externalUrl, fallbackTo } = getCheckoutHref(plan.id, billingCycle);

            return (
              <div
                key={plan.id}
                className={`min-w-0 rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-colors ${
                  isTopPlan
                    ? 'bg-[#19150B] border-2 border-[#D4AF37]'
                    : isMidPlan
                      ? 'bg-[#141414] border border-[#D4AF37]/35'
                      : 'bg-[#111111] border border-white/10'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isTopPlan ? 'text-[#D4AF37]' : isMidPlan ? 'text-zinc-200' : 'text-zinc-500'
                      }`}
                    >
                      {plan.badge || ''}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{plan.subtitle}</p>

                  <div className="pt-3 pb-4 border-y border-white/10 space-y-1.5">
                    {billingCycle === 'annual' ? (
                      <>
                        <div className="flex flex-wrap items-baseline gap-1.5 tabular-nums pt-1">
                          <span className="text-sm text-zinc-400">12x de R$</span>
                          <span className={`text-3xl sm:text-4xl font-bold ${isTopPlan ? 'text-[#D4AF37]' : 'text-white'}`}>
                            {formatBRL(displayPrice)}
                          </span>
                          <span className="text-sm text-zinc-400">/mês</span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#D4AF37] font-semibold tabular-nums">
                          Apenas R$ {formatBRL(dailyEquivalent)}/dia · R$ {formatBRL(plan.annualPrice)} à vista no ano
                        </p>
                        <p className="text-xs text-emerald-400 tabular-nums">
                          Economia de R$ {formatBRL(annualSavings)} comparado ao mensal
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-baseline gap-1.5 tabular-nums pt-1">
                          <span className="text-sm text-zinc-400">R$</span>
                          <span className={`text-3xl sm:text-4xl font-bold ${isTopPlan ? 'text-[#D4AF37]' : 'text-white'}`}>
                            {formatBRL(displayPrice)}
                          </span>
                          <span className="text-sm text-zinc-400">/mês</span>
                        </div>
                        <p className="text-xs text-zinc-400 tabular-nums">
                          Menos de R$ {formatBRL(dailyEquivalent)}/dia · Cancele quando quiser
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

                {externalUrl ? (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackSalesChannelClick(activeChannel, `${plan.id}_${billingCycle}`)}
                    className={`mt-7 w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-colors text-center ${
                      isTopPlan
                        ? 'bg-[#D4AF37] text-black hover:bg-[#e3c04f]'
                        : isMidPlan
                          ? 'bg-white text-black hover:bg-zinc-200'
                          : 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{isTopPlan ? 'Assinar Plano Completo' : `Assinar ${plan.name}`}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </a>
                ) : (
                  <Link
                    to={fallbackTo}
                    onClick={() => trackSalesChannelClick(activeChannel, `${plan.id}_${billingCycle}`)}
                    className={`mt-7 w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-colors text-center ${
                      isTopPlan
                        ? 'bg-[#D4AF37] text-black hover:bg-[#e3c04f]'
                        : isMidPlan
                          ? 'bg-white text-black hover:bg-zinc-200'
                          : 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{isTopPlan ? 'Assinar Plano Completo' : `Assinar ${plan.name}`}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-zinc-400 text-center">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
            Compra 100% segura com garantia incondicional de 7 dias
          </span>
          <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#D4AF37] shrink-0" />
            {activeChannel === 'propria'
              ? 'Pagamento via Cartão de Crédito ou PIX direto com liberação rápida'
              : `Checkout oficial via ${channelLabel} (PIX ou Cartão) com liberação rápida`}
          </span>
        </div>
      </section>

      {/* Section 05: Delivery & 7-Day Guarantee */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 border-b border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Sem complicação para começar
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Em menos de 5 minutos seu caixa, agenda e radar de retorno já estão rodando.
            </h2>
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <span className="font-mono text-sm font-bold text-[#D4AF37] pt-0.5 shrink-0">01.</span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Confirmação segura do plano escolhido</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Conclua via PIX ou Cartão de Crédito no ambiente criptografado e receba o acesso imediatamente no seu e-mail.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="font-mono text-sm font-bold text-[#D4AF37] pt-0.5 shrink-0">02.</span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Configuração guiada pelo celular</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Cadastre seus serviços, horários e o prazo de retorno dos seus clientes com um passo a passo simples dentro do próprio painel.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="font-mono text-sm font-bold text-[#D4AF37] pt-0.5 shrink-0">03.</span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Clientes agendando e voltando todo mês</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Coloque seu link na bio do Instagram e WhatsApp, acompanhe seu lucro líquido diário e resgate quem sumiu em 1 clique.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#19150B] border border-[#D4AF37]/40 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <ShieldCheck className="w-9 h-9 text-[#D4AF37]" />
              <h3 className="font-serif text-2xl font-bold text-white">
                Garantia Incondicional de 7 Dias
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Coloque o DoisemePRO para rodar no seu negócio real durante 7 dias. Se você não sentir mais clareza no financeiro, economia de tempo e facilidade para recuperar clientes, basta pedir reembolso total dentro do prazo sem burocracia.
              </p>
            </div>
            <p className="text-xs text-zinc-400 pt-4 border-t border-white/10">
              Risco zero para testar na rotina real do seu estabelecimento.
            </p>
          </div>
        </div>
      </section>

      {/* Section 06: Objection-Busting FAQ + Final CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Dúvidas Frequentes
          </p>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
            Respostas diretas antes de garantir seu acesso.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mb-12">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Como o sistema me ajuda a recuperar clientes sumidos?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Você escolhe o intervalo ideal de retorno (ex: 20 ou 30 dias). O sistema lista automaticamente quem passou desse prazo para você chamar no WhatsApp em 1 clique com oferta ou convite de retorno.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Consigo controlar todo o financeiro pelo celular?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sim. Você acompanha entradas diárias, despesas fixas/variáveis, cálculo automático de comissões da equipe e o lucro líquido real direto no navegador do celular, sem instalar aplicativo.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Serve para o meu tipo de atendimento?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sim. Qualquer negócio que atende com hora marcada — barbearias, salões, estética, clínicas, estúdios, pet shops e autônomos — personaliza serviços, horários e regras em poucos minutos.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Tem fidelidade ou multa se eu quiser cancelar?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Não. No plano mensal você cancela quando quiser sem multa, e qualquer contratação conta com 7 dias de garantia incondicional para testar na prática.
            </p>
          </div>
        </div>

        <div className="bg-[#15130D] border border-[#D4AF37]/40 rounded-3xl p-6 sm:p-10 text-center space-y-5">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white text-balance">
            Pare de deixar clientes sumirem e assuma o controle do seu faturamento hoje.
          </h2>
          <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto">
            Menos de 2 atendimentos recuperados já pagam o mês inteiro. Escolha seu plano e comece com garantia de 7 dias.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
            <a
              href="#planos"
              className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-sm sm:text-base px-6 py-3.5 rounded-xl hover:bg-[#e3c04f] transition-colors text-center"
            >
              <span>Ver planos e garantir acesso</span>
              <ArrowRight className="w-5 h-5 shrink-0" />
            </a>
            {supportWhatsapp && (
              <a
                href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                  'Olá! Vi a página de vendas do DoisemePRO e gostaria de tirar uma dúvida antes de assinar.'
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
            <Link to="/termos" className="hover:text-white transition-colors">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">
              Privacidade (LGPD)
            </Link>
            <Link to="/admin/login" className="hover:text-white transition-colors">
              Já sou cliente · Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
