import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Scissors,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Globe,
  Calendar,
  Sparkles,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { SEGMENTS, getSegment } from '../../lib/segments';
import { SegmentIcon } from '../../components/SegmentIcon';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export default function Register() {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [segment, setSegment] = useState('barbershop');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [seedStarterServices, setSeedStarterServices] = useState(true);
  const [createOwnerAsProfessional, setCreateOwnerAsProfessional] = useState(true);

  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    reason?: string;
    normalizedSlug?: string;
  }>({ checking: false, available: null });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedPreset = getSegment(segment);

  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(toSlug(businessName));
    }
  }, [businessName, slugManuallyEdited]);

  useEffect(() => {
    const clean = toSlug(slug);
    if (!clean || clean.length < 3) {
      setSlugStatus({
        checking: false,
        available: clean.length > 0 ? false : null,
        reason: clean.length > 0 ? 'O link deve ter pelo menos 3 caracteres.' : undefined,
        normalizedSlug: clean
      });
      return;
    }

    let cancelled = false;
    setSlugStatus((prev) => ({ ...prev, checking: true }));

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-slug/${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (!cancelled) {
          setSlugStatus({
            checking: false,
            available: Boolean(data.available),
            reason: data.reason,
            normalizedSlug: data.normalizedSlug || clean
          });
        }
      } catch {
        if (!cancelled) {
          setSlugStatus({ checking: false, available: null });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }
    if (slugStatus.available === false) {
      setError(slugStatus.reason || 'Escolha outro link personalizado disponível.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          slug: toSlug(slug),
          email: email.trim(),
          phone: phone.trim(),
          segment,
          password,
          confirmPassword,
          seedStarterServices,
          createOwnerAsProfessional
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível concluir o cadastro.');
        return;
      }

      try {
        localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        toast.success(`Bem-vindo ao DoisemePRO! Seus ${data.trialDays || 7} dias grátis começaram.`);
        navigate('/admin');
      } catch {
        setError("Seu navegador bloqueou o armazenamento da sessão. Use o botão 'Abrir em Nova Aba' para acessar o painel.");
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Editorial / Onboarding Preview Column */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#121212] border border-white/10 rounded-3xl p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <Scissors className="w-7 h-7 text-[#D4AF37]" />
              <span className="text-xl font-bold font-serif tracking-wide text-white whitespace-nowrap">
                DOISEME<span className="text-[#D4AF37] font-sans font-extrabold text-xs px-1.5 py-0.5 rounded bg-[#D4AF37]/15 ml-1">PRO</span>
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                Teste grátis por 7 dias
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-white text-balance leading-tight">
                Coloque sua agenda online no ar em menos de dois minutos.
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Cadastro completo com link exclusivo de agendamento, controle financeiro, comissões e gestão adaptada ao seu nicho.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Agenda e página pública pronta</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Seus {selectedPreset.terms.clientPlural.toLowerCase()} agendam direto pelo seu link sem baixar aplicativo.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Adaptado para {selectedPreset.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Terminologia configurada para {selectedPreset.terms.professionalPlural.toLowerCase()} e {selectedPreset.terms.servicePlural.toLowerCase()}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Seu endereço de agendamento</p>
                  <p className="text-xs font-mono text-[#D4AF37] truncate mt-0.5">
                    /b/{toSlug(slug) || 'seu-espaco'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${selectedPreset.defaultColors.primary}20`, color: selectedPreset.defaultColors.primary }}
            >
              <SegmentIcon iconName={selectedPreset.icon} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-zinc-400">Nicho selecionado</p>
              <p className="text-sm font-semibold text-white truncate">{selectedPreset.name}</p>
            </div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 bg-[#141414] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Criar conta do estabelecimento</h2>
              <p className="text-xs text-zinc-400 mt-1">Sem cartão de crédito necessário durante o período de teste.</p>
            </div>
            <Link
              to="/admin/login"
              className="text-xs font-semibold text-[#D4AF37] hover:underline whitespace-nowrap shrink-0"
            >
              Já tenho conta → Entrar
            </Link>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-3.5 rounded-xl text-sm flex items-start gap-2.5 mb-6">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Nome do Estabelecimento *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ex: Studio Vitta"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Nicho / Segmento *
                </label>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-[#D4AF37] outline-none transition-colors"
                >
                  {Object.values(SEGMENTS).map((seg) => (
                    <option key={seg.id} value={seg.id} className="bg-[#141414] text-white">
                      {seg.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Link Personalizado (Slug) *
              </label>
              <div className="flex items-center bg-black/50 border border-white/10 rounded-xl overflow-hidden focus-within:border-[#D4AF37] transition-colors">
                <span className="px-3.5 py-2.5 text-xs font-mono text-zinc-500 border-r border-white/10 bg-white/[0.02] shrink-0">
                  doiseme.com/b/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setSlug(toSlug(e.target.value));
                  }}
                  placeholder="studio-vitta"
                  className="w-full bg-transparent px-3 py-2.5 text-sm font-mono text-white placeholder:text-zinc-600 outline-none"
                />
                <div className="pr-3 shrink-0">
                  {slugStatus.checking ? (
                    <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                  ) : slugStatus.available === true ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : slugStatus.available === false ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : null}
                </div>
              </div>
              {slugStatus.available === true && (
                <p className="text-xs text-emerald-400 mt-1.5">Link disponível para uso imediato.</p>
              )}
              {slugStatus.available === false && slugStatus.reason && (
                <p className="text-xs text-red-400 mt-1.5">{slugStatus.reason}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Seu Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ex: Mariana Costa"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  WhatsApp Comercial
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                E-mail de Acesso *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Senha (mín. 6 caracteres) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    aria-label="Mostrar ou ocultar senha"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Confirmar Senha *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    aria-label="Mostrar ou ocultar confirmação de senha"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Starter options */}
            <div className="pt-2 space-y-2.5 border-t border-white/10">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={seedStarterServices}
                  onClick={() => setSeedStarterServices(!seedStarterServices)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    seedStarterServices
                      ? 'bg-[#D4AF37] border-[#D4AF37] text-black'
                      : 'border-white/20 bg-black/40 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-zinc-300">
                  Criar {selectedPreset.terms.servicePlural.toLowerCase()} iniciais sugeridos para {selectedPreset.name}
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={createOwnerAsProfessional}
                  onClick={() => setCreateOwnerAsProfessional(!createOwnerAsProfessional)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    createOwnerAsProfessional
                      ? 'bg-[#D4AF37] border-[#D4AF37] text-black'
                      : 'border-white/20 bg-black/40 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-zinc-300">
                  Me cadastrar como primeiro {selectedPreset.terms.professional.toLowerCase()} ativo na agenda
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || slugStatus.checking || slugStatus.available === false}
              className="w-full bg-[#D4AF37] text-black font-bold py-3 px-6 rounded-xl mt-2 hover:bg-[#e3be46] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando seu painel...
                </>
              ) : (
                <>
                  Criar Minha Conta Grátis
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
