const REFERRAL_STORAGE_KEY = 'doiseme_referral_code';
const REFERRAL_EXPIRY_KEY = 'doiseme_referral_expires_at';
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days attribution window

export function normalizeReferralCode(raw?: string | null): string | null {
  if (!raw) return null;
  const clean = String(raw).trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,30}$/.test(clean)) return null;
  return clean;
}

export function saveReferralCode(raw?: string | null): string | null {
  const clean = normalizeReferralCode(raw);
  if (!clean) return null;
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, clean);
    localStorage.setItem(REFERRAL_EXPIRY_KEY, String(Date.now() + REFERRAL_TTL_MS));
  } catch {
    // Ignore storage restriction errors
  }
  return clean;
}

export function getActiveReferralCode(): string | null {
  try {
    const code = normalizeReferralCode(localStorage.getItem(REFERRAL_STORAGE_KEY));
    const expiresRaw = localStorage.getItem(REFERRAL_EXPIRY_KEY);
    if (!code) return null;
    if (expiresRaw) {
      const expiresAt = Number(expiresRaw);
      if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
        clearStoredReferralCode();
        return null;
      }
    }
    return code;
  } catch {
    return null;
  }
}

export function captureReferralFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search || '');
    const raw = params.get('ref') || params.get('indicacao') || params.get('parceiro');
    if (raw) {
      return saveReferralCode(raw);
    }
  } catch {
    // Ignore malformed query string
  }
  return getActiveReferralCode();
}

export function getReferralFromUrlSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search || '');
    const raw = params.get('ref') || params.get('indicacao') || params.get('parceiro');
    return normalizeReferralCode(raw);
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    localStorage.removeItem(REFERRAL_EXPIRY_KEY);
  } catch {
    // Ignore
  }
}

const VISITOR_ID_KEY = 'doiseme_visitor_id';

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    return '';
  }
}

export function trackAffiliateClick(rawCode?: string | null): void {
  const code = normalizeReferralCode(rawCode);
  if (!code) return;

  const sessionKey = `doiseme_click_tracked_${code}`;
  try {
    if (sessionStorage.getItem(sessionKey) === '1') {
      return;
    }
    sessionStorage.setItem(sessionKey, '1');
  } catch {
    // Proceed even if sessionStorage is restricted
  }

  const visitorId = getOrCreateVisitorId();
  fetch(`/api/public/affiliate/${encodeURIComponent(code)}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
    keepalive: true
  }).catch(() => {
    // Silently ignore non-fatal analytics failure
  });
}

export type SalesPlatformChannel = 'propria' | 'kiwify' | 'eduzz' | 'hotmart';

export function trackSalesChannelVisit(channel: SalesPlatformChannel): void {
  const sessionKey = `doiseme_sales_visit_${channel}`;
  try {
    if (sessionStorage.getItem(sessionKey) === '1') {
      return;
    }
    sessionStorage.setItem(sessionKey, '1');
  } catch {
    // Proceed even if sessionStorage is restricted
  }

  const visitorId = getOrCreateVisitorId();
  fetch('/api/public/sales-metrics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, eventType: 'visit', visitorId }),
    keepalive: true
  }).catch(() => {});
}

export function trackSalesChannelClick(channel: SalesPlatformChannel, planKey?: string): void {
  const visitorId = getOrCreateVisitorId();
  fetch('/api/public/sales-metrics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, eventType: 'click', visitorId, planKey }),
    keepalive: true
  }).catch(() => {});
}

