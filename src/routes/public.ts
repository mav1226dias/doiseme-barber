import { Router } from 'express';
import { db } from '../lib/db.js';

const router = Router();

router.get('/barbers', (req, res) => {
  const barbers = db.prepare('SELECT id, name FROM barbers WHERE active = 1').all();
  res.json(barbers);
});

router.get('/services', (req, res) => {
  const services = db.prepare('SELECT id, name, duration, price FROM services').all();
  res.json(services);
});

router.get('/available-slots', (req, res) => {
  const { date, barber_id } = req.query;
  if (!date || !barber_id) return res.status(400).json({ error: 'Data e barbeiro são obrigatórios' });

  // Simple logic: 09:00 to 18:00, every 30 mins
  const allSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ];

  const booked = db.prepare(`
    SELECT appointment_time FROM appointments 
    WHERE appointment_date = ? AND barber_id = ? AND status != 'cancelled'
  `).all(date, barber_id) as any[];

  const bookedTimes = booked.map(b => b.appointment_time);
  const available = allSlots.filter(slot => !bookedTimes.includes(slot));

  res.json(available);
});

router.post('/appointments', (req, res) => {
  const { name, phone, barber_id, service_id, date, time } = req.body;

  try {
    // Check if slot is already taken
    const existing = db.prepare(`
      SELECT id FROM appointments 
      WHERE appointment_date = ? AND appointment_time = ? AND barber_id = ? AND status != 'cancelled'
    `).get(date, time, barber_id);

    if (existing) {
      return res.status(400).json({ error: 'Horário indisponível' });
    }

    // Find or create client
    let client = db.prepare('SELECT id FROM clients WHERE phone = ?').get(phone) as any;
    if (!client) {
      const result = db.prepare('INSERT INTO clients (name, phone) VALUES (?, ?)').run(name, phone);
      client = { id: result.lastInsertRowid };
    } else {
      db.prepare('UPDATE clients SET name = ? WHERE id = ?').run(name, client.id);
    }

    // Create appointment
    db.prepare(`
      INSERT INTO appointments (client_id, barber_id, service_id, appointment_date, appointment_time)
      VALUES (?, ?, ?, ?, ?)
    `).run(client.id, barber_id, service_id, date, time);

    // Update client last_appointment
    db.prepare('UPDATE clients SET last_appointment = CURRENT_TIMESTAMP WHERE id = ?').run(client.id);

    // Create notification
    const barber = db.prepare('SELECT name FROM barbers WHERE id = ?').get(barber_id) as any;
    db.prepare(`
      INSERT INTO notifications (type, message, phone)
      VALUES (?, ?, ?)
    `).run('new_appointment', `Novo agendamento: ${name} com ${barber.name} às ${time} do dia ${date}`, phone);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao agendar' });
  }
});

export default router;
