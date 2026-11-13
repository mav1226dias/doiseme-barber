import { createClient } from '@supabase/supabase-js';

const cleanEnv = (value?: string) => {
  if (!value || typeof value !== 'string') return undefined;
  return value.replace(/^["'](.+)["']$/, '$1').trim();
};

const normalizeSupabaseUrl = (value?: string) => {
  const cleaned = cleanEnv(value);
  if (!cleaned) return undefined;
  return cleaned
    .replace(/\/(rest|auth|storage|realtime|functions)\/v1(\/.*)?$/i, '')
    .replace(/\/+$/, '');
};

const supabaseUrl =
  normalizeSupabaseUrl(process.env.SUPABASE_URL) ||
  normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL) ||
  'https://omirtjuxuornolywneak.supabase.co';

const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const anonKey =
  cleanEnv(process.env.SUPABASE_ANON_KEY) ||
  cleanEnv(process.env.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_-7JstKYe52SoEA59qlELMA_dZf-w5V5';

export const hasServiceRoleKey = Boolean(serviceRoleKey);

if (!serviceRoleKey) {
  console.warn(
    '[SECURITY] SUPABASE_SERVICE_ROLE_KEY não configurada. O backend está usando a chave pública ANON. Para ativar RLS completo em produção, configure SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
