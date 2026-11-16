import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Edit3,
  Handshake,
  MessageCircle,
  MousePointerClick,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { SEGMENTS } from '../lib/segments';

interface AffiliateRow {
  id: string;
  name: string;
  email: string;
  phoneWhatsapp: string;
  pixKey: string;
  code: string;
  commissionRate: number;
  commissionPercent: number;
  niche: string;
  notes: string;
  active: boolean;
  createdAt: string;
  stats: {
    totalClicks: number;
    uniqueClicks: number;
    lastClickedAt: string | null;
    referralsCount: number;
    activePaidCount: number;
    trialCount: number;
    signupConversionRate: number;
    paidConversionRate: number;
    trialToPaidRate: number;
    pendingAmount: number;
    availableAmount: number;
    paidAmount: number;
    totalEarned: number;
    totalSalesVolume: number;
  };
}

interface CommissionRow {
  id: string;
  affiliate_id: string;
  affiliateName: string;
  affiliateCode: string;
  shop_id: string;
  shopName: string;
  plan_name: string;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'available' | 'paid' | 'reversed';
  available_at: string;
  paid_at: string | null;
  payout_reference: string | null;
  created_at: string;
}

interface AffiliatesSummary {
  activeAffiliates: number;
  totalClicks: number;
  totalUniqueClicks: number;
  totalReferrals: number;
  totalTrials: number;
  totalActivePaid: number;
  overallSignupConversionRate: number;
  overallPaidConversionRate: number;
  pendingPayouts: number;
  availablePayouts: number;
  totalPaid: number;
}

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

const formatWhatsappDigits = (raw?: string | null) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
};

const toReferralCode = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);

