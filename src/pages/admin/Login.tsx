import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scissors, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    console.log('Attempting login with:', email);
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
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
      <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <Scissors className="w-10 h-10 text-[#D4AF37] mb-4" />
          <h1 className="text-2xl font-bold text-white font-serif tracking-wide flex items-center">
            DOISEME<span className="text-[#D4AF37] font-sans font-extrabold text-sm px-1.5 py-0.5 rounded bg-[#D4AF37]/15 ml-1">PRO</span>
          </h1>
          <p className="text-white/50 text-sm uppercase tracking-widest mt-1">Painel Administrativo</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm text-center mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] outline-none transition-colors"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-white/50 uppercase tracking-wider">Senha</label>
              <Link
                to="/admin/recuperar-senha"
                className="text-xs text-[#D4AF37] hover:underline whitespace-nowrap"
              >
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
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
