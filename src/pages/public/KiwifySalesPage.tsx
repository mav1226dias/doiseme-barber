import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CreditCard,
  Globe,
  Menu,
  MessageCircle,
  PhoneCall,
  Repeat,
  ShieldCheck,
  TrendingUp,
  X
} from 'lucide-react';
import heroStudioImg from '../../assets/images/hero_doiseme_studio_1794534284924.jpg';
import { SEGMENTS, SegmentPreset } from '../../lib/segments';
import { SegmentIcon } from '../../components/SegmentIcon';
import { SalesPlatformChannel, trackSalesChannelClick, trackSalesChannelVisit } from '../../lib/referral';

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
    subtitle: 'Máxima recorrência de clientes, telemarketing e agenda ilimitada',
    monthlyPrice: 139.90,
    annualPrice: 1197.00,
    highlighted: true,
    badge: 'Mais Vendido · Completo',
    features: [
      'Profissionais e serviços ilimitados',
      'Gestão de telemarketing e reativação de clientes sumidos',
      'Pacotes de sessões e planos de recorrência',
      'Vitrine VIP (logo, banner e cores da sua marca)',
      'Gestão financeira completa + Suporte prioritário WhatsApp'
    ]
  },
  {
    id: 'profissional',
    name: 'Plano Pro',
    subtitle: 'Para pequenos negócios e equipes de até 4 profissionais',
    monthlyPrice: 119.90,
    annualPrice: 1039.00,
    highlighted: false,
    badge: 'Equipe até 4',
    features: [
      'Até 4 profissionais ativos na agenda inteligente 24h',
      'Cálculo automático de comissões por atendimento',
      'Controle financeiro diário de entradas e despesas',
      'Cadastro de clientes, prontuários e histórico completo'
    ]
  },
  {
    id: 'essencial',
    name: 'Agenda Individual',
    subtitle: 'Ideal para quem atende sozinho e quer profissionalizar a operação',
    monthlyPrice: 79.90,
    annualPrice: 659.00,
    highlighted: false,
    badge: '1 Profissional',
    features: [
      '1 profissional ativo com agenda inteligente 24h',
      'Link exclusivo de agendamento (/b/sua-marca)',
      'Gestão financeira básica e histórico de clientes',
      'Zero conflitos de horário e bloqueio de folgas em 1 clique'
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

  const segmentList = Object.values(SEGMENTS);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('barbershop');
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [plans, setPlans] = useState<KiwifyPlanOption[]>(DEFAULT_PLANS);
  const [checkoutLinks, setCheckoutLinks] = useState<Record<string, string>>({});
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeSegment: SegmentPreset = SEGMENTS[selectedSegmentId] || segmentList[0];

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
    const rawUrl = checkoutLinks[key];
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
            <a href="#pilares" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Ferramentas
            </a>
            <a href="#recorrencia" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Recorrência
            </a>
            <a href="#segmentos" className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Segmentos
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
            <a href="#pilares" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              Ferramentas de Gestão
            </a>
            <a href="#recorrencia" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              Recorrência &amp; Retorno
            </a>
            <a href="#segmentos" onClick={() => setMobileNavOpen(false)} className="block py-2 text-sm text-zinc-300 hover:text-white">
              Segmentos Atendidos
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
                <span>Sistema de Gestão para Pequenos Negócios</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-zinc-300 font-normal">Foco em Recorrência de Clientes</span>
              </div>

              <h1
                className="font-serif font-bold text-white leading-[1.08] tracking-tight text-balance"
                style={{ fontSize: 'clamp(2rem, 4.3vw, 3.65rem)' }}
              >
                Venda todos os meses para os mesmos clientes com gestão completa no piloto automático.
              </h1>

              <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl">
                O <strong className="text-white">DoisemePRO</strong> une <strong className="text-white">Agenda Inteligente 24hrs</strong>,{' '}
                <strong className="text-white">Gestão de Telemarketing</strong> para resgatar clientes sumidos e{' '}
                <strong className="text-white">Gestão Financeira</strong> completa em um único painel feito para pequenos negócios faturarem com previsibilidade.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <a
                  href="#planos"
                  className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-sm sm:text-base px-6 py-3.5 rounded-xl hover:bg-[#e3c04f] transition-colors text-center whitespace-nowrap"
                >
                  <span>Escolher meu plano agora</span>
                  <ArrowRight className="w-5 h-5 shrink-0" />
                </a>
                <a
                  href="#pilares"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/[0.03] text-white font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-white/10 transition-colors text-center whitespace-nowrap"
                >
                  Conhecer as ferramentas
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-400">
                <span>Acesso imediato após aprovação</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Garantia incondicional de 7 dias</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Funciona no celular e computador</span>
              </div>
            </div>

            {/* Right Visual Anchor */}
            <div className="lg:col-span-5 relative min-h-[300px] sm:min-h-[360px] lg:min-h-[480px] rounded-2xl overflow-hidden border border-white/10 bg-[#141414]">
              <img
                src={heroStudioImg}
                alt="Gestão profissional de pequenos negócios com agenda inteligente e controle financeiro DoisemePRO"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div
                className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(10,10,10,0.08) 0%, rgba(10,10,10,0.68) 55%, rgba(10,10,10,0.96) 100%)'
                }}
              >
                <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
                  Agenda Inteligente + Recorrência
                </p>
                <p className="text-lg sm:text-xl font-bold text-white mt-1.5 leading-snug">
                  Seu cliente agenda sozinho 24 horas por dia, enquanto seu telemarketing traz quem sumiu de volta.
                </p>
                <p className="text-xs sm:text-sm text-zinc-300 mt-2">
                  Sem depender de anúncios caros todo mês para manter a agenda cheia e o caixa previsível.
                </p>
              </div>
            </div>
          </div>

          {/* 4-Column Quantified Outcomes Strip Below Hero */}
          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-[#D4AF37] tabular-nums">24hrs / dia</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Agenda inteligente aberta recebendo reservas sem você parar de atender
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">30 · 60 · 90d</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Radar de telemarketing que identifica clientes inativos para reativação
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">100% claro</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Gestão financeira com entradas, despesas, comissões e lucro líquido real
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">16 nichos</p>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Estrutura adaptada para pequenos negócios de serviço pronta em minutos
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 01: Core Tools (Agenda Inteligente 24h, Telemarketing, Financeiro, Vitrine) */}
      <section id="pilares" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10">
        <div className="max-w-3xl mb-10 sm:mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Três motores que sustentam o lucro de pequenos negócios
          </p>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
            Tudo o que você precisa para atender melhor, controlar o dinheiro e fazer o cliente voltar sempre.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                  01. Agenda Inteligente 24hrs
                </span>
                <CalendarClock className="w-5 h-5 text-[#D4AF37] shrink-0" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Seu negócio aberto para agendamentos dia e noite, sem fila no WhatsApp
              </h3>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                Cada cliente acessa seu link exclusivo (<span className="font-mono text-[#D4AF37]">/b/sua-empresa</span>), vê apenas os horários realmente disponíveis por profissional e serviço, e confirma em segundos sem gerar choque de agenda.
              </p>
            </div>
            <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Cálculo automático de duração entre serviços</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Bloqueio de folgas, férias e pausas em 1 clique</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                  02. Gestão de Telemarketing
                </span>
                <PhoneCall className="w-5 h-5 text-[#D4AF37] shrink-0" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Traga clientes sumidos de volta e multiplique a recorrência
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Em vez de esperar o cliente lembrar de você, o painel organiza contatos por tempo sem retorno (30, 60 ou 90 dias) para sua equipe fazer abordagem ativa no WhatsApp com roteiro e histórico na mão.
              </p>
            </div>
            <p className="pt-4 border-t border-white/10 text-xs text-zinc-400">
              Conquiste novas vendas com quem já confia no seu trabalho — com custo zero de tráfego pago.
            </p>
          </div>

          <div className="lg:col-span-5 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                  03. Gestão Financeira Completa
                </span>
                <TrendingUp className="w-5 h-5 text-[#D4AF37] shrink-0" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Saiba exatamente quanto entra, sai e sobra de lucro todo mês
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Registre faturamento por atendimento, despesas fixas/variáveis e calcule automaticamente a comissão de cada profissional sem erros de planilha.
              </p>
            </div>
            <p className="pt-4 border-t border-white/10 text-xs text-zinc-400">
              Acesso individual para cada colaborador acompanhar apenas a própria agenda e comissões.
            </p>
          </div>

          <div className="lg:col-span-7 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                  04. Pacotes Recorrentes &amp; Vitrine VIP
                </span>
                <Repeat className="w-5 h-5 text-[#D4AF37] shrink-0" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                Previsibilidade no caixa com combos, pacotes e histórico completo
              </h3>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                Venda pacotes de sessões ou planos mensais para fidelizar clientes e personalize sua vitrine com logo, banner, cores da marca e fichas de atendimento sem obrigar ninguém a baixar aplicativo.
              </p>
            </div>
            <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Prontuários, anamnese e histórico por cliente</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Vitrine profissional pronta em 2 minutos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 02: ROI / Recurrence Engine */}
      <section id="recorrencia" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10">
        <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 min-w-0 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              O segredo da recorrência em pequenos negócios
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              Reativando apenas 2 clientes por mês o sistema já gera lucro líquido para o seu caixa.
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              A maioria dos pequenos negócios perde faturamento porque atende bem uma vez, mas não tem rotina de telemarketing nem agenda prática para fazer o cliente voltar. Com o <strong className="text-white">DoisemePRO</strong>, você organiza quem sumiu, vende pacotes recorrentes e enxerga cada centavo no financeiro.
            </p>
          </div>

          <div className="lg:col-span-5 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="bg-black/45 border border-[#D4AF37]/30 rounded-2xl p-5">
              <p className="text-xs text-zinc-400">Menos de um café por dia no Plano Completo Anual</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#D4AF37] mt-1 tabular-nums">R$ 3,28 / dia</p>
              <p className="text-xs text-zinc-400 mt-1.5">
                Agenda 24hrs, telemarketing de reativação, gestão financeira, pacotes e vitrine VIP ilimitados.
              </p>
            </div>
            <div className="bg-black/45 border border-white/10 rounded-2xl p-5">
              <p className="text-xs text-zinc-400">Economia no Plano Anual vs. Mensal</p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-1 tabular-nums">R$ 481,80 / ano</p>
              <p className="text-xs text-zinc-400 mt-1.5">
                Pague menos por mês no anual ou assine no plano mensal sem fidelidade.
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
              Adaptado ao seu pequeno negócio
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              Escolha o seu segmento e veja a estrutura pronta para trabalhar por você.
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-md">
            Termos, fichas, serviços sugeridos e vitrine de agendamento já vêm configurados conforme o seu ramo.
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
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">Negócio</span>
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
                Exemplos carregados no painel
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

            <a
              href="#planos"
              className="w-full inline-flex items-center justify-center gap-2 bg-white text-black font-bold text-sm py-3 px-4 rounded-xl hover:bg-zinc-200 transition-colors text-center"
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Usar em {activeSegment.terms.business}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Section 04: Pricing Plans (Kiwify Checkout Ready) */}
      <section id="planos" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Escolha seu plano e comece hoje
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
              Planos transparentes para o tamanho atual do seu negócio.
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
                          ou R$ {formatBRL(plan.annualPrice)} à vista no ano
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
                        <p className="text-xs text-zinc-400">
                          Cobrança recorrente mensal · Cancele quando quiser
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

      {/* Section 05: Delivery & 7-Day Guarantee (Kiwify Standard) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 border-b border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Como funciona após a compra
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Do checkout ao seu painel funcionando em 3 passos simples.
            </h2>
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <span className="font-mono text-sm font-bold text-[#D4AF37] pt-0.5 shrink-0">01.</span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Confirmação segura do pagamento</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Escolha seu plano e conclua via PIX ou Cartão de Crédito no ambiente criptografado de checkout.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="font-mono text-sm font-bold text-[#D4AF37] pt-0.5 shrink-0">02.</span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Liberação de acesso pelo seu e-mail</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Assim que a aprovação é confirmada, você recebe as instruções para entrar no painel DoisemePRO ou vincular sua conta existente.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="font-mono text-sm font-bold text-[#D4AF37] pt-0.5 shrink-0">03.</span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Configuração guiada em menos de 2 minutos</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Selecione seu nicho, ative seu link de agenda inteligente 24hrs e comece a registrar atendimentos, caixa e reativação de clientes.
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
                Use o DoisemePRO no seu negócio real durante 7 dias. Se você achar que a agenda inteligente, o telemarketing ou a gestão financeira não serviram para sua operação, basta solicitar o reembolso integral dentro do prazo de garantia sem burocracia.
              </p>
            </div>
            <p className="text-xs text-zinc-400 pt-4 border-t border-white/10">
              Risco zero para testar no dia a dia do seu estabelecimento.
            </p>
          </div>
        </div>
      </section>

      {/* Section 06: FAQ + Final CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Dúvidas Frequentes
          </p>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
            Respostas rápidas antes de garantir seu acesso.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mb-12">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Preciso instalar algum aplicativo?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Não. O sistema roda direto no navegador do celular, tablet ou computador — tanto para você e sua equipe quanto para seus clientes agendarem.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Serve para qualquer pequeno negócio?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sim. Barbearias, salões, estética, clínicas, consultórios, pet shops, estúdios e prestadores de serviço com atendimento agendado usam o painel adaptado ao nicho.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Como funciona a gestão de telemarketing?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              O sistema lista automaticamente clientes sem retorno recente para você ou sua recepção chamarem no WhatsApp e oferecerem horários ou pacotes promocionais.
            </p>
          </div>
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-2">
            <h3 className="text-base font-bold text-white">Posso cancelar a assinatura quando quiser?</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Sim. Não há multa nem fidelidade no plano mensal, e você conta com 7 dias de garantia incondicional na contratação.
            </p>
          </div>
        </div>

        <div className="bg-[#15130D] border border-[#D4AF37]/40 rounded-3xl p-6 sm:p-10 text-center space-y-5">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white text-balance">
            Organize sua agenda, seu financeiro e a recorrência dos seus clientes hoje mesmo.
          </h2>
          <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto">
            Escolha o plano ideal para o seu momento e coloque o DoisemePRO para rodar no seu negócio.
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
            <span className="text-xs text-zinc-500">Gestão para Pequenos Negócios &amp; Recorrência</span>
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
