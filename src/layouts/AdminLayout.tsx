// watch triggered
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Scissors, Calendar, Bell, LogOut, Menu, X, Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  // Avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  useEffect(() => {
    // Close the mobile menu automatically when clicking a navigation link
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/admin/login');
  };

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/agenda', icon: Calendar, label: 'Agenda' },
    { path: '/admin/barbers', icon: Users, label: 'Profissionais' },
    { path: '/admin/services', icon: Scissors, label: 'Serviços' },
    { path: '/admin/clients', icon: Users, label: 'Clientes' },
    { path: '/admin/campaigns', icon: Bell, label: 'Campanhas' },
    { path: '/admin/notifications', icon: Bell, label: 'Notificações' },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-zinc-950 text-gray-900 dark:text-gray-100 flex flex-col md:flex-row transition-colors">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white dark:bg-zinc-900 h-16 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-4 sticky top-0 z-40 w-full shadow-sm">
        <div className="flex items-center">
          <Scissors className="w-6 h-6 text-black dark:text-[#D4AF37] mr-2" />
          <span className="font-bold text-xl tracking-wider uppercase font-serif">Doiseme</span>
        </div>
        <div className="flex items-center gap-2">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col
        transform transition-transform duration-300 ease-in-out h-full
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="h-16 hidden md:flex items-center justify-between px-6 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center">
            <Scissors className="w-6 h-6 text-[#D4AF37] mr-2" />
            <span className="font-bold text-xl tracking-wider uppercase font-serif">Doiseme</span>
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors ${
                  isActive 
                    ? 'bg-black text-white dark:bg-[#D4AF37] dark:text-black shadow-md' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#D4AF37] dark:text-black' : ''}`} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 px-4 py-3.5 w-full text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full bg-[#f5f5f5] dark:bg-zinc-950">
        <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
