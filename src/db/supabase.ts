import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://omirtjuxuornolywneak.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-7JstKYe52SoEA59qlELMA_dZf-w5V5';

export const supabase = createClient(supabaseUrl, supabaseKey);
