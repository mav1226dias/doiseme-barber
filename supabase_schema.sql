-- Create tables for Doiseme Barber Shop (Robust Version)

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Tables with "IF NOT EXISTS"
CREATE TABLE IF NOT EXISTS barbershops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  instagram TEXT,
  whatsapp TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#ffffff',
  maps_url TEXT,
  show_whatsapp BOOLEAN DEFAULT TRUE,
  show_instagram BOOLEAN DEFAULT TRUE,
  show_address BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'barber',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barbers (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  barber_id TEXT NOT NULL REFERENCES barbers(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  client_id TEXT REFERENCES clients(id),
  customer_name TEXT,
  customer_phone TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_settings (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id) UNIQUE,
  config JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finances (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  type TEXT NOT NULL, -- income, expense
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  barber_id TEXT REFERENCES barbers(id), -- Add barber_id to finances
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_packages (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  client_name TEXT NOT NULL,
  client_whatsapp TEXT NOT NULL,
  package_name TEXT NOT NULL,
  total_quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Seed Initial Shop (Using ON CONFLICT to avoid errors)
INSERT INTO barbershops (id, name, slug) 
VALUES ('shop-1', 'Doiseme System', 'doiseme')
ON CONFLICT (id) DO NOTHING;

-- 4. Nota de Segurança sobre Contas Master:
-- Crie usuários Master iniciais pela aplicação ou via bcrypt seguro no painel SQL,
-- nunca com senhas padrão fixas no repositório.

-- 5. Enable Row Level Security (RLS) by default on ALL tables
-- Com RLS ativado e sem políticas permissivas para `anon`, apenas o backend
-- (usando SUPABASE_SERVICE_ROLE_KEY) pode ler/gravar dados diretamente no banco.
ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_packages ENABLE ROW LEVEL SECURITY;

-- 6. Storage Configuration (Run this in Supabase SQL Editor)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('barbearias-assets', 'barbearias-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública apenas para imagens já enviadas pelo backend
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'barbearias-assets');

-- Bloqueia uploads/alterações/exclusões anônimas diretas (apenas backend service_role)
DROP POLICY IF EXISTS "Admin Insert" ON storage.objects;
CREATE POLICY "Service Role Insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'barbearias-assets' AND auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Admin Update" ON storage.objects;
CREATE POLICY "Service Role Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'barbearias-assets' AND auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
CREATE POLICY "Service Role Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'barbearias-assets' AND auth.role() = 'service_role'
  );
