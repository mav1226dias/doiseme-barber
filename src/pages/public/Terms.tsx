import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scissors, ShieldCheck, MessageCircle } from 'lucide-react';

export default function Terms() {
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
              to="/privacidade"
              className="text-zinc-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Privacidade (LGPD)
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
            <ShieldCheck className="w-4 h-4" />
            Documento Legal · Versão 1.0
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Termos de Uso da Plataforma DoisemePRO
          </h1>
          <p className="text-sm text-zinc-400">
            Última atualização: Novembro de 2026 · Aplicável a todos os estabelecimentos assinantes e profissionais vinculados.
          </p>
        </div>

        <article className="space-y-8 text-sm sm:text-base leading-relaxed text-zinc-300">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Objeto e Aceitação</h2>
            <p>
              Estes Termos de Uso regulam a utilização do software como serviço (SaaS) <strong className="text-white">DoisemePRO</strong>, destinado à gestão de agendamentos online, cadastro de clientes, controle financeiro, comissões de equipe e prontuários/registros técnicos multi-nicho.
            </p>
            <p>
              Ao criar uma conta em <code className="text-[#D4AF37]">/cadastro</code> ou utilizar qualquer funcionalidade da plataforma, o representante legal do estabelecimento (&quot;Assinante&quot;) declara ter lido, compreendido e aceito integralmente estes Termos e a{' '}
              <Link to="/privacidade" className="text-[#D4AF37] underline hover:opacity-80">
                Política de Privacidade (LGPD)
              </Link>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">2. Cadastro, Conta e Acesso de Equipe</h2>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                O Assinante é responsável pela veracidade das informações fornecidas no cadastro e pela guarda das senhas de acesso do administrador e dos profissionais vinculados.
              </li>
              <li>
                É possível criar acessos individuais para membros da equipe (<strong className="text-white">Perfil Profissional</strong>), com permissões restritas à própria agenda, clientes atendidos e comissões. O Assinante responde pelos atos praticados por sua equipe na plataforma.
              </li>
              <li>
                O link público personalizado (<code className="text-[#D4AF37]">/b/seu-link</code>) é reservado de acordo com a disponibilidade no momento do cadastro, não sendo permitidos termos ofensivos ou que violem marcas registradas de terceiros.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">3. Teste Grátis, Planos e Pagamentos</h2>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                Novos estabelecimentos recebem <strong className="text-white">7 (sete) dias corridos de teste gratuito</strong> sem exigência de cartão de crédito prévio.
              </li>
              <li>
                Após o término do período de avaliação, a continuidade do uso administrativo depende da contratação de um dos planos vigentes (Mensal ou Anual) na aba <strong className="text-white">Assinatura &amp; Planos</strong>, processados via Mercado Pago ou PIX.
              </li>
              <li>
                Não há multa de fidelidade nos planos mensais: o Assinante pode deixar de renovar ao final do ciclo vigente. Caso a assinatura expire, o painel administrativo permanece bloqueado para edição até a regularização, preservando a integridade dos dados cadastrados conforme nossa política de retenção.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">4. Dados Clínicos, Estéticos e Sigilo Profissional</h2>
            <p>
              Para segmentos como Psicologia, Estética, Saúde, Pilates e Tatuagem, a plataforma oferece campos para anamnese, evolução clínica, registros fotográficos e especificações técnicas.
            </p>
            <p>
              O Assinante e seus profissionais atuam como <strong className="text-white">Controladores dos dados</strong> de seus pacientes e clientes finais, comprometendo-se a obter eventuais consentimentos específicos exigidos por lei ou conselhos de classe (incluindo autorização para armazenamento de imagens de antes e depois e registro de anamnese).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">5. Uso Aceitável e Disponibilidade</h2>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                É proibido utilizar o sistema para envio de spam, armazenamento de conteúdo ilícito, tentativas de acesso não autorizado a dados de outros estabelecimentos ou engenharia reversa.
              </li>
              <li>
                O DoisemePRO emprega melhores práticas de disponibilidade em nuvem, mas não se responsabiliza por falhas decorrentes de indisponibilidade de internet do usuário, operadoras de telefonia/WhatsApp ou gateways de pagamento externos.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">6. Suporte, Rescisão e Foro</h2>
            <p>
              Dúvidas operacionais, solicitações de cancelamento ou exclusão definitiva de conta podem ser encaminhadas pelo canal de suporte oficial disponível no painel. Fica eleito o foro da comarca do domicílio do controlador da plataforma no Brasil para dirimir eventuais controvérsias, ressalvadas as disposições legais aplicáveis ao consumidor.
            </p>
          </section>
        </article>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <Link to="/privacidade" className="text-[#D4AF37] font-semibold hover:underline">
              Ler Política de Privacidade (LGPD)
            </Link>
            {supportWhatsapp && (
              <a
                href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                  'Olá! Tenho uma dúvida sobre os Termos de Uso do DoisemePRO.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300"
              >
                <MessageCircle className="w-4 h-4" />
                Suporte via WhatsApp
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
