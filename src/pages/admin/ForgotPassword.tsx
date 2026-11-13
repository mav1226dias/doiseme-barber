import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Scissors,
  ArrowLeft,
  Mail,
  MessageCircle,
  Copy,
  Check,
  Building2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [loadingContact, setLoadingContact] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/public/support-contact')
      .then((res) => res.json())
      .then((data) => {
        if (data?.whatsapp) {
          setSupportWhatsapp(data.whatsapp);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingContact(false));
  }, []);

  const buildSupportMessage = () => {
    const lines = [
      'Olá! Preciso de ajuda para recuperar/trocar a senha de acesso no *DoisemePRO*.',
      email.trim() ? `E-mail cadastrado: ${email.trim()}` : 'E-mail cadastrado: (informar)',
      businessName.trim() ? `Estabelecimento: ${businessName.trim()}` : null
    ].filter(Boolean);
    return lines.join('\n');
  };

  const whatsappUrl = supportWhatsapp
    ? `https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(buildSupportMessage())}`
    : '';

  const handleCopyMessage = async () => {
    const msg = buildSupportMessage();
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      toast.success('Mensagem copiada para a área de transferência!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <Scissors className="w-10 h-10 text-[#D4AF37] mb-4" />
          <h1 className="text-2xl font-bold text-white font-serif tracking-wide flex items-center">
            DOISEME<span className="text-[#D4AF37] font-sans font-extrabold text-sm px-1.5 py-0.5 rounded bg-[#D4AF37]/15 ml-1">PRO</span>
          </h1>
          <p className="text-zinc-400 text-xs uppercase tracking-widest mt-1.5">Recuperar Acesso via Suporte</p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-zinc-300 text-center leading-relaxed">
            Para sua segurança, a recuperação ou troca de senha é realizada diretamente com o nosso suporte no WhatsApp.
          </p>

          <div>
            <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">
              Seu E-mail de Acesso
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">
              Nome do Estabelecimento (Opcional)
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ex: Studio Vitta"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
              />
            </div>
          </div>

          {loadingContact ? (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
              <span>Carregando contato do suporte...</span>
            </div>
          ) : supportWhatsapp ? (
            <div className="space-y-2.5 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold py-3 px-6 rounded-xl transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                Falar com Suporte no WhatsApp
              </a>

              <button
                type="button"
                onClick={handleCopyMessage}
                className="w-full inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-zinc-300 font-medium text-xs py-2.5 px-4 rounded-xl transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Mensagem copiada!' : 'Copiar mensagem pronta'}
              </button>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200 leading-relaxed">
                  O número de WhatsApp do suporte ainda não foi configurado no Painel Master.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-medium text-xs py-2 px-3 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar dados da solicitação
              </button>
            </div>
          )}

          <div className="pt-3 text-center">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
