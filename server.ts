import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { supabase } from './src/db/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-doiseme';

const app = express();
app.set('trust proxy', 1);

async function startServer() {
  const PORT = 3000;

  // Security Headers
  app.use(helmet({ contentSecurityPolicy: false })); // Disabled CSP to avoid breaking React dev server inline scripts
  app.disable('x-powered-by');

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  const api = express.Router();
  
  // LOG ALL API REQUESTS FOR DEBUGGING
  api.use((req, res, next) => {
    console.log(`[API_REQ] ${req.method} ${req.path}`);
    next();
  });
  const DEFAULT_SETTINGS = {
    monday: { isClosed: true, open: '09:00', close: '18:00' },
    tuesday: { isClosed: false, open: '09:00', close: '18:00' },
    wednesday: { isClosed: false, open: '09:00', close: '18:00' },
    thursday: { isClosed: false, open: '09:00', close: '18:00' },
    friday: { isClosed: false, open: '09:00', close: '18:00' },
    saturday: { isClosed: false, open: '09:00', close: '18:00' },
    sunday: { isClosed: true, open: '09:00', close: '18:00' }
  };

  const getShopSettings = async (shopId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('config')
        .eq('barbershop_id', shopId)
        .maybeSingle(); // Better than .single() as it won't throw 406 error if not found
      
      if (error || !data) return DEFAULT_SETTINGS;

      if (typeof data.config === 'string') {
        try {
          return JSON.parse(data.config);
        } catch (e) {
          console.error("Failed to parse settings JSON:", e);
          return DEFAULT_SETTINGS;
        }
      }
      return data.config || DEFAULT_SETTINGS;
    } catch (e) {
      console.error("Error fetching settings:", e);
      return DEFAULT_SETTINGS;
    }
  };

  // SEO Text endpoints
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nAllow: /\nSitemap: https://doiseme-barber.onrender.com/sitemap.xml");
  });

  app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://doiseme-barber.onrender.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
  });

  // Rate limiting for login - simplified to respect trust proxy
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 10,
    message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
    // When trust proxy is true, req.ip will be the client IP
  });

  // Auth Middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({ error: 'Sessão inválida ou expirada. Por favor, faça login novamente.' });
      }

      // Use a promise to verify the token
      const user: any = await new Promise((resolve, reject) => {
        jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
          if (err) {
            console.error(`[JWT_VERIFY_ERROR] Token: ${token.substring(0, 10)}... Error:`, err.message);
            reject(err);
          }
          else resolve(decoded);
        });
      });

      req.user = user;

      // Skip extra checks for master admin unless they are NOT impersonating
      if (user.role !== 'master' && user.barbershopId) {
        const { data: shop, error } = await supabase
          .from('barbershops')
          .select('is_blocked, expires_at')
          .eq('id', user.barbershopId)
          .maybeSingle();
        
        if (shop) {
          if (shop.is_blocked) {
            return res.status(403).json({ error: 'Sua conta está bloqueada pelo administrador.' });
          }
          if (shop.expires_at && new Date(shop.expires_at) < new Date()) {
            return res.status(403).json({ error: 'Seu período de teste ou assinatura expirou.' });
          }
        }
      }

      next();
    } catch (err) {
      console.error('[AUTH_ERROR]', err);
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
  };

  // Super Admin Check Middleware
  const requireMaster = (req: any, res: any, next: any) => {
    const authorizedEmails = ['marcusdoiseme@doiseme.com', 'marcusdias2014mv@gmail.com'];
    const userEmail = req.user.email?.toLowerCase();
    
    const isAuthorized = userEmail && authorizedEmails.includes(userEmail);
    const isMasterRole = req.user.role === 'master';

    if (isMasterRole && isAuthorized) {
      next();
    } else {
      console.warn(`[SECURITY_ALERT] Non-authorized Master attempt: ${req.user.email} (Role: ${req.user.role})`);
      res.status(403).json({ error: 'Acesso restrito ao Administrador Geral.' });
    }
  };

  api.get('/health', async (req, res) => {
    try {
      const { data, error } = await supabase.from('barbershops').select('id').limit(1);
      if (error) {
        return res.status(500).json({ status: 'error', database: 'failed', error });
      }
      res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (e: any) {
      res.status(500).json({ status: 'error', message: e.message });
    }
  });

  // --- PUBLIC ROUTES ---
  
  // Helper to standardize slugs (mirroring frontend src/lib/slugify.ts)
  const standardizeSlug = (text: string) => {
    if (!text) return null;
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  // Get barbershop info by slug (Public)
  api.get('/public/shop/:identifier', async (req, res) => {
    try {
      const identifier = req.params.identifier.toLowerCase().trim();
      console.log(`[PUBLIC_SHOP_LOOKUP] Identifier: "${identifier}"`);

      // 1. Try slug exact match
      const { data: shopBySlug, error: slugError } = await supabase
        .from('barbershops')
        .select('*')
        .eq('slug', identifier)
        .maybeSingle();

      if (shopBySlug) {
        console.log(`[PUBLIC_SHOP_FOUND] Match by slug: ${identifier} -> ID: ${shopBySlug.id}`);
        
        // Block/Expiry check
        if (shopBySlug.is_blocked) {
          return res.status(403).json({ 
            error: 'Barbearia Temporariamente Indisponível', 
            details: 'Esta barbearia está bloqueada pelo administrador do sistema.' 
          });
        }
        if (shopBySlug.expires_at && new Date(shopBySlug.expires_at) < new Date()) {
          return res.status(403).json({ 
            error: 'Acesso Expirado', 
            details: 'O prazo de utilização desta barbearia expirou.' 
          });
        }

        return res.json(shopBySlug);
      }

      // 2. Try ID if slug didn't match (fallback)
      // IDs are UUIDs or at least longer than standard slugs usually
      if (identifier.length >= 20) { 
        const { data: shopById, error: idError } = await supabase
          .from('barbershops')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();

        if (shopById) {
          console.log(`[PUBLIC_SHOP_FOUND] Match by ID: ${identifier}`);

          // Block/Expiry check
          if (shopById.is_blocked) {
            return res.status(403).json({ 
              error: 'Barbearia Temporariamente Indisponível', 
              details: 'Esta barbearia está bloqueada pelo administrador do sistema.' 
            });
          }
          if (shopById.expires_at && new Date(shopById.expires_at) < new Date()) {
            return res.status(403).json({ 
              error: 'Acesso Expirado', 
              details: 'O prazo de utilização desta barbearia expirou.' 
            });
          }

          return res.json(shopById);
        }
      }

      console.warn(`[PUBLIC_SHOP_NOT_FOUND] No shop matches: "${identifier}"`);
      res.status(404).json({ 
        error: 'Barbearia não encontrada', 
        details: `Não localizamos nenhuma barbearia com o link "${identifier}". Verifique se o endereço está correto.`
      });
    } catch (e: any) {
      console.error('Error in /public/shop/:identifier:', e);
      res.status(500).json({ error: 'Erro interno ao buscar barbearia' });
    }
  });

  // Keep this for compatibility if anything else uses it, but point to the same logic or similar
  api.get('/barbershops/:slug', async (req, res) => {
    try {
      const { data: shop, error } = await supabase
        .from('barbershops')
        .select('id, name, slug, address, phone, instagram, maps_url, logo_url, banner_url, primary_color, secondary_color, booking_layout')
        .eq('slug', req.params.slug.toLowerCase())
        .maybeSingle();
        
      if (error || !shop) return res.status(404).json({ error: 'Barbearia não encontrada' });
      res.json(shop);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar barbearia' });
    }
  });

  // Upload proxy to Supabase
  api.post('/admin/upload', authenticateToken, async (req: any, res) => {
    const { filePath, content, contentType } = req.body;
    const BUCKET_NAME = 'barbearias-assets';
    
    if (!filePath || !content) {
      return res.status(400).json({ error: 'Faltando dados de upload' });
    }

    try {
      const buffer = Buffer.from(content, 'base64');
      
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: contentType || 'image/png',
          upsert: true
        });

      if (error) {
        console.error('[SERVER_UPLOAD_ERROR]', error);
        return res.status(500).json({ error: error.message });
      }

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      res.json({ publicUrl });
    } catch (e: any) {
      console.error('[SERVER_UPLOAD_CATCH]', e);
      res.status(500).json({ error: e.message || 'Erro interno no servidor de upload' });
    }
  });

  api.get('/admin/shop-info', authenticateToken, async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('barbershops')
        .select('*')
        .eq('id', req.user.barbershopId)
        .single();
      if (error) throw error;
      res.json(data);
    } catch (e) { res.status(500).json({ error: 'Erro ao buscar dados da barbearia' }); }
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
      const spTime = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
      const spDate = new Date(spTime);
      const todayStr = `${spDate.getFullYear()}-${String(spDate.getMonth() + 1).padStart(2, '0')}-${String(spDate.getDate()).padStart(2, '0')}`;
      
      if ((date as string) < todayStr) return res.json([]);

      // Get settings for the day
      const targetDate = new Date(`${date}T12:00:00Z`);
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = days[targetDate.getDay()];
      
      const config = await getShopSettings(req.params.id);
      const dayConfig = (config as any)[dayName];
      
      if (dayConfig.isClosed) return res.json([]); // Barbershop is closed this day

      const currentHour = spDate.getHours();
      const currentMinute = spDate.getMinutes();

      const { data: existing, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('barber_id', barberId)
        .eq('date', date)
        .in('status', ['scheduled', 'blocked']);
        
      if (error) throw error;
      
      const slots = [];
      const startH = parseInt(dayConfig.open.split(':')[0]);
      const endH = parseInt(dayConfig.close.split(':')[0]);

      for (let i = startH; i <= endH; i++) {
        const time = `${i.toString().padStart(2, '0')}:00`;
        const time30 = `${i.toString().padStart(2, '0')}:30`;
        
        // Prevent booking exactly at closing hour if duration is going to exceed it (We don't know duration yet so we block exact close time)
        if (i === endH) continue;
        
        let isTimePast = false;
        let isTime30Past = false;
        
        // Block times that have already passed today
        if (date === todayStr) {
          if (i < currentHour || (i === currentHour && currentMinute >= 0)) isTimePast = true;
          if (i < currentHour || (i === currentHour && currentMinute >= 30)) isTime30Past = true;
        }
        
        if (!isTimePast && !existing?.find(a => a.start_time === time)) slots.push(time);
        if (!isTime30Past && !existing?.find(a => a.start_time === time30)) slots.push(time30);
      }
      
      res.json(slots);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
    }
  });

  // Create appointment
  api.post('/appointments', async (req, res) => {
    const { barbershopId, barberId, serviceId, clientName, clientPhone, date, startTime } = req.body;
    
    try {
      // Check if shop is active
      const { data: shop } = await supabase.from('barbershops').select('is_blocked, expires_at').eq('id', barbershopId).maybeSingle();
      if (shop) {
        if (shop.is_blocked || (shop.expires_at && new Date(shop.expires_at) < new Date())) {
          return res.status(403).json({ error: 'Os agendamentos para esta barbearia estão suspensos temporariamente.' });
        }
      }
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

      // 2.5 Check Conflict
      const { data: conflict } = await supabase.from('appointments').select('*')
        .eq('barber_id', barberId)
        .eq('date', date)
        .eq('start_time', startTime)
        .eq('status', 'scheduled')
        .single();
        
      if (conflict) {
        return res.status(409).json({ error: 'Horário já preenchido. Por favor, escolha outro.' });
      }

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
      
      // We store the data as serialized JSON in the message so we can extract it in the frontend
      // If table supports `phone` column natively, this will fallback or could be added, but we encode it into message just in case
      await supabase.from('notifications').insert({
        id: crypto.randomUUID(),
        barbershop_id: barbershopId,
        type: 'new_appointment',
        title: 'Novo Agendamento',
        // Instead of plain text, we pass data via JSON in message
        message: JSON.stringify({
          text: `${clientName} agendou com ${barber?.name || 'Profissional'} para ${date} às ${startTime}`,
          clientName: clientName,
          clientPhone: clientPhone,
          barberName: barber?.name,
          date: date,
          time: startTime
        })
      });

      res.json({ success: true, appointmentId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar agendamento' });
    }
  });

  // --- ADMIN AUTH ---
  api.get('/admin/settings', authenticateToken, async (req: any, res) => {
    const settings = await getShopSettings(req.user.barbershopId);
    res.json(settings);
  });

  api.post('/admin/settings', authenticateToken, async (req: any, res) => {
    const shopId = req.user.barbershopId;
    const config = req.body;
    
    try {
      const { error } = await supabase
        .from('shop_settings')
        .upsert({
          id: crypto.randomUUID(), // This is technically wrong for upsert without constraint but Supabase upsert works on unique columns
          barbershop_id: shopId,
          config: JSON.stringify(config),
          updated_at: new Date().toISOString()
        }, { onConflict: 'barbershop_id' });
        
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
  });

  api.post('/auth/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    console.log(`[LOGIN ATTEMPT] Email: ${email}`);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle(); // Better than .single() to avoid 406 on no rows
        
      if (error) {
        console.error(`[LOGIN ERROR] Supabase query failed:`, JSON.stringify(error, null, 2));
        return res.status(500).json({ 
          error: 'Erro na conexão com o banco de dados',
          details: error.message,
          code: error.code
        });
      }
      
      if (!user) {
        console.warn(`[LOGIN WARN] User not found: ${email}`);
        return res.status(401).json({ error: 'Usuário não encontrado ou credenciais inválidas' });
      }

      // Check shop status if NOT a master user
      if (user.role !== 'master') {
        const { data: shop } = await supabase
          .from('barbershops')
          .select('is_blocked, expires_at')
          .eq('id', user.barbershop_id)
          .maybeSingle();

        if (shop) {
          if (shop.is_blocked) {
            return res.status(403).json({ error: 'Esta barbearia está bloqueada. Entre em contato com o administrador.' });
          }
          if (shop.expires_at) {
            const expiryDate = new Date(shop.expires_at);
            if (expiryDate < new Date()) {
              return res.status(403).json({ error: 'O prazo de utilização desta barbearia expirou.' });
            }
          }
        }
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        console.warn(`[LOGIN WARN] Invalid password for ${email}`);
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      console.log(`[LOGIN SUCCESS] User authenticated: ${email} (Role: ${user.role})`);
      const token = jwt.sign({ 
        id: user.id, 
        barbershopId: user.barbershop_id, 
        role: user.role,
        email: user.email 
      }, JWT_SECRET, { expiresIn: '7d' });
      
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
    } catch (error: any) {
      console.error(`[LOGIN FATAL ERROR]`, error);
      res.status(500).json({ error: 'Erro interno ao processar login', details: error.message });
    }
  });

  // --- PROTECTED ADMIN ROUTES ---
  
  // Dashboard stats
  api.patch('/admin/shop', authenticateToken, async (req: any, res) => {
    const { 
      logoUrl, 
      bannerUrl, 
      primaryColor, 
      secondaryColor, 
      bookingLayout, 
      slug, 
      instagram, 
      mapsUrl,
      whatsapp,
      showWhatsapp,
      showInstagram,
      showAddress,
      name,
      address
    } = req.body;
    try {
      const cleanSlug = standardizeSlug(slug);
      
      if (cleanSlug) {
        const { data: existing } = await supabase
          .from('barbershops')
          .select('id')
          .eq('slug', cleanSlug)
          .maybeSingle();
        
        if (existing && existing.id !== req.user.barbershopId) {
          return res.status(409).json({ error: 'Este link já está em uso por outra barbearia.' });
        }
      }

      // Safety check: Prevent saving blob URLs (which are only valid in the client session)
      if (logoUrl && logoUrl.startsWith('blob:')) {
        console.warn(`[SECURITY] Prevented saving blob URL as logo: ${logoUrl}`);
        return res.status(400).json({ error: 'Aguarde o upload do logo ser concluído antes de salvar.' });
      }
      if (bannerUrl && bannerUrl.startsWith('blob:')) {
        console.warn(`[SECURITY] Prevented saving blob URL as banner: ${bannerUrl}`);
        return res.status(400).json({ error: 'Aguarde o upload da capa ser concluído antes de salvar.' });
      }

      const updateData: any = {
        name: name,
        address: address,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        booking_layout: bookingLayout,
        slug: cleanSlug,
        instagram: instagram,
        whatsapp: whatsapp,
        phone: whatsapp, // Sync phone with whatsapp for compatibility
        maps_url: mapsUrl,
        show_whatsapp: showWhatsapp ?? true,
        show_instagram: showInstagram ?? true,
        show_address: showAddress ?? true,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('barbershops')
        .update(updateData)
        .eq('id', req.user.barbershopId)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (e: any) { 
      console.error('[SHOP_UPDATE_ERROR]', e);
      res.status(500).json({ error: e.message }); 
    }
  });

  api.get('/admin/dashboard', authenticateToken, async (req: any, res) => {
    const { barbershopId } = (req as any).user;
    const { start, end } = req.query;
    console.log(`[DASHBOARD] Loading for shop ${barbershopId}, range: ${start} to ${end}`);
    
    try {
      // Use start_time instead of date based on schema
      let appointmentsQuery = supabase.from('appointments').select('*').eq('barbershop_id', barbershopId);
      
      if (start && end) {
        appointmentsQuery = appointmentsQuery.gte('start_time', `${start}T00:00:00`).lte('start_time', `${end}T23:59:59`);
      }

      const { data: allAppointments, error: appErr } = await appointmentsQuery;
      if (appErr) console.error('[DASHBOARD_APP_ERR]', appErr);

      const { data: allServices, error: svcErr } = await supabase.from('services').select('*').eq('barbershop_id', barbershopId);
      if (svcErr) console.error('[DASHBOARD_SVC_ERR]', svcErr);

      const { data: allBarbers, error: brbErr } = await supabase.from('barbers').select('*').eq('barbershop_id', barbershopId);
      if (brbErr) console.error('[DASHBOARD_BRB_ERR]', brbErr);
      
      if (appErr || svcErr || brbErr) {
        return res.status(500).json({ 
          error: 'Erro ao carregar dados do banco de dados',
          details: (appErr || svcErr || brbErr)?.message 
        });
      }

      const totalAppointments = allAppointments?.length || 0;
      
      // Calculate revenue and commissions
      let totalRevenue = 0;
      let totalCommissions = 0;
      (allAppointments || []).forEach(app => {
        if (app.status === 'completed' || app.status === 'confirmed') {
          const service = (allServices || []).find(s => s.id === app.service_id);
          const barber = (allBarbers || []).find(b => b.id === app.barber_id);
          if (service) {
            const price = Number(service.price) || 0;
            totalRevenue += price;
            const rate = barber?.commission_percentage || 50;
            totalCommissions += (price * rate) / 100;
          }
        }
      });

      // Get expenses from "finances" table (the correct one in schema)
      const { data: allExpenses, error: expErr } = await supabase
        .from('finances')
        .select('*')
        .eq('barbershop_id', barbershopId)
        .eq('type', 'expense')
        .gte('date', start || '2000-01-01')
        .lte('date', end || '2100-01-01');

      if (expErr) console.error('[DASHBOARD_EXP_ERR]', expErr);

      const totalExpenses = (allExpenses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      // Calculate appointments by barber
      const appointmentsByBarber = (allBarbers || []).map(barber => {
        const barberApps = (allAppointments || []).filter(app => app.barber_id === barber.id);
        const count = barberApps.length;
        const revenue = barberApps.reduce((acc, app) => {
          const service = (allServices || []).find(s => s.id === app.service_id);
          return acc + (Number(service?.price) || 0);
        }, 0);
        return { 
          name: barber.name, 
          count, 
          revenue,
          commission_percentage: barber.commission_percentage || 50
        };
      }).sort((a, b) => b.count - a.count);

      res.json({
        totalAppointments,
        totalRevenue,
        totalCommissions,
        totalExpenses,
        netProfit: totalRevenue - totalCommissions - totalExpenses,
        appointmentsByBarber
      });
    } catch (error: any) {
      console.error('[DASHBOARD_CATCH]', error);
      res.status(500).json({ error: 'Erro interno ao processar dashboard', details: error.message });
    }
  });

  // Finances / Expenses
  api.get('/admin/expenses', authenticateToken, async (req: any, res) => {
    try {
      const { data: financesList, error } = await supabase
        .from('finances')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .eq('type', 'expense')
        .order('date', { ascending: false });
      if (error) throw error;
      res.json(financesList || []);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar despesas' });
    }
  });

  api.post('/admin/expenses', authenticateToken, async (req: any, res) => {
    const { description, amount, category, date, barberId } = req.body;
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('finances').insert({
        id,
        barbershop_id: req.user.barbershopId,
        type: 'expense',
        description,
        amount: Number(amount),
        category,
        date,
        barber_id: barberId || null
      });
      if (error) throw error;
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar despesa' });
    }
  });

  api.delete('/admin/expenses/:id', authenticateToken, async (req: any, res) => {
    try {
      const { error } = await supabase
        .from('finances')
        .delete()
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir despesa' });
    }
  });

  // Client Packages
  api.get('/admin/packages', authenticateToken, async (req: any, res) => {
    try {
      const { data, error } = await supabase
        .from('client_packages')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar pacotes' });
    }
  });

  api.post('/admin/packages', authenticateToken, async (req: any, res) => {
    const { clientName, clientWhatsapp, packageName, totalQuantity, pricePaid } = req.body;
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('client_packages').insert({
        id,
        barbershop_id: req.user.barbershopId,
        client_name: clientName,
        client_whatsapp: clientWhatsapp,
        package_name: packageName,
        total_quantity: Number(totalQuantity),
        remaining_quantity: Number(totalQuantity),
        price_paid: Number(pricePaid)
      });
      if (error) throw error;
      res.json({ success: true, id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar pacote' });
    }
  });

  api.get('/admin/packages/search', authenticateToken, async (req: any, res) => {
    const { whatsapp } = req.query;
    try {
      const { data, error } = await supabase
        .from('client_packages')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .eq('client_whatsapp', whatsapp)
        .gt('remaining_quantity', 0);
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao pesquisar pacote' });
    }
  });

  api.post('/admin/packages/use/:id', authenticateToken, async (req: any, res) => {
    try {
      const { data: pkg, error: fetchError } = await supabase
        .from('client_packages')
        .select('remaining_quantity')
        .eq('id', req.params.id)
        .single();
      
      if (fetchError || !pkg) throw new Error('Pacote não encontrado');
      if (pkg.remaining_quantity <= 0) throw new Error('Pacote esgotado');

      const { error: updateError } = await supabase
        .from('client_packages')
        .update({ remaining_quantity: pkg.remaining_quantity - 1 })
        .eq('id', req.params.id);
      
      if (updateError) throw updateError;
      res.json({ success: true, remaining: pkg.remaining_quantity - 1 });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao usar pacote' });
    }
  });

  api.delete('/admin/packages/:id', authenticateToken, async (req: any, res) => {
    try {
      const { error } = await supabase
        .from('client_packages')
        .delete()
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir pacote' });
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

  api.post('/admin/appointments', authenticateToken, async (req: any, res) => {
    const { barberId, serviceId, clientName, clientPhone, date, startTime } = req.body;
    const barbershopId = req.user.barbershopId;
    
    try {
      let { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('barbershop_id', barbershopId)
        .eq('phone', clientPhone.replace(/\D/g, ''))
        .single();
        
      if (!client) {
        const clientId = crypto.randomUUID();
        const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
          id: clientId,
          barbershop_id: barbershopId,
          name: clientName,
          phone: clientPhone.replace(/\D/g, ''),
        }).select().single();
        if (clientErr) throw clientErr;
        client = newClient;
      }

      const { data: service, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();
        
      if (svcErr || !service) return res.status(404).json({ error: 'Serviço não encontrado' });

      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + service.duration_minutes;
      const endHours = Math.floor(totalMinutes / 60);
      const endMins = totalMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;

      const { data: conflict } = await supabase.from('appointments').select('*')
        .eq('barber_id', barberId)
        .eq('date', date)
        .eq('start_time', startTime)
        .eq('status', 'scheduled')
        .single();
        
      if (conflict) {
        return res.status(409).json({ error: 'Horário já preenchido.' });
      }

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

      res.json({ success: true, appointmentId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar agendamento' });
    }
  });

  api.post('/admin/appointments/block', authenticateToken, async (req: any, res) => {
    const { date, startTime, endTime, barberId } = req.body; // endTime is optional
    try {
      let { data: client } = await supabase.from('clients').select('*').eq('phone', '00000000000').single();
      if (!client) {
        const { data: newC } = await supabase.from('clients').insert({ id: crypto.randomUUID(), name: 'BLOQUEIO SISTEMA', phone: '00000000000', barbershop_id: req.user.barbershopId }).select().single();
        client = newC;
      }

      // Generate times to block
      const times = [];
      if (endTime && endTime > startTime) {
        let [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        while (sh < eh || (sh === eh && sm < em)) {
          times.push(`${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`);
          sm += 30;
          if (sm >= 60) {
            sh += 1;
            sm = 0;
          }
        }
      } else {
        times.push(startTime);
      }

      const inserts = times.map(t => ({
        id: crypto.randomUUID(),
        barbershop_id: req.user.barbershopId,
        barber_id: barberId,
        service_id: null,
        client_id: client.id,
        date,
        start_time: t,
        end_time: t,
        status: 'blocked'
      }));

      const { error } = await supabase.from('appointments').insert(inserts);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao bloquear horário' });
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

  // Inactive Clients (no appointments in last 20 days)
  api.get('/admin/inactive-clients', authenticateToken, async (req: any, res) => {
    try {
      const barbershopId = req.user.barbershopId;
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      const isoThreshold = twentyDaysAgo.toISOString().split('T')[0];

      // Get all appointments
      const { data: allAppointments, error: apptErr } = await supabase
        .from('appointments')
        .select(`
          date, 
          status, 
          clients (id, name, phone),
          barbers (name)
        `)
        .eq('barbershop_id', barbershopId)
        .order('date', { ascending: false });

      if (apptErr) throw apptErr;

      // Group by client and find the latest appointment
      const clientMap = new Map();
      
      allAppointments?.forEach(apt => {
        if (!apt.clients) return;
        const c = apt.clients as any;
        if (!clientMap.has(c.id)) {
          clientMap.set(c.id, {
            id: c.id,
            name: c.name,
            phone: c.phone,
            lastDate: apt.date,
            lastBarberName: (apt.barbers as any)?.name || 'Profissional'
          });
        } else {
          const existing = clientMap.get(c.id);
          if (apt.date > existing.lastDate) {
            existing.lastDate = apt.date;
            existing.lastBarberName = (apt.barbers as any)?.name || 'Profissional';
          }
        }
      });

      // Filter those whose last date is older than 20 days
      const inactive = Array.from(clientMap.values()).filter(c => c.lastDate < isoThreshold);
      
      res.json(inactive);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar clientes inativos' });
    }
  });

  // --- CLIENTS ---
  api.get('/admin/clients', authenticateToken, async (req: any, res) => {
    try {
      const { data: clientsList, error } = await supabase
        .from('clients')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .order('name');
      if (error) throw error;
      res.json(clientsList || []);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
  });

  api.post('/admin/clients', authenticateToken, async (req: any, res) => {
    const { name, phone } = req.body;
    try {
      // Basic check for existing client
      const { data: existing } = await supabase.from('clients')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .eq('phone', phone)
        .single();
        
      if (existing) {
        return res.status(409).json({ error: 'Telefone já cadastrado' });
      }

      const id = crypto.randomUUID();
      const { error } = await supabase.from('clients').insert({
        id,
        barbershop_id: req.user.barbershopId,
        name,
        phone
      });
      if (error) throw error;
      res.json({ success: true, id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao cadastrar cliente' });
    }
  });

  api.post('/admin/clients/batch', authenticateToken, async (req: any, res) => {
    const { clients } = req.body; // Array of { name, phone }
    try {
      // First get existing to avoid duplicates easily.
      const { data: existingClients } = await supabase.from('clients')
        .select('phone')
        .eq('barbershop_id', req.user.barbershopId);
        
      const existingPhones = new Set((existingClients || []).map(c => c.phone));
      const inserts = [];
      const addedPhones = new Set(existingPhones);

      for (const client of clients) {
        let cleanPhone = client.phone.replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 8) continue; 
        
        if (!addedPhones.has(cleanPhone)) {
          addedPhones.add(cleanPhone);
          inserts.push({
            id: crypto.randomUUID(),
            barbershop_id: req.user.barbershopId,
            name: client.name || 'Sem Nome',
            phone: cleanPhone
          });
        }
      }

      if (inserts.length > 0) {
        // Supabase bulk insert limit is typically 1000, so we chunk it to be safe
        const chunkSize = 500;
        for (let i = 0; i < inserts.length; i += chunkSize) {
          const chunk = inserts.slice(i, i + chunkSize);
          const { error } = await supabase.from('clients').insert(chunk);
          if (error) throw error;
        }
      }
      
      res.json({ success: true, count: inserts.length });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao importar clientes' });
    }
  });

  api.delete('/admin/clients', authenticateToken, async (req: any, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nenhum cliente selecionado' });
    }
    
    try {
      // First delete associated appointments to clear Foreign Key constraints before deleting clients
      await supabase
        .from('appointments')
        .delete()
        .in('client_id', ids)
        .eq('barbershop_id', req.user.barbershopId);

      const { error } = await supabase
        .from('clients')
        .delete()
        .in('id', ids)
        .eq('barbershop_id', req.user.barbershopId);
        
      if (error) throw error;
      
      res.json({ success: true, count: ids.length });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao excluir clientes' });
    }
  });

  // --- CAMPAIGNS ---
  api.post('/admin/campaigns', authenticateToken, async (req: any, res) => {
    const { name, messageTemplate, daysActive } = req.body;
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + Number(daysActive || 7));
      
      const id = crypto.randomUUID();
      const { error } = await supabase.from('notifications').insert({
        id,
        barbershop_id: req.user.barbershopId,
        type: 'campaign',
        title: name,
        message: JSON.stringify({
          template: messageTemplate,
          expiresAt: expirationDate.toISOString()
        })
      });
      if (error) throw error;
      res.json({ success: true, id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar campanha' });
    }
  });

  api.get('/admin/campaigns', authenticateToken, async (req: any, res) => {
    try {
      const { data: campaignRows, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .eq('type', 'campaign')
        .order('created_at', { ascending: false });
        
      if (error) throw error;

      const nowStr = new Date().toISOString();
      const activeCampaigns = [];
      const expiredIds = [];

      for (const row of (campaignRows || [])) {
        try {
          const data = JSON.parse(row.message);
          if (data.expiresAt < nowStr) {
            expiredIds.push(row.id);
          } else {
            activeCampaigns.push(row);
          }
        } catch(e) { }
      }

      // Cleanup expired campaigns (auto-delete after 7 days logic)
      if (expiredIds.length > 0) {
        await supabase.from('notifications').delete().in('id', expiredIds);
      }

      res.json(activeCampaigns);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao carregar campanhas' });
    }
  });

  api.delete('/admin/campaigns/:id', authenticateToken, async (req: any, res) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao excluir campanha' });
    }
  });

  // Seed endpoint
  // --- MASTER ADMIN ROUTES ---

  // Create new shop + master user
  api.post('/admin/master/shops', authenticateToken, requireMaster, async (req, res) => {
    const { name, slug, email, password } = req.body;
    
    if (!name || !slug || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
      const cleanSlug = standardizeSlug(slug);
      
      // Check if slug taken
      const { data: existingShop } = await supabase
        .from('barbershops')
        .select('id')
        .eq('slug', cleanSlug)
        .maybeSingle();

      if (existingShop) {
        return res.status(400).json({ error: 'Este link (slug) já está em uso.' });
      }

      // Check if email taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: 'Este email já está cadastrado.' });
      }

      // Create shop
      const shopId = crypto.randomUUID();
      const { error: shopErr } = await supabase
        .from('barbershops')
        .insert({
          id: shopId,
          name,
          slug: cleanSlug,
        });

      if (shopErr) throw shopErr;

      // Create Admin User
      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      const { error: userErr } = await supabase
        .from('users')
        .insert({
          id: userId,
          barbershop_id: shopId,
          name: `${name} Admin`,
          email,
          password_hash: passwordHash,
          role: 'admin'
        });

      if (userErr) throw userErr;

      res.json({ 
        success: true, 
        message: 'Barbearia e administrador criados com sucesso!', 
        shop: { id: shopId, name, slug: cleanSlug },
        admin: { email }
      });
    } catch (e: any) {
      console.error('[MASTER_CREATE_SHOP_ERROR]', e);
      res.status(500).json({ error: 'Erro ao criar barbearia', details: e.message });
    }
  });

  // List all shops (Master only)
  api.get('/admin/master/shops', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('barbershops')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao buscar lojas', details: e.message });
    }
  });

  // Toggle block status
  api.post('/admin/master/shops/:id/toggle-block', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { id } = req.params;
      const { is_blocked } = req.body;
      
      const { error } = await supabase
        .from('barbershops')
        .update({ is_blocked })
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true, is_blocked });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao alterar status de bloqueio' });
    }
  });

  // Update expiration date
  api.post('/admin/master/shops/:id/expiration', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { id } = req.params;
      const { expires_at } = req.body;
      
      const { error } = await supabase
        .from('barbershops')
        .update({ expires_at })
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true, expires_at });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao alterar data de expiração' });
    }
  });

  // Impersonate a shop (Master only)
  api.post('/admin/master/impersonate/:shopId', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { shopId } = req.params;
      
      // Get the shop details to confirm it exists
      const { data: shop, error: shopError } = await supabase
        .from('barbershops')
        .select('*')
        .eq('id', shopId)
        .maybeSingle();
      
      if (shopError || !shop) throw new Error('Barbearia não encontrada');

      // Create a master-elevated token for this specific shop
      const token = jwt.sign({ 
        id: (req as any).user.id, 
        barbershopId: shopId, 
        role: 'master', // Keep master role so they can still access master tools if needed
        email: (req as any).user.email,
        isImpersonating: true
      }, JWT_SECRET, { expiresIn: '2h' }); // Short-lived token for impersonation
      
      res.json({ success: true, token, shop });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao entrar no dashboard', details: e.message });
    }
  });

  // --- END MASTER ADMIN ROUTES ---

  api.post('/seed', async (req, res) => {
    try {
      console.log('[SEED] Starting database sync...');
      const shopId = 'shop-1';
      const { data: existingShop } = await supabase.from('barbershops').select('*').eq('id', shopId).maybeSingle();
      
      const hashDefault = await bcrypt.hash('admin123', 10);
      const hashMarcus = await bcrypt.hash('Luna2025', 10);

      if (!existingShop) {
        await supabase.from('barbershops').insert({
          id: shopId,
          name: 'Doiseme Barber Shop',
          slug: 'doiseme',
          address: 'Rua das Flores, 123 - Centro',
          phone: '11999999999',
          instagram: '@doiseme.barber'
        });
      }

      const usersToSeed = [
        {
          id: 'user-admin',
          barbershop_id: shopId,
          name: 'Admin Doiseme',
          email: 'admin@doiseme.com',
          password_hash: hashDefault,
          role: 'master'
        },
        {
          id: 'user-marcus',
          barbershop_id: shopId,
          name: 'Marcus Doiseme',
          email: 'marcusdoiseme@doiseme.com',
          password_hash: hashMarcus,
          role: 'master'
        }
      ];

      for (const u of usersToSeed) {
        const { data: ext } = await supabase.from('users').select('id').eq('email', u.email).maybeSingle();
        if (!ext) {
          await supabase.from('users').insert(u);
        } else {
          await supabase.from('users').update({ role: 'master' }).eq('email', u.email);
        }
      }

      // Barbers ensure
      const { count: bCount } = await supabase.from('barbers').select('*', { count: 'exact', head: true });
      if (!bCount) {
        await supabase.from('barbers').insert([
          { id: 'barber-1', barbershop_id: shopId, name: 'João Silva', active: true },
          { id: 'barber-2', barbershop_id: shopId, name: 'Carlos Santos', active: true }
        ]);
      }

      // Services ensure
      const { count: sCount } = await supabase.from('services').select('*', { count: 'exact', head: true });
      if (!sCount) {
        await supabase.from('services').insert([
          { id: 'srv-1', barbershop_id: shopId, name: 'Corte Clássico', duration_minutes: 30, price: 45.00, active: true },
          { id: 'srv-2', barbershop_id: shopId, name: 'Barba Terapia', duration_minutes: 30, price: 35.00, active: true }
        ]);
      }

      res.json({ 
        success: true, 
        message: 'Sistema sincronizado com sucesso!',
        logins: 'Marcus: marcusdoiseme@doiseme.com (Luna2025) | Admin: admin@doiseme.com (admin123)' 
      });
    } catch (error: any) {
      console.error('[SEED_ERROR]', error);
      res.status(500).json({ error: 'Seed failed', details: error.message });
    }
  });

  // API 404 Handler - Prevent falling through to SPA HTML
  api.use((req, res) => {
    console.warn(`[API_404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: 'Rota da API não encontrada',
      path: req.originalUrl 
    });
  });

  // API Global Error Handler
  api.use((err: any, req: any, res: any, next: any) => {
    console.error(`[API_ERROR] ${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({ 
      error: 'Erro interno na API',
      message: err.message 
    });
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
    app.use(express.static(distPath, { maxAge: '1d' }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Final server setup
  if (process.env.VERCEL !== '1') {
    app.listen(PORT, '0.0.0.0', async () => {
      console.log(`Server running on http://localhost:${PORT}`);
      
      // ENSURE MASTER USERS ON STARTUP
      try {
        console.log('[STARTUP] Syncing Master users...');
        const masterUsers = [
          { email: 'marcusdoiseme@doiseme.com', name: 'Marcus Doiseme', pass: 'Luna2025' },
          { email: 'admin@doiseme.com', name: 'Admin Doiseme', pass: 'admin123' },
          { email: 'marcusdias2014mv@gmail.com', name: 'Marcus Dias', pass: 'admin123' }
        ];

        for (const u of masterUsers) {
          const { data: existingUser } = await supabase.from('users').select('id').eq('email', u.email).maybeSingle();
          
          if (existingUser) {
            const { error } = await supabase.from('users').update({ role: 'master' }).eq('email', u.email);
            if (!error) console.log(`[STARTUP] Updated ${u.email} to master.`);
          } else {
            console.log(`[STARTUP] Creating master user: ${u.email}`);
            const passwordHash = await bcrypt.hash(u.pass, 10);
            const { error } = await supabase.from('users').insert({
              id: crypto.randomUUID(),
              barbershop_id: 'shop-1', // Ensure shop-1 exists as well
              name: u.name,
              email: u.email,
              password_hash: passwordHash,
              role: 'master'
            });
            if (error) console.error(`[STARTUP] Failed to create ${u.email}:`, error);
          }
        }
      } catch (e) {
        console.error('[STARTUP_SYNC_FAILED]', e);
      }
    });
  }
}

startServer();

export default app;
// end
