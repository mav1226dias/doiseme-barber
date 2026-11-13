import { useState, useEffect, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Scissors, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [emailMasked, setEmailMasked] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setTokenValid(false);
      setTokenError('Token de redefinição ausente no link.');
      return;
    }

    let cancelled = false;
    fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!cancelled) {
          if (res.ok && data.valid) {
            setTokenValid(true);
            setEmailMasked(data.emailMasked || '');
          } else {
            setTokenValid(false);
            setTokenError(data.error || 'Link inválido ou expirado.');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTokenValid(false);
          setTokenError('Erro ao validar o link com o servidor.');
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (newPassword.length < 6) {
      setSubmitError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSubmitError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Não foi possível redefinir a senha.');
        return;
      }
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
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
          <p className="text-zinc-400 text-xs uppercase tracking-widest mt-1.5">Nova Senha</p>
        </div>

        {checking ? (
          <div className="py-10 flex flex-col items-center gap-3 text-zinc-400 text-sm">
            <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
            <span>Validando link de redefinição...</span>
          </div>
        ) : success ? (
          <div className="space-y-5 text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 space-y-2.5">
              <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
              <h2 className="text-lg font-bold text-white">Senha redefinida</h2>
              <p className="text-sm text-zinc-300">
                Sua nova senha já está ativa. Faça login para acessar seu painel administrativo.
              </p>
            </div>
            <Link
              to="/admin/login"
              className="w-full inline-flex items-center justify-center bg-[#D4AF37] text-black font-bold py-3 px-6 rounded-xl hover:bg-[#e3be46] transition-colors whitespace-nowrap"
            >
              Ir para o Login
            </Link>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-5 text-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 space-y-2.5">
              <AlertCircle className="w-9 h-9 text-red-400 mx-auto" />
              <h2 className="text-base font-bold text-white">Link inválido ou expirado</h2>
              <p className="text-sm text-zinc-300">{tokenError}</p>
            </div>
            <Link
              to="/admin/recuperar-senha"
              className="w-full inline-flex items-center justify-center bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap"
            >
              Solicitar Novo Link
            </Link>
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {emailMasked && (
              <p className="text-xs text-zinc-400 text-center">
                Redefinindo senha da conta <span className="text-white font-mono">{emailMasked}</span>
              </p>
            )}

            {submitError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-3.5 rounded-xl text-sm text-center">
                {submitError}
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Nova Senha</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-3.5 pr-10 py-3 text-sm text-white focus:border-[#D4AF37] outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  aria-label="Mostrar ou ocultar nova senha"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Confirmar Nova Senha</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-3.5 pr-10 py-3 text-sm text-white focus:border-[#D4AF37] outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  aria-label="Mostrar ou ocultar confirmação"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#D4AF37] text-black font-bold py-3 px-6 rounded-xl hover:bg-[#e3be46] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
