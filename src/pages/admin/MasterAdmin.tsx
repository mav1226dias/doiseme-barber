import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, Users, Server, Database, Activity, Lock, Plus, Globe, Mail, Key, Trash2,
  ShieldCheck, ShieldAlert, Calendar, ExternalLink, Unlock, CheckCircle2, XCircle, Sparkles,
  Cloud, Copy, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, MessageCircle, Save, CreditCard, Clock, Bot,
  TrendingUp, DollarSign, Filter, Phone, SlidersHorizontal, Search, X, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { SEGMENTS, getSegment } from '../../lib/segments';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';
import { SegmentIcon } from '../../components/SegmentIcon';

const PLAN_OPTIONS = [
  { id: 'trial', label: 'Teste Grátis (7 dias)', price: 0 },
  { id: 'essencial', label: 'Agenda Individual (Básico) — R$ 59,90', price: 59.9 },
  { id: 'profissional', label: 'Plano Pro — R$ 99,90', price: 99.9 },
  { id: 'premium', label: 'Plano Completo — R$ 119,90', price: 119.9 }
] as const;

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatWhatsappDigits = (raw?: string | null) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
};

export default function MasterAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'admins' | 'settings'>('overview');
  const [stats, setStats] = useState({
    totalShops: 0,
    totalUsers: 0,
    systemStatus: 'Online',
    dbSize: '...'
  });

  const [shops, setShops] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Analytics filters & data
  const [datePreset, setDatePreset] = useState<'all' | '7d' | 'month' | '30d' | 'custom'>('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterSegment, setFilterSegment] = useState('all');
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Shops table search & status filter
  const [shopSearch, setShopSearch] = useState('');
  const [shopStatusFilter, setShopStatusFilter] = useState<'all' | 'active' | 'blocked' | 'expired'>('all');
  const [shopPlanFilter, setShopPlanFilter] = useState<string>('all');
  const [updatingShopId, setUpdatingShopId] = useState<string | null>(null);

  // Manage Plan & Access Modal
  const [planModalShop, setPlanModalShop] = useState<any | null>(null);
  const [planModalForm, setPlanModalForm] = useState({
    plan_id: 'trial',
    is_blocked: false,
    expires_at: '',
    extend_days: '',
    record_payment: false,
    billing_cycle: 'monthly' as 'monthly' | 'annual',
    payment_amount: ''
  });
  const [savingPlanModal, setSavingPlanModal] = useState(false);

  // Contact / WhatsApp Modal
  const [contactModalShop, setContactModalShop] = useState<any | null>(null);
  const [contactWhatsappInput, setContactWhatsappInput] = useState('');
  const [savingContact, setSavingContact] = useState(false);

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

  // Evolution API v2 (Parte 6 — oculta temporariamente até ativação da VPS)
  const showEvolutionSetup = false;
  const [evoConfigured, setEvoConfigured] = useState(false);
  const [evoApiUrlInput, setEvoApiUrlInput] = useState('');
  const [evoApiKeyInput, setEvoApiKeyInput] = useState('');
  const [evoKeyMasked, setEvoKeyMasked] = useState('');
  const [evoSource, setEvoSource] = useState<'database' | 'env' | 'none'>('none');
  const [cronSecretInput, setCronSecretInput] = useState('');
  const [cronSecretConfigured, setCronSecretConfigured] = useState(false);
  const [savingEvo, setSavingEvo] = useState(false);
  const [testingEvo, setTestingEvo] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  
  const [newShop, setNewShop] = useState({
    name: '',
    slug: '',
    email: '',
    password: '',
    segment: 'barbershop',
    plan_id: 'trial',
    whatsapp: ''
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

  const fetchEvolutionConfig = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/master/evolution-config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvoConfigured(Boolean(data.configured));
        setEvoApiUrlInput(data.apiUrl || '');
        setEvoKeyMasked(data.apiKeyMasked || '');
        setEvoSource(data.source || 'none');
        setCronSecretConfigured(Boolean(data.cronSecretConfigured));
      }
    } catch (e) {
      console.error('Failed to load evolution config:', e);
    }
  };

  const handleSaveEvolutionConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setSavingEvo(true);
    try {
      const res = await fetch('/api/admin/master/evolution-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiUrl: evoApiUrlInput.trim(),
          apiKey: evoApiKeyInput.trim() || undefined,
          cronSecret: cronSecretInput.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar configuração da Evolution API');
        return;
      }
      setEvoApiKeyInput('');
      setCronSecretInput('');
      await fetchEvolutionConfig();
      toast.success('Servidor Evolution API salvo com sucesso!');
    } catch {
      toast.error('Erro de conexão ao salvar Evolution API');
    } finally {
      setSavingEvo(false);
    }
  };

  const handleTestEvolutionServer = async () => {
    const token = localStorage.getItem('token');
    setTestingEvo(true);
    try {
      const res = await fetch('/api/admin/master/evolution-test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(`${data.message} (${data.instancesCount ?? 0} instância(s) ativa(s))`);
      } else {
        toast.error(data.message || 'Não foi possível conectar na Evolution API.');
      }
    } catch {
      toast.error('Erro de rede ao testar Evolution API.');
    } finally {
      setTestingEvo(false);
    }
  };

  const handleRunRemindersCronNow = async () => {
    const token = localStorage.getItem('token');
    setRunningCron(true);
    try {
      const res = await fetch('/api/cron/whatsapp-reminders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao executar lembretes');
        return;
      }
      if (data.skipped) {
        toast.warning('Rotina ignorada: configure primeiro a URL e API Key da Evolution API.');
      } else {
        toast.success(
          `Cron executado: ${data.processedShops} loja(s), ${data.sent24h} lembrete(s) 24h, ${data.sent2h} lembrete(s) 2h.`
        );
      }
    } catch {
      toast.error('Erro de rede ao executar rotina de lembretes');
    } finally {
      setRunningCron(false);
    }
  };

  const fetchAnalytics = useCallback(async (startVal = filterStart, endVal = filterEnd, segVal = filterSegment) => {
    const token = localStorage.getItem('token');
    setLoadingAnalytics(true);
    try {
      const params = new URLSearchParams();
      if (startVal) params.set('start', startVal);
      if (endVal) params.set('end', endVal);
      if (segVal && segVal !== 'all') params.set('segment', segVal);
      const res = await fetch(`/api/admin/master/analytics?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
        if (data?.summary?.totalUsers !== undefined) {
          setStats(prev => ({ ...prev, totalUsers: data.summary.totalUsers }));
        }
      }
    } catch (e) {
      console.error('Failed to load master analytics:', e);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [filterStart, filterEnd, filterSegment]);

  const applyDatePreset = (preset: 'all' | '7d' | 'month' | '30d') => {
    setDatePreset(preset);
    const now = new Date();
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    let nextStart = '';
    let nextEnd = '';
    if (preset === '7d') {
      const start = new Date(now.getTime() - 6 * 86400000);
      nextStart = toIso(start);
      nextEnd = toIso(now);
    } else if (preset === '30d') {
      const start = new Date(now.getTime() - 29 * 86400000);
      nextStart = toIso(start);
      nextEnd = toIso(now);
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      nextStart = toIso(start);
      nextEnd = toIso(end);
    }
    setFilterStart(nextStart);
    setFilterEnd(nextEnd);
    fetchAnalytics(nextStart, nextEnd, filterSegment);
  };

  useEffect(() => {
    fetchMasterData();
    fetchAnalytics('', '', 'all');
    fetchCloudStatus();
    fetchSupportWhatsapp();
    fetchBillingConfigAndPayments();
    if (showEvolutionSetup) {
      fetchEvolutionConfig();
    }
    setStats(prev => ({ ...prev, systemStatus: 'Online', dbSize: '4.8 MB' }));
  }, []);

  const handleToggleBlock = async (shopId: string, currentStatus: boolean) => {
    const token = localStorage.getItem('token');
    setUpdatingShopId(shopId);
    try {
      const nextBlocked = !currentStatus;
      const res = await fetch(`/api/admin/master/shops/${shopId}/toggle-block`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_blocked: nextBlocked })
      });
      
      if (res.ok) {
        toast.success(nextBlocked ? 'Permissão de uso revogada (loja bloqueada)' : 'Permissão de uso liberada');
        await Promise.all([fetchMasterData(), fetchAnalytics()]);
      } else {
        toast.error('Não foi possível alterar a permissão de uso');
      }
    } catch (e) {
      toast.error('Erro ao alterar status');
    } finally {
      setUpdatingShopId(null);
    }
  };

  const handleQuickPlanChange = async (shopId: string, nextPlanId: string) => {
    const token = localStorage.getItem('token');
    setUpdatingShopId(shopId);
    try {
      const res = await fetch(`/api/admin/master/shops/${shopId}/plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan_id: nextPlanId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao alterar plano');
        return;
      }
      toast.success(`Plano alterado para ${data.plan_name}!`);
      await Promise.all([fetchMasterData(), fetchAnalytics()]);
    } catch {
      toast.error('Erro de conexão ao alterar plano');
    } finally {
      setUpdatingShopId(null);
    }
  };

  const openPlanModal = (shop: any) => {
    setPlanModalShop(shop);
    const planMeta = PLAN_OPTIONS.find((p) => p.id === (shop.plan_id || 'trial')) || PLAN_OPTIONS[0];
    setPlanModalForm({
      plan_id: shop.plan_id || 'trial',
      is_blocked: Boolean(shop.is_blocked),
      expires_at: shop.expires_at ? new Date(shop.expires_at).toISOString().split('T')[0] : '',
      extend_days: '',
      record_payment: false,
      billing_cycle: 'monthly',
      payment_amount: planMeta.price > 0 ? String(planMeta.price) : ''
    });
  };

  const handleSavePlanModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planModalShop) return;
    const token = localStorage.getItem('token');
    setSavingPlanModal(true);
    try {
      const payload: Record<string, any> = {
        plan_id: planModalForm.plan_id,
        is_blocked: planModalForm.is_blocked,
        record_payment: planModalForm.record_payment,
        billing_cycle: planModalForm.billing_cycle
      };

      if (planModalForm.extend_days && Number(planModalForm.extend_days) > 0) {
        payload.extend_days = Number(planModalForm.extend_days);
      } else if (planModalForm.expires_at) {
        payload.expires_at = new Date(`${planModalForm.expires_at}T23:59:59`).toISOString();
      } else {
        payload.expires_at = null;
      }

      if (planModalForm.record_payment && planModalForm.payment_amount) {
        payload.payment_amount = Number(planModalForm.payment_amount);
      }

      const res = await fetch(`/api/admin/master/shops/${planModalShop.id}/plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar plano e permissão');
        return;
      }
      toast.success(`Acesso e plano de "${planModalShop.name}" atualizados!`);
      setPlanModalShop(null);
      await Promise.all([fetchMasterData(), fetchAnalytics(), fetchBillingConfigAndPayments()]);
    } catch {
      toast.error('Erro de conexão ao atualizar loja');
    } finally {
      setSavingPlanModal(false);
    }
  };

  const openContactModal = (shop: any) => {
    setContactModalShop(shop);
    setContactWhatsappInput(shop.contact_whatsapp || shop.whatsapp || shop.phone || '');
  };

  const handleSaveShopContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactModalShop) return;
    const token = localStorage.getItem('token');
    setSavingContact(true);
    try {
      const res = await fetch(`/api/admin/master/shops/${contactModalShop.id}/contact`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ whatsapp: contactWhatsappInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar contato da loja');
        return;
      }
      toast.success('WhatsApp do administrador salvo!');
      setContactModalShop((prev: any) => prev ? { ...prev, contact_whatsapp: data.whatsapp, whatsapp: data.whatsapp } : null);
      await fetchMasterData();
    } catch {
      toast.error('Erro de conexão ao salvar contato');
    } finally {
      setSavingContact(false);
    }
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success(`${label} copiado!`);
    } catch {
      toast.error('Não foi possível copiar');
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
        body: JSON.stringify({ expires_at: date ? new Date(`${date}T23:59:59`).toISOString() : null })
      });
      
      if (res.ok) {
        toast.success('Validade atualizada');
        await Promise.all([fetchMasterData(), fetchAnalytics()]);
      }
    } catch (e) {
      toast.error('Erro ao atualizar validade');
    }
  };

  const handleExtendDays = async (shopId: string, days: number) => {
    const shop = shops.find((s) => s.id === shopId);
    const now = Date.now();
    const curr = shop?.expires_at ? new Date(shop.expires_at).getTime() : 0;
    const base = curr > now ? curr : now;
    const nextIso = new Date(base + days * 86400000).toISOString().split('T')[0];
    await handleUpdateExpiration(shopId, nextIso);
  };

  const { setBusinessTypeForShop } = useBusinessConfig();

  const handleUpdateSegment = async (shopId: string, segment: string) => {
    const success = await setBusinessTypeForShop(shopId, segment);
    if (success) {
      await Promise.all([fetchMasterData(), fetchAnalytics()]);
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
        setNewShop({ name: '', slug: '', email: '', password: '', segment: 'barbershop', plan_id: 'trial', whatsapp: '' });
        setShowForm(false);
        await Promise.all([fetchMasterData(), fetchAnalytics()]);
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
      await Promise.all([fetchMasterData(), fetchAnalytics(), fetchBillingConfigAndPayments()]);
    } catch {
      toast.error('Erro de conexão ao excluir estabelecimento');
    } finally {
      setDeletingShopId(null);
    }
  };

  const filteredShops = shops.filter((shop) => {
    const isExpired = Boolean(shop.expires_at && new Date(shop.expires_at) < new Date());
    const isBlocked = Boolean(shop.is_blocked);
    if (shopStatusFilter === 'blocked' && !isBlocked) return false;
    if (shopStatusFilter === 'expired' && (isBlocked || !isExpired)) return false;
    if (shopStatusFilter === 'active' && (isBlocked || isExpired)) return false;
    if (shopPlanFilter !== 'all' && (shop.plan_id || 'trial') !== shopPlanFilter) return false;
    if (filterSegment !== 'all' && (shop.segment || 'barbershop') !== filterSegment) return false;

    if (shopSearch.trim()) {
      const q = shopSearch.trim().toLowerCase();
      const matchesName = String(shop.name || '').toLowerCase().includes(q);
      const matchesSlug = String(shop.slug || '').toLowerCase().includes(q);
      const matchesEmail = String(shop.admin_email || '').toLowerCase().includes(q);
      const matchesAdmin = String(shop.admin_name || '').toLowerCase().includes(q);
      if (!matchesName && !matchesSlug && !matchesEmail && !matchesAdmin) return false;
    }
    return true;
  });

  const summary = analytics?.summary;
  const maxSegmentRevenue = Math.max(
    1,
    ...(analytics?.bySegment || []).map((s: any) => Math.max(s.saasRevenue || 0, s.mrrEstimate || 0))
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header + Master Navigation Menu */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">Painel Master</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Receita SaaS, planos, permissões de uso e contato com administradores.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sub-menu do Painel Master */}
          <div className="inline-flex items-center bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Dashboard &amp; Lojas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admins')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'admins'
                  ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Contato Admins ({shops.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Pagamentos &amp; Nuvem
            </button>
          </div>

          <button 
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-black dark:bg-[#D4AF37] text-white dark:text-black px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" /> Cadastrar Loja
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Novo Estabelecimento</h2>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nível do Plano Inicial</label>
                <select
                  value={newShop.plan_id}
                  onChange={e => setNewShop({...newShop, plan_id: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#D4AF37] text-gray-900 dark:text-gray-100"
                >
                  {PLAN_OPTIONS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
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
                <p className="text-[11px] text-gray-500 mt-1">Link de agendamento: /b/{newShop.slug || 'slug'}</p>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp do Administrador (opcional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input 
                    type="text"
                    value={newShop.whatsapp}
                    onChange={e => setNewShop({...newShop, whatsapp: e.target.value})}
                    placeholder="Ex: 5511999999999"
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
                className="bg-black dark:bg-[#D4AF37] text-white dark:text-black px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? 'Criando...' : 'Finalizar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 1: OVERVIEW (ANALYTICS DASHBOARD + SHOPS TABLE) */}
      {activeTab === 'overview' && (
        <>
          {/* Master Revenue Dashboard Filters */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#D4AF37]" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Dashboard Administrativo &amp; Receita Gerada
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Date Presets */}
                <div className="inline-flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-1">
                  {[
                    { id: 'all', label: 'Tudo' },
                    { id: '7d', label: '7 dias' },
                    { id: 'month', label: 'Este mês' },
                    { id: '30d', label: '30 dias' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyDatePreset(preset.id as any)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        datePreset === preset.id
                          ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Start / End Date */}
                <div className="flex items-center gap-1.5 text-xs">
                  <input
                    type="date"
                    value={filterStart}
                    onChange={(e) => {
                      const nextStart = e.target.value;
                      setDatePreset('custom');
                      setFilterStart(nextStart);
                      fetchAnalytics(nextStart, filterEnd, filterSegment);
                    }}
                    className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-[#D4AF37]"
                    title="Data inicial"
                  />
                  <span className="text-gray-400">até</span>
                  <input
                    type="date"
                    value={filterEnd}
                    onChange={(e) => {
                      const nextEnd = e.target.value;
                      setDatePreset('custom');
                      setFilterEnd(nextEnd);
                      fetchAnalytics(filterStart, nextEnd, filterSegment);
                    }}
                    className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-[#D4AF37]"
                    title="Data final"
                  />
                </div>

                {/* Niche Filter */}
                <select
                  value={filterSegment}
                  onChange={(e) => {
                    const nextSeg = e.target.value;
                    setFilterSegment(nextSeg);
                    fetchAnalytics(filterStart, filterEnd, nextSeg);
                  }}
                  className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 outline-none focus:border-[#D4AF37]"
                >
                  <option value="all">Todos os nichos</option>
                  {Object.values(SEGMENTS).map((seg) => (
                    <option key={seg.id} value={seg.id}>
                      {seg.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => fetchAnalytics()}
                  disabled={loadingAnalytics}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {/* 4 Primary KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Receita SaaS Gerada</span>
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                  R$ {formatBRL(summary?.saasRevenue || 0)}
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 tabular-nums">
                  {summary?.approvedPaymentsCount || 0} pagamento(s) aprovado(s)
                  {summary?.pendingPaymentsCount ? ` · ${summary.pendingPaymentsCount} pendente(s)` : ''}
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">MRR Estimado (Ativas)</span>
                  <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                  R$ {formatBRL(summary?.mrrEstimate || 0)}
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 tabular-nums">
                  {summary?.paidShops || 0} loja(s) em plano pago · {summary?.trialShops || 0} em teste
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Movimento das Lojas</span>
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                  R$ {formatBRL(summary?.ecosystemRevenue || 0)}
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 tabular-nums">
                  {summary?.ecosystemAppointmentsCount || 0} agendamento(s) no período
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Lojas &amp; Permissões</span>
                  <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {summary?.activeShops ?? shops.filter((s) => !s.is_blocked).length} / {summary?.totalShops ?? stats.totalShops}
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 tabular-nums">
                  {summary?.blockedShops || 0} bloqueada(s) · {summary?.expiredShops || 0} vencida(s) · {summary?.totalUsers ?? stats.totalUsers} usuários
                </p>
              </div>
            </div>

            {/* Breakdown Row: Plans + By Niche */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch pt-1">
              {/* Plan Distribution */}
              <div className="lg:col-span-5 p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                    Lojas por Nível do Plano
                  </h3>
                  <span className="text-xs text-gray-400 tabular-nums">
                    PIX/MP: R$ {formatBRL(summary?.gatewayRevenue || 0)} · Manual: R$ {formatBRL(summary?.manualRevenue || 0)}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {(analytics?.planBreakdown || []).map((plan: any) => {
                    const pct = summary?.totalShops ? Math.round((plan.count / summary.totalShops) * 100) : 0;
                    return (
                      <div key={plan.planId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{plan.name}</span>
                          <span className="text-gray-500 dark:text-zinc-400 tabular-nums">
                            {plan.count} loja(s) ({plan.activeCount} ativa) · MRR R$ {formatBRL(plan.mrr)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              plan.planId === 'premium'
                                ? 'bg-[#D4AF37]'
                                : plan.planId === 'profissional'
                                  ? 'bg-emerald-500'
                                  : plan.planId === 'essencial'
                                    ? 'bg-blue-500'
                                    : 'bg-gray-400 dark:bg-zinc-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revenue & Shops by Niche */}
              <div className="lg:col-span-7 p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 space-y-3 overflow-x-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                    Desempenho por Nicho ({(analytics?.bySegment || []).length})
                  </h3>
                  {filterSegment !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterSegment('all');
                        fetchAnalytics(filterStart, filterEnd, 'all');
                      }}
                      className="text-xs font-bold text-[#D4AF37] hover:underline"
                    >
                      Limpar filtro de nicho
                    </button>
                  )}
                </div>

                {(analytics?.bySegment || []).length === 0 ? (
                  <p className="text-xs text-gray-500 py-4">Nenhum dado encontrado para os filtros atuais.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                        <th className="py-2 pr-3 font-semibold">Nicho</th>
                        <th className="py-2 px-2 font-semibold text-right">Lojas (Ativas)</th>
                        <th className="py-2 px-2 font-semibold text-right">Receita SaaS</th>
                        <th className="py-2 px-2 font-semibold text-right">MRR</th>
                        <th className="py-2 pl-2 font-semibold text-right">Agendamentos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {(analytics?.bySegment || []).map((row: any) => {
                        const barWidth = Math.min(100, Math.round(((row.saasRevenue || row.mrrEstimate || 0) / maxSegmentRevenue) * 100));
                        return (
                          <tr
                            key={row.segment}
                            onClick={() => {
                              const nextSeg = filterSegment === row.segment ? 'all' : row.segment;
                              setFilterSegment(nextSeg);
                              fetchAnalytics(filterStart, filterEnd, nextSeg);
                            }}
                            className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 pr-3">
                              <div className="font-semibold text-gray-900 dark:text-white">{row.segmentName}</div>
                              <div className="h-1 mt-1 rounded-full bg-gray-100 dark:bg-zinc-800 w-24 overflow-hidden">
                                <div className="h-full bg-[#D4AF37]" style={{ width: `${barWidth}%` }} />
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                              {row.shopsCount} ({row.activeShopsCount})
                            </td>
                            <td className="py-2.5 px-2 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              R$ {formatBRL(row.saasRevenue)}
                            </td>
                            <td className="py-2.5 px-2 text-right tabular-nums text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                              R$ {formatBRL(row.mrrEstimate)}
                            </td>
                            <td className="py-2.5 pl-2 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                              {row.ecosystemAppointmentsCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'settings' && (
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
      )}

      {activeTab === 'settings' && (
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
      )}

      {/* Evolution API v2 Global Server & Cron Config Card (Part 6 - Oculta até ativação da VPS) */}
      {activeTab === 'settings' && showEvolutionSetup && (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm p-6 space-y-5">
        <form onSubmit={handleSaveEvolutionConfig} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                evoConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
              }`}>
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Automação WhatsApp — Servidor Evolution API v2
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Conecte aqui a sua VPS com Evolution API quando estiver pronta. Cada loja passa a parear o próprio WhatsApp na aba <strong>WhatsApp &amp; Robô</strong>.
                </p>
              </div>
            </div>
            <span className={`text-xs font-bold ${evoConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {evoConfigured
                ? `Configurada (${evoSource === 'database' ? 'Painel Master' : 'Env Vercel'})`
                : 'Aguardando VPS (Parte 6 pronta no app)'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                URL da Evolution API (VPS)
              </label>
              <input
                type="url"
                value={evoApiUrlInput}
                onChange={(e) => setEvoApiUrlInput(e.target.value)}
                placeholder="Ex: https://evo.seu-ip.sslip.io"
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Global API Key (Evolution)
              </label>
              <input
                type="password"
                value={evoApiKeyInput}
                onChange={(e) => setEvoApiKeyInput(e.target.value)}
                placeholder={evoKeyMasked ? `Atual: ${evoKeyMasked}` : 'Chave secreta da Evolution API'}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                CRON_SECRET (Lembretes automáticos)
              </label>
              <input
                type="password"
                value={cronSecretInput}
                onChange={(e) => setCronSecretInput(e.target.value)}
                placeholder={cronSecretConfigured ? 'Configurado (digite para trocar)' : 'Segredo p/ cron-job.org / Vercel'}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Endpoint do agendador (2h e 24h): <code className="font-mono bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">/api/cron/whatsapp-reminders</code>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleTestEvolutionServer}
                disabled={testingEvo || !evoConfigured}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                <Activity className="w-4 h-4" />
                {testingEvo ? 'Testando...' : 'Testar Conexão VPS'}
              </button>

              <button
                type="button"
                onClick={handleRunRemindersCronNow}
                disabled={runningCron}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                {runningCron ? 'Executando...' : 'Rodar Lembretes Agora'}
              </button>

              <button
                type="submit"
                disabled={savingEvo}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingEvo ? 'Salvando...' : 'Salvar Evolution API'}
              </button>
            </div>
          </div>
        </form>
      </div>
      )}

      {/* PIX QR Code + App Mercado Pago Payment Links + Optional API Config Card */}
      {activeTab === 'settings' && (
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
      )}

      {/* TAB 1 CONT: SHOPS TABLE WITH PLAN LEVEL, USAGE PERMISSION & ADMIN CONTACT */}
      {activeTab === 'overview' && (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white">
              Lojas, Planos &amp; Permissões ({filteredShops.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Edite o nível do plano manualmente, libere ou revogue a permissão de uso e fale direto com cada administrador.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
                placeholder="Buscar loja, slug ou e-mail..."
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#D4AF37] w-52"
              />
            </div>

            <select
              value={shopPlanFilter}
              onChange={(e) => setShopPlanFilter(e.target.value)}
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-[#D4AF37]"
            >
              <option value="all">Todos os planos</option>
              {PLAN_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label.split(' — ')[0]}</option>
              ))}
            </select>

            <select
              value={shopStatusFilter}
              onChange={(e) => setShopStatusFilter(e.target.value as any)}
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-[#D4AF37]"
            >
              <option value="all">Todas permissões</option>
              <option value="active">Liberadas (Ativas)</option>
              <option value="blocked">Sem Permissão (Bloqueadas)</option>
              <option value="expired">Vencidas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/50 text-[11px] font-bold uppercase text-gray-500 dark:text-zinc-400">
                <th className="p-4">Estabelecimento &amp; Admin</th>
                <th className="p-4">Nicho / Segmento</th>
                <th className="p-4">Nível do Plano</th>
                <th className="p-4">Permissão de Uso</th>
                <th className="p-4">Validade</th>
                <th className="p-4 text-right">Contato &amp; Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm">
              {filteredShops.map(shop => {
                const isExpired = Boolean(shop.expires_at && new Date(shop.expires_at) < new Date());
                const shopPreset = getSegment(shop.segment);
                const waDigits = formatWhatsappDigits(shop.contact_whatsapp);
                const isBusy = updatingShopId === shop.id;

                return (
                  <tr key={shop.id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900 dark:text-gray-100">{shop.name}</div>
                      <div className="text-xs text-gray-500 dark:text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="font-mono text-blue-600 dark:text-blue-400">/b/{shop.slug}</span>
                        {shop.admin_email && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate max-w-[190px]" title={shop.admin_email}>{shop.admin_email}</span>
                          </>
                        )}
                      </div>
                      {Number(shop.total_paid || 0) > 0 && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 tabular-nums">
                          Pago acumulado: R$ {formatBRL(shop.total_paid)}
                        </div>
                      )}
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
                        <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">
                          {shopPreset.terms.business}
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <select
                        value={shop.plan_id || 'trial'}
                        disabled={isBusy}
                        onChange={(e) => handleQuickPlanChange(shop.id, e.target.value)}
                        className="text-xs font-semibold bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-gray-100 focus:border-[#D4AF37] outline-none disabled:opacity-50"
                      >
                        {PLAN_OPTIONS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label.split(' — ')[0]}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openPlanModal(shop)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B69121] dark:text-[#D4AF37] hover:underline whitespace-nowrap"
                        >
                          <SlidersHorizontal className="w-3 h-3" /> Editar / Lançar Pagamento
                        </button>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                          shop.is_blocked
                            ? 'text-red-600 dark:text-red-400'
                            : isExpired
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {shop.is_blocked ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Sem Permissão</span>
                            </>
                          ) : isExpired ? (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>Vencido</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Uso Liberado</span>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleBlock(shop.id, !!shop.is_blocked)}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap w-fit disabled:opacity-50 ${
                            shop.is_blocked
                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                              : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/60'
                          }`}
                        >
                          {shop.is_blocked ? (
                            <>
                              <Unlock className="w-3 h-3" /> Liberar Permissão
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" /> Tirar Permissão
                            </>
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="date" 
                            value={shop.expires_at ? new Date(shop.expires_at).toISOString().split('T')[0] : ''}
                            onChange={(e) => handleUpdateExpiration(shop.id, e.target.value)}
                            className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:border-[#D4AF37] outline-none tabular-nums"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleExtendDays(shop.id, 30)}
                            className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-[11px] font-bold text-gray-700 dark:text-zinc-300 hover:bg-[#D4AF37] hover:text-black transition-colors whitespace-nowrap"
                          >
                            +30d
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExtendDays(shop.id, 365)}
                            className="px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-[11px] font-bold text-gray-700 dark:text-zinc-300 hover:bg-[#D4AF37] hover:text-black transition-colors whitespace-nowrap"
                          >
                            +1 ano
                          </button>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {waDigits ? (
                          <a
                            href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                              `Olá${shop.admin_name ? ` ${shop.admin_name}` : ''}! Aqui é do suporte DoisemePRO sobre a loja "${shop.name}".`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                            title={`WhatsApp: ${shop.contact_whatsapp}`}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openContactModal(shop)}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-emerald-600 transition-colors"
                            title="Adicionar WhatsApp / Contatar Admin"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                        )}

                        {shop.admin_email && (
                          <a
                            href={`mailto:${shop.admin_email}?subject=${encodeURIComponent(`DoisemePRO — Atendimento ${shop.name}`)}`}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                            title={`Enviar e-mail para ${shop.admin_email}`}
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        )}

                        <button 
                          type="button"
                          onClick={() => handleEnterDashboard(shop.id)}
                          className="p-2 bg-black dark:bg-[#D4AF37] text-white dark:text-black rounded-lg hover:opacity-80 transition-opacity"
                          title="Entrar no Painel da Loja"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyResetLink(shop.id, shop.name)}
                          className="p-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                          title="Gerar e copiar link de redefinição de senha"
                        >
                          <Key className="w-4 h-4" />
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
              {filteredShops.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 italic">
                    Nenhuma loja encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* TAB 2: STORE ADMINISTRATORS CONTACT DIRECTORY */}
      {activeTab === 'admins' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Contato com Administradores das Lojas ({filteredShops.length})
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Fale por WhatsApp ou e-mail com os donos das lojas cadastradas, cadastre o número de contato ou envie link de acesso.
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
                placeholder="Buscar loja, admin ou e-mail..."
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-[#D4AF37] w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-800/50 text-[11px] font-bold uppercase text-gray-500 dark:text-zinc-400">
                  <th className="p-4">Loja &amp; Nicho</th>
                  <th className="p-4">Administrador</th>
                  <th className="p-4">E-mail</th>
                  <th className="p-4">WhatsApp / Telefone</th>
                  <th className="p-4">Plano &amp; Status</th>
                  <th className="p-4 text-right">Canais de Contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {filteredShops.map((shop) => {
                  const seg = getSegment(shop.segment);
                  const waDigits = formatWhatsappDigits(shop.contact_whatsapp);
                  const isExpired = Boolean(shop.expires_at && new Date(shop.expires_at) < new Date());
                  return (
                    <tr key={shop.id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/20">
                      <td className="p-4">
                        <div className="font-bold text-gray-900 dark:text-white">{shop.name}</div>
                        <div className="text-xs text-gray-500 dark:text-zinc-400">{seg.name} · /b/{shop.slug}</div>
                      </td>
                      <td className="p-4 font-medium text-gray-800 dark:text-gray-200">
                        {shop.admin_name || 'Administrador'}
                      </td>
                      <td className="p-4">
                        {shop.admin_email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-gray-700 dark:text-zinc-300">{shop.admin_email}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(shop.admin_email, 'E-mail')}
                              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                              title="Copiar e-mail"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Não informado</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-700 dark:text-zinc-300">
                            {shop.contact_whatsapp || 'Não cadastrado'}
                          </span>
                          <button
                            type="button"
                            onClick={() => openContactModal(shop)}
                            className="text-xs font-bold text-[#B69121] dark:text-[#D4AF37] hover:underline"
                          >
                            {shop.contact_whatsapp ? 'Editar' : 'Adicionar'}
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-semibold text-gray-900 dark:text-white">{shop.plan_name || 'Teste Grátis'}</div>
                        <div className={
                          shop.is_blocked ? 'text-red-600 dark:text-red-400' : isExpired ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                        }>
                          {shop.is_blocked ? 'Sem Permissão' : isExpired ? 'Vencido' : 'Liberado'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {waDigits ? (
                            <a
                              href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                                `Olá${shop.admin_name ? ` ${shop.admin_name}` : ''}! Tudo bem? Aqui é da equipe DoisemePRO falando sobre sua conta "${shop.name}" (${shop.plan_name || 'Teste Grátis'}).`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
                            >
                              <Send className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openContactModal(shop)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 whitespace-nowrap"
                            >
                              <Phone className="w-3.5 h-3.5" /> Salvar WhatsApp
                            </button>
                          )}

                          {shop.admin_email && (
                            <a
                              href={`mailto:${shop.admin_email}?subject=${encodeURIComponent(`DoisemePRO — Contato sobre ${shop.name}`)}&body=${encodeURIComponent(
                                `Olá ${shop.admin_name || ''},\n\nEstamos entrando em contato sobre o seu painel "${shop.name}" no DoisemePRO.\n`
                              )}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-900 dark:bg-zinc-800 text-white hover:opacity-90 transition-opacity whitespace-nowrap"
                            >
                              <Mail className="w-3.5 h-3.5" /> E-mail
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyResetLink(shop.id, shop.name)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                            title="Copiar link de redefinição de senha"
                          >
                            <Key className="w-3.5 h-3.5" /> Link Senha
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredShops.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500 italic">
                      Nenhum administrador encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-amber-900 dark:text-amber-400 mb-1">Segurança de Acesso</h3>
          <p className="text-xs sm:text-sm text-amber-800/80 dark:text-amber-500/80">
            Esta tela é protegida por validação JWT no backend e verificação de permissão no frontend. Somente o usuário raiz (Master) pode editar planos, permissões e visualizar a receita global.
          </p>
        </div>
      </div>

      {/* Modal: Gerenciar Plano & Permissão de Uso (+ Pagamento Manual opcional) */}
      {planModalShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Plano &amp; Permissão — {planModalShop.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Troque o plano (ex: Básico para Pro ou vice-versa), libere/bloqueie o uso e opcionalmente registre pagamento manual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlanModalShop(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlanModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1.5">
                  Nível do Plano Cadastrado
                </label>
                <select
                  value={planModalForm.plan_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const opt = PLAN_OPTIONS.find((p) => p.id === nextId);
                    setPlanModalForm((prev) => ({
                      ...prev,
                      plan_id: nextId,
                      payment_amount: opt && opt.price > 0 ? String(opt.price) : ''
                    }));
                  }}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#D4AF37]"
                >
                  {PLAN_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40">
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">Permissão de Uso</div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400">
                    {planModalForm.is_blocked
                      ? 'Loja bloqueada manualmente (sem acesso ao painel).'
                      : 'Loja com acesso liberado (sujeita à data de validade).'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanModalForm((prev) => ({ ...prev, is_blocked: !prev.is_blocked }))}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    planModalForm.is_blocked
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {planModalForm.is_blocked ? 'Sem Permissão (Clique p/ Liberar)' : 'Liberado (Clique p/ Bloquear)'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1.5">
                    Data de Validade
                  </label>
                  <input
                    type="date"
                    value={planModalForm.expires_at}
                    onChange={(e) => setPlanModalForm((prev) => ({ ...prev, expires_at: e.target.value, extend_days: '' }))}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1.5">
                    Ou Adicionar Dias (opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 30 ou 365"
                    value={planModalForm.extend_days}
                    onChange={(e) => setPlanModalForm((prev) => ({ ...prev, extend_days: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {planModalForm.plan_id !== 'trial' && (
                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planModalForm.record_payment}
                      onChange={(e) => setPlanModalForm((prev) => ({ ...prev, record_payment: e.target.checked }))}
                      className="rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                    />
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      Registrar pagamento manual na Receita do Painel Master
                    </span>
                  </label>

                  {planModalForm.record_payment && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Ciclo</label>
                        <select
                          value={planModalForm.billing_cycle}
                          onChange={(e) => setPlanModalForm((prev) => ({ ...prev, billing_cycle: e.target.value as any }))}
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs outline-none"
                        >
                          <option value="monthly">Mensal</option>
                          <option value="annual">Anual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Valor Recebido (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={planModalForm.payment_amount}
                          onChange={(e) => setPlanModalForm((prev) => ({ ...prev, payment_amount: e.target.value }))}
                          placeholder="99.90"
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs tabular-nums outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPlanModalShop(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlanModal}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingPlanModal ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Contato / WhatsApp do Administrador */}
      {contactModalShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Contatar Administrador — {contactModalShop.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {contactModalShop.admin_name || 'Admin'} · {contactModalShop.admin_email || 'Sem e-mail'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactModalShop(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShopContact} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1.5">
                  WhatsApp / Telefone da Loja
                </label>
                <input
                  type="text"
                  value={contactWhatsappInput}
                  onChange={(e) => setContactWhatsappInput(e.target.value)}
                  placeholder="Ex: 5511999999999"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  {formatWhatsappDigits(contactWhatsappInput) && (
                    <a
                      href={`https://wa.me/${formatWhatsappDigits(contactWhatsappInput)}?text=${encodeURIComponent(
                        `Olá! Aqui é do suporte DoisemePRO sobre a loja "${contactModalShop.name}".`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
                    </a>
                  )}
                  {contactModalShop.admin_email && (
                    <a
                      href={`mailto:${contactModalShop.admin_email}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200"
                    >
                      <Mail className="w-4 h-4" /> E-mail
                    </a>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={savingContact}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#D4AF37] text-black hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingContact ? 'Salvando...' : 'Salvar Número'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
