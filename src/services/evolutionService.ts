import { cloudNicheDb } from '../db/cloudNicheDb.js';

export interface EvolutionServerConfig {
  apiUrl: string;
  apiKey: string;
  source: 'database' | 'env' | 'none';
}

export interface WhatsAppTemplateVars {
  cliente?: string;
  estabelecimento?: string;
  servico?: string;
  profissional?: string;
  data?: string;
  horario?: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES = {
  template_confirm:
    'Olá, {cliente}! Seu agendamento em *{estabelecimento}* está confirmado ✅\n\n📅 Data: {data}\n⏰ Horário: {horario}\n✨ Serviço: {servico}\n👤 Profissional: {profissional}\n\nTe esperamos!',
  template_reminder_24h:
    'Olá, {cliente}! Lembrete do seu horário amanhã em *{estabelecimento}* 📅\n\n• Serviço: {servico}\n• Data: {data} às {horario}\n• Profissional: {profissional}\n\nSe precisar remarcar, avise com antecedência!',
  template_reminder_2h:
    'Oi, {cliente}! Faltam cerca de *2 horas* para o seu atendimento em *{estabelecimento}* ⏰\n\n🗓️ Hoje às {horario}\n✨ {servico} com {profissional}\n\nAté já!',
  template_cancel:
    'Olá, {cliente}. Informamos que o seu agendamento em *{estabelecimento}* para o dia {data} às {horario} ({servico}) foi cancelado.\n\nCaso deseje escolher um novo horário, acesse nossa agenda online.'
};

export function buildInstanceName(slug: string | undefined | null, shopId: string): string {
  const safeSlug = String(slug || 'loja')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 14) || 'loja';
  const shortId = String(shopId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'shop';
  return `doiseme_${safeSlug}_${shortId}`;
}

export function normalizeWhatsAppNumber(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function formatBrDate(isoDate: string): string {
  const parts = String(isoDate || '').split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function renderWhatsAppTemplate(template: string, vars: WhatsAppTemplateVars): string {
  const map: Record<string, string> = {
    '{cliente}': vars.cliente || 'Cliente',
    '{estabelecimento}': vars.estabelecimento || 'Estabelecimento',
    '{servico}': vars.servico || 'Atendimento',
    '{profissional}': vars.profissional || 'Equipe',
    '{data}': vars.data || '',
    '{horario}': vars.horario || ''
  };
  let text = String(template || '');
  for (const [token, val] of Object.entries(map)) {
    text = text.split(token).join(val);
  }
  return text;
}

export async function resolveEvolutionConfig(): Promise<EvolutionServerConfig> {
  try {
    const [dbUrl, dbKey] = await Promise.all([
      cloudNicheDb.getPlatformSetting('evolution_api_url'),
      cloudNicheDb.getPlatformSetting('evolution_api_key')
    ]);

    const cleanDbUrl = String(dbUrl || '').trim().replace(/\/+$/, '');
    const cleanDbKey = String(dbKey || '').trim();
    if (cleanDbUrl && cleanDbKey) {
      return { apiUrl: cleanDbUrl, apiKey: cleanDbKey, source: 'database' };
    }
  } catch (err) {
    console.warn('[EVOLUTION_CONFIG_RESOLVE_WARN]', (err as any)?.message || err);
  }

  const envUrl = String(process.env.EVOLUTION_API_URL || '').trim().replace(/\/+$/, '');
  const envKey = String(process.env.EVOLUTION_API_KEY || '').trim();
  if (envUrl && envKey) {
    return { apiUrl: envUrl, apiKey: envKey, source: 'env' };
  }

  return { apiUrl: '', apiKey: '', source: 'none' };
}

export async function resolveCronSecret(): Promise<string> {
  try {
    const dbSecret = await cloudNicheDb.getPlatformSetting('cron_secret');
    if (dbSecret && dbSecret.trim()) return dbSecret.trim();
  } catch {
    // ignore
  }
  return String(process.env.CRON_SECRET || '').trim();
}

async function evolutionFetch(
  config: EvolutionServerConfig,
  path: string,
  options: RequestInit = {},
  timeoutMs = 12000
): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${config.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
        ...(options.headers || {})
      }
    });
    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, rawText };
  } finally {
    clearTimeout(timer);
  }
}

export async function testEvolutionServer(config: EvolutionServerConfig): Promise<{ ok: boolean; message: string; instancesCount?: number }> {
  if (!config.apiUrl || !config.apiKey) {
    return { ok: false, message: 'URL ou API Key da Evolution API não configurada.' };
  }
  try {
    const res = await evolutionFetch(config, '/instance/fetchInstances', { method: 'GET' }, 8000);
    if (!res.ok) {
      return {
        ok: false,
        message: res.data?.message || res.data?.error || `Servidor respondeu HTTP ${res.status}`
      };
    }
    const count = Array.isArray(res.data) ? res.data.length : 0;
    return { ok: true, message: 'Servidor Evolution API online e autenticado.', instancesCount: count };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.name === 'AbortError' ? 'Tempo esgotado ao tentar conectar na VPS.' : (err?.message || 'Erro de rede ao acessar Evolution API.')
    };
  }
}

