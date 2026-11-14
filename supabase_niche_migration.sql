-- ============================================================================
-- DoisemePRO - Migração Completa para Nuvem (Parte 1)
-- Execute este script no SQL Editor do seu painel Supabase
-- ============================================================================

-- 1. Garantir colunas extras nas tabelas principais
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'barbershop';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'barbershop';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS booking_layout TEXT;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#ffffff';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#0a0a0a';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'trial';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE barbers ADD COLUMN IF NOT EXISTS service_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS commission_percentage REAL DEFAULT 50;
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS barber_id TEXT;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Notas Clínicas / Psicologia e Prontuários
CREATE TABLE IF NOT EXISTS client_clinical_notes (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  author_name TEXT,
  session_date TEXT NOT NULL,
  session_time TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  patient_mood TEXT,
  therapeutic_goals TEXT,
  techniques_used TEXT,
  is_private INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_client
ON client_clinical_notes (barbershop_id, client_id, session_date DESC);

-- 3. Anamnese Psicológica / Clínica
CREATE TABLE IF NOT EXISTS patient_anamnesis (
  client_id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  chief_complaint TEXT,
  history_of_problem TEXT,
  family_medical_history TEXT,
  current_medications TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_anamnesis_shop
ON patient_anamnesis (barbershop_id, client_id);

-- 4. Anamnese Estética
CREATE TABLE IF NOT EXISTS aesthetics_anamnesis (
  client_id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  skin_phototype TEXT,
  skin_type TEXT,
  allergies TEXT,
  contraindications TEXT,
  main_complaints TEXT,
  home_care_routine TEXT,
  treatment_plan TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aesthetics_anamnesis_shop
ON aesthetics_anamnesis (barbershop_id, client_id);

-- 5. Fotos Antes & Depois (Estética)
CREATE TABLE IF NOT EXISTS aesthetics_photos (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  procedure_name TEXT NOT NULL,
  date TEXT NOT NULL,
  before_photo_url TEXT,
  after_photo_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aesthetics_photos_client
ON aesthetics_photos (barbershop_id, client_id, date DESC);

-- 6. Retornos & Retoques (Estética / Lash)
CREATE TABLE IF NOT EXISTS aesthetics_touchups (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  procedure_name TEXT NOT NULL,
  performed_date TEXT NOT NULL,
  return_due_date TEXT NOT NULL,
  interval_days INTEGER DEFAULT 15,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aesthetics_touchups_client
ON aesthetics_touchups (barbershop_id, client_id, return_due_date ASC);

-- 7. Pet Shop & Banho e Tosa
CREATE TABLE IF NOT EXISTS client_pets (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  pet_name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'Cão',
  breed TEXT,
  size TEXT,
  coat_type TEXT,
  birth_year TEXT,
  temperament TEXT,
  allergies_medical TEXT,
  special_instructions TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_pets_client
ON client_pets (barbershop_id, client_id);

-- 8. Oficina & Estética Automotiva
CREATE TABLE IF NOT EXISTS client_vehicles (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  plate TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year TEXT,
  color TEXT,
  current_km INTEGER,
  next_oil_change_km INTEGER,
  fuel_level TEXT,
  pre_existing_damages TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_vehicles_client
ON client_vehicles (barbershop_id, client_id);

-- 9. Barbearia & Salão (Preferências e Coloração)
CREATE TABLE IF NOT EXISTS client_style_preferences (
  client_id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  hair_cut_style TEXT,
  beard_style TEXT,
  blade_sizes TEXT,
  hair_color_formula TEXT,
  shampoo_preference TEXT,
  aftershave_allergies TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_style_prefs_shop
ON client_style_preferences (barbershop_id, client_id);

-- 10. Personal Trainer, Pilates & Nutrição (Avaliações Físicas)
CREATE TABLE IF NOT EXISTS client_fitness_assessments (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  assessment_date TEXT NOT NULL,
  weight_kg REAL,
  height_cm REAL,
  body_fat_pct REAL,
  muscle_mass_kg REAL,
  chest_cm REAL,
  waist_cm REAL,
  abdomen_cm REAL,
  hips_cm REAL,
  arms_cm REAL,
  thighs_cm REAL,
  physical_restrictions TEXT,
  training_goal TEXT,
  workout_prescription TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fitness_assessments_client
ON client_fitness_assessments (barbershop_id, client_id, assessment_date DESC);

-- 11. Tattoo & Piercing (Biossegurança & Cuidados)
CREATE TABLE IF NOT EXISTS client_tattoo_records (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  title TEXT NOT NULL,
  placement TEXT NOT NULL,
  style TEXT,
  needle_batch TEXT,
  ink_batch TEXT,
  session_date TEXT NOT NULL,
  healing_stage TEXT DEFAULT 'Recente',
  consent_signed INTEGER DEFAULT 1,
  aftercare_instructions TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tattoo_records_client
ON client_tattoo_records (barbershop_id, client_id, session_date DESC);

-- 11b. Projetos Criativos, Marcenaria, Arquitetura, Fotografia & Audiovisual
CREATE TABLE IF NOT EXISTS client_creative_projects (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  segment_type TEXT NOT NULL,
  project_title TEXT NOT NULL,
  category_or_style TEXT,
  location_or_room TEXT,
  dimensions_or_scope TEXT,
  materials_or_specs TEXT,
  status TEXT DEFAULT 'Briefing / Orçamento',
  delivery_date TEXT,
  deliverable_link TEXT,
  estimated_value REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creative_projects_client
ON client_creative_projects (barbershop_id, client_id, created_at DESC);

-- 11c. Observações / Briefing de Agendamentos
CREATE TABLE IF NOT EXISTS appointment_notes (
  appointment_id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  notes TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointment_notes_shop
ON appointment_notes (barbershop_id);

-- 12. Fotos de Profissionais e Serviços/Procedimentos
CREATE TABLE IF NOT EXISTS entity_photos (
  entity_id TEXT PRIMARY KEY,
  barbershop_id TEXT,
  entity_type TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_photos_type
ON entity_photos (entity_type, barbershop_id);

-- 13. Metadados de Profissionais (Comissões e Configurações Extras)
CREATE TABLE IF NOT EXISTS barber_metadata (
  barber_id TEXT PRIMARY KEY,
  barbershop_id TEXT,
  commission_percentage REAL DEFAULT 50,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_barber_meta_shop
ON barber_metadata (barbershop_id);

-- 13a. Vínculo de Login Individual por Profissional (Multi-Usuários)
CREATE TABLE IF NOT EXISTS barber_accounts (
  barber_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  barbershop_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_barber_accounts_user
ON barber_accounts (user_id);

CREATE INDEX IF NOT EXISTS idx_barber_accounts_shop
ON barber_accounts (barbershop_id);

-- 13b. Tokens de Recuperação de Senha
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS updated_at TEXT;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_hash
ON password_reset_tokens (token_hash);

-- 13c. Configurações Globais da Plataforma (WhatsApp de Suporte, etc.)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 13d. Pagamentos e Assinaturas SaaS (Mercado Pago / PIX)
CREATE TABLE IF NOT EXISTS saas_payments (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount REAL NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  payment_method TEXT NOT NULL DEFAULT 'mercadopago',
  external_reference TEXT NOT NULL,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  days_added INTEGER NOT NULL DEFAULT 30,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_payments_shop
ON saas_payments (barbershop_id, created_at DESC);

-- 13e. Automação de WhatsApp por Loja (Parte 6 - Evolution API)
CREATE TABLE IF NOT EXISTS whatsapp_integrations (
  barbershop_id TEXT PRIMARY KEY,
  instance_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'evolution',
  connection_status TEXT NOT NULL DEFAULT 'disconnected',
  connected_phone TEXT,
  auto_confirm_enabled INTEGER DEFAULT 0,
  reminder_24h_enabled INTEGER DEFAULT 0,
  reminder_2h_enabled INTEGER DEFAULT 0,
  auto_cancel_enabled INTEGER DEFAULT 0,
  template_confirm TEXT NOT NULL,
  template_reminder_24h TEXT NOT NULL,
  template_reminder_2h TEXT NOT NULL,
  template_cancel TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL,
  appointment_id TEXT,
  event_type TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  provider_message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_shop
ON whatsapp_logs (barbershop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_appt_event
ON whatsapp_logs (appointment_id, event_type, status);

-- 14. Garantir Bucket de Storage para Imagens (Logos, Banners, Fotos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('barbearias-assets', 'barbearias-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage (idempotentes)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'barbearias-assets');

DROP POLICY IF EXISTS "Admin Insert" ON storage.objects;
CREATE POLICY "Admin Insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'barbearias-assets');

DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
CREATE POLICY "Admin Update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'barbearias-assets');

DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Admin Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'barbearias-assets');

-- ============================================================================
-- SEGURANÇA / RLS (Opcional - Recomendado quando SUPABASE_SERVICE_ROLE_KEY
-- estiver configurada no servidor Backend!):
--
-- ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE services ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE finances ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_clinical_notes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE patient_anamnesis ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE aesthetics_anamnesis ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE aesthetics_photos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE aesthetics_touchups ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_pets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_vehicles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_style_preferences ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_fitness_assessments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_tattoo_records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE entity_photos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE barber_metadata ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE barber_accounts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE saas_payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE whatsapp_integrations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;
-- ============================================================================
