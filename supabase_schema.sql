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

-- 4. Seed Master Admins (Using ON CONFLICT to avoid errors)
-- Note: Replace with actual hashes if needed
INSERT INTO users (id, barbershop_id, name, email, password_hash, role) VALUES 
('user-admin', 'shop-1', 'Admin Doiseme', 'admin@doiseme.com', '$2b$10$f38aI2MhXl9gZkY1o7H7yeRk6fQWpJ5yC6nZz.rWJ.aKqjT9p6K.S', 'master'),
('user-marcus', 'shop-1', 'Marcus Doiseme', 'marcusdoiseme@doiseme.com', '$2b$10$eW8O8zH0/eQ4L1T5B3G/e.n0S/7o0h/V.y1WJ.O0Z0r2o6R.uU.mK', 'master'),
('user-marcus-gmail', 'shop-1', 'Marcus Dias', 'marcusdias2014mv@gmail.com', '$2b$10$f38aI2MhXl9gZkY1o7H7yeRk6fQWpJ5yC6nZz.rWJ.aKqjT9p6K.S', 'master')
ON CONFLICT (id) DO UPDATE SET role = 'master';

-- 5. Disable Row Level Security (RLS) for all tables
ALTER TABLE barbershops DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE barbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE finances DISABLE ROW LEVEL SECURITY;

-- 6. Storage Configuration (Run this in Supabase SQL Editor)
-- Criar o bucket para fotos da barbearia se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('barbearias-assets', 'barbearias-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Política: Permitir que qualquer pessoa veja as fotos (Public Access)
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'barbearias-assets');

-- Política: Permitir Upload apenas para usuários autenticados
CREATE POLICY "Admin Insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'barbearias-assets' AND 
    auth.role() = 'authenticated'
  );

-- Política: Permitir Update apenas para usuários autenticados
CREATE POLICY "Admin Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'barbearias-assets' AND 
    auth.role() = 'authenticated'
  );

-- Política: Permitir Delete apenas para usuários autenticados
CREATE POLICY "Admin Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'barbearias-assets' AND 
    auth.role() = 'authenticated'
  );
