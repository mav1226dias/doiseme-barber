import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Server, Database, Activity, Lock, Plus, Globe, Mail, Key, Trash2,
  ShieldCheck, ShieldAlert, Calendar, ExternalLink, Unlock, CheckCircle2, XCircle, Sparkles,
  Cloud, Copy, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, MessageCircle, Save, CreditCard, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { SEGMENTS, getSegment } from '../../lib/segments';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { SegmentIcon } from '../../components/SegmentIcon';

export default function MasterAdmin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalShops: 0,
    totalUsers: 0,
    systemStatus: 'Online',
    dbSize: '...'
  });

  const [shops, setShops] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [cloudStatus, setCloudStatus] = useState<{
    readyCount: number;
    totalCount: number;
    tables: { table: string; ready: boolean; localRows: number; error?: string }[];
    security?: {
      hasJwtSecret: boolean;
      hasServiceRoleKey: boolean;
      nodeEnv: string;
    };
  } | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [migratingCloud, setMigratingCloud] = useState(false);
  const [copyingSql, setCopyingSql] = useState(false);
  const [showCloudDetails, setShowCloudDetails] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  const [mpConfigured, setMpConfigured] = useState(false);
  const [mpTokenMasked, setMpTokenMasked] = useState('');
  const [mpAccessTokenInput, setMpAccessTokenInput] = useState('');
  const [pixKeyInput, setPixKeyInput] = useState('');
  const [pixReceiverNameInput, setPixReceiverNameInput] = useState('DOISEME PRO');
  const [pixReceiverCityInput, setPixReceiverCityInput] = useState('SAO PAULO');
  const [mpLinksInput, setMpLinksInput] = useState({ solo: '', pro: '' });
  const [showAdvancedMpApi, setShowAdvancedMpApi] = useState(false);
  const [savingBillingConfig, setSavingBillingConfig] = useState(false);
  const [saasPayments, setSaasPayments] = useState<any[]>([]);
  const [approvingPaymentId, setApprovingPaymentId] = useState<string | null>(null);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<any | null>(null);
  const [deletingShopId, setDeletingShopId] = useState<string | null>(null);
  
  const [newShop, setNewShop] = useState({
    name: '',
    slug: '',
    email: '',
    password: '',
    segment: 'barbershop'
  });

  const fetchCloudStatus = async () => {
    const token = localStorage.getItem('token');
    setLoadingCloud(true);
    try {
      const res = await fetch('/api/admin/master/cloud-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCloudStatus(data);
      }
    } catch (e) {
      console.error('Failed to load cloud status:', e);
    } finally {
      setLoadingCloud(false);
    }
  };

  const handleCopyMigrationSql = async () => {
    const token = localStorage.getItem('token');
    setCopyingSql(true);
    try {
      const res = await fetch('/api/admin/master/migration-sql', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.sql) {
        toast.error(data.error || 'Não foi possível carregar o script SQL');
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(data.sql);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = data.sql;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      toast.success('SQL de migração copiado! Cole no SQL Editor do Supabase e execute.');
    } catch (e) {
      toast.error('Erro ao copiar script SQL');
    } finally {
      setCopyingSql(false);
    }
  };

  const handleMigrateToCloud = async () => {
    const token = localStorage.getItem('token');
    setMigratingCloud(true);
    try {
      const res = await fetch('/api/admin/master/migrate-niche-to-cloud', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao sincronizar dados locais para a nuvem');
        return;
      }

      const missingCount = (data.results || []).filter((r: any) => r.status === 'missing_table').length;
      if (missingCount > 0) {
        toast.warning(
          `${data.migratedTotal || 0} registro(s) sincronizado(s). ${missingCount} tabela(s) ainda não existem no Supabase — execute o SQL primeiro.`
        );
      } else if (data.migratedTotal > 0) {
        toast.success(`${data.migratedTotal} registro(s) migrado(s) para o Supabase com sucesso!`);
      } else {
        toast.success('Todas as tabelas estão conectadas à nuvem! Nenhum registro local pendente.');
      }

      await fetchCloudStatus();
    } catch (e) {
      toast.error('Erro de conexão ao migrar dados para a nuvem');
    } finally {
      setMigratingCloud(false);
    }
  };

  const fetchMasterData = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/master/shops', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setShops(data || []);
        setStats(prev => ({ ...prev, totalShops: (data || []).length }));
      } else {
        const text = await res.text();
        console.error('Fetch Master Data failed:', res.status, text.substring(0, 100));
        if (!res.ok && (res.status === 401 || res.status === 403)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/admin/login');
        } else if (!res.ok) {
          console.warn('Response was not OK and/or not JSON');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSupportWhatsapp = async () => {
    try {
      const res = await fetch('/api/public/support-contact');
      if (res.ok) {
        const data = await res.json();
        setSupportWhatsapp(data.whatsapp || data.raw || '');
      }
    } catch (e) {
      console.error('Failed to load support whatsapp:', e);
    }
  };

  const handleSaveSupportWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setSavingWhatsapp(true);
    try {
      const res = await fetch('/api/admin/master/support-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ whatsapp: supportWhatsapp })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar WhatsApp do suporte');
        return;
      }
      setSupportWhatsapp(data.whatsapp);
      toast.success('WhatsApp do suporte salvo! Já está ativo na tela de recuperação e configurações.');
    } catch {
      toast.error('Erro de conexão ao salvar WhatsApp');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const fetchBillingConfigAndPayments = async () => {
    const token = localStorage.getItem('token');
    try {
      const [cfgRes, payRes] = await Promise.all([
        fetch('/api/admin/master/billing-config', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/master/payments', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setMpConfigured(Boolean(cfg.mpConfigured));
        setMpTokenMasked(cfg.mpTokenMasked || '');
        setPixKeyInput(cfg.pixKey || '');
        setPixReceiverNameInput(cfg.pixReceiverName || 'DOISEME PRO');
        setPixReceiverCityInput(cfg.pixReceiverCity || 'SAO PAULO');
        setMpLinksInput({
          solo: cfg.mpLinks?.solo || cfg.mpLinks?.essencial || '',
          pro: cfg.mpLinks?.pro || cfg.mpLinks?.profissional || ''
        });
      }
      if (payRes.ok) {
        const pData = await payRes.json();
        setSaasPayments(pData.payments || []);
      }
    } catch (e) {
      console.error('Failed to load billing config/payments:', e);
    }
  };

  const handleSaveBillingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setSavingBillingConfig(true);
    try {
      const res = await fetch('/api/admin/master/billing-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mpAccessToken: mpAccessTokenInput.trim() || undefined,
          pixKey: pixKeyInput.trim(),
          pixReceiverName: pixReceiverNameInput.trim(),
          pixReceiverCity: pixReceiverCityInput.trim(),
          mpLinks: mpLinksInput
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar configuração de pagamentos');
        return;
      }
      setMpConfigured(Boolean(data.mpConfigured));
      setMpTokenMasked(data.mpTokenMasked || '');
      setMpAccessTokenInput('');
      setPixKeyInput(data.pixKey || '');
      setPixReceiverNameInput(data.pixReceiverName || 'DOISEME PRO');
      setPixReceiverCityInput(data.pixReceiverCity || 'SAO PAULO');
      setMpLinksInput({
        solo: data.mpLinks?.solo || data.mpLinks?.essencial || '',
        pro: data.mpLinks?.pro || data.mpLinks?.profissional || ''
      });
      toast.success('Configuração de pagamentos atualizada com sucesso!');
    } catch {
      toast.error('Erro de conexão ao salvar configuração de pagamentos');
    } finally {
      setSavingBillingConfig(false);
    }
  };

  const handleApproveSaasPayment = async (paymentId: string) => {
    const token = localStorage.getItem('token');
    setApprovingPaymentId(paymentId);
    try {
      const res = await fetch(`/api/admin/master/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao aprovar pagamento');
        return;
      }
      toast.success('Pagamento aprovado e validade da loja renovada!');
      await Promise.all([fetchBillingConfigAndPayments(), fetchMasterData()]);
    } catch {
      toast.error('Erro ao aprovar pagamento');
    } finally {
      setApprovingPaymentId(null);
    }
  };

  useEffect(() => {
    fetchMasterData();
    fetchCloudStatus();
    fetchSupportWhatsapp();
    fetchBillingConfigAndPayments();
    // System status remains static or could be fetched
    setStats(prev => ({ ...prev, systemStatus: 'Online', dbSize: '4.8 MB' }));
  }, []);

  const handleToggleBlock = async (shopId: string, currentStatus: boolean) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/master/shops/${shopId}/toggle-block`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_blocked: !currentStatus })
      });
      
      if (res.ok) {
        toast.success(!currentStatus ? 'Barbearia bloqueada' : 'Barbearia desbloqueada');
        fetchMasterData();
      }
    } catch (e) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleUpdateExpiration = async (shopId: string, date: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/master/shops/${shopId}/expiration`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ expires_at: date ? new Date(date).toISOString() : null })
      });
      
      if (res.ok) {
        toast.success('Validade atualizada');
        fetchMasterData();
      }
    } catch (e) {
      toast.error('Erro ao atualizar validade');
    }
  };

  const { setBusinessTypeForShop } = useBusinessConfig();

  const handleUpdateSegment = async (shopId: string, segment: string) => {
    const success = await setBusinessTypeForShop(shopId, segment);
    if (success) {
      fetchMasterData();
    }
  };

  const handleCopyResetLink = async (shopId: string, shopName: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/master/shops/${shopId}/reset-link`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.resetUrl) {
        toast.error(data.error || 'Não foi possível gerar o link de redefinição');
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(data.resetUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = data.resetUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      toast.success(`Link de redefinição de senha para ${shopName} (${data.adminEmail}) copiado!`);
    } catch {
      toast.error('Erro ao gerar link de redefinição');
    }
  };

  const handleEnterDashboard = async (shopId: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/master/impersonate/${shopId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('Impersonation failed:', res.status, text.substring(0, 100));
        data = { error: 'O servidor retornou uma resposta inválida. Verifique o console.' };
      }

      if (res.ok && data.token) {
        // Save impersonation token and redirect
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({
          ...JSON.parse(localStorage.getItem('user') || '{}'),
          barbershopId: shopId,
          isImpersonating: true
        }));
        
        toast.success(`Entrando em ${data.shop.name}...`);
        setTimeout(() => {
          window.location.href = '/admin'; // Hard reload to clear states
        }, 1000);
      } else {
        toast.error(data.error || 'Erro ao entrar no dashboard');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch('/api/admin/master/shops', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newShop)
      });
      
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('Create shop failed:', res.status, text.substring(0, 100));
        data = { error: 'Erro ao criar barbearia (Resposta não JSON)' };
      }
      
      if (res.ok) {
        toast.success('Estabelecimento cadastrado com sucesso!');
        setNewShop({ name: '', slug: '', email: '', password: '', segment: 'barbershop' });
        setShowForm(false);
        fetchMasterData();
      } else {
        toast.error(data.error || 'Erro ao criar estabelecimento');
      }
    } catch (e) {
      toast.error('Erro de conexão com o servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDeleteShop = async () => {
    if (!shopToDelete) return;
    const target = shopToDelete;
    const token = localStorage.getItem('token');
    setDeletingShopId(target.id);
    try {
      const res = await fetch(`/api/admin/master/shops/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (!res.ok) {
        toast.error(data?.error || 'Não foi possível excluir o estabelecimento');
        return;
      }

      setShops((prev) => prev.filter((s) => s.id !== target.id));
      setShopToDelete(null);
      toast.success(`Estabelecimento "${target.name}" excluído permanentemente!`);
      await Promise.all([fetchMasterData(), fetchBillingConfigAndPayments()]);
    } catch {
      toast.error('Erro de conexão ao excluir estabelecimento');
    } finally {
      setDeletingShopId(null);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Painel Master</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Controle global do ecossistema e nichos de mercado.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-black dark:bg-[#D4AF37] text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg"
        >
          <Plus className="w-5 h-5" /> Cadastrar Estabelecimento
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-dashed border-gray-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-bold mb-6">Novo Estabelecimento</h2>
          <form onSubmit={handleCreateShop} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do Estabelecimento</label>
                <div className="relative">
                  <Server className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="text"
                    required
                    value={newShop.name}
                    onChange={e => setNewShop({...newShop, name: e.target.value})}
                    placeholder="Ex: Studio Bella Lash / Clínica Vitta"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nicho / Segmento</label>
                <div className="relative">
                  <Sparkles className="absolute left-3 top-3 w-5 h-5 text-[#D4AF37]" />
                  <select
                    value={newShop.segment}
                    onChange={e => setNewShop({...newShop, segment: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37] text-gray-900 dark:text-gray-100"
                  >
                    {Object.values(SEGMENTS).map(seg => (
                      <option key={seg.id} value={seg.id}>
                        {seg.name} ({seg.terms.business})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">O sistema carregará automaticamente termos e layout deste nicho.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link (Slug)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="text"
                    required
                    value={newShop.slug}
                    onChange={e => setNewShop({...newShop, slug: e.target.value})}
                    placeholder="ex: clinica-vitta"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 italic">Link de agendamento: doiseme.com/b/{newShop.slug || 'slug'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email do Administrador</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="email"
                    required
                    value={newShop.email}
                    onChange={e => setNewShop({...newShop, email: e.target.value})}
                    placeholder="admin@empresa.com"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha Temporária</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="password"
                    required
                    value={newShop.password}
                    onChange={e => setNewShop({...newShop, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-4 mt-2">
              <button 
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 rounded-xl font-bold bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:opacity-80 transition-opacity"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isLoading}
                className="bg-black dark:bg-[#D4AF37] text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? 'Criando...' : 'Finalizar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <Server className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total de Lojas</span>
          </div>
          <div className="text-3xl font-bold">{stats.totalShops}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Usuários</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">---</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-500">Status Sistema</span>
          </div>
          <div className="text-3xl font-bold text-green-500">{stats.systemStatus}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-gray-500">Tamanho DB</span>
          </div>
          <div className="text-3xl font-bold">{stats.dbSize}</div>
        </div>
      </div>

      {/* Cloud Persistence & Security Panel */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              cloudStatus && cloudStatus.readyCount === cloudStatus.totalCount
                ? 'bg-green-500/10 text-green-600'
                : 'bg-amber-500/10 text-amber-600'
            }`}>
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Persistência na Nuvem &amp; Segurança (Supabase)
                </h2>
                {cloudStatus && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    cloudStatus.readyCount === cloudStatus.totalCount
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {cloudStatus.readyCount}/{cloudStatus.totalCount} tabelas na nuvem
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {cloudStatus && cloudStatus.readyCount === cloudStatus.totalCount
                  ? 'Todas as tabelas de nicho, fotos extras e comissões estão persistidas no PostgreSQL do Supabase.'
                  : 'Algumas tabelas ainda operam em fallback local (SQLite). Copie o SQL, execute no Supabase SQL Editor e sincronize.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchCloudStatus}
              disabled={loadingCloud}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCloud ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleCopyMigrationSql}
              disabled={copyingSql}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-900 dark:bg-zinc-800 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              {copyingSql ? 'Copiando...' : 'Copiar SQL de Migração'}
            </button>
            <button
              type="button"
              onClick={handleMigrateToCloud}
              disabled={migratingCloud}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {migratingCloud ? 'Sincronizando...' : 'Sincronizar Dados Locais → Nuvem'}
            </button>
          </div>
        </div>

        {cloudStatus?.security && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2.5">
                {cloudStatus.security.hasJwtSecret ? (
                  <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Variável JWT_SECRET</span>
              </div>
              <span className={`text-xs font-bold ${cloudStatus.security.hasJwtSecret ? 'text-green-600' : 'text-amber-600'}`}>
                {cloudStatus.security.hasJwtSecret ? 'Configurada' : 'Usando chave padrão (definir no env)'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2.5">
                {cloudStatus.security.hasServiceRoleKey ? (
                  <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SUPABASE_SERVICE_ROLE_KEY</span>
              </div>
              <span className={`text-xs font-bold ${cloudStatus.security.hasServiceRoleKey ? 'text-green-600' : 'text-amber-600'}`}>
                {cloudStatus.security.hasServiceRoleKey ? 'Ativa no servidor' : 'Fallback anon (obrigatória p/ RLS)'}
              </span>
            </div>
          </div>
        )}

        {cloudStatus && (
          <div>
            <button
              type="button"
              onClick={() => setShowCloudDetails(!showCloudDetails)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              {showCloudDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showCloudDetails
                ? `Ocultar detalhes das ${cloudStatus.totalCount} tabelas`
                : `Ver status individual das ${cloudStatus.totalCount} tabelas`}
            </button>

            {showCloudDetails && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {cloudStatus.tables.map((t) => (
                  <div
                    key={t.table}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {t.ready ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      <span className="text-xs font-mono truncate text-gray-800 dark:text-gray-200">{t.table}</span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-500 ml-2 flex-shrink-0">
                      {t.localRows} local
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Support WhatsApp Config Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm p-6">
        <form onSubmit={handleSaveSupportWhatsapp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                WhatsApp do Suporte (Recuperação &amp; Troca de Senha)
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Quando um usuário clicar em <strong>Esqueci minha senha</strong> ou precisar trocar a senha via suporte, ele será direcionado para este número. Depois, use o botão de chave na tabela abaixo para gerar o link de redefinição e enviar para ele.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 lg:min-w-[360px]">
            <input
              type="text"
              value={supportWhatsapp}
              onChange={(e) => setSupportWhatsapp(e.target.value)}
              placeholder="Ex: 5511999999999"
              className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              disabled={savingWhatsapp}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4" />
              {savingWhatsapp ? 'Salvando...' : 'Salvar WhatsApp'}
            </button>
          </div>
        </form>
      </div>

      {/* PIX QR Code + App Mercado Pago Payment Links + Optional API Config Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm p-6 space-y-6">
        <form onSubmit={handleSaveBillingConfig} className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                pixKeyInput || mpConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
              }`}>
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Pagamentos (PIX QR Code &amp; App Mercado Pago)
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Configure sem precisar de API: informe sua <strong>Chave PIX</strong> para o sistema gerar automaticamente <strong>QR Code e Copia e Cola com valor exato</strong>, e/ou cole os <strong>Links de Pagamento</strong> criados no app do Mercado Pago no celular.
                </p>
              </div>
            </div>
            <span className={`text-xs font-bold ${pixKeyInput || mpConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {pixKeyInput ? 'PIX QR Code ativo' : mpConfigured ? `API ativa: ${mpTokenMasked}` : 'Aguardando Chave PIX'}
            </span>
          </div>

          {/* 1. Chave PIX + Recebedor (sem API) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Sua Chave PIX (Mercado Pago ou qualquer banco)
              </label>
              <input
                type="text"
                value={pixKeyInput}
                onChange={(e) => setPixKeyInput(e.target.value)}
                placeholder="CPF, CNPJ, E-mail, Celular ou Aleatória"
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Nome do Recebedor (aparece no PIX)
              </label>
              <input
                type="text"
                value={pixReceiverNameInput}
                onChange={(e) => setPixReceiverNameInput(e.target.value)}
                placeholder="Ex: Marcus Dias"
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Cidade (sem acento)
              </label>
              <input
                type="text"
                value={pixReceiverCityInput}
                onChange={(e) => setPixReceiverCityInput(e.target.value)}
                placeholder="Ex: Sao Paulo"
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {/* 2. Links de Pagamento do App Mercado Pago (Opcional - para Cartão) */}
          <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Links de Pagamento do App Mercado Pago (Opcional — para aceitar Cartão / Boleto sem API)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                No aplicativo do Mercado Pago do celular, toque em <strong>Link de pagamento</strong>, crie 1 link para cada plano e cole abaixo:
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="url"
                value={mpLinksInput.solo}
                onChange={(e) => setMpLinksInput({ ...mpLinksInput, solo: e.target.value })}
                placeholder="Link Agenda Solo — R$ 59,90 (https://mpago.la/...)"
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-mono outline-none focus:border-[#D4AF37]"
              />
              <input
                type="url"
                value={mpLinksInput.pro}
                onChange={(e) => setMpLinksInput({ ...mpLinksInput, pro: e.target.value })}
                placeholder="Link Plano PRO — R$ 99,90 (https://mpago.la/...)"
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-mono outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {/* 3. Modo Avançado API (Colapsável) + Botão Salvar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvancedMpApi(!showAdvancedMpApi)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors self-start"
            >
              {showAdvancedMpApi ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Modo Avançado: Token de API Mercado Pago (opcional)
            </button>

            <button
              type="submit"
              disabled={savingBillingConfig}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Save className="w-4 h-4" />
              {savingBillingConfig ? 'Salvando...' : 'Salvar Pagamentos'}
            </button>
          </div>

          {showAdvancedMpApi && (
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Access Token de Produção (APP_USR-...) — apenas se quiser automação por API
              </label>
              <input
                type="password"
                value={mpAccessTokenInput}
                onChange={(e) => setMpAccessTokenInput(e.target.value)}
                placeholder={mpConfigured ? `Atual: ${mpTokenMasked} (digite para substituir)` : 'APP_USR-...'}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
              />
            </div>
          )}
        </form>

        {/* Recent SaaS Payments */}
        <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Cobranças &amp; Renovações ({saasPayments.length})
            </h3>
            {saasPayments.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllPayments(!showAllPayments)}
                className="text-xs font-bold text-[#D4AF37] hover:underline"
              >
                {showAllPayments ? 'Mostrar menos' : 'Ver todas'}
              </button>
            )}
          </div>

          {saasPayments.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-zinc-500">
              Nenhuma cobrança gerada pelas lojas ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 uppercase">
                    <th className="p-3">Data</th>
                    <th className="p-3">Loja</th>
                    <th className="p-3">Plano</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {(showAllPayments ? saasPayments : saasPayments.slice(0, 5)).map((p) => (
                    <tr key={p.id}>
                      <td className="p-3 tabular-nums text-gray-500 whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-white">
                        {p.shopName}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-zinc-300">
                        {p.plan_name} ({p.billing_cycle === 'annual' ? 'Anual' : 'Mensal'})
                      </td>
                      <td className="p-3 font-bold tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                        R$ {Number(p.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        {p.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
                          </span>
                        ) : p.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" /> Pendente
                          </span>
                        ) : (
                          <span className="font-bold text-red-500">{p.status}</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {p.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleApproveSaasPayment(p.id)}
                            disabled={approvingPaymentId === p.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            {approvingPaymentId === p.id ? 'Aprovando...' : 'Aprovar e Liberar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="font-bold text-lg">Lojas Ativas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/50 text-xs font-bold uppercase text-gray-500">
                <th className="p-4">Nome</th>
                <th className="p-4">Nicho / Segmento</th>
                <th className="p-4">Status & Plano</th>
                <th className="p-4">Link / Slug</th>
                <th className="p-4">Validade</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {shops.map(shop => {
                const isExpired = shop.expires_at && new Date(shop.expires_at) < new Date();
                const shopPreset = getSegment(shop.segment);

                return (
                  <tr key={shop.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900 dark:text-gray-100">{shop.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{shop.id}</div>
                    </td>
                    <td className="p-4">
                      <select
                        value={shop.segment || 'barbershop'}
                        onChange={(e) => handleUpdateSegment(shop.id, e.target.value)}
                        className="text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 font-medium text-gray-900 dark:text-gray-100 focus:border-[#D4AF37] outline-none"
                      >
                        {Object.values(SEGMENTS).map(seg => (
                          <option key={seg.id} value={seg.id}>
                            {seg.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1.5 mt-1">
                        <SegmentIcon iconName={shopPreset.icon} className="w-3.5 h-3.5" style={{ color: shopPreset.defaultColors.primary }} />
                        <span className="text-[10px] font-bold" style={{ color: shopPreset.defaultColors.primary }}>
                          {shopPreset.terms.business}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {shop.is_blocked ? (
                          <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full text-[10px] font-bold uppercase">
                            <Lock className="w-3 h-3" /> Bloqueado
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-[10px] font-bold uppercase">
                            <Activity className="w-3 h-3" /> Expirado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full text-[10px] font-bold uppercase">
                            <ShieldCheck className="w-3 h-3" /> Ativo
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">Criado: {new Date(shop.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-blue-500 dark:text-blue-400 font-mono text-sm">/b/{shop.slug}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 group">
                        <input 
                          type="date" 
                          value={shop.expires_at ? new Date(shop.expires_at).toISOString().split('T')[0] : ''}
                          onChange={(e) => handleUpdateExpiration(shop.id, e.target.value)}
                          className="bg-transparent border-none text-sm text-gray-600 dark:text-gray-300 focus:ring-0 cursor-pointer"
                        />
                        <Calendar className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-colors" />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEnterDashboard(shop.id)}
                          className="p-2 bg-black dark:bg-[#D4AF37] text-white rounded-lg hover:opacity-80 transition-opacity"
                          title="Entrar no Dashboard"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyResetLink(shop.id, shop.name)}
                          className="p-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                          title="Gerar e copiar link de redefinição de senha"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleToggleBlock(shop.id, !!shop.is_blocked)}
                          className={`p-2 rounded-lg transition-colors ${
                            shop.is_blocked 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                          title={shop.is_blocked ? "Desbloquear" : "Bloquear"}
                        >
                          {shop.is_blocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        <button 
                          type="button"
                          disabled={shop.id === 'shop-1' || deletingShopId === shop.id}
                          className={`p-2 rounded-lg transition-colors ${
                            shop.id === 'shop-1'
                              ? 'text-gray-300 dark:text-zinc-700 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                          }`}
                          title={shop.id === 'shop-1' ? 'Estabelecimento raiz protegido' : 'Excluir estabelecimento'}
                          onClick={() => {
                            if (shop.id === 'shop-1') return;
                            setShopToDelete(shop);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {shops.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                    Nenhuma loja cadastrada no sistema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-3xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-6">
        <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-400 mb-2">Segurança de Acesso</h3>
          <p className="text-amber-800/70 dark:text-amber-500/70">
            Esta tela é protegida por validação JWT no backend e verificação de permissão no frontend. 
            Somente o usuário raiz (Master) pode visualizar e interagir com estas configurações globais do sistema.
          </p>
        </div>
      </div>

      {/* Delete Establishment Confirmation Modal */}
      {shopToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800">
            <div className="p-6 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Excluir Estabelecimento?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Você está prestes a excluir <strong>{shopToDelete.name}</strong> (<span className="font-mono text-xs">/b/{shopToDelete.slug}</span>).
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                  Esta ação é irreversível e apagará usuários, profissionais, serviços, clientes, agendamentos, histórico financeiro e cobranças vinculadas a esta loja.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={Boolean(deletingShopId)}
                onClick={() => setShopToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(deletingShopId)}
                onClick={handleConfirmDeleteShop}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deletingShopId === shopToDelete.id ? 'Excluindo...' : 'Excluir Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
