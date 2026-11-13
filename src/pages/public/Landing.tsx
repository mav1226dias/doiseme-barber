import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  CreditCard,
  Globe,
  Menu,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Users,
  X
} from 'lucide-react';
import heroStudioImg from '../../assets/images/hero_doiseme_studio_1794534284924.jpg';
import { SEGMENTS, SegmentPreset } from '../../lib/segments';
import { SegmentIcon } from '../../components/SegmentIcon';

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

const DEFAULT_PLANS: PlanOption[] = [
  {
    id: 'essencial',
    name: 'Agenda Individual',
    subtitle: 'Ideal para quem trabalha sozinho (1 profissional)',
    monthlyPrice: 59.90,
    annualPrice: 479.00,
    highlighted: false,
    badge: '1 Profissional',
    features: [
      '1 profissional ativo na agenda',
      'Link exclusivo de agendamento (/b/sua-marca)',
      'Cadastro de clientes e histórico completo',
      'Agenda inteligente sem conflitos de horário'
    ]
  },
  {
    id: 'profissional',
    name: 'Plano Pro',
    subtitle: 'Perfeito para equipes de 1 a 3 funcionários',
    monthlyPrice: 99.90,
    annualPrice: 859.00,
    highlighted: false,
    badge: 'Equipe 1 a 3',
    features: [
      'Até 4 profissionais ativos (dono + equipe)',
      'Cálculo automático de comissões',
      'Controle financeiro diário e despesas',
      'Prontuários, anamnese e fotos do seu nicho'
    ]
  },
  {
    id: 'premium',
    name: 'Plano Completo',
    subtitle: 'Retenção, pacotes e lucro sem limites',
    monthlyPrice: 119.90,
    annualPrice: 997.00,
    highlighted: true,
    badge: 'Melhor Custo-Benefício',
    features: [
      'Profissionais e serviços ilimitados',
      'Campanhas de reativação p/ trazer clientes sumidos',
      'Pacotes de sessões e combos recorrentes',
      'Vitrine VIP (logo, banner e paleta personalizada)',
      'Implantação assistida + Suporte VIP no WhatsApp'
    ]
  }
];

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Landing() {
  const segmentList = Object.values(SEGMENTS);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('barbershop');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [plans, setPlans] = useState<PlanOption[]>(DEFAULT_PLANS);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeSegment: SegmentPreset = SEGMENTS[selectedSegmentId] || segmentList[0];

  useEffect(() => {
    fetch('/api/public/plans')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.plans?.length) setPlans(data.plans);
      })
      .catch(() => {});

    fetch('/api/public/support-contact')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.configured && data?.whatsapp) setSupportWhatsapp(data.whatsapp);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased selection:bg-[#D4AF37] selection:text-black">
      {/* Top Bar (3 zones: Brand — Nav Links — Primary CTA) */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0A]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <span className="font-serif text-xl font-bold tracking-[0.14em] uppercase text-white">
              Doiseme
            </span>
            <span className="text-xs font-extrabold tracking-widest uppercase text-[#D4AF37]">
              PRO
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
            <a href="#recursos" className="hover:text-white transition-colors whitespace-nowrap">
              Recursos
            </a>
            <a href="#segmentos" className="hover:text-white transition-colors whitespace-nowrap">
              16 Segmentos
            </a>
            <a href="#planos" className="hover:text-white transition-colors whitespace-nowrap">
              Planos
            </a>
            <Link to="/admin/login" className="hover:text-white transition-colors whitespace-nowrap">
              Acessar Painel
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/cadastro"
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
              href="#recursos"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm text-zinc-300 hover:text-white"
            >
              Recursos
            </a>
            <a
              href="#segmentos"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm text-zinc-300 hover:text-white"
            >
              16 Segmentos
            </a>
            <a
              href="#planos"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm text-zinc-300 hover:text-white"
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
        <div className="absolute inset-0">
          <img
            src={heroStudioImg}
            alt="Recepção premium de estúdio usando DoisemePRO"
            className="w-full h-full object-cover object-center opacity-55"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(95deg, rgba(10,10,10,0.96) 0%, rgba(10,10,10,0.84) 48%, rgba(10,10,10,0.52) 100%)'
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 lg:py-32">
          <div className="max-w-2xl space-y-6">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              Plataforma de Gestão &amp; Agendamento Multi-Nicho
            </p>
            <h1
              className="font-serif font-bold text-white leading-[1.08] tracking-tight"
              style={{ fontSize: 'clamp(2.25rem, 4.8vw, 4rem)' }}
            >
              Agenda, caixa e clientes sob medida para o seu negócio.
            </h1>
            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-xl">
              Do atendimento individual à gestão completa da sua equipe. Site de agendamento exclusivo,
              comissões automáticas e prontuários adaptados ao seu segmento em menos de 2 minutos.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                to="/cadastro"
                className="inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-base px-6 py-3.5 rounded-xl hover:bg-[#e3c04f] transition-colors whitespace-nowrap"
              >
                Começar 7 dias grátis
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#planos"
                className="inline-flex items-center justify-center gap-2 border border-white/20 bg-black/40 text-white font-semibold text-base px-6 py-3.5 rounded-xl hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                Ver planos e valores
              </a>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-zinc-400">
              <span>7 dias grátis sem cartão</span>
              <span className="text-zinc-600">·</span>
              <span>16 segmentos pré-configurados</span>
              <span className="text-zinc-600">·</span>
              <span>PIX ou Cartão via Mercado Pago</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section id="recursos" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24 border-b border-white/10">
        <div className="max-w-2xl mb-14 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
            Tudo em um só painel
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Feito para eliminar planilhas e horários perdidos.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-3">
            <Globe className="w-6 h-6 text-[#D4AF37]" />
            <h3 className="text-lg font-bold text-white">Link Exclusivo de Reserva</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Seu cliente agenda pelo celular em segundos escolhendo profissional, serviço e horário livre em tempo real.
            </p>
          </div>

          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-3">
            <Calendar className="w-6 h-6 text-[#D4AF37]" />
            <h3 className="text-lg font-bold text-white">Agenda &amp; Bloqueios</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Controle diário por profissional, bloqueio de folgas, confirmações e prevenção contra conflitos de horário.
            </p>
          </div>

          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-3">
            <TrendingUp className="w-6 h-6 text-[#D4AF37]" />
            <h3 className="text-lg font-bold text-white">Caixa &amp; Comissões</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Faturamento líquido, registro de despesas e cálculo automático da comissão de cada membro da equipe.
            </p>
          </div>

          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-3">
            <Users className="w-6 h-6 text-[#D4AF37]" />
            <h3 className="text-lg font-bold text-white">Fichas por Nicho</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Anamnese estética, fotos antes/depois, pets, veículos, avaliações físicas ou histórico de estilo integrados.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive 16-Niche Showcase */}
      <section id="segmentos" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24 border-b border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              Sistema Camaleão
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Escolha seu segmento e veja o sistema se adaptar.
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-md">
            Termos, cores, ícones e catálogo inicial são configurados automaticamente ao criar sua conta.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Niche selector list */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {segmentList.map((seg) => {
              const active = seg.id === activeSegment.id;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setSelectedSegmentId(seg.id)}
                  className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                      : 'bg-[#141414] border-white/10 text-zinc-300 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <SegmentIcon
                    iconName={seg.icon}
                    className="w-5 h-5"
                    style={{ color: active ? '#D4AF37' : seg.defaultColors.primary }}
                  />
                  <span className="text-xs font-semibold leading-snug line-clamp-2">
                    {seg.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Live Niche Preview */}
          <div className="lg:col-span-5 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-7 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex items-center gap-3.5">
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
                <div>
                  <h3 className="text-lg font-bold text-white">{activeSegment.name}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{activeSegment.layoutTheme.tagline}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">
                  Estabelecimento
                </span>
                <span className="font-semibold text-white">{activeSegment.terms.business}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">
                  Atendente
                </span>
                <span className="font-semibold text-white">{activeSegment.terms.professional}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">
                  Público
                </span>
                <span className="font-semibold text-white">{activeSegment.terms.clientPlural}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block">
                  Catálogo
                </span>
                <span className="font-semibold text-white">{activeSegment.terms.servicePlural}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                Exemplos carregados no cadastro
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
              to={`/cadastro?nicho=${activeSegment.id}`}
              className="w-full inline-flex items-center justify-center gap-2 bg-white text-black font-bold text-sm py-3 rounded-xl hover:bg-zinc-200 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Criar painel para {activeSegment.terms.business}
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              Planos Transparentes
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Teste grátis por 7 dias. Economize até 33% no plano anual.
            </h2>
          </div>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center bg-[#141414] border border-white/10 rounded-xl p-1 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
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
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                billingCycle === 'monthly'
                  ? 'bg-[#D4AF37] text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Mensal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const displayPrice =
              billingCycle === 'annual' ? plan.annualPrice / 12 : plan.monthlyPrice;
            const annualSavings = Math.max(0, plan.monthlyPrice * 12 - plan.annualPrice);
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-7 flex flex-col justify-between border transition-colors ${
                  plan.highlighted
                    ? 'bg-[#161510] border-[#D4AF37] shadow-[0_0_50px_-18px_rgba(212,175,55,0.35)]'
                    : 'bg-[#141414] border-white/10'
                }`}
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    {(plan.badge || plan.highlighted) && (
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${
                        plan.highlighted ? 'text-[#D4AF37]' : 'text-zinc-400'
                      }`}>
                        {plan.badge || 'Recomendado'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">{plan.subtitle}</p>

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
                        R$ {formatBRL(plan.annualPrice)}/ano · Economize R$ {formatBRL(annualSavings)}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500 mt-1">
                        Pagamento mensal via PIX ou Cartão
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 text-sm text-zinc-300">
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
                  className={`mt-8 w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-colors ${
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

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#D4AF37]" />
            Liberação automática imediata via Mercado Pago e PIX
          </span>
          <span className="text-zinc-600 hidden sm:inline">·</span>
          <span>Cancele quando quiser sem fidelidade</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#070707]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold tracking-wider uppercase text-white">Doiseme</span>
            <span className="text-xs font-extrabold text-[#D4AF37]">PRO</span>
            <span className="text-zinc-600">·</span>
            <span className="text-xs text-zinc-500">Gestão Multi-Nicho</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm">
            <Link to="/cadastro" className="hover:text-white transition-colors">
              Criar conta
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
