import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scissors, Lock, MessageCircle } from 'lucide-react';

export default function Privacy() {
  const [supportWhatsapp, setSupportWhatsapp] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch('/api/public/support-contact')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.whatsapp) setSupportWhatsapp(data.whatsapp);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 selection:bg-[#D4AF37] selection:text-black">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <Scissors className="w-6 h-6 text-[#D4AF37]" />
            <div className="flex items-center">
              <span className="font-serif font-bold text-lg tracking-wider uppercase text-white">
                Doiseme
              </span>
              <span className="text-[#D4AF37] font-sans font-extrabold text-xs px-1.5 py-0.5 rounded bg-[#D4AF37]/15 ml-1.5">
                PRO
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <Link
              to="/termos"
              className="text-zinc-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Termos de Uso
            </Link>
            <Link
              to="/cadastro"
              className="bg-[#D4AF37] text-black font-bold px-4 py-2 rounded-xl hover:bg-[#e3c04f] transition-colors whitespace-nowrap shrink-0"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10">
        <div className="space-y-4 border-b border-white/10 pb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-[#D4AF37] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a página inicial
          </Link>

          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#D4AF37] font-semibold pt-2">
            <Lock className="w-4 h-4" />
            Conformidade LGPD · Lei nº 13.709/2018
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Política de Privacidade e Proteção de Dados
          </h1>
          <p className="text-sm text-zinc-400">
            Última atualização: Novembro de 2026 · Transparência sobre coleta, uso e guarda de dados pessoais e sensíveis.
          </p>
        </div>

        <article className="space-y-8 text-sm sm:text-base leading-relaxed text-zinc-300">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Papéis no Tratamento de Dados (Controlador e Operador)</h2>
            <p>
              Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD):
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                Para os dados cadastrais dos <strong className="text-white">Assinantes e Profissionais</strong> (nome, e-mail, WhatsApp, nome do negócio e histórico de assinatura), o DoisemePRO atua como <strong className="text-white">Controlador</strong>.
              </li>
              <li>
                Para os dados dos <strong className="text-white">Clientes Finais / Pacientes</strong> inseridos por cada estabelecimento (agendamentos, prontuários clínicos, fichas estéticas, avaliações físicas, fotos e dados técnicos), o estabelecimento assinante é o <strong className="text-white">Controlador</strong> e o DoisemePRO atua estritamente como <strong className="text-white">Operador</strong> tecnológico, armazenando as informações de forma isolada por estabelecimento.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Quais Dados São Tratados</h2>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                <strong className="text-white">Dados de conta:</strong> nome completo, e-mail de login, senha criptografada (hash bcrypt), telefone comercial e configurações do estabelecimento.
              </li>
              <li>
                <strong className="text-white">Dados de agendamento público:</strong> nome, WhatsApp e observações/briefing opcionais informados pelo cliente final no ato da reserva.
              </li>
              <li>
                <strong className="text-white">Dados sensíveis por nicho (quando habilitados pelo estabelecimento):</strong> anamnese de saúde/estética, evolução clínica em psicologia, avaliações físicas e registros fotográficos. O acesso é protegido por autenticação JWT e segregação por empresa e profissional.
              </li>
              <li>
                <strong className="text-white">Dados de pagamento SaaS:</strong> referências de cobrança, plano escolhido e status retornados pelo gateway Mercado Pago. O DoisemePRO não armazena números completos de cartão de crédito.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. Finalidade e Bases Legais</h2>
            <p>Os dados são tratados exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>Viabilizar o agendamento online e a prestação dos serviços contratados (execução de contrato);</li>
              <li>Controlar repasses de comissões, histórico financeiro e autenticação de usuários (legítimo interesse e execução de contrato);</li>
              <li>Processar renovações de planos, PIX e prevenção a fraudes (cumprimento de obrigação legal e execução contratual);</li>
              <li>Manter registros clínicos ou estéticos sob responsabilidade e consentimento gerenciados pelo profissional ou clínica responsável.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Armazenamento Local, Segurança e Compartilhamento</h2>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                Utilizamos infraestrutura em nuvem com criptografia em trânsito (HTTPS/TLS), tokens assinados (JWT) e isolamento lógico por <code className="text-[#D4AF37]">barbershop_id</code>.
              </li>
              <li>
                O navegador utiliza armazenamento local (<code className="text-[#D4AF37]">localStorage</code>) estritamente necessário para manter sua sessão autenticada e preferência de tema (claro/escuro), sem rastreadores publicitários de terceiros.
              </li>
              <li>
                Não comercializamos nem cedemos bases de clientes entre estabelecimentos. O compartilhamento ocorre apenas com provedores essenciais de infraestrutura (banco de dados em nuvem e gateway Mercado Pago).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">5. Direitos dos Titulares e Retenção</h2>
            <p>
              Nos termos do Art. 18 da LGPD, titulares de dados podem solicitar confirmação de tratamento, acesso, correção, portabilidade ou exclusão de seus registros:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                <strong className="text-white">Clientes finais / Pacientes:</strong> devem contatar diretamente o estabelecimento onde realizaram o atendimento para atualização ou exclusão de ficha.
              </li>
              <li>
                <strong className="text-white">Estabelecimentos assinantes:</strong> podem editar ou remover clientes, profissionais e prontuários a qualquer momento no painel, ou solicitar a exclusão integral da conta junto ao suporte oficial.
              </li>
            </ul>
          </section>
        </article>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <Link to="/termos" className="text-[#D4AF37] font-semibold hover:underline">
              Ler Termos de Uso
            </Link>
            {supportWhatsapp && (
              <a
                href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                  'Olá! Preciso de atendimento sobre Privacidade / LGPD no DoisemePRO.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300"
              >
                <MessageCircle className="w-4 h-4" />
                Falar com encarregado / suporte
              </a>
            )}
          </div>
          <Link
            to="/cadastro"
            className="text-xs sm:text-sm font-bold bg-white text-black px-5 py-2.5 rounded-xl hover:bg-zinc-200 transition-colors whitespace-nowrap"
          >
            Criar minha conta grátis
          </Link>
        </div>
      </main>
    </div>
  );
}
