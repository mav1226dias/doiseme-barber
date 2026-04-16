-- Create tables for Doiseme Barber Shop

CREATE TABLE barbershops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  instagram TEXT,
  maps_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE barbers (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price REAL NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  last_visit TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  barber_id TEXT NOT NULL REFERENCES barbers(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  barbershop_id TEXT NOT NULL REFERENCES barbershops(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Since we are using the ANON key for backend calls without a service key, 
-- we need to either disable Row Level Security (RLS) or create appropriate policies.
-- For a quick start (if you don't need strict RLS on the DB level yet), you can disable RLS:
ALTER TABLE barbershops DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE barbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
