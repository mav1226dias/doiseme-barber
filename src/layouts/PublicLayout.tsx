import { Outlet } from 'react-router-dom';
import { Scissors } from 'lucide-react';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-[#D4AF37]" />
            <span className="font-bold text-xl tracking-wider uppercase">Doiseme</span>
          </div>
          <a href="/admin/login" className="text-xs text-white/50 hover:text-white uppercase tracking-widest transition-colors">Admin</a>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-white/10 py-8 text-center text-white/40 text-sm mt-20">
        <p>&copy; 2024 Doiseme Barber Shop. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
