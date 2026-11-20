export type SessionRole = 'master' | 'admin' | 'barber';

export const AUTHORIZED_MASTER_EMAILS = [
  'marcusdoiseme@doiseme.com',
  'marcusdias2014mv@gmail.com',
  'admin@doiseme.com'
];

export interface SessionAuth {
  isAuthenticated: boolean;
  isExpired: boolean;
  role: SessionRole | null;
  email: string | null;
  barbershopId: string | null;
  barberId: string | null;
  isImpersonating: boolean;
  token: string | null;
}

const EMPTY_SESSION: SessionAuth = {
  isAuthenticated: false,
  isExpired: false,
  role: null,
  email: null,
  barbershopId: null,
  barberId: null,
  isImpersonating: false,
  token: null
};

export function clearSessionStorage() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (typeof sessionStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('doiseme_trial_modal_seen_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    }
  } catch {
    // ignore storage errors
  }
}

export function getSessionAuth(): SessionAuth {
  let token: string | null = null;
  try {
    token = localStorage.getItem('token');
  } catch {
    return EMPTY_SESSION;
  }

  if (!token || token === 'null' || token === 'undefined') {
    return EMPTY_SESSION;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      clearSessionStorage();
      return EMPTY_SESSION;
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      clearSessionStorage();
      return { ...EMPTY_SESSION, isExpired: true };
    }

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
    let role: SessionRole = 'admin';
    if (payload.role === 'barber') {
      role = 'barber';
    } else if (payload.role === 'master' && email && AUTHORIZED_MASTER_EMAILS.includes(email)) {
      role = 'master';
    }

    return {
      isAuthenticated: true,
      isExpired: false,
      role,
      email,
      barbershopId: payload.barbershopId ? String(payload.barbershopId) : null,
      barberId: payload.barberId ? String(payload.barberId) : null,
      isImpersonating: Boolean(payload.isImpersonating),
      token
    };
  } catch {
    clearSessionStorage();
    return EMPTY_SESSION;
  }
}

export function getHomePathForRole(role: SessionRole | null): string {
  if (role === 'barber') return '/admin/agenda';
  if (role === 'admin' || role === 'master') return '/admin';
  return '/admin/login';
}
