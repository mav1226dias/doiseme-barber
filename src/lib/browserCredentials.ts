export function saveRememberedEmail(scope: 'admin' | 'affiliate', email: string): void {
  try {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return;
    localStorage.setItem(`doiseme_remembered_email_${scope}`, clean);
  } catch {
    // Ignore storage blocked errors
  }
}

export function getRememberedEmail(scope: 'admin' | 'affiliate'): string {
  try {
    return localStorage.getItem(`doiseme_remembered_email_${scope}`) || '';
  } catch {
    return '';
  }
}

export function clearRememberedEmail(scope: 'admin' | 'affiliate'): void {
  try {
    localStorage.removeItem(`doiseme_remembered_email_${scope}`);
  } catch {
    // Ignore
  }
}

export function supportsPasswordCredentialApi(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      'credentials' in navigator &&
      typeof (window as any).PasswordCredential === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Triggers the browser's native encrypted Password Manager vault (Google Password Manager / Edge / Android)
 * without ever storing plaintext passwords in localStorage or cookies.
 */
export async function storeBrowserPasswordCredential(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<void> {
  try {
    if (!supportsPasswordCredentialApi()) return;
    const PasswordCredentialCtor = (window as any).PasswordCredential;
    const cred = new PasswordCredentialCtor({
      id: params.email.trim().toLowerCase(),
      password: params.password,
      name: params.name || params.email.trim().toLowerCase()
    });
    await navigator.credentials.store(cred);
  } catch {
    // Silently ignore if browser denies or user dismisses native save dialog
  }
}

export async function requestSavedBrowserCredential(): Promise<{ email: string; password: string } | null> {
  try {
    if (
      typeof window === 'undefined' ||
      !('credentials' in navigator) ||
      typeof navigator.credentials.get !== 'function'
    ) {
      return null;
    }
    const cred: any = await navigator.credentials.get({
      password: true,
      mediation: 'optional'
    } as any);
    if (cred && cred.type === 'password' && cred.id && cred.password) {
      return { email: String(cred.id), password: String(cred.password) };
    }
  } catch {
    // Ignore
  }
  return null;
}
