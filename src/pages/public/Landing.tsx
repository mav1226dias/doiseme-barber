import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { captureReferralFromSearch, getActiveReferralCode, trackSalesChannelClick, trackSalesChannelVisit } from '../../lib/referral';
import {
  SalesGrowthPillarsSection,
  SalesPainDiagnosisSection,
  SalesRoiCalculatorSection
} from '../../components/SalesConversionSections';

interface PlanOption {
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

const DEFAULT_PLANS: PlanOption[] = [
  {
    id: 'premium',
    name: 'Plano Completo',
    subtitle: 'Máxima retenção de clientes, remarketing no WhatsApp e financeiro completo sem limites',
    monthlyPrice: 139.90,
    annualPrice: 1197.00,
    highlighted: true,
    badge: 'Mais Lucrativo · Recomendado',
    features: [
      'Radar de clientes sumidos + remarketing em 1 clique no WhatsApp',
      'Campanhas promocionais para encher dias parados e atrair novos clientes',
      'Pacotes de sessões e planos de recorrência para caixa previsível',
      'Controle financeiro completo: entradas, despesas, comissões e lucro real',
      'Profissionais ilimitados + suporte VIP no WhatsApp'
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
      'Até 4 profissionais ativos na agenda online 24h',
      'Controle financeiro diário de entradas, despesas e lucro',
      'Cálculo automático de comissões sem planilhas manuais',
      'Histórico completo de clientes para aumentar a fidelização'
    ]
  },
  {
    id: 'essencial',
    name: 'Agenda Individual',
    subtitle: 'Organize atendimentos, fidelize clientes e controle seu caixa trabalhando sozinho',
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
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Landing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [plans, setPlans] = useState<PlanOption[]>(DEFAULT_PLANS);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeRefCode, setActiveRefCode] = useState<string | null>(() => getActiveReferralCode());

  useEffect(() => {
    trackSalesChannelVisit('propria');
    const captured = captureReferralFromSearch(window.location.search);
    if (captured) setActiveRefCode(captured);

    fetch('/api/public/plans')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.plans?.length) {
          setPlans(
            [...data.plans].sort(
              (a: PlanOption, b: PlanOption) => (PLAN_PRIORITY[a.id] ?? 99) - (PLAN_PRIORITY[b.id] ?? 99)
            )
          );
        }
      })
      .catch(() => {});

