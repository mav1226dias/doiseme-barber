import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Copy,
  KeyRound,
  MessageSquare,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Unplug,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppIntegration {
  barbershop_id: string;
  instance_name: string;
  provider: string;
  connection_status: 'disconnected' | 'connecting' | 'connected';
  connected_phone: string | null;
  auto_confirm_enabled: boolean;
  reminder_24h_enabled: boolean;
  reminder_2h_enabled: boolean;
  auto_cancel_enabled: boolean;
  template_confirm: string;
  template_reminder_24h: string;
  template_reminder_2h: string;
  template_cancel: string;
}

interface WhatsAppLog {
  id: string;
  event_type: string;
  recipient_phone: string;
  recipient_name: string | null;
  message_text: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const TEMPLATE_VARIABLES = [
  '{cliente}',
  '{estabelecimento}',
  '{servico}',
  '{profissional}',
  '{data}',
  '{horario}'
];

const EVENT_LABELS: Record<string, string> = {
  confirmation: 'Confirmação',
  reminder_24h: 'Lembrete 24h',
  reminder_2h: 'Lembrete 2h',
  cancellation: 'Cancelamento',
  test: 'Teste Manual'
};

export default function WhatsAppAutomation() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [serverConfigured, setServerConfigured] = useState(false);
  const [serverReachable, setServerReachable] = useState(false);
  const [integration, setIntegration] = useState<WhatsAppIntegration | null>(null);
  const [defaultTemplates, setDefaultTemplates] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);

  // Connection UI state
  const [connectMode, setConnectMode] = useState<'pairing' | 'qr'>('pairing');
  const [pairingPhoneInput, setPairingPhoneInput] = useState('');
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  // Active template editor tab
  const [activeTemplateTab, setActiveTemplateTab] = useState<
    'template_confirm' | 'template_reminder_24h' | 'template_reminder_2h' | 'template_cancel'
  >('template_confirm');

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const fetchConfig = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/admin/whatsapp/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao carregar automações de WhatsApp');
        return;
      }
      setServerConfigured(Boolean(data.serverConfigured));
      setServerReachable(Boolean(data.serverReachable));
      setIntegration(data.integration);
      setDefaultTemplates(data.defaultTemplates || {});
      setLogs(data.logs || []);
      if (data.integration?.connection_status === 'connected') {
        setQrBase64(null);
        setPairingCode(null);
        stopPolling();
      }
    } catch {
      toast.error('Erro de rede ao carregar automações de WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    return () => stopPolling();
  }, []);

  const startPollingStatus = () => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/admin/whatsapp/status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.connectionStatus === 'connected') {
          setIntegration((prev) =>
            prev
              ? {
                  ...prev,
                  connection_status: 'connected',
                  connected_phone: data.connectedPhone ?? prev.connected_phone
                }
              : prev
          );
          setQrBase64(null);
          setPairingCode(null);
          stopPolling();
          toast.success('WhatsApp conectado com sucesso!');
        }
      } catch {
        // Ignore transient polling failures
      }
    }, 4000);
  };

  const handleConnect = async () => {
    if (connectMode === 'pairing') {
      const digits = pairingPhoneInput.replace(/\D/g, '');
      if (digits.length < 10) {
        toast.error('Digite o WhatsApp da loja com DDD (ex: 11999998888).');
        return;
      }
    }

    const token = localStorage.getItem('token');
    setConnecting(true);
    try {
      const res = await fetch('/api/admin/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          phoneNumber: connectMode === 'pairing' ? pairingPhoneInput : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível iniciar a conexão.');
        return;
      }

      if (data.connectionStatus === 'connected') {
        setQrBase64(null);
        setPairingCode(null);
        setIntegration((prev) =>
          prev
            ? {
                ...prev,
                connection_status: 'connected',
                connected_phone: data.connectedPhone ?? prev.connected_phone
              }
            : prev
        );
        toast.success('Este WhatsApp já está conectado!');
        return;
      }

      setQrBase64(data.qrBase64 || null);
      setPairingCode(data.pairingCode || null);
      setIntegration((prev) => (prev ? { ...prev, connection_status: 'connecting' } : prev));
      startPollingStatus();

      if (data.pairingCode) {
        toast.success('Código gerado! Insira no WhatsApp em Dispositivos Conectados.');
      } else if (data.qrBase64) {
        toast.success('QR Code gerado! Escaneie com seu WhatsApp.');
      }
    } catch {
      toast.error('Erro de conexão ao gerar pareamento');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const token = localStorage.getItem('token');
    setDisconnecting(true);
    try {
      const res = await fetch('/api/admin/whatsapp/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        toast.error('Erro ao desconectar WhatsApp');
        return;
      }
      stopPolling();
      setQrBase64(null);
      setPairingCode(null);
      setIntegration((prev) =>
        prev ? { ...prev, connection_status: 'disconnected', connected_phone: null } : prev
      );
      toast.success('WhatsApp desconectado.');
    } catch {
      toast.error('Erro de rede ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integration) return;
    const token = localStorage.getItem('token');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/whatsapp/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          auto_confirm_enabled: integration.auto_confirm_enabled,
          reminder_24h_enabled: integration.reminder_24h_enabled,
          reminder_2h_enabled: integration.reminder_2h_enabled,
          auto_cancel_enabled: integration.auto_cancel_enabled,
          template_confirm: integration.template_confirm,
          template_reminder_24h: integration.template_reminder_24h,
          template_reminder_2h: integration.template_reminder_2h,
          template_cancel: integration.template_cancel
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar automações');
        return;
      }
      setIntegration(data.integration);
      toast.success('Regras e modelos de mensagens salvos!');
    } catch {
      toast.error('Erro de rede ao salvar automações');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = testPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Informe um WhatsApp válido com DDD para o teste.');
      return;
    }

    const token = localStorage.getItem('token');
    setSendingTest(true);
    try {
      const res = await fetch('/api/admin/whatsapp/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone: cleanPhone, message: testMessage.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Não foi possível enviar a mensagem de teste.');
      } else {
        toast.success('Mensagem de teste enviada pelo WhatsApp!');
      }
      await fetchConfig();
    } catch {
      toast.error('Erro de rede ao enviar teste');
    } finally {
      setSendingTest(false);
    }
  };

  const handleCopyPairingCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      toast.success('Código copiado!');
    } catch {
      toast.error('Não foi possível copiar o código.');
    }
  };

  const insertVariable = (variable: string) => {
    if (!integration) return;
    setIntegration({
      ...integration,
      [activeTemplateTab]: `${integration[activeTemplateTab]}${integration[activeTemplateTab].endsWith(' ') || integration[activeTemplateTab] === '' ? '' : ' '}${variable}`
    });
  };

  const restoreDefaultTemplate = () => {
    if (!integration || !defaultTemplates[activeTemplateTab]) return;
    setIntegration({
      ...integration,
      [activeTemplateTab]: defaultTemplates[activeTemplateTab]
    });
    toast.success('Modelo padrão restaurado (lembre-se de salvar).');
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-9 w-72 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        <div className="h-44 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800" />
        <div className="h-80 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800" />
      </div>
    );
  }

  const isConnected = integration?.connection_status === 'connected';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-serif">
            WhatsApp &amp; Automação
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Envie confirmações imediatas, lembretes automáticos (24h e 2h antes) e avisos de cancelamento direto no WhatsApp dos clientes.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchConfig}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors self-start"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar Status
        </button>
      </div>

      {/* VPS / Evolution Status Banner */}
      {!serverConfigured && (
        <div className="rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-bold text-gray-900 dark:text-gray-100">
              Servidor Evolution API aguardando ativação na VPS
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Toda a estrutura do robô já está pronta no DoisemePRO. Você já pode ativar os gatilhos e personalizar suas mensagens abaixo — assim que a URL e a API Key da VPS (Evolution API v2) forem informadas no <strong>Painel Master</strong> ou nas variáveis de ambiente, o pareamento por celular ou QR Code será liberado automaticamente.
            </p>
          </div>
        </div>
      )}

      {serverConfigured && !serverReachable && (
        <div className="rounded-2xl border border-red-300/60 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 p-4 flex items-center gap-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>O servidor Evolution API configurado não respondeu no momento. Verifique se a VPS está ligada.</span>
        </div>
      )}

      {/* Connection Card (Pairing Code for Mobile + QR Code) */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Conexão do WhatsApp
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                Instância: <span className="font-mono">{integration?.instance_name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Conectado {integration?.connected_phone ? `(+${integration.connected_phone})` : ''}
              </span>
            ) : integration?.connection_status === 'connecting' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" /> Aguardando pareamento
              </span>
            ) : (
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Desconectado
              </span>
            )}

            {isConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
              >
                <Unplug className="w-3.5 h-3.5" />
                {disconnecting ? 'Saindo...' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>

        {!isConnected && (
          <div className="border-t border-gray-100 dark:border-zinc-800 pt-5 space-y-4">
            <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setConnectMode('pairing')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  connectMode === 'pairing'
                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Código no Celular (8 dígitos)
              </button>
              <button
                type="button"
                onClick={() => setConnectMode('qr')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  connectMode === 'qr'
                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" /> QR Code (PC / 2º Aparelho)
              </button>
            </div>

            {connectMode === 'pairing' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    WhatsApp que vai enviar as mensagens (com DDD)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="tel"
                      value={pairingPhoneInput}
                      onChange={(e) => setPairingPhoneInput(e.target.value)}
                      placeholder="Ex: 11999998888"
                      className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting || !serverConfigured}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
                    >
                      <KeyRound className="w-4 h-4" />
                      {connecting ? 'Gerando...' : 'Gerar Código'}
                    </button>
                  </div>
                  <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-decimal list-inside pt-1">
                    <li>Abra o <strong>WhatsApp</strong> neste mesmo celular.</li>
                    <li>Vá em <strong>Dispositivos conectados → Conectar dispositivo</strong>.</li>
                    <li>Toque em <strong>"Conectar com número de telefone"</strong> no rodapé e digite o código gerado.</li>
                  </ol>
                </div>

                {pairingCode && (
                  <div className="p-5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 flex flex-col items-center justify-center text-center space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      Seu Código de Pareamento
                    </span>
                    <div className="text-3xl font-mono font-extrabold tracking-[0.2em] text-gray-900 dark:text-white tabular-nums">
                      {pairingCode}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPairingCode}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Código
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || !serverConfigured}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <QrCode className="w-4 h-4" />
                  {connecting ? 'Gerando QR Code...' : 'Gerar QR Code'}
                </button>

                {qrBase64 && (
                  <div className="p-3 bg-white rounded-2xl border border-gray-200 inline-flex flex-col items-center gap-2">
                    <img
                      src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                      alt="QR Code WhatsApp"
                      className="w-48 h-48 object-contain"
                    />
                    <span className="text-[11px] font-medium text-gray-500">
                      Escaneie em WhatsApp → Dispositivos conectados
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rules & Message Templates */}
      {integration && (
        <form
          onSubmit={handleSaveRules}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Gatilhos Automáticos &amp; Mensagens
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Escolha quando o robô envia mensagens sozinho e personalize o texto para o tom da sua marca.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-black dark:bg-[#D4AF37] text-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50 self-start sm:self-auto"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Regras e Mensagens'}
            </button>
          </div>

          {/* 4 Switches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                key: 'auto_confirm_enabled' as const,
                title: 'Confirmação Imediata',
                desc: 'Envia assim que o cliente finaliza um agendamento pelo seu link público.'
              },
              {
                key: 'reminder_24h_enabled' as const,
                title: 'Lembrete 24h Antes',
                desc: 'Avisa no dia anterior reduzindo drasticamente esquecimentos e faltas.'
              },
              {
                key: 'reminder_2h_enabled' as const,
                title: 'Lembrete 2h Antes',
                desc: 'Reforço automático cerca de 2 horas antes do horário marcado.'
              },
              {
                key: 'auto_cancel_enabled' as const,
                title: 'Aviso de Cancelamento',
                desc: 'Notifica automaticamente o cliente se um horário for cancelado na Agenda.'
              }
            ].map((item) => {
              const checked = integration[item.key];
              return (
                <label
                  key={item.key}
                  className={`flex items-start justify-between gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    checked
                      ? 'border-[#D4AF37]/60 bg-[#D4AF37]/5'
                      : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {item.title}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setIntegration({ ...integration, [item.key]: e.target.checked })
                    }
                    className="mt-0.5 h-5 w-5 accent-[#D4AF37] rounded cursor-pointer shrink-0"
                  />
                </label>
              );
            })}
          </div>

          {/* Template Tabs & Editor */}
          <div className="border-t border-gray-100 dark:border-zinc-800 pt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['template_confirm', 'Confirmação'],
                    ['template_reminder_24h', 'Lembrete 24h'],
                    ['template_reminder_2h', 'Lembrete 2h'],
                    ['template_cancel', 'Cancelamento']
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTemplateTab(key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      activeTemplateTab === key
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white'
                        : 'bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={restoreDefaultTemplate}
                className="text-xs font-semibold text-[#D4AF37] hover:underline"
              >
                Restaurar texto padrão
              </button>
            </div>

            <textarea
              rows={5}
              value={integration[activeTemplateTab]}
              onChange={(e) =>
                setIntegration({ ...integration, [activeTemplateTab]: e.target.value })
              }
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-[#D4AF37] font-sans leading-relaxed"
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Inserir variável:
              </span>
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-mono text-gray-700 dark:text-gray-200 hover:border-[#D4AF37] transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* Test Send + Recent Dispatch History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSendTest}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 space-y-4 lg:col-span-1"
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Enviar Teste Manual
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Envie uma mensagem real para o seu próprio número para validar a conexão.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Número de Destino (com DDD)
            </label>
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Ex: 11999998888"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-mono outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Mensagem (opcional)
            </label>
            <textarea
              rows={3}
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Se vazio, envia mensagem padrão de validação."
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
            />
          </div>
          <button
            type="submit"
            disabled={sendingTest || !serverConfigured || !isConnected}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-black hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sendingTest ? 'Enviando...' : 'Disparar Teste'}
          </button>
        </form>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 space-y-4 lg:col-span-2">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Histórico Recente de Disparos ({logs.length})
          </h3>

          {logs.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum disparo registrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-800/60 text-gray-500 uppercase border-b border-gray-100 dark:border-zinc-800">
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Evento</th>
                    <th className="p-3">Destinatário</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="p-3 tabular-nums text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {EVENT_LABELS[log.event_type] || log.event_type}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">
                        <div className="font-medium">{log.recipient_name || 'Cliente'}</div>
                        <div className="font-mono text-[11px] text-gray-400">{log.recipient_phone}</div>
                      </td>
                      <td className="p-3">
                        {log.status === 'sent' ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            Enviado
                          </span>
                        ) : (
                          <div>
                            <span className="font-bold text-red-500">Falhou</span>
                            {log.error_message && (
                              <div className="text-[11px] text-gray-400 max-w-[200px] truncate" title={log.error_message}>
                                {log.error_message}
                              </div>
                            )}
                          </div>
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
    </div>
  );
}
