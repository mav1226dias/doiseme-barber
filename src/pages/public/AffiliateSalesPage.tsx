import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock,
  CreditCard,
  Globe,
  Handshake,
  Menu,
  MessageCircle,
  Repeat,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X
} from 'lucide-react';
import heroStudioImg from '../../assets/images/hero_doiseme_studio_1794534284924.jpg';
import { SEGMENTS, SegmentPreset } from '../../lib/segments';
import { SegmentIcon } from '../../components/SegmentIcon';
import { normalizeReferralCode, saveReferralCode, trackAffiliateClick, trackSalesChannelClick, trackSalesChannelVisit } from '../../lib/referral';

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
    subtitle: 'Máxima recorrência, pacotes e vitrine personalizada sem limites',
    regularMonthlyPrice: 139.90,
    regularAnnualPrice: 1197.00,
    monthlyPrice: 119.90,
    annualPrice: 997.00,
    promoApplied: true,
    highlighted: true,
    badge: 'Mais Lucrativo · Recomendado',
    features: [
      'Profissionais e serviços ilimitados',
      'Campanhas de reativação p/ resgatar clientes sumidos',
      'Pacotes de sessões e planos de recorrência',
      'Vitrine VIP (logo, banner e cores da sua marca)',
      'Implantação assistida + Suporte prioritário WhatsApp'
    ]
  },
  {
    id: 'profissional',
    name: 'Plano Pro',
    subtitle: 'Para espaços e equipes de até 4 profissionais com comissões automáticas',
    regularMonthlyPrice: 119.90,
    regularAnnualPrice: 1039.00,
    monthlyPrice: 99.90,
    annualPrice: 859.00,
    promoApplied: true,
    highlighted: false,
    badge: 'Equipe até 4',
    features: [
      'Até 4 profissionais ativos (dono + equipe)',
      'Cálculo automático de comissões por serviço',
      'Controle financeiro diário, entradas e despesas',
      'Fichas de anamnese e histórico adaptado ao seu nicho'
    ]
  },
  {
    id: 'essencial',
    name: 'Agenda Individual',
    subtitle: 'Opção de entrada para quem atende sozinho e quer sair do WhatsApp manual',
    regularMonthlyPrice: 79.90,
    regularAnnualPrice: 659.00,
    monthlyPrice: 59.90,
    annualPrice: 479.00,
    promoApplied: true,
    highlighted: false,
    badge: '1 Profissional',
    features: [
      '1 profissional ativo na agenda online 24h',
      'Link exclusivo de agendamento (/b/sua-marca)',
      'Cadastro de clientes, prontuários e histórico',
      'Agenda inteligente com zero conflitos de horário'
    ]
  }
];

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AffiliateSalesPage() {
  const { code } = useParams<{ code: string }>();
  const normalizedCode = normalizeReferralCode(code);

  const segmentList = Object.values(SEGMENTS);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('barbershop');
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [plans, setPlans] = useState<SalesPlanOption[]>(PROMO_FALLBACK_PLANS);
  const [partner, setPartner] = useState<PartnerSummary | null>(null);
  const [checkedPartner, setCheckedPartner] = useState<boolean>(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeSegment: SegmentPreset = SEGMENTS[selectedSegmentId] || segmentList[0];

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
  const buildRegisterUrl = (extraParams?: { plano?: string; ciclo?: string; nicho?: string }) => {
    const params = new URLSearchParams();
    if (effectiveRefCode) params.set('ref', effectiveRefCode);
    if (extraParams?.plano) params.set('plano', extraParams.plano);
    if (extraParams?.ciclo) params.set('ciclo', extraParams.ciclo);
    if (extraParams?.nicho) params.set('nicho', extraParams.nicho);
    const qs = params.toString();
    return qs ? `/cadastro?${qs}` : '/cadastro';
  };

  const promoApplied = Boolean(partner?.valid || normalizedCode);

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
            <a href="#solucoes" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Benefícios
            </a>
            <a href="#retorno" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Retorno
            </a>
            <a href="#segmentos" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Segmentos
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
            <a href="#solucoes" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              Benefícios
            </a>
            <a href="#retorno" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              Retorno Financeiro
            </a>
            <a href="#segmentos" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              16 Segmentos
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

      {/* Hero Section: Proposition + High-Ticket Promotional Anchor */}
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
                  {partner.niche && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-300 font-normal">Especialidade: {partner.niche}</span>
                    </>
                  )}
                  <span className="text-zinc-600">·</span>
                  <span className="text-emerald-400">Condição VIP aplicada</span>
                </div>
              ) : (
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
                  Plataforma Completa de Gestão &amp; Recorrência
                </p>
              )}

              <h1
                className="font-serif font-bold text-white leading-[1.1] tracking-tight text-balance break-words"
                style={{ fontSize: 'clamp(1.85rem, 4.3vw, 3.6rem)' }}
              >
                Pare de perder clientes no WhatsApp e transforme sua agenda em lucro recorrente.
              </h1>

              <p className="text-sm sm:text-lg text-zinc-300 leading-relaxed max-w-2xl">
                O DoisemePRO automatiza seus agendamentos 24h por dia, calcula comissões sem planilhas,
                recupera clientes que sumiram e organiza seu caixa completo em menos de 2 minutos.
              </p>

              {/* High-Profitability Spotlight Strip in Hero (Plano Completo first!) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-white/10">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#D4AF37]">Plano Completo VIP (Ilimitado + Reativação)</p>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1 tabular-nums">
                    <span className="text-xs text-zinc-500 line-through">R$ 139,90/mês</span>
                    <span className="text-lg font-bold text-white">R$ 83,08/mês</span>
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
                <Link
                  to={buildRegisterUrl({ plano: 'premium', ciclo: billingCycle })}
                  className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/[0.03] text-white font-semibold text-sm px-5 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-center"
                >
                  Criar conta em 2 minutos
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-400">
                <span>7 dias grátis sem cartão</span>
                <span className="text-zinc-600">·</span>
                <span>Sem fidelidade no mensal</span>
                <span className="text-zinc-600">·</span>
                <span>Funciona direto no celular</span>
              </div>
            </div>

            {/* Right Visual Anchor */}
            <div className="lg:col-span-5 relative min-h-[280px] sm:min-h-[340px] lg:min-h-[480px] rounded-2xl overflow-hidden border border-white/10 bg-[#141414]">
              <img
                src={heroStudioImg}
                alt="Ambiente profissional organizado com o sistema de agendamento e caixa DoisemePRO"
                className="w-full h-full object-cover object-center"
              />
              <div
                className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(10,10,10,0.08) 0%, rgba(10,10,10,0.68) 58%, rgba(10,10,10,0.95) 100%)'
                }}
              >
                <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
                  Operação no piloto automático
                </p>
                <p className="text-base sm:text-xl font-bold text-white mt-1.5 leading-snug">
                  Seu cliente agenda sozinho pelo seu link exclusivo — mesmo de madrugada ou enquanto você atende.
                </p>
                <p className="text-xs text-zinc-300 mt-2">
                  Você ganha tempo livre, elimina furos e acompanha o lucro líquido do dia em tempo real.
                </p>
              </div>
            </div>
          </div>

          {/* 4-Column Quantified Outcomes Strip Below Hero */}
          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-white tabular-nums">+8h / sem</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Economizadas parando de responder horários livres no WhatsApp
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-[#D4AF37] tabular-nums">24h / dia</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Vitrine aberta para fechar agendamentos enquanto você trabalha
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-emerald-400 tabular-nums">R$ 681 off</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                De economia real no Plano Completo Anual via link de parceiro
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-white tabular-nums">16 nichos</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Painel, termos, catálogo e fichas prontos em menos de 2 minutos
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 01: Pain vs Solution (Asymmetric Editorial Bento) */}
      <section id="solucoes" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10">
        <div className="max-w-3xl mb-10 sm:mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Por que o DoisemePRO aumenta seu faturamento
          </p>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
            Cada recurso resolve os 4 gargalos que fazem você perder dinheiro todos os meses.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-7 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                  01. Otimização de Tempo
                </span>
                <Clock className="w-5 h-5 text-[#D4AF37] shrink-0" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Acabe com o “qual horário você tem hoje?” no WhatsApp
              </h3>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                Em vez de parar no meio de um atendimento para conferir agenda e trocar 10 mensagens por cliente,
                envie seu link exclusivo <span className="font-mono text-[#D4AF37] break-all">/b/sua-marca</span>.
                O cliente escolhe serviço, profissional e horário livre em segundos.
              </p>
            </div>
            <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Zero choque ou conflito de horários</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Bloqueio de folgas em 1 clique</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                  02. Aumento de Recorrência
                </span>
                <Repeat className="w-5 h-5 text-[#D4AF37] shrink-0" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Resgate clientes sumidos e venda pacotes
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                O sistema aponta quem não volta há 30, 60 ou 90 dias para você disparar convite no WhatsApp em 1 clique,
                além de controlar combos e pacotes recorrentes no Plano Completo.
              </p>
            </div>
            <p className="pt-4 border-t border-white/10 text-xs text-zinc-400">
              Reativar um cliente que já confia em você custa zero de anúncio.
            </p>
          </div>

          <div className="lg:col-span-5 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                  03. Caixa &amp; Comissões Blindados
                </span>
                <TrendingUp className="w-5 h-5 text-[#D4AF37] shrink-0" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Saiba quanto entrou e quanto sobrou líquido
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Acompanhe faturamento, despesas e cálculo automático da comissão de cada profissional sem planilhas manuais.
              </p>
            </div>
            <p className="pt-4 border-t border-white/10 text-xs text-zinc-400">
              Acesso individual para colaboradores verem apenas a própria agenda e repasse.
            </p>
          </div>

          <div className="lg:col-span-7 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                  04. Experiência VIP &amp; Prontuários
                </span>
                <Globe className="w-5 h-5 text-[#D4AF37] shrink-0" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Vitrine personalizada com sua marca + fichas completas
              </h3>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                Personalize sua página de agendamento com logo, banner e cores. Registre anamnese, fotos antes/depois,
                ficha pet ou histórico de atendimento para fidelizar cada cliente.
              </p>
            </div>
            <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Histórico detalhado por cliente</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Sem o cliente precisar baixar app</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 02: ROI / Practical Payback Proof */}
      <section id="retorno" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10">
        <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 min-w-0 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Matemática simples do retorno
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              O Plano Completo se paga com 1 único cliente reativado no mês.
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Com campanhas de reativação + pacotes recorrentes no <strong className="text-white">Plano Completo</strong>,
              basta trazer de volta <strong className="text-white">1 cliente que havia sumido</strong> ou evitar
              <strong className="text-white"> 1 furo na agenda</strong> para o sistema sair de graça e gerar lucro líquido imediato.
            </p>
          </div>

          <div className="lg:col-span-5 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="bg-black/45 border border-[#D4AF37]/30 rounded-2xl p-5">
              <p className="text-xs text-zinc-400">Investimento diário no Plano Completo Anual</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#D4AF37] mt-1 tabular-nums">R$ 2,73 / dia</p>
              <p className="text-xs text-zinc-400 mt-1.5">
                Profissionais ilimitados, reativação, pacotes recorrentes e vitrine VIP.
              </p>
            </div>
            <div className="bg-black/45 border border-white/10 rounded-2xl p-5">
              <p className="text-xs text-zinc-400">Economia imediata neste link de parceiro</p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-1 tabular-nums">Até R$ 681,80</p>
              <p className="text-xs text-zinc-400 mt-1.5">
                Comparado ao plano mensal padrão (ou R$ 240/ano de vantagem pagando mensal).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 03: Interactive 16-Niche Showcase */}
      <section id="segmentos" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Adaptado ao seu mercado
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              Escolha o seu ramo e veja seu painel pronto em segundos.
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-md">
            Termos, ícones, cores e lista inicial de serviços já vêm configurados no cadastro.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          <div className="lg:col-span-7 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {segmentList.map((seg) => {
              const active = seg.id === activeSegment.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setSelectedSegmentId(seg.id)}
                  className={`flex flex-col items-start gap-2 p-3 sm:p-3.5 rounded-xl border text-left transition-all min-w-0 ${
                    active
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                      : 'bg-[#141414] border-white/10 text-zinc-300 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <SegmentIcon
                    iconName={seg.icon}
                    className="w-5 h-5 shrink-0"
                    style={{ color: active ? '#D4AF37' : seg.defaultColors.primary }}
                  />
                  <span className="text-xs font-semibold leading-snug line-clamp-2 w-full">
                    {seg.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-5 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-5 sm:p-7 space-y-5">
            <div className="flex items-center gap-3.5 border-b border-white/10 pb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                style={{ backgroundColor: `${activeSegment.defaultColors.primary}1F` }}
              >
                <SegmentIcon
                  iconName={activeSegment.icon}
                  className="w-6 h-6"
                  style={{ color: activeSegment.defaultColors.primary }}
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{activeSegment.name}</h3>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{activeSegment.layoutTheme.tagline}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">Estabelecimento</span>
                <span className="font-semibold text-white truncate block">{activeSegment.terms.business}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">Atendimento</span>
                <span className="font-semibold text-white truncate block">{activeSegment.terms.professional}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">Público</span>
                <span className="font-semibold text-white truncate block">{activeSegment.terms.clientPlural}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">Catálogo</span>
                <span className="font-semibold text-white truncate block">{activeSegment.terms.servicePlural}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                Exemplos carregados automaticamente
              </p>
              <div className="divide-y divide-white/5">
                {activeSegment.suggestedServices.slice(0, 3).map((srv) => (
                  <div key={srv.name} className="py-2 flex items-center justify-between text-sm gap-4">
                    <span className="text-zinc-200 truncate">{srv.name}</span>
                    <span className="text-[#D4AF37] font-semibold tabular-nums shrink-0">
                      {srv.price > 0 ? `R$ ${formatBRL(srv.price)}` : 'Sob consulta'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to={buildRegisterUrl({ nicho: activeSegment.id, plano: 'premium', ciclo: billingCycle })}
              className="w-full inline-flex items-center justify-center gap-2 bg-white text-black font-bold text-sm py-3 px-4 rounded-xl hover:bg-zinc-200 transition-colors text-center"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Testar grátis para {activeSegment.terms.business}</span>
            </Link>
          </div>
        </div>
      </section>

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
              Escolha o plano ideal e garanta o preço promocional em todas as renovações.
            </h2>
          </div>

          {/* Mobile-safe Responsive Toggle (fits 320px screens without horizontal scroll) */}
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
                ? 'Comparado ao mensal padrão, o Plano Completo Anual reduz seu custo em até R$ 681,80 ao ano — como ganhar quase 5 meses grátis.'
                : 'Você começa com 7 dias grátis, trava R$ 240,00/ano de desconto mesmo pagando mês a mês e pode cancelar quando quiser.'}
            </p>
          </div>
          {promoApplied && (
            <div className="text-xs font-semibold text-emerald-400 shrink-0">
              Desconto vinculado ao seu cadastro
            </div>
          )}
        </div>

        {/* 3 Plan Cards: Plano Completo FIRST (Spotlight) -> Plano Pro SECOND -> Agenda Individual THIRD */}
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
                          <span>·</span>
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
          <span className="text-zinc-600 hidden sm:inline">·</span>
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
              Não. Você cria sua conta agora só com nome, e-mail e ramo do seu negócio e já sai usando com link de agendamento ativo na hora.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">O preço promocional continua nas renovações?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sim. Criando sua conta por este link de parceiro, o desconto fica gravado no seu estabelecimento tanto nas assinaturas mensais quanto nas anuais.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Funciona no celular sem instalar nada?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sim. Tanto o seu painel administrativo quanto o link de reserva dos seus clientes funcionam direto no navegador do celular e do computador.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Posso mudar de plano depois?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Pode sim. Você troca de plano ou migra do mensal para o anual com 1 clique dentro da aba Assinatura no seu painel.
            </p>
          </div>
        </div>

        <div className="bg-[#15130D] border border-[#D4AF37]/40 rounded-3xl p-6 sm:p-10 text-center space-y-5">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white text-balance">
            Coloque sua agenda online e sua oferta promocional no ar nos próximos 2 minutos.
          </h2>
          <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto">
            Teste o Plano Completo grátis por 7 dias, sem compromisso e sem cartão de crédito.
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
            <span className="text-zinc-600">·</span>
            <span className="text-xs text-zinc-500">Gestão Multi-Nicho &amp; Agendamento</span>
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
