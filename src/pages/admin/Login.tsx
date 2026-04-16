import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      
      if (res.ok) {
        try {
          localStorage.setItem('token', data.token);
          console.log('Token saved, navigating to /admin');
          navigate('/admin');
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
        setError('O servidor demorou muito para responder. Verifique sua agulha e tente novamente.');
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
          <h1 className="text-2xl font-bold text-white font-serif tracking-wide">DOISEME</h1>
          <p className="text-white/50 text-sm uppercase tracking-widest mt-1">Painel Administrativo</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl text-sm text-center mb-6">
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
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#D4AF37] outline-none transition-colors"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