export default function MasterAffiliatesTab() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AffiliatesSummary>({
    activeAffiliates: 0,
    totalClicks: 0,
    totalUniqueClicks: 0,
    totalReferrals: 0,
    totalTrials: 0,
    totalActivePaid: 0,
    overallSignupConversionRate: 0,
    overallPaidConversionRate: 0,
    pendingPayouts: 0,
    availablePayouts: 0,
    totalPaid: 0
  });
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [search, setSearch] = useState('');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<'all' | 'available' | 'pending' | 'paid'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form Modal (Create / Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<AffiliateRow | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    password: '',
    phoneWhatsapp: '',
    pixKey: '',
    code: '',
    commissionPercent: 25,
    niche: 'Todos os nichos',
    notes: '',
    active: true
  });

  // Payout Modal
  const [payoutTarget, setPayoutTarget] = useState<AffiliateRow | null>(null);
  const [payoutRefInput, setPayoutRefInput] = useState('');
  const [payoutIncludePending, setPayoutIncludePending] = useState(false);
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<AffiliateRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/master/affiliates', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao carregar afiliados');
        return;
      }
      setSummary(data.summary || summary);
      setAffiliates(data.affiliates || []);
      setCommissions(data.commissions || []);
    } catch {
      toast.error('Erro de conexão ao carregar programa de afiliados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingAffiliate(null);
    setCodeManuallyEdited(false);
    setFormState({
      name: '',
      email: '',
      password: '',
      phoneWhatsapp: '',
      pixKey: '',
      code: '',
      commissionPercent: 25,
      niche: 'Todos os nichos',
      notes: '',
      active: true
    });
    setShowModal(true);
  };

  const openEditModal = (aff: AffiliateRow) => {
    setEditingAffiliate(aff);
    setCodeManuallyEdited(true);
    setFormState({
      name: aff.name,
      email: aff.email,
      password: '',
      phoneWhatsapp: aff.phoneWhatsapp || '',
      pixKey: aff.pixKey || '',
      code: aff.code,
      commissionPercent: aff.commissionPercent || 25,
      niche: aff.niche || 'Todos os nichos',
      notes: aff.notes || '',
      active: aff.active
    });
    setShowModal(true);
  };

  const handleSaveAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setSavingForm(true);
    try {
      const endpoint = editingAffiliate
        ? `/api/admin/master/affiliates/${encodeURIComponent(editingAffiliate.id)}`
        : '/api/admin/master/affiliates';
      const method = editingAffiliate ? 'PATCH' : 'POST';

      const payload: Record<string, any> = {
        name: formState.name.trim(),
        email: formState.email.trim(),
        phoneWhatsapp: formState.phoneWhatsapp.trim(),
        pixKey: formState.pixKey.trim(),
        code: toReferralCode(formState.code),
        commissionPercent: Number(formState.commissionPercent),
        niche: formState.niche.trim(),
        notes: formState.notes.trim()
      };

      if (editingAffiliate) {
        payload.active = formState.active;
        if (formState.password.trim()) {
          payload.password = formState.password.trim();
        }
      } else {
        payload.password = formState.password.trim();
      }

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar afiliado');
        return;
      }

      toast.success(editingAffiliate ? 'Parceiro atualizado com sucesso!' : 'Parceiro cadastrado com sucesso!');
      setShowModal(false);
      await loadData();
    } catch {
      toast.error('Erro de conexão ao salvar afiliado');
    } finally {
      setSavingForm(false);
    }
  };

  const handleToggleActive = async (aff: AffiliateRow) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/master/affiliates/${encodeURIComponent(aff.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ active: !aff.active })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao alterar status');
        return;
      }
      toast.success(aff.active ? 'Afiliado pausado.' : 'Afiliado reativado!');
      await loadData();
    } catch {
      toast.error('Erro de conexão ao atualizar status');
    }
  };

  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTarget) return;
    const token = localStorage.getItem('token');
    setSubmittingPayout(true);
    try {
      const res = await fetch(`/api/admin/master/affiliates/${encodeURIComponent(payoutTarget.id)}/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          includePending: payoutIncludePending,
          payoutReference: payoutRefInput.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível registrar o repasse');
        return;
      }
      toast.success(
        `Repasse de R$ ${formatBRL(data.totalAmount)} (${data.count} comissão(ões)) marcado como pago!`
      );
      setPayoutTarget(null);
      setPayoutRefInput('');
      setPayoutIncludePending(false);
      await loadData();
    } catch {
      toast.error('Erro de conexão ao registrar repasse');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const token = localStorage.getItem('token');
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/master/affiliates/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir parceiro');
        return;
      }
      toast.success(`Parceiro "${deleteTarget.name}" removido.`);
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error('Erro de conexão ao excluir parceiro');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyReferralLink = async (aff: AffiliateRow) => {
    const url = `${window.location.origin}/r/${aff.code}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedId(aff.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success(`Link /r/${aff.code} copiado!`);
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  const filteredAffiliates = affiliates.filter((a) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.niche || '').toLowerCase().includes(q)
    );
  });

  const filteredCommissions = commissions.filter((c) => {
    if (commissionStatusFilter !== 'all' && c.status !== commissionStatusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.affiliateName.toLowerCase().includes(q) ||
      c.affiliateCode.toLowerCase().includes(q) ||
      c.shopName.toLowerCase().includes(q)
    );
  });

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/afiliado` : '/afiliado';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Parceiros Ativos</span>
            <Handshake className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            {summary.activeAffiliates}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 tabular-nums">
            {affiliates.length} parceiro(s) cadastrado(s)
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Cliques &amp; Conversão</span>
            <MousePointerClick className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            {summary.totalClicks}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 tabular-nums">
            {summary.totalUniqueClicks} únicos · {Number(summary.overallSignupConversionRate || 0).toFixed(1)}% cad. · {Number(summary.overallPaidConversionRate || 0).toFixed(1)}% pago
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Em Testes &amp; Pagantes</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            {summary.totalTrials}{' '}
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">em teste</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 tabular-nums">
            {summary.totalReferrals} indicações · {summary.totalActivePaid} pagante(s)
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Liberado p/ PIX</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            R$ {formatBRL(summary.availablePayouts)}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 tabular-nums">
            + R$ {formatBRL(summary.pendingPayouts)} em janela D+15
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">Total Repassado</span>
            <DollarSign className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            R$ {formatBRL(summary.totalPaid)}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            Portal do parceiro:{' '}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(portalUrl);
                toast.success('Link do Portal de Afiliados copiado!');
              }}
              className="text-[#D4AF37] font-semibold hover:underline"
            >
              Copiar /afiliado
            </button>
          </p>
        </div>
      </div>

      {/* Header Actions & Search */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar parceiro, código, nicho ou loja..."
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#D4AF37] text-black hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo Parceiro / Afiliado
          </button>
        </div>
      </div>

      {/* Affiliates Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Influenciadores &amp; Parceiros Cadastrados
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Comissão recorrente automática (20%–25%) em toda venda e renovação paga pelo Mercado Pago ou baixa manual.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-gray-500 dark:text-zinc-400 bg-gray-50/70 dark:bg-zinc-950/40">
                <th className="py-3.5 px-5">Parceiro / Nicho</th>
                <th className="py-3.5 px-4">Link &amp; Código</th>
                <th className="py-3.5 px-4">Comissão</th>
                <th className="py-3.5 px-4 text-center">Cliques / Conv.</th>
                <th className="py-3.5 px-4 text-center">Indicados</th>
                <th className="py-3.5 px-4 text-right">Saldo (Disp. / Pend.)</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm">
              {filteredAffiliates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-5 text-center text-gray-500 dark:text-zinc-400 text-xs sm:text-sm">
                    {loading ? 'Carregando parceiros...' : 'Nenhum parceiro encontrado. Clique em "Novo Parceiro / Afiliado" para criar o primeiro.'}
                  </td>
                </tr>
              ) : (
                filteredAffiliates.map((aff) => {
                  const waDigits = formatWhatsappDigits(aff.phoneWhatsapp);
                  return (
                    <tr key={aff.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/30">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-gray-900 dark:text-white">{aff.name}</div>
                        <div className="text-xs text-gray-500 dark:text-zinc-400">
                          {aff.email} {aff.niche ? `· ${aff.niche}` : ''}
                        </div>
                        {aff.pixKey && (
                          <div className="text-[11px] font-mono text-gray-500 dark:text-zinc-400 mt-0.5">
                            PIX: {aff.pixKey}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-gray-800 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded">
                            /r/{aff.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyReferralLink(aff)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800"
                            title="Copiar link de indicação"
                          >
                            {copiedId === aff.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          {waDigits && (
                            <a
                              href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                                `Olá ${aff.name.split(' ')[0]}! Segue seu link oficial de parceiro DoisemePRO (${aff.commissionPercent}% recorrente): ${window.location.origin}/r/${aff.code} — Portal: ${portalUrl}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                              title="Enviar link no WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#B8941F] dark:text-[#D4AF37] tabular-nums">
                            {aff.commissionPercent}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(aff)}
                            className={`text-[11px] font-semibold underline-offset-2 hover:underline ${
                              aff.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                            }`}
                          >
                            {aff.active ? 'Ativo' : 'Pausado'}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="font-bold text-gray-900 dark:text-white tabular-nums">
                          {aff.stats.totalClicks} cliques
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-zinc-400 tabular-nums">
                          {aff.stats.uniqueClicks} únicos · {Number(aff.stats.signupConversionRate || 0).toFixed(1)}% cad. · {Number(aff.stats.paidConversionRate || 0).toFixed(1)}% pago
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="font-bold text-gray-900 dark:text-white tabular-nums">
                          {aff.stats.referralsCount}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-zinc-400 tabular-nums">
                          {aff.stats.trialCount} em teste · {aff.stats.activePaidCount} paga(s)
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          R$ {formatBRL(aff.stats.availableAmount)}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-zinc-400 tabular-nums">
                          Pend: R$ {formatBRL(aff.stats.pendingAmount)} · Pago: R$ {formatBRL(aff.stats.paidAmount)}
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {(aff.stats.availableAmount > 0 || aff.stats.pendingAmount > 0) && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayoutTarget(aff);
                                setPayoutRefInput(`PIX_${new Date().toISOString().slice(0, 10)}`);
                                setPayoutIncludePending(aff.stats.availableAmount === 0 && aff.stats.pendingAmount > 0);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Pagar PIX
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(aff)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800"
                            title="Editar parceiro"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(aff)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                            title="Excluir parceiro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commissions Ledger */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Extrato Global de Comissões Recorrentes
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Janela padrão de segurança D+15 após confirmação do pagamento da assinatura.
            </p>
          </div>

          <div className="inline-flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-1 text-xs">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'available', label: 'Liberadas p/ PIX' },
              { id: 'pending', label: 'Aguardando D+15' },
              { id: 'paid', label: 'Pagas' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCommissionStatusFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  commissionStatusFilter === f.id
                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-gray-500 dark:text-zinc-400 bg-gray-50/70 dark:bg-zinc-950/40">
                <th className="py-3 px-5">Data</th>
                <th className="py-3 px-4">Parceiro</th>
                <th className="py-3 px-4">Loja / Plano</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">Comissão</th>
                <th className="py-3 px-5 text-right">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-5 text-center text-gray-500 dark:text-zinc-400 text-xs">
                    Nenhuma comissão registrada com este filtro.
                  </td>
                </tr>
              ) : (
                filteredCommissions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-5 text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 dark:text-white">{c.affiliateName}</div>
                      <div className="text-[11px] font-mono text-gray-500">cód: {c.affiliateCode}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800 dark:text-zinc-200">{c.shopName}</div>
                      <div className="text-xs text-gray-500 dark:text-zinc-400">
                        {c.plan_name} · {Math.round(Number(c.commission_rate) * 100)}%
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-gray-600 dark:text-zinc-300 tabular-nums">
                      R$ {formatBRL(c.gross_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#B8941F] dark:text-[#D4AF37] tabular-nums">
                      R$ {formatBRL(c.commission_amount)}
                    </td>
                    <td className="py-3 px-5 text-right text-xs">
                      {c.status === 'paid' && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pago ({formatDate(c.paid_at)})
                        </span>
                      )}
                      {c.status === 'available' && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Liberado p/ PIX</span>
                      )}
                      {c.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Libera {formatDate(c.available_at)}
                        </span>
                      )}
                      {c.status === 'reversed' && (
                        <span className="text-red-500 font-medium">Estornado</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create / Edit Affiliate */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-zinc-800">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-[#D4AF37]" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {editingAffiliate ? `Editar Parceiro — ${editingAffiliate.name}` : 'Cadastrar Novo Parceiro / Afiliado'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    Define link exclusivo (/r/código), % recorrente e login no Portal (/afiliado).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAffiliate} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Nome do Influenciador / Parceiro *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setFormState((prev) => ({
                        ...prev,
                        name: nextName,
                        code: codeManuallyEdited ? prev.code : toReferralCode(nextName)
                      }));
                    }}
                    placeholder="Ex: João Barber"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Código de Indicação *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.code}
                    onChange={(e) => {
                      setCodeManuallyEdited(true);
                      setFormState((prev) => ({ ...prev, code: toReferralCode(e.target.value) }));
                    }}
                    placeholder="joaobarber"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1 font-mono truncate">
                    Link: /r/{formState.code || 'codigo'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    E-mail de Acesso ao Portal *
                  </label>
                  <input
                    type="email"
                    required
                    value={formState.email}
                    onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="parceiro@email.com"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    {editingAffiliate ? 'Nova Senha (deixe vazio p/ manter)' : 'Senha Inicial do Portal *'}
                  </label>
                  <input
                    type="password"
                    required={!editingAffiliate}
                    minLength={editingAffiliate ? undefined : 8}
                    value={formState.password}
                    onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Mín. 8 caracteres (letras + números)"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Comissão Recorrente (%) *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, commissionPercent: 20 }))}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                        formState.commissionPercent === 20
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                          : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300'
                      }`}
                    >
                      20%
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, commissionPercent: 25 }))}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                        formState.commissionPercent === 25
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                          : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300'
                      }`}
                    >
                      25%
                    </button>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      required
                      value={formState.commissionPercent}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, commissionPercent: Number(e.target.value) || 20 }))
                      }
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm tabular-nums outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Nicho Principal do Parceiro
                  </label>
                  <select
                    value={formState.niche}
                    onChange={(e) => setFormState((prev) => ({ ...prev, niche: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                  >
                    <option value="Todos os nichos">Todos os nichos</option>
                    {Object.values(SEGMENTS).map((seg) => (
                      <option key={seg.id} value={seg.name}>
                        {seg.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formState.phoneWhatsapp}
                    onChange={(e) => setFormState((prev) => ({ ...prev, phoneWhatsapp: e.target.value }))}
                    placeholder="5511999999999"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm tabular-nums outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                    Chave PIX para Repasse
                  </label>
                  <input
                    type="text"
                    value={formState.pixKey}
                    onChange={(e) => setFormState((prev) => ({ ...prev, pixKey: e.target.value }))}
                    placeholder="CPF, E-mail ou Telefone"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                  Observações Internas (acordo, @instagram, etc.)
                </label>
                <textarea
                  rows={2}
                  value={formState.notes}
                  onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: @joaobarber · 45k seguidores · combinamos 25% recorrente"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingForm ? 'Salvando...' : editingAffiliate ? 'Salvar Alterações' : 'Cadastrar Parceiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Payout Confirmation */}
      {payoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Registrar Repasse PIX — {payoutTarget.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {payoutTarget.pixKey ? `Chave PIX: ${payoutTarget.pixKey}` : 'Parceiro ainda não informou chave PIX'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayoutTarget(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayout} className="p-5 space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-zinc-400">Liberado (D+15 vencido):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    R$ {formatBRL(payoutTarget.stats.availableAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-zinc-400">Aguardando D+15:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-300 tabular-nums">
                    R$ {formatBRL(payoutTarget.stats.pendingAmount)}
                  </span>
                </div>
              </div>

              {payoutTarget.stats.pendingAmount > 0 && (
                <label className="flex items-center gap-2.5 text-xs text-gray-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payoutIncludePending}
                    onChange={(e) => setPayoutIncludePending(e.target.checked)}
                    className="rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                  />
                  <span>Incluir também comissões pendentes (antecipar D+15)</span>
                </label>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                  Referência / Comprovante (opcional)
                </label>
                <input
                  type="text"
                  value={payoutRefInput}
                  onChange={(e) => setPayoutRefInput(e.target.value)}
                  placeholder="Ex: PIX_2026-11-15"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayoutTarget(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submittingPayout ? 'Registrando...' : 'Confirmar PIX Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Affiliate Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200 dark:border-zinc-800">
            <div className="p-6 flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Excluir parceiro {deleteTarget.name}?
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-1">
                  O código <span className="font-mono">/r/{deleteTarget.code}</span> deixará de pontuar novas lojas e comissões não pagas serão removidas. Se quiser apenas pausar, use o botão Ativo/Pausado.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir Parceiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
