import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  Megaphone,
  Repeat,
  TrendingUp,
  Wallet
} from 'lucide-react';
import clientReturnImg from '../assets/images/sales_client_return_1795203705939.jpg';

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SalesPainDiagnosisSection() {
  return (
    <section
      id="problema"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-6 min-w-0 flex flex-col justify-between space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
              O vazamento invisível do seu faturamento
            </p>
            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance leading-[1.12]">
              Você trabalha o dia inteiro, mas sente que o dinheiro e os clientes escapam sem perceber?
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              A maioria dos negócios de atendimento não quebra por falta de talento — perde milhares de reais por mês porque não tem sistema para reter clientes, controlar o caixa e gerar novos horários.
            </p>
          </div>

          <div className="divide-y divide-white/10 border-y border-white/10">
            <div className="py-5 space-y-1.5">
              <h3 className="text-base font-bold text-white">
                01. Clientes atendidos que somem e vão para a concorrência
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Você entrega um ótimo serviço, o cliente sai satisfeito, mas ninguém acompanha o prazo de retorno. Sem lembrete nem remarketing, ele esquece e agenda no primeiro lugar que aparecer.
              </p>
            </div>

            <div className="py-5 space-y-1.5">
              <h3 className="text-base font-bold text-white">
                02. Falta de controle financeiro real no dia a dia
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                O dinheiro entra no PIX, cartão e dinheiro, mas no fim do mês você não enxerga quanto lucrou de verdade, mistura despesas e perde horas conferindo comissões da equipe no papel ou planilha.
              </p>
            </div>

            <div className="py-5 space-y-1.5">
              <h3 className="text-base font-bold text-white">
                03. Horários vazios e dependência de sorte para atrair novos clientes
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Quando a semana esfria, falta uma ferramenta prática de marketing e agendamento online para transformar seguidores em clientes e preencher a agenda sem gastar fortunas com anúncios.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 min-w-0 flex flex-col justify-between gap-6">
          <div className="relative flex-1 min-h-[300px] sm:min-h-[380px] rounded-2xl overflow-hidden border border-white/10 bg-[#141414]">
            <img
              src={clientReturnImg}
              alt="Cliente recorrente sendo recebido com sorriso na recepção do estabelecimento"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            <div
              className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8"
              style={{
                background:
                  'linear-gradient(180deg, rgba(10,10,10,0.06) 0%, rgba(10,10,10,0.62) 55%, rgba(10,10,10,0.96) 100%)'
              }}
            >
              <p className="text-xs uppercase tracking-[0.14em] text-[#D4AF37] font-semibold">
                A conta que muda o jogo
              </p>
              <p className="text-lg sm:text-2xl font-serif font-bold text-white mt-2 leading-snug text-balance">
                Trazer um cliente que já confia em você de volta custa zero de anúncio — e multiplica seu lucro mês após mês.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#141414] border border-white/10 rounded-2xl p-5 space-y-1.5">
              <p className="text-xs font-semibold text-zinc-400">Sem controle de retorno</p>
              <p className="text-2xl font-bold text-red-400 tabular-nums">- R$ 1.280 / mês</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Perdendo apenas 4 clientes sumidos por semana em um ticket médio de R$ 80.
              </p>
            </div>
            <div className="bg-[#15130D] border border-[#D4AF37]/35 rounded-2xl p-5 space-y-1.5">
              <p className="text-xs font-semibold text-[#D4AF37]">Com o DoisemePRO ativo</p>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">Caixa previsível</p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Radar de retorno + remarketing no WhatsApp + controle financeiro completo no celular.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SalesGrowthPillarsSection() {
  return (
    <section
      id="como-lucrar"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10"
    >
      <div className="max-w-3xl mb-10 sm:mb-14 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
          Como o DoisemePRO coloca dinheiro no seu caixa
        </p>
        <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
          Quatro engrenagens trabalhando juntas para reter clientes, atrair novos horários e blindar seu financeiro.
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pillar 01: Retenção & Recorrência */}
        <div className="lg:col-span-7 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold tracking-wide text-[#D4AF37]">
                01. Retenção &amp; Recorrência de Clientes
              </span>
              <Repeat className="w-5 h-5 text-[#D4AF37] shrink-0" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
              Radar automático de clientes sumidos + pacotes recorrentes todo mês
            </h3>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Você define o prazo ideal de retorno dos seus clientes (15, 20, 30 ou 60 dias). Assim que alguém passa do prazo sem agendar, o painel sinaliza automaticamente para você resgatar o cliente no WhatsApp em 1 clique — antes que ele vá para outro lugar.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Lista pronta de clientes inativos para remarketing</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Controle de pacotes de sessões e planos mensais</span>
            </div>
          </div>
        </div>

        {/* Pillar 02: Controle Financeiro na Palma da Mão */}
        <div className="lg:col-span-5 min-w-0 bg-[#15130D] border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold tracking-wide text-[#D4AF37]">
                02. Controle Financeiro na Palma da Mão
              </span>
              <Wallet className="w-5 h-5 text-[#D4AF37] shrink-0" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
              Saiba no celular quanto entrou, quanto saiu e qual é o lucro real
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Chega de fechar o mês no escuro. Acompanhe o faturamento diário, registre despesas fixas e variáveis e deixe o sistema calcular automaticamente a comissão de cada profissional sem erros de planilha.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 space-y-2 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Lucro líquido e repasses da equipe atualizados na hora</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Cada profissional acompanha apenas sua própria comissão</span>
            </div>
          </div>
        </div>

        {/* Pillar 03: Marketing, Remarketing & Captação */}
        <div className="lg:col-span-5 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold tracking-wide text-[#D4AF37]">
                03. Marketing &amp; Remarketing Direto
              </span>
              <Megaphone className="w-5 h-5 text-[#D4AF37] shrink-0" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
              Atraia novos clientes e encha os dias mais parados da semana
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Use campanhas prontas de remarketing no WhatsApp para oferecer combos, promoções de retorno e horários relâmpago. Coloque seu link profissional na bio do Instagram e no Google para converter visitantes em clientes na hora.
            </p>
          </div>
          <p className="pt-4 border-t border-white/10 text-xs text-zinc-400">
            Gere movimento novo toda semana sem depender apenas de indicação ou tráfego pago caro.
          </p>
        </div>

        {/* Pillar 04: Agenda Inteligente 24h & Experiência VIP */}
        <div className="lg:col-span-7 min-w-0 bg-[#141414] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold tracking-wide text-[#D4AF37]">
                04. Agenda 24h que Fecha Horários Enquanto Você Atende
              </span>
              <CalendarClock className="w-5 h-5 text-[#D4AF37] shrink-0" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
              Não perca mais novos clientes por demorar para responder no WhatsApp
            </h3>
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              Quando um cliente novo manda mensagem à noite ou enquanto você está ocupado, ele não espera — marca em outro lugar. Com seu link exclusivo de agendamento 24h, ele escolhe serviço, profissional e horário livre em segundos, direto pelo navegador do celular, sem baixar aplicativo.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-zinc-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Zero conflito de horários e bloqueio de folgas em 1 clique</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Histórico completo de cada cliente para fidelizar melhor</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface SalesRoiCalculatorSectionProps {
  planMonthlyPrice: number;
  planName?: string;
  ctaHref: string;
  ctaLabel: string;
  onCtaClick?: () => void;
}

export function SalesRoiCalculatorSection({
  planMonthlyPrice,
  planName = 'Plano Completo (no anual)',
  ctaHref,
  ctaLabel,
  onCtaClick
}: SalesRoiCalculatorSectionProps) {
  const [avgTicket, setAvgTicket] = useState<number>(80);
  const [recoveredClients, setRecoveredClients] = useState<number>(8);
  const [newClients, setNewClients] = useState<number>(6);

  const recoveredRevenue = avgTicket * recoveredClients;
  const newClientsRevenue = avgTicket * newClients;
  const totalExtraMonthly = recoveredRevenue + newClientsRevenue;
  const totalExtraAnnual = totalExtraMonthly * 12;
  const safePlanCost = Math.max(1, planMonthlyPrice);
  const netExtraMonthly = Math.max(0, totalExtraMonthly - safePlanCost);
  const roiMultiple = Math.max(1, Math.round(totalExtraMonthly / safePlanCost));
  const appointmentsToBreakEven = Math.max(1, Math.ceil(safePlanCost / Math.max(1, avgTicket)));
  const dailyCost = safePlanCost / 30;

  return (
    <section
      id="simulador"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-b border-white/10"
    >
      <div className="max-w-3xl mb-10 sm:mb-12 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
          Prova matemática · Valor pago vs. retorno real
        </p>
        <h2 className="font-serif text-2xl sm:text-4xl font-bold text-white tracking-tight text-balance">
          Faça a conta do seu próprio negócio e veja como o sistema se paga nos primeiros dias.
        </h2>
        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
          Ajuste os controles abaixo com a realidade do seu atendimento. O investimento mensal é mínimo perto dos clientes recuperados pelo remarketing e dos novos agendamentos fechados.
        </p>
      </div>

      <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
        {/* Left: Interactive Sliders */}
        <div className="lg:col-span-6 min-w-0 flex flex-col justify-between space-y-7">
          <div className="space-y-6">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="roi-ticket" className="text-sm font-semibold text-white">
                  Valor médio do seu atendimento
                </label>
                <span className="text-base sm:text-lg font-bold text-[#D4AF37] tabular-nums">
                  R$ {formatBRL(avgTicket)}
                </span>
              </div>
              <input
                id="roi-ticket"
                type="range"
                min={35}
                max={300}
                step={5}
                value={avgTicket}
                onChange={(e) => setAvgTicket(Number(e.target.value))}
                className="w-full accent-[#D4AF37] cursor-pointer h-2 rounded-lg bg-zinc-800"
              />
              <div className="flex justify-between text-[11px] text-zinc-500 tabular-nums">
                <span>R$ 35</span>
                <span>R$ 150</span>
                <span>R$ 300</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="roi-recovered" className="text-sm font-semibold text-white">
                  Clientes sumidos recuperados por mês (remarketing)
                </label>
                <span className="text-base sm:text-lg font-bold text-white tabular-nums">
                  {recoveredClients} {recoveredClients === 1 ? 'cliente' : 'clientes'}
                </span>
              </div>
              <input
                id="roi-recovered"
                type="range"
                min={1}
                max={30}
                step={1}
                value={recoveredClients}
                onChange={(e) => setRecoveredClients(Number(e.target.value))}
                className="w-full accent-[#D4AF37] cursor-pointer h-2 rounded-lg bg-zinc-800"
              />
              <div className="flex justify-between text-[11px] text-zinc-500 tabular-nums">
                <span>1 cliente/mês</span>
                <span>15 clientes/mês</span>
                <span>30 clientes/mês</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="roi-new" className="text-sm font-semibold text-white">
                  Novos atendimentos captados por mês (link 24h + campanhas)
                </label>
                <span className="text-base sm:text-lg font-bold text-white tabular-nums">
                  {newClients} {newClients === 1 ? 'cliente' : 'clientes'}
                </span>
              </div>
              <input
                id="roi-new"
                type="range"
                min={1}
                max={30}
                step={1}
                value={newClients}
                onChange={(e) => setNewClients(Number(e.target.value))}
                className="w-full accent-[#D4AF37] cursor-pointer h-2 rounded-lg bg-zinc-800"
              />
              <div className="flex justify-between text-[11px] text-zinc-500 tabular-nums">
                <span>1 novo/mês</span>
                <span>15 novos/mês</span>
                <span>30 novos/mês</span>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-white/10 flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Com seu ticket médio de <strong className="text-white">R$ {formatBRL(avgTicket)}</strong>, bastam apenas{' '}
              <strong className="text-[#D4AF37]">
                {appointmentsToBreakEven} {appointmentsToBreakEven === 1 ? 'atendimento recuperado' : 'atendimentos recuperados'}
              </strong>{' '}
              no mês inteiro para pagar a assinatura. Todo o restante fica livre no seu caixa.
            </p>
          </div>
        </div>

        {/* Right: Clear Financial Comparison Output */}
        <div className="lg:col-span-6 min-w-0 bg-[#18150D] border border-[#D4AF37]/40 rounded-2xl p-6 sm:p-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
              Resultado estimado no seu caixa
            </p>

            <div className="divide-y divide-white/10 text-sm">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-zinc-300">Receita de clientes recuperados ({recoveredClients}x)</span>
                <span className="font-semibold text-white tabular-nums shrink-0">
                  + R$ {formatBRL(recoveredRevenue)}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-zinc-300">Receita de novos atendimentos ({newClients}x)</span>
                <span className="font-semibold text-white tabular-nums shrink-0">
                  + R$ {formatBRL(newClientsRevenue)}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-zinc-400">Investimento no {planName}</span>
                <span className="font-semibold text-zinc-300 tabular-nums shrink-0">
                  - R$ {formatBRL(safePlanCost)}
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-1.5">
              <p className="text-xs text-zinc-400">Lucro extra estimado por mês (já descontando o sistema)</p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-3xl sm:text-4xl font-bold text-emerald-400 tabular-nums">
                  + R$ {formatBRL(netExtraMonthly)}
                </p>
                <span className="text-sm font-bold text-[#D4AF37] tabular-nums">
                  {roiMultiple}x o valor investido
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 tabular-nums">
                Em 12 meses, isso representa <strong className="text-white">R$ {formatBRL(totalExtraAnnual)}</strong> a mais girando no seu negócio — por apenas <strong className="text-[#D4AF37]">R$ {formatBRL(dailyCost)}/dia</strong>.
              </p>
            </div>
          </div>

          <a
            href={ctaHref}
            onClick={onCtaClick}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-sm sm:text-base py-3.5 px-5 rounded-xl hover:bg-[#e3c04f] transition-colors text-center"
          >
            <span>{ctaLabel}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </a>
        </div>
      </div>
    </section>
  );
}
