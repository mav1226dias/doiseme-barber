import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(process.cwd(), 'database.sqlite');
export const db = new Database(dbPath);

export function initDb() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS barbershops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      instagram TEXT,
      maps_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS barbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL, -- in minutes
      price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      last_appointment DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      barber_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL, -- YYYY-MM-DD
      appointment_time TEXT NOT NULL, -- HH:MM
      status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (barber_id) REFERENCES barbers (id),
      FOREIGN KEY (service_id) REFERENCES services (id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- new_appointment, inactive_client
      message TEXT NOT NULL,
      phone TEXT NOT NULL,
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default admin and barbershop if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@doiseme.com');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run('Admin', 'admin@doiseme.com', hashedPassword);
  }

  const shopExists = db.prepare('SELECT id FROM barbershops LIMIT 1').get();
  if (!shopExists) {
    db.prepare('INSERT INTO barbershops (name) VALUES (?)').run('Doiseme Barber Shop');
  }

  const barberExists = db.prepare('SELECT id FROM barbers LIMIT 1').get();
  if (!barberExists) {
    db.prepare('INSERT INTO barbers (name, active) VALUES (?, ?)').run('João Silva', 1);
    db.prepare('INSERT INTO barbers (name, active) VALUES (?, ?)').run('Marcos Paulo', 1);
  }

  const serviceExists = db.prepare('SELECT id FROM services LIMIT 1').get();
  if (!serviceExists) {
    db.prepare('INSERT INTO services (name, duration, price) VALUES (?, ?, ?)').run('Corte Clássico', 30, 45.00);
    db.prepare('INSERT INTO services (name, duration, price) VALUES (?, ?, ?)').run('Barba Terapia', 30, 35.00);
    db.prepare('INSERT INTO services (name, duration, price) VALUES (?, ?, ?)').run('Combo (Corte + Barba)', 60, 70.00);
  }
}
