// watch triggered
import { Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  Scissors, 
  Calendar, 
  LogOut, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Settings, 
  Wallet, 
  Globe, 
  Megaphone, 
  Shield,
  CreditCard,
  Crown,
  ArrowRight,
  Check
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import RealTimeNotifications from '../components/RealTimeNotifications';
import { getSegment } from '../lib/segments';
import { SegmentIcon } from '../components/SegmentIcon';
import { clearSessionStorage, getSessionAuth, getHomePathForRole } from '../lib/auth';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSession = getSessionAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  // Avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [isMaster, setIsMaster] = useState(initialSession.role === 'master');
  const [userRole, setUserRole] = useState<'admin' | 'master' | 'barber'>(initialSession.role || 'admin');
  const [isImpersonating, setIsImpersonating] = useState(initialSession.isImpersonating);
  const [shopSegment, setShopSegment] = useState('barbershop');
  const [shopName, setShopName] = useState('');
  const [shopExpiresAt, setShopExpiresAt] = useState<string | null>(null);
  const [shopPlanId, setShopPlanId] = useState<string | null>(null);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number>(7);

  useEffect(() => {
    setMounted(true);
    const session = getSessionAuth();
    if (!session.isAuthenticated || !session.token) {
      navigate('/admin/login', { replace: true });
      return;
    }

    const resolvedRole = session.role || 'admin';
    setUserRole(resolvedRole);
    setIsMaster(resolvedRole === 'master');
    setIsImpersonating(session.isImpersonating);

    const barberAllowedPaths = ['/admin/agenda', '/admin/clients', '/admin/comissoes'];
    if (resolvedRole === 'barber' && !barberAllowedPaths.includes(window.location.pathname)) {
      navigate('/admin/agenda', { replace: true });
    } else if (resolvedRole !== 'master' && window.location.pathname.startsWith('/admin/master')) {
      navigate(getHomePathForRole(resolvedRole), { replace: true });
    }

    // Load shop info to get the segment and validate token with backend
    fetch('/api/admin/shop-info', {
      headers: { 'Authorization': `Bearer ${session.token}` }
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          clearSessionStorage();
          navigate('/admin/login', { replace: true });
          return null;
        }
        if (res.status === 403 && !data?.subscriptionExpired) {
          clearSessionStorage();
          navigate('/admin/login', { replace: true });
          return null;
        }
        return data;
      })
      .then((data) => {
        if (!data) return;
        if (data?.segment) setShopSegment(data.segment);
        if (data?.name) setShopName(data.name);
        if (data?.plan_id) setShopPlanId(String(data.plan_id));
        if (data?.expires_at) {
          setShopExpiresAt(data.expires_at);
          const isMasterUser = resolvedRole === 'master';
          const msLeft = new Date(data.expires_at).getTime() - Date.now();
          const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
          if (
            !isMasterUser &&
            resolvedRole !== 'barber' &&
            new Date(data.expires_at) < new Date() &&
            window.location.pathname !== '/admin/assinatura'
          ) {
            navigate('/admin/assinatura', { replace: true });
          } else if (
            !isMasterUser &&
            resolvedRole === 'admin' &&
            String(data.plan_id || 'trial') === 'trial' &&
            msLeft >= 0 &&
            window.location.pathname !== '/admin/assinatura'
          ) {
            setTrialDaysRemaining(daysLeft);
            setShowTrialModal(true);
          }
        }
      })
      .catch(err => console.error('[ADMIN_LAYOUT_SHOP_INFO_ERR]', err));
  }, [navigate]);

  useEffect(() => {
    // Close the mobile menu automatically when clicking a navigation link
    setIsMobileMenuOpen(false);
    const session = getSessionAuth();
    if (!session.isAuthenticated) {
      navigate('/admin/login', { replace: true });
      return;
    }

    const currentRole = session.role || userRole;
    if (location.pathname.startsWith('/admin/master') && currentRole !== 'master') {
      navigate(getHomePathForRole(currentRole), { replace: true });
      return;
    }

    const barberAllowedPaths = ['/admin/agenda', '/admin/clients', '/admin/comissoes'];
    if (currentRole === 'barber' && !barberAllowedPaths.includes(location.pathname)) {
      navigate('/admin/agenda', { replace: true });
      return;
    }
    if (
      currentRole !== 'master' &&
      currentRole !== 'barber' &&
      shopExpiresAt &&
      new Date(shopExpiresAt) < new Date() &&
      location.pathname !== '/admin/assinatura'
    ) {
      navigate('/admin/assinatura', { replace: true });
    }
  }, [location.pathname, isMaster, userRole, shopExpiresAt, navigate]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
    } catch {
      // ignore network error on logout
    }
    clearSessionStorage();
    navigate('/admin/login');
  };

  const handleStopImpersonation = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
    } catch {
      // ignore
    }
    clearSessionStorage();
    navigate('/admin/login');
  };

  const currentPreset = getSegment(shopSegment);

  const navSections = userRole === 'barber'
    ? [
        {
          title: 'Área do Profissional',
          items: [
            { path: '/admin/agenda', icon: Calendar, label: 'Minha Agenda' },
            { path: '/admin/clients', icon: Users, label: `Meus ${currentPreset.terms.clientPlural}` },
            { path: '/admin/comissoes', icon: Wallet, label: 'Minhas Comissões' }
          ]
        }
      ]
    : [
        {
          title: 'Principal',
          items: [
            { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
            { path: '/admin/agenda', icon: Calendar, label: 'Agenda' },
            { path: '/admin/clients', icon: Users, label: currentPreset.terms.clientPlural },
          ]
        },
        {
          title: 'Atendimento & Catálogo',
          items: [
            { path: '/admin/barbers', icon: UserCheck, label: currentPreset.terms.professionalPlural },
            { path: '/admin/services', icon: Scissors, label: currentPreset.terms.servicePlural },
          ]
        },
        {
          title: 'Gestão & Presença',
          items: [
            { path: '/admin/finances', icon: Wallet, label: 'Financeiro' },
            { path: '/admin/campaigns', icon: Megaphone, label: 'Marketing & Mensagens' },
            { path: '/admin/profile', icon: Globe, label: 'Meu Site & Perfil' },
            { path: '/admin/assinatura', icon: CreditCard, label: 'Assinatura & Planos' },
            { path: '/admin/settings', icon: Settings, label: 'Configurações' },
          ]
        }
      ];

  if (isMaster && userRole !== 'barber') {
    navSections.push({
      title: 'Administração',
      items: [
        { path: '/admin/master', icon: Shield, label: 'Painel Master' }
      ]
    });
  }

  // Synchronous render-level guard to guarantee unauthorized views never render
  const liveSession = getSessionAuth();
  if (!liveSession.isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  if (location.pathname.startsWith('/admin/master') && liveSession.role !== 'master') {
    return <Navigate to={getHomePathForRole(liveSession.role)} replace />;
  }
  if (liveSession.role === 'barber' && !['/admin/agenda', '/admin/clients', '/admin/comissoes'].includes(location.pathname)) {
    return <Navigate to="/admin/agenda" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-zinc-950 text-gray-900 dark:text-gray-100 flex flex-col md:flex-row transition-colors">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-white dark:bg-zinc-900 h-16 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-4 sticky top-0 z-40 w-full shadow-sm">
        <div className="flex items-center gap-2">
          <SegmentIcon iconName={currentPreset.icon} className="w-6 h-6 text-black dark:text-[#D4AF37]" />
          <div>
            <div className="flex items-center">
              <span className="font-bold text-base tracking-wider uppercase font-serif">Doiseme</span>
              <span className="text-[#D4AF37] font-sans font-extrabold text-[11px] px-1.5 py-0.2 rounded bg-[#D4AF37]/15 ml-1">PRO</span>
            </div>
            <span className="text-[10px] block text-gray-500 dark:text-gray-400 font-sans tracking-normal leading-none font-medium truncate max-w-[140px]">{currentPreset.name.split(' ')[0]}</span>
          </div>
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
          <div className="flex items-center gap-2">
            <SegmentIcon iconName={currentPreset.icon} className="w-6 h-6 text-[#D4AF37]" />
            <div>
              <div className="flex items-center">
                <span className="font-bold text-lg tracking-wider uppercase font-serif">Doiseme</span>
                <span className="text-[#D4AF37] font-sans font-extrabold text-xs px-1.5 py-0.5 rounded bg-[#D4AF37]/15 ml-1">PRO</span>
              </div>
              <span className="text-[10px] block text-gray-400 font-sans leading-none truncate max-w-[120px]">{currentPreset.name}</span>
            </div>
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
        
        <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs ${
                        isActive 
                          ? 'bg-black text-white dark:bg-[#D4AF37] dark:text-black shadow-sm font-bold' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800/80 hover:text-gray-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#D4AF37] dark:text-black' : 'text-gray-500 dark:text-gray-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 px-4 py-3 w-full text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl transition-colors text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full bg-[#f5f5f5] dark:bg-zinc-950">
        {isImpersonating && (
          <div className="bg-red-600 text-white p-2 text-center text-xs font-bold flex items-center justify-center gap-4 sticky top-0 md:relative z-50">
            <span>VOCÊ ESTÁ ACESSANDO COMO ADMINISTRADOR MASTER (MODO VISUALIZAÇÃO)</span>
            <button 
              onClick={handleStopImpersonation}
              className="bg-white text-red-600 px-3 py-1 rounded-md hover:bg-gray-100 transition-colors uppercase"
            >
              Parar Acesso Rapído
            </button>
          </div>
        )}
        {!isMaster && shopExpiresAt && (() => {
          const daysLeft = Math.ceil((new Date(shopExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft < 0) {
            return (
              <div className="bg-red-600 text-white px-4 py-2.5 text-center text-xs font-bold flex flex-wrap items-center justify-center gap-3 tabular-nums">
                <span>
                  {userRole === 'barber'
                    ? `Assinatura do estabelecimento expirada em ${new Date(shopExpiresAt).toLocaleDateString('pt-BR')}. Solicite ao administrador para regularizar.`
                    : `Assinatura expirada em ${new Date(shopExpiresAt).toLocaleDateString('pt-BR')}. Renove para liberar o painel.`}
                </span>
                {userRole !== 'barber' && (
                  <Link
                    to="/admin/assinatura"
                    className="bg-white text-red-600 px-3 py-1 rounded-md hover:bg-gray-100 transition-colors uppercase"
                  >
                    Renovar Agora
                  </Link>
                )}
              </div>
            );
          }
          if (daysLeft >= 0 && daysLeft <= 15 && userRole !== 'barber') {
            return (
              <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 px-4 py-2 text-center text-xs text-amber-800 dark:text-amber-300 font-medium tabular-nums flex flex-wrap items-center justify-center gap-2">
                <span>
                  Período de avaliação ativo: {daysLeft === 0 ? 'expira hoje' : `${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'}`} ({new Date(shopExpiresAt).toLocaleDateString('pt-BR')}).
                </span>
                <Link to="/admin/assinatura" className="font-bold underline hover:opacity-80">
                  Ver planos e assinar
                </Link>
              </div>
            );
          }
          return null;
        })()}
        <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
        <RealTimeNotifications />

        {/* Pop-up obrigatório para contas em Plano Gratuito (Trial) */}
        {showTrialModal && shopPlanId === 'trial' && userRole === 'admin' && !isMaster && location.pathname !== '/admin/assinatura' && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#D4AF37]/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative">
              <button
                type="button"
                onClick={() => setShowTrialModal(false)}
                className="absolute right-4 top-4 p-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-white rounded-lg"
                aria-label="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-2 pr-6">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B69121] dark:text-[#D4AF37]">
                  <Crown className="w-4 h-4" />
                  <span>Conta em Teste Gratuito</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-snug">
                  {shopName ? `Olá, ${shopName}! ` : ''}Garanta seu plano pago sem perder seus agendamentos
                </h2>
                <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
                  Você está utilizando a avaliação gratuita com recursos completos. Escolha seu plano pago para ativar pacotes recorrentes, reativação de clientes sumidos e manter sua agenda ativa sem risco de bloqueio.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-2 text-xs text-gray-700 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span><strong>Plano Completo:</strong> profissionais ilimitados + reativação + pacotes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>Liberação imediata via PIX ou Cartão (Mercado Pago)</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowTrialModal(false);
                    navigate('/admin/assinatura');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold text-sm py-3.5 px-4 rounded-xl hover:bg-[#e3be46] transition-colors text-center"
                >
                  <span>Ir para os Planos Pagos</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTrialModal(false)}
                  className="w-full py-3 px-4 rounded-xl border border-gray-300 dark:border-white/15 bg-transparent text-xs sm:text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-center tabular-nums"
                >
                  Continuar com plano grátis ({trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'})
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
