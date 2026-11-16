import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Eye,
  EyeOff,
  Handshake,
  KeyRound,
  LogOut,
  MessageCircle,
  MousePointerClick,
  Save,
  Scissors,
  Share2,
  Store,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { getSegment } from '../../lib/segments';
import {
  getRememberedEmail,
  saveRememberedEmail,
  clearRememberedEmail,
  supportsPasswordCredentialApi,
  storeBrowserPasswordCredential,
  requestSavedBrowserCredential
} from '../../lib/browserCredentials';

const AFFILIATE_TOKEN_KEY = 'doiseme_affiliate_token';

interface AffiliateProfile {
  id: string;
  name: string;
  email: string;
  phoneWhatsapp: string;
  pixKey: string;
  code: string;
  commissionRate: number;
  commissionPercent: number;
  niche: string;
  active: boolean;
  createdAt: string;
}

interface AffiliateMetrics {
  clicksCount: number;
  uniqueClicks: number;
  lastClickedAt: string | null;
  referralsCount: number;
  trialCount: number;
  activePaidCount: number;
  signupConversionRate: number;
  paidConversionRate: number;
  trialToPaidRate: number;
  pendingAmount: number;
  availableAmount: number;
  paidAmount: number;
  totalEarned: number;
}

interface ReferralItem {
  shopId: string;
  shopName: string;
  segment: string;
  planId: string;
  planName: string;
  status: 'trial' | 'active' | 'expired' | 'blocked';
  registeredAt: string;
  expiresAt: string | null;
}

interface CommissionItem {
  id: string;
  shopId: string;
  shopName: string;
  planId: string;
  planName: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'pending' | 'available' | 'paid' | 'reversed';
  availableAt: string;
  paidAt: string | null;
  payoutReference: string | null;
  createdAt: string;
}

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

