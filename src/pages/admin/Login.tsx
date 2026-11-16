import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Scissors,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  LogIn,
  Check
} from 'lucide-react';
import { getSessionAuth, getHomePathForRole, clearSessionStorage } from '../../lib/auth';
import {
  getRememberedEmail,
  saveRememberedEmail,
  clearRememberedEmail,
  supportsPasswordCredentialApi,
  storeBrowserPasswordCredential,
  requestSavedBrowserCredential
} from '../../lib/browserCredentials';

function readStoredUserLabel(): string | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.name || parsed?.email || null;
  } catch {
    return null;
  }
}

export default function Login() {
  const [email, setEmail] = useState(() => getRememberedEmail('admin'));
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState(() => {
    const session = getSessionAuth();
    return session.isAuthenticated ? session : null;
  });
  const [storedUserName] = useState(() => readStoredUserLabel());
  const canUseCredentialPicker = supportsPasswordCredentialApi();
  const navigate = useNavigate();

  const handleUseSavedCredential = async () => {
    const cred = await requestSavedBrowserCredential();
    if (cred) {
      setEmail(cred.email);
      setPassword(cred.password);
    }
  };

  const handleSwitchAccount = () => {
    clearSessionStorage();
    setActiveSession(null);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      const cleanEmail = email.trim();
      const cleanPassword = password.trim();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          rememberMe
        }),
        signal: controller.signal
      });
      clearTimeout(id);
      
      const contentType = res.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('Non-JSON response:', text.substring(0, 500));
        data = { error: 'O servidor retornou uma resposta inválida (HTML). Verifique se a API está funcionando.' };
      }
      
      if (res.ok) {
        if (rememberMe) {
          saveRememberedEmail('admin', cleanEmail);
          await storeBrowserPasswordCredential({
            email: cleanEmail,
            password: cleanPassword,
            name: data.user?.name
          });
        } else {
          clearRememberedEmail('admin');
        }

        try {
          localStorage.setItem('token', data.token);
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          if (data.user?.role === 'barber') {
            navigate('/admin/agenda');
          } else {
            navigate(data.subscriptionExpired ? '/admin/assinatura' : '/admin');
          }
        } catch (storageErr) {
          console.error("Storage error (iframe blocked cookies?):", storageErr);
          setError("O seu navegador está bloqueando o salvamento da sessão (Cookies/Storage). Utilize o botão de 'Abrir em Nova Aba' (ícone superior direito do AI Studio) para acessar o painel!");
        }
      } else {
        setError(data.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      clearTimeout(id);
      console.error('Login error:', err);
      if (err.name === 'AbortError') {
        setError('O servidor demorou muito para responder. Verifique sua conexão e tente novamente.');
      } else {
        setError(err.message || 'Erro ao conectar ao servidor');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-medium text-zinc-300 hover:text-white hover:border-white/25 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para Home
          </Link>
          <Link
            to="/afiliado"
            className="text-xs text-zinc-400 hover:text-[#D4AF37] transition-colors whitespace-nowrap"
          >
            Portal de Afiliados
          </Link>
        </div>

        <Link to="/" className="flex flex-col items-center mb-7 group">
          <Scissors className="w-10 h-10 text-[#D4AF37] mb-3 group-hover:scale-105 transition-transform" />
          <h1 className="text-2xl font-bold text-white font-serif tracking-wide flex items-center">
            DOISEME<span className="text-[#D4AF37] font-sans font-extrabold text-sm px-1.5 py-0.5 rounded bg-[#D4AF37]/15 ml-1">PRO</span>
          </h1>
          <p className="text-white/50 text-sm uppercase tracking-widest mt-1">Painel Administrativo</p>
        </Link>

        {activeSession && (
          <div className="mb-6 p-4 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                  Sessão ativa encontrada
                </p>
                <p className="text-sm font-semibold text-white truncate mt-0.5">
                  {storedUserName || activeSession.email || 'Conta conectada'}
                </p>
                {storedUserName && activeSession.email && (
                  <p className="text-xs text-zinc-400 truncate">{activeSession.email}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="text-xs text-zinc-400 hover:text-white underline shrink-0"
              >
                Trocar conta
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate(getHomePathForRole(activeSession.role))}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-sm py-2.5 px-4 rounded-xl hover:bg-[#e3be46] transition-colors whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              Entrar direto no Painel
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center mb-6">
            {error}
          </div>
        )}

        <form method="post" autoComplete="on" onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs text-white/50 mb-2 uppercase tracking-wider">
              Email
            </label>
            <input 
              id="admin-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="admin-password" className="block text-xs text-white/50 uppercase tracking-wider">
                Senha
              </label>
              <Link
                to="/admin/recuperar-senha"
                className="text-xs text-[#D4AF37] hover:underline whitespace-nowrap"
              >
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <input 
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-3 pr-10 py-3 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
                required
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
            disabled={isLoading}
            className="w-full bg-white text-black font-bold py-3 rounded-xl mt-2 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10 text-center space-y-3">
          <p className="text-xs text-zinc-400">
            Ainda não tem um painel para o seu negócio?
          </p>
          <Link
            to="/admin/cadastro"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] font-semibold text-sm hover:bg-[#D4AF37]/20 transition-colors whitespace-nowrap"
          >
            Criar conta grátis (7 dias)
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
