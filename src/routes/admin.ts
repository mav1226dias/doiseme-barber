import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-doiseme-2024';

// Middleware to verify JWT
router.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// Dashboard Stats
router.get('/dashboard', (req, res) => {
  try {
    const totalAppointments = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status != 'cancelled'").get() as any;
    const totalRevenue = db.prepare(`
      SELECT SUM(s.price) as total 
      FROM appointments a 
      JOIN services s ON a.service_id = s.id 
      WHERE a.status = 'completed'
    `).get() as any;

    const appointmentsByBarber = db.prepare(`
      SELECT b.name, COUNT(a.id) as count 
      FROM barbers b 
      LEFT JOIN appointments a ON b.id = a.barber_id AND a.status != 'cancelled'
      GROUP BY b.id
    `).all();

    res.json({
      totalAppointments: totalAppointments.count,
      totalRevenue: totalRevenue.total || 0,
      appointmentsByBarber
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// Barbers
router.get('/barbers', (req, res) => {
  const barbers = db.prepare('SELECT * FROM barbers').all();
  res.json(barbers);
});

router.post('/barbers', (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO barbers (name) VALUES (?)').run(name);
  res.json({ id: result.lastInsertRowid, name, active: 1 });
});

router.put('/barbers/:id', (req, res) => {
  const { active } = req.body;
  db.prepare('UPDATE barbers SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// Services
router.get('/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services').all();
  res.json(services);
});

router.post('/services', (req, res) => {
  const { name, duration, price } = req.body;
  const result = db.prepare('INSERT INTO services (name, duration, price) VALUES (?, ?, ?)').run(name, duration, price);
  res.json({ id: result.lastInsertRowid, name, duration, price });
});

router.delete('/services/:id', (req, res) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Appointments
router.get('/appointments', (req, res) => {
  const { date } = req.query;
  let query = `
    SELECT a.*, c.name as client_name, c.phone as client_phone, b.name as barber_name, s.name as service_name, s.price as service_price
    FROM appointments a
    JOIN clients c ON a.client_id = c.id
    JOIN barbers b ON a.barber_id = b.id
    JOIN services s ON a.service_id = s.id
  `;
  
  if (date) {
    query += ` WHERE a.appointment_date = ? ORDER BY a.appointment_time ASC`;
    const appointments = db.prepare(query).all(date);
    return res.json(appointments);
  }
  
  query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 50`;
  const appointments = db.prepare(query).all();
  res.json(appointments);
});

router.put('/appointments/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// Notifications
router.get('/notifications', (req, res) => {
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  res.json(notifications);
});

export default router;
