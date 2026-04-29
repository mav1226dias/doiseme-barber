import { createClient } from '@supabase/supabase-js';

// Robust way to get environment variables in both Node and Browser
const getEnv = (key: string) => {
  let value = undefined;
  if (typeof process !== 'undefined' && process.env?.[key]) value = process.env[key];
  // @ts-ignore - import.meta.env is a Vite thing
  else if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) value = import.meta.env[key];
  
  // Remove quotes if present (common issue with copied vars)
  if (value && typeof value === 'string') {
    return value.replace(/^["'](.+)["']$/, '$1').trim();
  }
  return value;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://omirtjuxuornolywneak.supabase.co';
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_-7JstKYe52SoEA59qlELMA_dZf-w5V5';

if (typeof process !== 'undefined' && (!getEnv('VITE_SUPABASE_URL') || !getEnv('VITE_SUPABASE_ANON_KEY'))) {
  console.warn('[Supabase] Credenciais não encontradas no ambiente. Usando fallback.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
