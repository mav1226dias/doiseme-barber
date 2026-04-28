import { Outlet } from 'react-router-dom';
import { Scissors } from 'lucide-react';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <main className="pt-10">
        <Outlet />
      </main>
      <footer className="border-t border-white/10 py-12 text-center text-white/40 text-xs mt-20">
        <p>&copy; {new Date().getFullYear()} - Sistema de Agendamento Profissional</p>
      </footer>
    </div>
  );
}