export default function AffiliatePortal() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AFFILIATE_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(Boolean(token));
  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null);
  const [metrics, setMetrics] = useState<AffiliateMetrics | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [supportWhatsapp, setSupportWhatsapp] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState(() => getRememberedEmail('affiliate'));
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const canUseCredentialPicker = supportsPasswordCredentialApi();

  // Dashboard tabs & PIX profile edit
  const [activeListTab, setActiveListTab] = useState<'referrals' | 'commissions'>('referrals');
  const [pixKeyInput, setPixKeyInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'link' | 'pitch' | null>(null);

  const fetchSupportContact = async () => {
    try {
      const res = await fetch('/api/public/support-contact');
      if (res.ok) {
        const data = await res.json();
        if (data?.configured && data?.whatsapp) {
          setSupportWhatsapp(data.whatsapp);
        }
      }
    } catch {
      // Non-critical
    }
  };

  const fetchDashboard = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/affiliate/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (res.status === 401 || res.status === 403) {
        try {
          localStorage.removeItem(AFFILIATE_TOKEN_KEY);
        } catch {}
        setToken(null);
        setAffiliate(null);
        if (res.status === 403) {
          const errData = await res.json().catch(() => null);
          setLoginError(errData?.error || 'Sessão encerrada ou conta desativada.');
        }
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível carregar os dados do parceiro.');
        return;
      }

      setAffiliate(data.affiliate);
      setMetrics(data.metrics);
      setReferrals(data.referrals || []);
      setCommissions(data.commissions || []);
      setPixKeyInput(data.affiliate?.pixKey || '');
      setPhoneInput(data.affiliate?.phoneWhatsapp || '');
    } catch {
      toast.error('Erro de conexão ao carregar painel de parceiro.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupportContact();
    if (token) {
      fetchDashboard(token);
    }
  }, [token]);

  const handleUseSavedCredential = async () => {
    const cred = await requestSavedBrowserCredential();
    if (cred) {
      setLoginEmail(cred.email);
      setLoginPassword(cred.password);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const cleanEmail = loginEmail.trim();
      const res = await fetch('/api/affiliate/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: loginPassword,
          rememberMe
        })
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setLoginError(data.error || 'E-mail ou senha inválidos.');
        return;
      }

      if (rememberMe) {
        saveRememberedEmail('affiliate', cleanEmail);
        await storeBrowserPasswordCredential({
          email: cleanEmail,
          password: loginPassword,
          name: data.affiliate?.name
        });
      } else {
        clearRememberedEmail('affiliate');
      }

      try {
        localStorage.setItem(AFFILIATE_TOKEN_KEY, data.token);
      } catch {
        // Ignore if storage blocked
      }
      setToken(data.token);
      setLoginPassword('');
      toast.success(`Bem-vindo(a), ${data.affiliate?.name?.split(' ')[0] || 'Parceiro'}!`);
    } catch {
      setLoginError('Erro de conexão com o servidor.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(AFFILIATE_TOKEN_KEY);
    } catch {}
    setToken(null);
    setAffiliate(null);
    setMetrics(null);
    setReferrals([]);
    setCommissions([]);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingProfile(true);
    try {
      const payload: Record<string, any> = {
        pixKey: pixKeyInput.trim(),
        phoneWhatsapp: phoneInput.trim()
      };
      if (newPasswordInput.trim()) {
        payload.newPassword = newPasswordInput.trim();
      }

      const res = await fetch('/api/affiliate/me/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar dados.');
        return;
      }
      setAffiliate(data.affiliate);
      setNewPasswordInput('');
      toast.success('Dados de repasse atualizados com sucesso!');
    } catch {
      toast.error('Erro de conexão ao salvar perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const referralUrl =
    typeof window !== 'undefined' && affiliate?.code
      ? `${window.location.origin}/r/${affiliate.code}`
      : '';

  const copyText = async (text: string, type: 'link' | 'pitch', successLabel: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(type);
      setTimeout(() => setCopiedKey(null), 2200);
      toast.success(successLabel);
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  // Unauthenticated View — Partner Login
  if (!token || (!loading && !affiliate)) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-between p-4 sm:p-8">
        <header className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-medium text-zinc-300 hover:text-white hover:border-white/25 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para Home
            </Link>
            <Link to="/" className="hidden sm:flex items-center gap-2 whitespace-nowrap shrink-0">
              <Scissors className="w-5 h-5 text-[#D4AF37]" />
              <span className="font-serif text-lg font-bold tracking-[0.12em] uppercase">Doiseme</span>
              <span className="text-xs font-extrabold text-[#D4AF37]">PRO</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <Link to="/cadastro" className="text-zinc-400 hover:text-white transition-colors whitespace-nowrap">
              Criar conta de loja
            </Link>
            <Link to="/admin/login" className="text-zinc-300 hover:text-white font-medium transition-colors whitespace-nowrap">
              Painel da Loja
            </Link>
          </div>
        </header>

        <main className="max-w-5xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 bg-[#121212] border border-white/10 rounded-2xl p-7 sm:p-9 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                <Handshake className="w-4 h-4" />
                Programa de Parceiros &amp; Afiliados
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight text-balance">
                Ganhe de 20% a 25% recorrente indicando o DoisemePRO para o seu nicho.
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Cada profissional, estúdio ou clínica que entrar pelo seu link e assinar qualquer plano gera comissão mensal enquanto permanecer ativo na plataforma.
              </p>

              <div className="pt-4 border-t border-white/10 space-y-3.5 text-sm">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-4 h-4 text-[#D4AF37] shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-white">Comissão recorrente real</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Receba em todas as renovações mensais ou anuais das lojas indicadas por você.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Share2 className="w-4 h-4 text-[#D4AF37] shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-white">Link curto com rastreamento de 30 dias</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Se o cliente visitar pelo seu link e finalizar o teste grátis dias depois, a indicação ainda conta para você.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Wallet className="w-4 h-4 text-[#D4AF37] shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-white">Transparência total &amp; PIX</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Acompanhe quem está em teste de 7 dias, quem assinou e seus valores liberados após D+15.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {supportWhatsapp && (
              <div className="mt-8 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-zinc-400">Ainda não tem acesso de parceiro?</p>
                <a
                  href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                    'Olá! Tenho interesse em me tornar parceiro/afiliado do DoisemePRO para divulgar no meu nicho.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  Solicitar cadastro de parceiro
                </a>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-[#141414] border border-white/10 rounded-2xl p-7 sm:p-9 flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-white">Acessar Portal do Afiliado</h2>
            <p className="text-xs text-zinc-400 mt-1 mb-6">
              Entre com o e-mail e a senha configurados pela administração do DoisemePRO.
            </p>

            {loginError && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm">
                {loginError}
              </div>
            )}

            <form method="post" autoComplete="on" onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="affiliate-email" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  E-mail de Parceiro
                </label>
                <input
                  id="affiliate-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="parceiro@email.com"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div>
                <label htmlFor="affiliate-password" className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <input
                    id="affiliate-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    aria-label="Mostrar senha"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={rememberMe}
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                      rememberMe
                        ? 'bg-[#D4AF37] border-[#D4AF37] text-black'
                        : 'border-white/25 bg-black/40 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <span className="text-xs text-zinc-300">
                    Manter conectado (30 dias) e salvar login no navegador
                  </span>
                </label>

                {canUseCredentialPicker && (
                  <button
                    type="button"
                    onClick={handleUseSavedCredential}
                    className="inline-flex items-center gap-1.5 self-start text-xs text-[#D4AF37] hover:underline"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Preencher com senha salva do navegador
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full bg-[#D4AF37] text-black font-bold py-3.5 rounded-xl text-sm hover:bg-[#e2be4a] transition-colors disabled:opacity-50"
              >
                {loggingIn ? 'Entrando...' : 'Entrar no Portal do Afiliado'}
              </button>
            </form>
          </div>
        </main>

        <footer className="max-w-5xl w-full mx-auto text-center text-xs text-zinc-500 py-2">
          DoisemePRO · Programa Oficial de Parceiros e Indicações
        </footer>
      </div>
    );
  }

  if (loading || !affiliate) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
        <p className="text-xs text-zinc-400">Carregando painel do parceiro...</p>
      </div>
    );
  }

  const pitchTemplate = `Fala! Tudo certo? Tenho indicado o DoisemePRO para profissionais e donos de espaço que querem agenda 24h no automático, parar de perder tempo no WhatsApp e fazer clientes voltarem todo mês. Pelo meu link você ganha 7 dias grátis sem cartão + condição promocional VIP (R$ 20/mês OFF no mensal ou economia de até R$ 681 no anual). Confere aqui: ${referralUrl}`;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased">
      {/* Header (Single-line controls, clear separation) */}
      <header className="border-b border-white/10 bg-[#0D0D0D] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <Scissors className="w-5 h-5 text-[#D4AF37]" />
              <span className="font-serif text-lg font-bold tracking-[0.12em] uppercase">Doiseme</span>
              <span className="text-xs font-extrabold text-[#D4AF37]">PRO</span>
            </Link>
            <span className="text-zinc-600 hidden sm:inline">·</span>
            <span className="text-xs sm:text-sm text-zinc-300 font-medium truncate hidden sm:inline">
              Parceiro: <strong className="text-white">{affiliate.name}</strong> ({affiliate.commissionPercent}% recorrente)
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {supportWhatsapp && (
              <a
                href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                  `Olá! Sou o parceiro ${affiliate.name} (código ${affiliate.code}).`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 text-zinc-200 hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Suporte Parceiro</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Link & Pitch Hero */}
        <section className="bg-[#121212] border border-white/10 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
              <Award className="w-4 h-4" />
              Comissão ativa de {affiliate.commissionPercent}% recorrente
              {affiliate.niche ? ` · Foco: ${affiliate.niche}` : ''}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Seu Link Exclusivo de Indicação</h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Compartilhe nos seus Reels, bio, grupos de WhatsApp ou direto no 1-a-1. Todo cadastro iniciado por aqui fica vinculado a você.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <div className="bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono text-[#D4AF37] truncate max-w-full sm:max-w-xs">
              {referralUrl}
            </div>
            <button
              type="button"
              onClick={() => copyText(referralUrl, 'link', 'Link de indicação copiado!')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#D4AF37] text-black hover:bg-[#e2be4a] transition-colors whitespace-nowrap shrink-0"
            >
              {copiedKey === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedKey === 'link' ? 'Copiado!' : 'Copiar Link'}
            </button>
            <button
              type="button"
              onClick={() => copyText(pitchTemplate, 'pitch', 'Mensagem pronta copiada! Cole no WhatsApp ou Direct.')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedKey === 'pitch' ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              Copiar Texto Pronto
            </button>
          </div>
        </section>

        {/* Funnel & Conversion KPI Strip */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#121212] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-2">
                <span>Cliques no Seu Link</span>
                <MousePointerClick className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-3xl font-bold text-white tabular-nums">
                {metrics?.clicksCount || 0}
              </div>
              <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                {metrics?.uniqueClicks || 0} visitante(s) único(s)
              </p>
            </div>

            <div className="bg-[#121212] border border-amber-500/25 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-300 mb-2">
                <span>Em Fase de Testes</span>
                <Users className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-amber-300 tabular-nums">
                {metrics?.trialCount || 0}
              </div>
              <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                {metrics?.referralsCount || 0} cadastro(s) total · {metrics?.activePaidCount || 0} pagante(s)
              </p>
            </div>

            <div className="bg-[#121212] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-2">
                <span>Taxa de Conversão</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-emerald-400 tabular-nums">
                {Number(metrics?.paidConversionRate || 0).toFixed(1)}%
              </div>
              <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                {Number(metrics?.signupConversionRate || 0).toFixed(1)}% clique→cadastro · {Number(metrics?.trialToPaidRate || 0).toFixed(1)}% teste→pago
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#121212] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-2">
                <span>Aguardando D+15</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-amber-300 tabular-nums">
                R$ {formatBRL(metrics?.pendingAmount || 0)}
              </div>
              <p className="text-xs text-zinc-400 mt-1">Janela de segurança de 15 dias</p>
            </div>

            <div className="bg-[#121212] border border-emerald-500/30 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-300 mb-2">
                <span>Disponível p/ PIX</span>
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-emerald-400 tabular-nums">
                R$ {formatBRL(metrics?.availableAmount || 0)}
              </div>
              <p className="text-xs text-zinc-400 mt-1">Liberado para o próximo repasse</p>
            </div>

            <div className="bg-[#121212] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-2">
                <span>Total Recebido</span>
                <DollarSign className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-3xl font-bold text-white tabular-nums">
                R$ {formatBRL(metrics?.paidAmount || 0)}
              </div>
              <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                Acumulado histórico: R$ {formatBRL(metrics?.totalEarned || 0)}
              </p>
            </div>
          </div>
        </section>

        {/* Main 8/4 Grid: Referrals + Ledger | PIX Settings */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-[#121212] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center bg-black/50 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setActiveListTab('referrals')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    activeListTab === 'referrals' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Lojas Indicadas ({referrals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveListTab('commissions')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    activeListTab === 'commissions' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Extrato de Comissões ({commissions.length})
                </button>
              </div>
              <span className="text-xs text-zinc-400">
                Renovações recorrentes entram automaticamente aqui
              </span>
            </div>

            {activeListTab === 'referrals' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-zinc-400">
                      <th className="py-3.5 px-5">Estabelecimento</th>
                      <th className="py-3.5 px-4">Nicho</th>
                      <th className="py-3.5 px-4">Plano</th>
                      <th className="py-3.5 px-4">Situação</th>
                      <th className="py-3.5 px-5 text-right">Cadastro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {referrals.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 px-5 text-center text-zinc-500 text-xs sm:text-sm">
                          Nenhuma loja cadastrada pelo seu link ainda. Copie seu link acima e comece a divulgar!
                        </td>
                      </tr>
                    ) : (
                      referrals.map((ref) => {
                        const segName = getSegment(ref.segment).name;
                        return (
                          <tr key={ref.shopId} className="hover:bg-white/[0.02]">
                            <td className="py-3.5 px-5 font-medium text-white">{ref.shopName}</td>
                            <td className="py-3.5 px-4 text-xs text-zinc-400">{segName}</td>
                            <td className="py-3.5 px-4 text-xs text-zinc-200">{ref.planName}</td>
                            <td className="py-3.5 px-4 text-xs">
                              {ref.status === 'active' && (
                                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Assinante Ativo
                                </span>
                              )}
                              {ref.status === 'trial' && (
                                <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
                                  <Clock className="w-3.5 h-3.5" /> Em Teste Grátis
                                </span>
                              )}
                              {ref.status === 'expired' && (
                                <span className="text-zinc-400 font-medium">Expirado</span>
                              )}
                              {ref.status === 'blocked' && (
                                <span className="text-red-400 font-medium">Bloqueado</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right text-xs text-zinc-400 tabular-nums">
                              {formatDate(ref.registeredAt)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-zinc-400">
                      <th className="py-3.5 px-5">Data</th>
                      <th className="py-3.5 px-4">Cliente / Plano</th>
                      <th className="py-3.5 px-4 text-right">Assinatura</th>
                      <th className="py-3.5 px-4 text-right">Sua Comissão</th>
                      <th className="py-3.5 px-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {commissions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 px-5 text-center text-zinc-500 text-xs sm:text-sm">
                          Assim que uma loja indicada pagar a primeira assinatura, sua comissão aparecerá aqui.
                        </td>
                      </tr>
                    ) : (
                      commissions.map((comm) => (
                        <tr key={comm.id} className="hover:bg-white/[0.02]">
                          <td className="py-3.5 px-5 text-xs text-zinc-400 tabular-nums">
                            {formatDate(comm.createdAt)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-white text-sm">{comm.shopName}</div>
                            <div className="text-xs text-zinc-400">
                              {comm.planName} · {Math.round(comm.commissionRate * 100)}%
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs text-zinc-300 tabular-nums">
                            R$ {formatBRL(comm.grossAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-[#D4AF37] tabular-nums">
                            R$ {formatBRL(comm.commissionAmount)}
                          </td>
                          <td className="py-3.5 px-5 text-right text-xs">
                            {comm.status === 'paid' && (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Pago ({formatDate(comm.paidAt)})
                              </span>
                            )}
                            {comm.status === 'available' && (
                              <span className="text-emerald-300 font-semibold">Liberado p/ PIX</span>
                            )}
                            {comm.status === 'pending' && (
                              <span className="text-amber-300 font-medium">
                                Libera em {formatDate(comm.availableAt)}
                              </span>
                            )}
                            {comm.status === 'reversed' && (
                              <span className="text-red-400 font-medium">Estornado</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Side: PIX & Security Settings */}
          <div className="lg:col-span-4 bg-[#121212] border border-white/10 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-white">Dados de Recebimento (PIX)</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Mantenha sua chave PIX atualizada para receber seus repasses assim que completarem 15 dias da assinatura.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Chave PIX</label>
                <input
                  type="text"
                  value={pixKeyInput}
                  onChange={(e) => setPixKeyInput(e.target.value)}
                  placeholder="CPF, E-mail, Celular ou Chave Aleatória"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">WhatsApp de Contato</label>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Alterar Senha (opcional)</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Deixe vazio para manter a atual"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm hover:bg-[#e2be4a] transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? 'Salvando...' : 'Salvar Dados PIX'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
