import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from './src/db/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-doiseme';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  const api = express.Router();

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      next();
    });
  };

  // --- PUBLIC ROUTES ---
  
  // Get barbershop info by slug
  api.get('/barbershops/:slug', async (req, res) => {
    try {
      const { data: shop, error } = await supabase
        .from('barbershops')
        .select('*')
        .eq('slug', req.params.slug)
        .single();
        
      if (error || !shop) return res.status(404).json({ error: 'Barbearia não encontrada' });
      res.json(shop);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar barbearia' });
    }
  });

  // Get active barbers for a shop
  api.get('/barbershops/:id/barbers', async (req, res) => {
    try {
      const { data: shopBarbers, error } = await supabase
        .from('barbers')
        .select('*')
        .eq('barbershop_id', req.params.id)
        .eq('active', true);
        
      if (error) throw error;
      
      // Map to camelCase for the frontend
      res.json((shopBarbers || []).map(b => ({
        id: b.id,
        barbershopId: b.barbershop_id,
        userId: b.user_id,
        name: b.name,
        active: b.active
      })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
  });

  // Get active services for a shop
  api.get('/barbershops/:id/services', async (req, res) => {
    try {
      const { data: shopServices, error } = await supabase
        .from('services')
        .select('*')
        .eq('barbershop_id', req.params.id)
        .eq('active', true);
        
      if (error) throw error;
      
      res.json((shopServices || []).map(s => ({
        id: s.id,
        barbershopId: s.barbershop_id,
        name: s.name,
        durationMinutes: s.duration_minutes,
        price: s.price,
        active: s.active
      })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar serviços' });
    }
  });

  // Get available slots
  api.get('/barbershops/:id/availability', async (req, res) => {
    const { date, barberId } = req.query;
    if (!date || !barberId) return res.status(400).json({ error: 'Data e profissional são obrigatórios' });
    
    try {
      const { data: existing, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('barber_id', barberId)
        .eq('date', date)
        .eq('status', 'scheduled');
        
      if (error) throw error;
      
      const slots = [];
      for (let i = 9; i <= 18; i++) {
        const time = `${i.toString().padStart(2, '0')}:00`;
        const time30 = `${i.toString().padStart(2, '0')}:30`;
        
        if (!existing?.find(a => a.start_time === time)) slots.push(time);
        if (!existing?.find(a => a.start_time === time30)) slots.push(time30);
      }
      
      res.json(slots);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
    }
  });

  // Create appointment
  api.post('/appointments', async (req, res) => {
    const { barbershopId, barberId, serviceId, clientName, clientPhone, date, startTime } = req.body;
    
    try {
      // 1. Find or create client
      let { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('barbershop_id', barbershopId)
        .eq('phone', clientPhone)
        .single();
        
      if (!client) {
        const clientId = crypto.randomUUID();
        const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
          id: clientId,
          barbershop_id: barbershopId,
          name: clientName,
          phone: clientPhone,
        }).select().single();
        if (clientErr) throw clientErr;
        client = newClient;
      }

      // 2. Get service duration
      const { data: service, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();
        
      if (svcErr || !service) return res.status(404).json({ error: 'Serviço não encontrado' });

      // Calculate end time
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + service.duration_minutes;
      const endHours = Math.floor(totalMinutes / 60);
      const endMins = totalMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;

      // 3. Create appointment
      const appointmentId = crypto.randomUUID();
      const { error: apptErr } = await supabase.from('appointments').insert({
        id: appointmentId,
        barbershop_id: barbershopId,
        barber_id: barberId,
        service_id: serviceId,
        client_id: client.id,
        date,
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled'
      });
      if (apptErr) throw apptErr;

      // 4. Create notification
      const { data: barber } = await supabase.from('barbers').select('*').eq('id', barberId).single();
      await supabase.from('notifications').insert({
        id: crypto.randomUUID(),
        barbershop_id: barbershopId,
        type: 'new_appointment',
        title: 'Novo Agendamento',
        message: `${clientName} agendou com ${barber?.name || 'Profissional'} para ${date} às ${startTime}`,
      });

      res.json({ success: true, appointmentId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar agendamento' });
    }
  });

  // --- ADMIN AUTH ---
  api.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[LOGIN ATTEMPT] Email: ${email}`);
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
        
      if (error) {
        console.error(`[LOGIN ERROR] Supabase error:`, error);
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }
      
      if (!user) {
        console.warn(`[LOGIN WARN] User not found`);
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        console.warn(`[LOGIN WARN] Invalid password for ${email}`);
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      console.log(`[LOGIN SUCCESS] User authenticated: ${email}`);
      const token = jwt.sign({ id: user.id, barbershopId: user.barbershop_id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role, 
          barbershopId: user.barbershop_id 
        } 
      });
    } catch (error) {
      console.error(`[LOGIN FATAL ERROR]`, error);
      res.status(500).json({ error: 'Erro no login' });
    }
  });

  // --- PROTECTED ADMIN ROUTES ---
  
  // Dashboard stats
  api.get('/admin/dashboard', authenticateToken, async (req: any, res) => {
    const { barbershopId } = req.user;
    try {
      const { data: allAppointments, error: appErr } = await supabase.from('appointments').select('*').eq('barbershop_id', barbershopId);
      const { data: allServices, error: svcErr } = await supabase.from('services').select('*').eq('barbershop_id', barbershopId);
      const { data: allBarbers, error: brbErr } = await supabase.from('barbers').select('*').eq('barbershop_id', barbershopId);
      
      if (appErr || svcErr || brbErr) throw new Error('Failed to load dashboard data');

      const totalAppointments = allAppointments?.length || 0;
      
      // Calculate revenue
      let totalRevenue = 0;
      (allAppointments || []).forEach(app => {
        if (app.status !== 'cancelled') {
          const service = (allServices || []).find(s => s.id === app.service_id);
          if (service) totalRevenue += service.price;
        }
      });

      // Calculate appointments by barber
      const appointmentsByBarber = (allBarbers || []).map(barber => {
        const count = (allAppointments || []).filter(app => app.barber_id === barber.id).length;
        return { name: barber.name, count };
      }).sort((a, b) => b.count - a.count);

      res.json({
        totalAppointments,
        totalRevenue,
        appointmentsByBarber
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao carregar dashboard' });
    }
  });

  // Appointments
  api.get('/admin/appointments', authenticateToken, async (req: any, res) => {
    const { barbershopId } = req.user;
    const { date } = req.query;
    
    try {
      let query = supabase
        .from('appointments')
        .select(`
          id, date, start_time, end_time, status,
          clients (name, phone),
          barbers (name),
          services (name, price)
        `)
        .eq('barbershop_id', barbershopId)
        .order('start_time');
        
      if (date) {
        query = query.eq('date', date);
      }

      const { data: rawAppointments, error } = await query;
      if (error) throw error;

      const results = (rawAppointments || []).map(apt => ({
        id: apt.id,
        date: apt.date,
        startTime: apt.start_time,
        endTime: apt.end_time,
        status: apt.status,
        clientName: (apt.clients as any)?.name,
        clientPhone: (apt.clients as any)?.phone,
        barberName: (apt.barbers as any)?.name,
        serviceName: (apt.services as any)?.name,
        servicePrice: (apt.services as any)?.price
      }));

      res.json(results);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar agendamentos' });
    }
  });

  api.patch('/admin/appointments/:id/status', authenticateToken, async (req: any, res) => {
    const { status } = req.body;
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  });

  // Barbers
  api.get('/admin/barbers', authenticateToken, async (req: any, res) => {
    try {
      const { data: barbersList, error } = await supabase
        .from('barbers')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId);
        
      if (error) throw error;
      res.json(barbersList || []);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
  });

  api.post('/admin/barbers', authenticateToken, async (req: any, res) => {
    const { name } = req.body;
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('barbers').insert({
        id,
        barbershop_id: req.user.barbershopId,
        name,
        active: true
      });
      if (error) throw error;
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar profissional' });
    }
  });

  api.patch('/admin/barbers/:id', authenticateToken, async (req: any, res) => {
    const { active, name } = req.body;
    try {
      const { error } = await supabase
        .from('barbers')
        .update({ active, name })
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar profissional' });
    }
  });

  // Services
  api.get('/admin/services', authenticateToken, async (req: any, res) => {
    try {
      const { data: servicesList, error } = await supabase
        .from('services')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId);
      if (error) throw error;
      
      res.json((servicesList || []).map(s => ({
        id: s.id,
        barbershopId: s.barbershop_id,
        name: s.name,
        durationMinutes: s.duration_minutes,
        price: s.price,
        active: s.active
      })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar serviços' });
    }
  });

  api.post('/admin/services', authenticateToken, async (req: any, res) => {
    const { name, durationMinutes, price } = req.body;
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('services').insert({
        id,
        barbershop_id: req.user.barbershopId,
        name,
        duration_minutes: Number(durationMinutes),
        price: Number(price),
        active: true
      });
      if (error) throw error;
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar serviço' });
    }
  });

  api.patch('/admin/services/:id', authenticateToken, async (req: any, res) => {
    const { active, name, durationMinutes, price } = req.body;
    try {
      const { error } = await supabase
        .from('services')
        .update({ 
          active, 
          name, 
          duration_minutes: durationMinutes, 
          price 
        })
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar serviço' });
    }
  });

  api.delete('/admin/services/:id', authenticateToken, async (req: any, res) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir serviço' });
    }
  });

  // Notifications
  api.get('/admin/notifications', authenticateToken, async (req: any, res) => {
    try {
      const { data: notifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json(notifs || []);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
  });

  api.patch('/admin/notifications/:id/read', authenticateToken, async (req: any, res) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao marcar como lida' });
    }
  });

  // Seed endpoint
  api.post('/seed', async (req, res) => {
    try {
      const shopId = 'shop-1';
      const { data: existingShop } = await supabase.from('barbershops').select('*').eq('id', shopId).single();
      
      if (!existingShop) {
        await supabase.from('barbershops').insert({
          id: shopId,
          name: 'Doiseme Barber Shop',
          slug: 'doiseme',
          address: 'Rua das Flores, 123 - Centro',
          phone: '11999999999',
          instagram: '@doiseme.barber'
        });

        const hash = await bcrypt.hash('admin123', 10);
        await supabase.from('users').insert({
          id: 'user-1',
          barbershop_id: shopId,
          name: 'Admin Doiseme',
          email: 'admin@doiseme.com',
          password_hash: hash,
          role: 'admin'
        });

        await supabase.from('barbers').insert([
          { id: 'barber-1', barbershop_id: shopId, name: 'João Silva', active: true },
          { id: 'barber-2', barbershop_id: shopId, name: 'Carlos Santos', active: true }
        ]);

        await supabase.from('services').insert([
          { id: 'srv-1', barbershop_id: shopId, name: 'Corte Clássico', duration_minutes: 30, price: 45.00, active: true },
          { id: 'srv-2', barbershop_id: shopId, name: 'Barba Terapia', duration_minutes: 30, price: 35.00, active: true },
          { id: 'srv-3', barbershop_id: shopId, name: 'Combo (Corte + Barba)', duration_minutes: 60, price: 70.00, active: true }
        ]);
        
        res.json({ success: true, message: 'Database seeded! Login: admin@doiseme.com / admin123' });
      } else {
        res.json({ success: true, message: 'Database already seeded.' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Seed failed' });
    }
  });

  app.use('/api', api);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
