import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  MessageCircle,
  QrCode,
  RefreshCw,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface PlanOption {
  id: string;
  name: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  highlighted?: boolean;
  badge?: string;
  features: string[];
}

interface BillingStatusResponse {
  shop: {
    id: string;
    name: string;
    slug: string;
    expires_at?: string | null;
    is_blocked?: boolean;
    plan_id?: string;
    plan_name?: string;
  } | null;
  currentPlanId?: string;
  currentPlanName?: string;
  isExpired: boolean;
  plans: PlanOption[];
  payments: any[];
  mpConfigured: boolean;
  pixKeyConfigured: boolean;
  pixKey: string | null;
  mpLinks?: Record<string, string>;
  supportWhatsapp: string;
}

interface PixModalData {
  mode: 'mercadopago_pix' | 'brcode_pix';
  paymentId: string;
  amount: number;
  planName: string;
  billingCycle: string;
  qrCode?: string;
  qrCodeBase64?: string | null;
  ticketUrl?: string | null;
  pixKey?: string;
  supportWhatsapp?: string;
}

interface LinkModalData {
  paymentId: string;
  paymentUrl: string;
  amount: number;
  planName: string;
}

const formatBRL = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Subscription() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [pixModal, setPixModal] = useState<PixModalData | null>(null);
  const [linkModal, setLinkModal] = useState<LinkModalData | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchBillingStatus = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/billing/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBilling(data);
      } else {
        toast.error('Não foi possível carregar os dados da assinatura.');
      }
    } catch {
      toast.error('Erro de conexão ao buscar assinatura.');
    } finally {
      setLoading(false);
    }
  };

  const verifyPaymentById = async (paymentId: string, quiet = false) => {
    const token = localStorage.getItem('token');
    setVerifyingId(paymentId);
    try {
      const res = await fetch(`/api/admin/billing/verify/${paymentId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'approved') {
        toast.success('Pagamento aprovado! Sua assinatura foi renovada.');
        setPixModal(null);
        await fetchBillingStatus();
        return true;
      }
      if (!quiet) {
        toast.info(data.message || 'Pagamento ainda pendente de confirmação.');
      }
      return false;
    } catch {
      if (!quiet) toast.error('Erro ao verificar pagamento.');
      return false;
    } finally {
      setVerifyingId(null);
    }
  };

  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    const refParam = searchParams.get('ref');

    fetchBillingStatus().then(async () => {
      if (refParam && (paymentParam === 'success' || paymentParam === 'pending')) {
        await verifyPaymentById(refParam, true);
        setSearchParams({}, { replace: true });
      } else if (paymentParam === 'failure') {
        toast.error('O pagamento não foi concluído. Você pode tentar novamente.');
        setSearchParams({}, { replace: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckoutPro = async (planId: string) => {
    const token = localStorage.getItem('token');
    setProcessingKey(`checkout:${planId}`);
    try {
      const res = await fetch('/api/admin/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId, billingCycle })
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        toast.error(data.error || 'Não foi possível iniciar o checkout no Mercado Pago.');
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      toast.error('Erro de conexão ao iniciar checkout.');
    } finally {
      setProcessingKey(null);
    }
  };

  const handleAppPaymentLink = async (planId: string) => {
    const token = localStorage.getItem('token');
    setProcessingKey(`link:${planId}`);
    try {
      const res = await fetch('/api/admin/billing/link-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId, billingCycle })
      });
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) {
        toast.error(data.error || 'Link de pagamento não disponível.');
        return;
      }
      setLinkModal({
        paymentId: data.paymentId,
        paymentUrl: data.paymentUrl,
        amount: data.amount,
        planName: data.planName
      });
      fetchBillingStatus();
    } catch {
      toast.error('Erro ao abrir link de pagamento.');
    } finally {
      setProcessingKey(null);
    }
  };

  const handleGeneratePix = async (planId: string) => {
    const token = localStorage.getItem('token');
    setProcessingKey(`pix:${planId}`);
    try {
      const res = await fetch('/api/admin/billing/pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId, billingCycle })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível gerar o pagamento PIX.');
        return;
      }
      setPixModal(data);
      fetchBillingStatus();
    } catch {
      toast.error('Erro de conexão ao gerar PIX.');
    } finally {
      setProcessingKey(null);
    }
  };

  const copyText = async (text: string, label: string) => {
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
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center text-sm text-gray-500 dark:text-zinc-400">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Carregando dados da assinatura...
      </div>
    );
  }

  const expiresAt = billing?.shop?.expires_at ? new Date(billing.shop.expires_at) : null;
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = Boolean(billing?.isExpired);
  const plans = billing?.plans || [];
  const payments = billing?.payments || [];

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-serif">
            Assinatura &amp; Planos
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Gerencie a licença de uso de {billing?.shop?.name || 'seu estabelecimento'} e renove via PIX ou Mercado Pago.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchBillingStatus}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar Status
        </button>
      </div>

      {/* Current Subscription Status Banner */}
      <div
        className={`rounded-2xl p-6 border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isExpired
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'
            : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isExpired
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isExpired ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isExpired
                ? 'Assinatura ou período de teste expirado'
                : daysLeft !== null && daysLeft <= 15
                  ? 'Período de avaliação / renovação próxima'
                  : 'Assinatura ativa'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-0.5 tabular-nums">
              Plano atual: <strong className="text-gray-900 dark:text-white">{billing?.currentPlanName || billing?.shop?.plan_name || 'Teste Grátis (7 dias)'}</strong>
              {expiresAt ? (
                <>
                  {' · '}Validade: <strong className="text-gray-900 dark:text-white">{expiresAt.toLocaleDateString('pt-BR')}</strong>
                  {daysLeft !== null && (
                    <>
                      {' · '}
                      {daysLeft < 0
                        ? `Expirado há ${Math.abs(daysLeft)} dia(s)`
                        : daysLeft === 0
                          ? 'Expira hoje'
                          : `${daysLeft} dia(s) restante(s)`}
                    </>
                  )}
                </>
              ) : (
                ' · Escolha um plano abaixo para definir seu ciclo de renovação.'
              )}
            </p>
            {isExpired && (
              <p className="text-xs font-medium text-red-700 dark:text-red-300 mt-2">
                Realize o pagamento de um plano abaixo para liberar todas as funções do painel.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
          <Calendar className="w-4 h-4 text-[#D4AF37]" />
          <span>Renovação soma dias sobre sua validade atual</span>
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Escolha seu plano
        </h2>
        <div className="inline-flex items-center bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              billingCycle === 'annual'
                ? 'bg-black text-white dark:bg-[#D4AF37] dark:text-black'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Anual — 365 dias (Até 33% off)
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-black text-white dark:bg-[#D4AF37] dark:text-black'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Mensal (30 dias)
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const totalAmount = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
          const monthlyEquivalent = billingCycle === 'annual' ? plan.annualPrice / 12 : plan.monthlyPrice;
          const annualSavings = Math.max(0, plan.monthlyPrice * 12 - plan.annualPrice);
          const isPixLoading = processingKey === `pix:${plan.id}`;
          const isCheckoutLoading = processingKey === `checkout:${plan.id}`;
          const isLinkLoading = processingKey === `link:${plan.id}`;
          const appLink = billing?.mpLinks?.[plan.id];
          const isCurrentPlan = (billing?.currentPlanId || billing?.shop?.plan_id) === plan.id;

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 flex flex-col justify-between border transition-shadow ${
                isCurrentPlan
                  ? 'bg-white dark:bg-zinc-900 border-emerald-500 ring-1 ring-emerald-500/40 shadow-md'
                  : plan.highlighted
                    ? 'bg-white dark:bg-zinc-900 border-[#D4AF37] shadow-lg'
                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-sm'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                  {isCurrentPlan ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Plano Atual
                    </span>
                  ) : (plan.badge || plan.highlighted) && (
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${
                      plan.highlighted
                        ? 'text-[#B69121] dark:text-[#D4AF37]'
                        : 'text-gray-500 dark:text-zinc-400'
                    }`}>
                      {plan.badge || 'Recomendado'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-400">{plan.subtitle}</p>

                <div className="pt-2 pb-4 border-b border-gray-100 dark:border-zinc-800">
                  {billingCycle === 'annual' && (
                    <p className="text-xs text-gray-400 line-through tabular-nums">
                      De R$ {formatBRL(plan.monthlyPrice)}/mês
                    </p>
                  )}
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="text-xs text-gray-500 dark:text-zinc-400">R$</span>
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatBRL(monthlyEquivalent)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-zinc-400">/mês</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 tabular-nums">
                    {billingCycle === 'annual'
                      ? `R$ ${formatBRL(totalAmount)}/ano · Economize R$ ${formatBRL(annualSavings)}`
                      : `Cobrança avulsa de R$ ${formatBRL(totalAmount)}`}
                  </p>
                </div>

                <ul className="space-y-2.5 text-sm text-gray-700 dark:text-zinc-300">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleGeneratePix(plan.id)}
                  disabled={Boolean(processingKey)}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-[#D4AF37] text-black hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <QrCode className="w-4 h-4" />
                  {isPixLoading ? 'Gerando QR Code PIX...' : 'Pagar via PIX Agora'}
                </button>

                {billing?.mpConfigured ? (
                  <button
                    type="button"
                    onClick={() => handleCheckoutPro(plan.id)}
                    disabled={Boolean(processingKey)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs bg-gray-900 dark:bg-zinc-800 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {isCheckoutLoading ? 'Abrindo Mercado Pago...' : 'Cartão / Boleto (Mercado Pago)'}
                  </button>
                ) : billingCycle === 'monthly' && appLink ? (
                  <button
                    type="button"
                    onClick={() => handleAppPaymentLink(plan.id)}
                    disabled={Boolean(processingKey)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs bg-gray-900 dark:bg-zinc-800 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {isLinkLoading ? 'Preparando link...' : `Cartão / Boleto · R$ ${formatBRL(plan.monthlyPrice)}`}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment History */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-base text-gray-900 dark:text-white">
            Histórico de Pagamentos
          </h3>
          {billing?.supportWhatsapp && (
            <a
              href={`https://wa.me/${billing.supportWhatsapp}?text=${encodeURIComponent(
                `Olá! Preciso de ajuda com a assinatura de ${billing.shop?.name || 'minha loja'}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <MessageCircle className="w-4 h-4" />
              Suporte no WhatsApp
            </a>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/50 text-xs uppercase text-gray-500 dark:text-zinc-400">
                <th className="p-4">Data</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Método</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {payments.map((p) => {
                const isApproved = p.status === 'approved';
                const isPending = p.status === 'pending';
                return (
                  <tr key={p.id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/30">
                    <td className="p-4 tabular-nums text-gray-600 dark:text-zinc-300 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 font-semibold text-gray-900 dark:text-white">
                      {p.plan_name} · {p.billing_cycle === 'annual' ? 'Anual' : 'Mensal'}
                    </td>
                    <td className="p-4 text-xs text-gray-500 dark:text-zinc-400">
                      {p.payment_method === 'mercadopago_pix'
                        ? 'PIX (Mercado Pago)'
                        : p.payment_method === 'mercadopago_checkout'
                          ? 'Checkout Mercado Pago'
                          : p.payment_method === 'mercadopago_link'
                            ? 'Link Mercado Pago'
                            : 'PIX QR Code'}
                    </td>
                    <td className="p-4 font-bold tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                      R$ {formatBRL(p.amount)}
                    </td>
                    <td className="p-4">
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprovado
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          Pendente
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          {p.status}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {isPending && billing?.mpConfigured && (
                        <button
                          type="button"
                          onClick={() => verifyPaymentById(p.id)}
                          disabled={verifyingId === p.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${verifyingId === p.id ? 'animate-spin' : ''}`} />
                          {verifyingId === p.id ? 'Verificando...' : 'Verificar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-zinc-500 text-sm">
                    Nenhum pagamento registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PIX Payment Modal (Works for both MP API & Official Banco Central BR Code) */}
      {pixModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Pagamento via PIX
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                  Plano {pixModal.planName} ({pixModal.billingCycle === 'annual' ? 'Anual' : 'Mensal'}) ·{' '}
                  <strong className="text-gray-900 dark:text-white">R$ {formatBRL(pixModal.amount)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPixModal(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pixModal.qrCodeBase64 && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-center">
                <img
                  src={`data:image/png;base64,${pixModal.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 object-contain"
                />
              </div>
            )}

            {pixModal.qrCode && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  PIX Copia e Cola (valor já preenchido)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixModal.qrCode}
                    className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 dark:text-zinc-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(pixModal.qrCode || '', 'Código PIX')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black dark:bg-[#D4AF37] text-white dark:text-black text-xs font-bold shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </button>
                </div>
              </div>
            )}

            {pixModal.mode === 'mercadopago_pix' ? (
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => verifyPaymentById(pixModal.paymentId)}
                  disabled={verifyingId === pixModal.paymentId}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${verifyingId === pixModal.paymentId ? 'animate-spin' : ''}`} />
                  {verifyingId === pixModal.paymentId ? 'Verificando no Mercado Pago...' : 'Já paguei — Verificar Pagamento'}
                </button>

                {pixModal.ticketUrl && (
                  <a
                    href={pixModal.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  >
                    Abrir comprovante no Mercado Pago
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {pixModal.pixKey && (
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-500 dark:text-zinc-400 truncate">
                      Chave: <strong className="font-mono text-gray-900 dark:text-white">{pixModal.pixKey}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(pixModal.pixKey || '', 'Chave PIX')}
                      className="font-bold text-[#D4AF37] hover:underline shrink-0"
                    >
                      Copiar chave
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                  Abra o app do seu banco ou Mercado Pago, escolha <strong>PIX Copia e Cola</strong> ou leia o QR Code acima. Após pagar <strong>R$ {formatBRL(pixModal.amount)}</strong>, envie o comprovante no WhatsApp para liberação imediata.
                </p>

                {pixModal.supportWhatsapp && (
                  <a
                    href={`https://wa.me/${pixModal.supportWhatsapp}?text=${encodeURIComponent(
                      `Olá! Acabei de pagar o PIX de R$ ${formatBRL(pixModal.amount)} referente ao Plano ${pixModal.planName} (${pixModal.billingCycle === 'annual' ? 'Anual' : 'Mensal'}) da loja ${billing?.shop?.name || ''}. Código: ${pixModal.paymentId}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar Comprovante no WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mercado Pago App Payment Link Modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Pagamento via Mercado Pago
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                  Plano {linkModal.planName} (Mensal) ·{' '}
                  <strong className="text-gray-900 dark:text-white">R$ {formatBRL(linkModal.amount)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLinkModal(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
              Seu pedido foi registrado (código <strong className="font-mono">{linkModal.paymentId}</strong>). Clique abaixo para concluir no site/app oficial do Mercado Pago e depois envie o comprovante no WhatsApp para liberação.
            </p>

            <div className="space-y-2.5">
              <a
                href={linkModal.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ir para Mercado Pago (R$ {formatBRL(linkModal.amount)})
              </a>

              {billing?.supportWhatsapp && (
                <a
                  href={`https://wa.me/${billing.supportWhatsapp}?text=${encodeURIComponent(
                    `Olá! Acabei de pagar o Plano ${linkModal.planName} (R$ ${formatBRL(linkModal.amount)}) via Mercado Pago para a loja ${billing?.shop?.name || ''}. Código: ${linkModal.paymentId}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Já paguei — Enviar Comprovante no WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