    fetch('/api/public/support-contact')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.configured && data?.whatsapp) setSupportWhatsapp(data.whatsapp);
      })
      .catch(() => {});
  }, []);

  const featuredPlan = plans.find((p) => p.id === 'premium') || plans[0];
  const featuredAnnualMonthly = (featuredPlan?.annualPrice || 1197) / 12;

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#0A0A0A] text-white font-sans antialiased selection:bg-[#D4AF37] selection:text-black">
      {/* Top Bar (Strict 3-Zone Contract: Brand — 4 Single-Line Links — 1 Primary CTA) */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <Link to="/" className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <span className="font-serif text-xl font-bold tracking-[0.14em] uppercase text-white">
              Doiseme
            </span>
            <span className="text-xs font-extrabold tracking-widest uppercase text-[#D4AF37]">
              PRO
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
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
            <Link to="/admin/login" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Entrar
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/cadastro"
              onClick={() => trackSalesChannelClick('propria', 'hero_header')}
              className="hidden sm:inline-flex items-center gap-2 bg-[#D4AF37] text-black font-bold text-sm px-4 py-2 rounded-lg hover:bg-[#e3c04f] transition-colors whitespace-nowrap shrink-0"
            >
              Testar 7 dias grátis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden p-2 text-zinc-300 hover:text-white rounded-lg border border-white/10"
              aria-label="Abrir menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#101010] px-4 py-4 space-y-3">
            <a
              href="#problema"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm text-zinc-300 hover:text-white"
            >
              O Problema
            </a>
            <a
              href="#como-lucrar"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm text-zinc-300 hover:text-white"
            >
              Retenção, Marketing &amp; Caixa
            </a>
            <a
              href="#simulador"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm text-zinc-300 hover:text-white"
            >
              Simulador de Retorno
            </a>
            <a
              href="#planos"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm text-[#D4AF37] font-semibold"
            >
              Planos
            </a>
            <Link
              to="/admin/login"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm text-zinc-300 hover:text-white"
            >
              Acessar Painel
            </Link>
            <Link
              to="/cadastro"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center justify-center gap-2 w-full bg-[#D4AF37] text-black font-bold text-sm py-2.5 rounded-lg"
            >
              Criar conta grátis (7 dias)
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-center space-y-6">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#D4AF37] font-semibold">
                <span>Retenção e Recorrência</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-zinc-300 font-normal">Controle Financeiro na Palma da Mão</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-zinc-300 font-normal">Marketing no WhatsApp</span>
              </div>

              <h1
                className="font-serif font-bold text-white leading-[1.08] tracking-tight text-balance"
                style={{ fontSize: 'clamp(2.1rem, 4.5vw, 3.75rem)' }}
              >
                Pare de perder clientes que somem e tenha o controle financeiro do seu negócio na palma da mão.
              </h1>

              <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl">
                O <strong className="text-white">DoisemePRO</strong> resgata clientes inativos com remarketing no WhatsApp, atrai novos agendamentos 24h por dia e mostra quanto sobra de lucro líquido no celular — custando menos que <strong className="text-white">2 atendimentos por mês</strong>.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Link
                  to="/cadastro"
                  onClick={() => trackSalesChannelClick('propria', 'hero_primary')}
                  className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-base px-6 py-3.5 rounded-xl hover:bg-[#e3c04f] transition-colors whitespace-nowrap"
                >
                  Começar 7 dias grátis
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#simulador"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/[0.03] text-white font-semibold text-sm sm:text-base px-6 py-3.5 rounded-xl hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  Simular meu retorno financeiro
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-zinc-400">
                <span>7 dias grátis sem cartão</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Sem fidelidade no mensal</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Funciona direto no celular</span>
              </div>
            </div>

            {/* Right Visual Anchor */}
            <div className="lg:col-span-5 relative min-h-[300px] sm:min-h-[360px] lg:min-h-[480px] rounded-2xl overflow-hidden border border-white/10 bg-[#141414]">
              <img
                src={ownerControlImg}
                alt="Empreendedora acompanhando retorno de clientes e controle financeiro na palma da mão"
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
                  Caixa organizado + agenda cheia
                </p>
                <p className="text-lg sm:text-xl font-bold text-white mt-1.5 leading-snug">
                  Seu cliente agenda sozinho 24h enquanto o radar de retorno traz quem sumiu de volta.
                </p>
                <p className="text-xs sm:text-sm text-zinc-300 mt-2">
                  Veja entradas, despesas, comissões e lucro líquido real no seu celular em segundos.
                </p>
              </div>
            </div>
          </div>

          {/* 4-Column Quantified Outcomes Strip Below Hero */}
          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-[#D4AF37] tabular-nums">2 atendimentos</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Recuperados no mês já pagam o Plano Completo — todo o resto é lucro líquido
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">15 · 20 · 30d</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Radar de retorno que avisa quem sumiu para chamar com remarketing no WhatsApp
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">Caixa na mão</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Faturamento, despesas, comissões e lucro líquido atualizados em tempo real
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">24h / dia</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Link de agendamento e campanhas atraindo novos clientes mesmo fora do horário
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 01: Pain Diagnosis */}
      <SalesPainDiagnosisSection />

      {/* Section 02: 4 Profit Engines */}
      <SalesGrowthPillarsSection />

      {/* Section 03: Interactive ROI Simulator */}
      <SalesRoiCalculatorSection
        planMonthlyPrice={featuredAnnualMonthly}
        planName="Plano Completo (no anual)"
        ctaHref="#planos"
        ctaLabel="Ver planos e começar 7 dias grátis"
      />

      {/* Pricing Section */}
      <section id="planos" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              Investimento que se paga nos primeiros dias
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              Teste grátis por 7 dias. Economize até 33% no plano anual.
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto bg-[#141414] border border-white/10 rounded-xl p-1 gap-1 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors text-center ${
                billingCycle === 'annual'
                  ? 'bg-[#D4AF37] text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Anual (Até 33% off)
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors text-center ${
                billingCycle === 'monthly'
                  ? 'bg-[#D4AF37] text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Mensal
            </button>
          </div>
        </div>

        {activeRefCode && (
          <div className="mb-8 px-5 py-4 rounded-2xl border border-[#D4AF37]/40 bg-[#15130D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">
                Você acessou anteriormente por um link de parceiro ({activeRefCode.toUpperCase()}).
              </p>
              <p className="text-xs text-zinc-300 mt-0.5">
                Veja sua página de oferta exclusiva com R$ 20/mês OFF no mensal ou até R$ 681 off no anual.
              </p>
            </div>
            <Link
              to={`/r/${encodeURIComponent(activeRefCode)}`}
              className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-[#e3c04f] transition-colors whitespace-nowrap shrink-0"
            >
              Ver oferta promocional
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const displayPrice =
              billingCycle === 'annual' ? plan.annualPrice / 12 : plan.monthlyPrice;
            const annualSavings = Math.max(0, plan.monthlyPrice * 12 - plan.annualPrice);
            const dailyCost = displayPrice / 30;
            return (
              <div
                key={plan.id}
                className={`min-w-0 rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-colors ${
                  plan.highlighted
                    ? 'bg-[#19150B] border-2 border-[#D4AF37]'
                    : 'bg-[#141414] border border-white/10'
                }`}
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    {(plan.badge || plan.highlighted) && (
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${
                        plan.highlighted ? 'text-[#D4AF37]' : 'text-zinc-400'
                      }`}>
                        {plan.badge || 'Recomendado'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300">{plan.subtitle}</p>

                  <div className="pt-2 pb-4 border-b border-white/10">
                    {billingCycle === 'annual' && (
                      <p className="text-xs text-zinc-500 line-through tabular-nums">
                        De R$ {formatBRL(plan.monthlyPrice)}/mês no mensal
                      </p>
                    )}
                    <div className="flex items-baseline gap-1.5 tabular-nums">
                      <span className="text-sm text-zinc-400">R$</span>
                      <span className="text-4xl font-bold text-white">
                        {formatBRL(displayPrice)}
                      </span>
                      <span className="text-sm text-zinc-400">/mês</span>
                    </div>
                    {billingCycle === 'annual' ? (
                      <p className="text-xs text-[#D4AF37] mt-1 tabular-nums">
                        Apenas R$ {formatBRL(dailyCost)}/dia · R$ {formatBRL(plan.annualPrice)}/ano (Economize R$ {formatBRL(annualSavings)})
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                        Menos de R$ {formatBRL(dailyCost)}/dia · Pagamento mensal via PIX ou Cartão
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 text-sm text-zinc-200">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={`/cadastro?plano=${plan.id}`}
                  onClick={() => trackSalesChannelClick('propria', `${plan.id}_${billingCycle}`)}
                  className={`mt-8 w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-colors ${
                    plan.highlighted
                      ? 'bg-[#D4AF37] text-black hover:bg-[#e3c04f]'
                      : 'bg-white text-black hover:bg-zinc-200'
                  }`}
                >
                  Testar 7 dias grátis
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-zinc-400 text-center">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            7 dias grátis sem cadastrar cartão de crédito
          </span>
          <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#D4AF37]" />
            Liberação automática via Mercado Pago e PIX · Cancele quando quiser
          </span>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 bg-[#070707]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold tracking-wider uppercase text-white">Doiseme</span>
            <span className="text-xs font-extrabold text-[#D4AF37]">PRO</span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="text-xs text-zinc-500">Retenção de Clientes &amp; Controle Financeiro</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 sm:gap-6 text-xs sm:text-sm">
            <Link to="/termos" className="hover:text-white transition-colors">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">
              Privacidade (LGPD)
            </Link>
            <Link to="/cadastro" className="hover:text-white transition-colors">
              Criar conta
            </Link>
            <Link to="/afiliado" className="hover:text-white transition-colors">
              Parceiros &amp; Afiliados
            </Link>
            <Link to="/admin/login" className="hover:text-white transition-colors">
              Acessar painel
            </Link>
            {supportWhatsapp && (
              <a
                href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                  'Olá! Gostaria de tirar dúvidas sobre o DoisemePRO.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Falar com suporte
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