export async function connectEvolutionInstance(
  config: EvolutionServerConfig,
  instanceName: string,
  pairingPhone?: string
): Promise<{
  ok: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  qrBase64: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  error?: string;
}> {
  const normalizedPhone = pairingPhone ? normalizeWhatsAppNumber(pairingPhone) : '';

  // 1. Check current connection state first
  const currentState = await getEvolutionConnectionState(config, instanceName);
  if (currentState.connectionStatus === 'connected') {
    return {
      ok: true,
      connectionStatus: 'connected',
      qrBase64: null,
      pairingCode: null,
      connectedPhone: currentState.connectedPhone
    };
  }

  // 2. Ensure instance exists in Evolution API v2
  const createPayload: Record<string, any> = {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: !normalizedPhone
  };
  if (normalizedPhone) {
    createPayload.number = normalizedPhone;
  }

  const createRes = await evolutionFetch(config, '/instance/create', {
    method: 'POST',
    body: JSON.stringify(createPayload)
  });

  // 3. Extract immediate QR / pairing if returned on create, otherwise request /instance/connect
  let qrBase64: string | null = extractQrBase64(createRes.data);
  let pairingCode: string | null = extractPairingCode(createRes.data);

  if (!qrBase64 && !pairingCode) {
    const connectQuery = normalizedPhone ? `?number=${encodeURIComponent(normalizedPhone)}` : '';
    const connectRes = await evolutionFetch(
      config,
      `/instance/connect/${encodeURIComponent(instanceName)}${connectQuery}`,
      { method: 'GET' }
    );

    if (!connectRes.ok && !createRes.ok) {
      return {
        ok: false,
        connectionStatus: 'disconnected',
        qrBase64: null,
        pairingCode: null,
        connectedPhone: null,
        error: connectRes.data?.message || createRes.data?.message || `Evolution API retornou erro HTTP ${connectRes.status}`
      };
    }

    qrBase64 = extractQrBase64(connectRes.data);
    pairingCode = extractPairingCode(connectRes.data);
  }

  return {
    ok: true,
    connectionStatus: 'connecting',
    qrBase64,
    pairingCode,
    connectedPhone: null
  };
}

export async function getEvolutionConnectionState(
  config: EvolutionServerConfig,
  instanceName: string
): Promise<{
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  connectedPhone: string | null;
  reachable: boolean;
}> {
  try {
    const res = await evolutionFetch(
      config,
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
      { method: 'GET' },
      7000
    );

    if (!res.ok) {
      return { connectionStatus: 'disconnected', connectedPhone: null, reachable: res.status !== 502 && res.status !== 504 };
    }

    const rawState = String(
      res.data?.instance?.state || res.data?.state || res.data?.connectionStatus || ''
    ).toLowerCase();

    if (rawState === 'open' || rawState === 'connected') {
      let connectedPhone: string | null = null;
      try {
        const listRes = await evolutionFetch(
          config,
          `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
          { method: 'GET' },
          5000
        );
        if (listRes.ok && Array.isArray(listRes.data) && listRes.data.length > 0) {
          const item = listRes.data[0];
          const jid = item?.ownerJid || item?.instance?.owner || item?.number || '';
          const phoneDigits = String(jid).split('@')[0].replace(/\D/g, '');
          if (phoneDigits) connectedPhone = phoneDigits;
        }
      } catch {
        // Optional phone lookup
      }
      return { connectionStatus: 'connected', connectedPhone, reachable: true };
    }

    if (rawState === 'connecting') {
      return { connectionStatus: 'connecting', connectedPhone: null, reachable: true };
    }

    return { connectionStatus: 'disconnected', connectedPhone: null, reachable: true };
  } catch {
    return { connectionStatus: 'disconnected', connectedPhone: null, reachable: false };
  }
}

export async function logoutEvolutionInstance(config: EvolutionServerConfig, instanceName: string): Promise<void> {
  try {
    await evolutionFetch(
      config,
      `/instance/logout/${encodeURIComponent(instanceName)}`,
      { method: 'DELETE' },
      8000
    );
  } catch (err) {
    console.warn('[EVOLUTION_LOGOUT_WARN]', (err as any)?.message || err);
  }
}

export async function sendEvolutionTextMessage(
  config: EvolutionServerConfig,
  instanceName: string,
  recipientPhone: string,
  text: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const normalized = normalizeWhatsAppNumber(recipientPhone);
  if (!normalized || normalized.length < 10) {
    return { ok: false, error: 'Número de WhatsApp inválido para envio.' };
  }

  try {
    const res = await evolutionFetch(
      config,
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          number: normalized,
          text,
          delay: 1000
        })
      },
      10000
    );

    if (!res.ok) {
      const errMsg = res.data?.response?.message?.[0] || res.data?.message || res.data?.error || `HTTP ${res.status}`;
      return { ok: false, error: String(errMsg) };
    }

    const messageId = res.data?.key?.id || res.data?.messageId || res.data?.id || undefined;
    return { ok: true, messageId };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.name === 'AbortError' ? 'Timeout ao enviar mensagem pela Evolution API.' : (err?.message || 'Erro de conexão com Evolution API.')
    };
  }
}

function extractQrBase64(data: any): string | null {
  if (!data) return null;
  const candidate =
    data?.qrcode?.base64 ||
    data?.base64 ||
    (typeof data?.qrcode === 'string' && data.qrcode.startsWith('data:image') ? data.qrcode : null);
  return candidate ? String(candidate) : null;
}

function extractPairingCode(data: any): string | null {
  if (!data) return null;
  const candidate = data?.pairingCode || data?.qrcode?.pairingCode || null;
  return candidate ? String(candidate) : null;
}
