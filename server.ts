import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { supabase } from './src/db/supabase';
import { nicheDb } from './src/db/nicheDb';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-doiseme';

const app = express();
app.set('trust proxy', 1);

async function startServer() {
  const PORT = 3000;

  // Test DB connection on startup
  try {
    const { data: test, error: testError } = await supabase
      .from('barbershops')
      .select('id, name')
      .limit(1);

    if (testError) {
      console.warn('[DB_INIT_CHECK] Initial check note:', testError.message);
    } else {
      console.log('[DB_INIT_CHECK] Supabase connected successfully. Found shop:', test?.[0]?.name || 'none');
    }
  } catch (err: any) {
    console.warn('[DB_INIT_CHECK] Note during startup check:', err.message);
  }


  // Security Headers
  app.use(helmet({ contentSecurityPolicy: false })); // Disabled CSP to avoid breaking React dev server inline scripts
  app.disable('x-powered-by');

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'data', 'uploads')));

  // API Routes
  const api = express.Router();
  
  // LOG ALL API REQUESTS FOR DEBUGGING
  api.use((req, res, next) => {
    console.log(`[API_REQ] ${req.method} ${req.path}`);
    next();
  });
  const DEFAULT_SETTINGS = {
    monday: { isClosed: true, open: '09:00', close: '18:00', hasLunchBreak: false, lunchOpen: '12:00', lunchClose: '13:00' },
    tuesday: { isClosed: false, open: '09:00', close: '18:00', hasLunchBreak: false, lunchOpen: '12:00', lunchClose: '13:00' },
    wednesday: { isClosed: false, open: '09:00', close: '18:00', hasLunchBreak: false, lunchOpen: '12:00', lunchClose: '13:00' },
    thursday: { isClosed: false, open: '09:00', close: '18:00', hasLunchBreak: false, lunchOpen: '12:00', lunchClose: '13:00' },
    friday: { isClosed: false, open: '09:00', close: '18:00', hasLunchBreak: false, lunchOpen: '12:00', lunchClose: '13:00' },
    saturday: { isClosed: false, open: '09:00', close: '18:00', hasLunchBreak: false, lunchOpen: '12:00', lunchClose: '13:00' },
    sunday: { isClosed: true, open: '09:00', close: '18:00', hasLunchBreak: false, lunchOpen: '12:00', lunchClose: '13:00' }
  };

  const getShopSettings = async (shopId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('config')
        .eq('barbershop_id', shopId)
        .maybeSingle(); 
      
      if (error || !data) return DEFAULT_SETTINGS;

      let config = {};
      if (typeof data.config === 'string') {
        try {
          config = JSON.parse(data.config);
        } catch (e) {
          console.error("Failed to parse settings JSON:", e);
          return DEFAULT_SETTINGS;
        }
      } else {
        config = data.config || {};
      }

      // Ensure all days have nested properties (merge with default)
      const merged: any = {};
      Object.keys(DEFAULT_SETTINGS).forEach(day => {
        merged[day] = { 
          ...(DEFAULT_SETTINGS as any)[day], 
          ...(config as any)[day] || {} 
        };
      });
      return merged;
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
    const authorizedEmails = ['marcusdoiseme@doiseme.com', 'marcusdias2014mv@gmail.com', 'admin@doiseme.com'];
    const userEmail = req.user?.email?.toLowerCase();
    
    const isAuthorized = userEmail && authorizedEmails.includes(userEmail);
    const isMasterRole = req.user?.role === 'master';

    if (isMasterRole || isAuthorized) {
      next();
    } else {
      console.warn(`[SECURITY_ALERT] Non-authorized Master attempt: ${req.user?.email} (Role: ${req.user?.role})`);
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

  // DEBUG: List all shops for internal diagnostics
  api.get('/admin/debug/shops', authenticateToken, async (req: any, res) => {
    // Only allow some email or just anyone with a valid token for now since it's dev
    try {
      const { data, error } = await supabase.from('barbershops').select('id, name, slug, is_blocked');
      if (error) console.warn('[DEBUG_DB_SCAN_WARN]', error.message);
      res.json({ count: data?.length, shops: data, error: error ? error.message : null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get barbershop info by slug (Public)
  api.get('/public/shop/:identifier', async (req, res) => {
    try {
      const identifier = req.params.identifier.trim().toLowerCase();

      const { data: shop, error } = await supabase
        .from('barbershops')
        .select('*')
        .eq('slug', identifier)
        .single();

      if (error || !shop) {
        if (error) console.warn('[SHOP_NOT_FOUND_WARN]', identifier, error.message);
        return res.status(404).json({
          error: 'Barbearia não encontrada',
          debug: { identifier }
        });
      }

      // Extract customizable colors with robust fallbacks
      let primaryColor = shop.primary_color || '#D4AF37';
      let backgroundColor = (shop as any).background_color || shop.secondary_color || '#0a0a0a';
      let textColor = (shop as any).text_color || '#ffffff';

      if (shop.booking_layout && typeof shop.booking_layout === 'string' && shop.booking_layout.startsWith('{')) {
        try {
          const parsed = JSON.parse(shop.booking_layout);
          if (parsed.primaryColor) primaryColor = parsed.primaryColor;
          if (parsed.backgroundColor) backgroundColor = parsed.backgroundColor;
          if (parsed.textColor) textColor = parsed.textColor;
        } catch (e) {}
      }

      return res.json({
        ...shop,
        primary_color: primaryColor,
        primaryColor,
        secondary_color: backgroundColor,
        secondaryColor: backgroundColor,
        background_color: backgroundColor,
        backgroundColor,
        text_color: textColor,
        textColor,
        whatsapp: shop.whatsapp || shop.phone,
        instagram: shop.instagram ? shop.instagram.replace('@', '') : null
      });
    } catch (e: any) {
      console.error('[PUBLIC_SHOP_CRASH]', e);
      res.status(500).json({ error: 'Erro interno ao buscar barbearia', details: e.message });
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

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);
        return res.json({ publicUrl });
      }

      console.warn('[SERVER_UPLOAD_SUPABASE_WARN] Falling back to local storage:', error.message);
      
      // Fallback: save to local data/uploads/
      const cleanName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeFileName = `${Date.now()}-${cleanName}`;
      const localUploadDir = path.join(process.cwd(), 'data', 'uploads');
      if (!fs.existsSync(localUploadDir)) {
        fs.mkdirSync(localUploadDir, { recursive: true });
      }
      const targetDiskPath = path.join(localUploadDir, safeFileName);
      fs.writeFileSync(targetDiskPath, buffer);
      
      return res.json({ publicUrl: `/uploads/${safeFileName}` });
    } catch (e: any) {
      console.error('[SERVER_UPLOAD_CATCH]', e);
      // Even in catch, try writing to local disk
      try {
        const buffer = Buffer.from(content, 'base64');
        const cleanName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
        const safeFileName = `${Date.now()}-${cleanName}`;
        const localUploadDir = path.join(process.cwd(), 'data', 'uploads');
        if (!fs.existsSync(localUploadDir)) {
          fs.mkdirSync(localUploadDir, { recursive: true });
        }
        fs.writeFileSync(path.join(localUploadDir, safeFileName), buffer);
        return res.json({ publicUrl: `/uploads/${safeFileName}` });
      } catch (diskErr: any) {
        return res.status(500).json({ error: diskErr.message || 'Erro interno no upload' });
      }
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

      let primaryColor = data.primary_color || '#D4AF37';
      let backgroundColor = data.background_color || data.secondary_color || '#0a0a0a';
      let textColor = data.text_color || '#ffffff';

      if (data.booking_layout && typeof data.booking_layout === 'string' && data.booking_layout.startsWith('{')) {
        try {
          const parsed = JSON.parse(data.booking_layout);
          if (parsed.primaryColor) primaryColor = parsed.primaryColor;
          if (parsed.backgroundColor) backgroundColor = parsed.backgroundColor;
          if (parsed.textColor) textColor = parsed.textColor;
        } catch (e) {}
      }

      res.json({
        ...data,
        primary_color: primaryColor,
        primaryColor,
        secondary_color: backgroundColor,
        secondaryColor: backgroundColor,
        background_color: backgroundColor,
        backgroundColor,
        text_color: textColor,
        textColor
      });
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
      
      const barberIds = (shopBarbers || []).map(b => b.id.toString());
      const photosMap = nicheDb.getEntityPhotosMap(barberIds);

      // Map to camelCase for the frontend including assigned serviceIds and photoUrl
      res.json((shopBarbers || []).map(b => ({
        id: b.id,
        barbershopId: b.barbershop_id,
        userId: b.user_id,
        name: b.name,
        active: b.active,
        photoUrl: photosMap[b.id] || b.photo_url || b.avatar_url || null,
        photo_url: photosMap[b.id] || b.photo_url || b.avatar_url || null,
        serviceIds: Array.isArray(b.service_ids) ? b.service_ids : []
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
      
      const serviceIds = (shopServices || []).map(s => s.id.toString());
      const photosMap = nicheDb.getEntityPhotosMap(serviceIds);

      res.json((shopServices || []).map(s => ({
        id: s.id,
        barbershopId: s.barbershop_id,
        name: s.name,
        durationMinutes: s.duration_minutes,
        price: s.price,
        active: s.active,
        imageUrl: photosMap[s.id] || s.image_url || s.photo_url || null,
        image_url: photosMap[s.id] || s.image_url || s.photo_url || null
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

      // Lunch break info
      const hasLunch = dayConfig.hasLunchBreak;
      const lunchStartH = hasLunch ? parseInt(dayConfig.lunchOpen.split(':')[0]) : -1;
      const lunchStartM = hasLunch ? parseInt(dayConfig.lunchOpen.split(':')[1]) : -1;
      const lunchEndH = hasLunch ? parseInt(dayConfig.lunchClose.split(':')[0]) : -1;
      const lunchEndM = hasLunch ? parseInt(dayConfig.lunchClose.split(':')[1]) : -1;

      for (let i = startH; i <= endH; i++) {
        const time = `${i.toString().padStart(2, '0')}:00`;
        const time30 = `${i.toString().padStart(2, '0')}:30`;
        
        // Prevent booking exactly at closing hour
        if (i === endH) continue;
        
        let isTimePast = false;
        let isTime30Past = false;
        
        // Block times that have already passed today
        if (date === todayStr) {
          if (i < currentHour || (i === currentHour && currentMinute >= 0)) isTimePast = true;
          if (i < currentHour || (i === currentHour && currentMinute >= 30)) isTime30Past = true;
        }

        // Check for lunch break
        let isLunch00 = false;
        let isLunch30 = false;
        
        if (hasLunch) {
          // Block if time is within lunch range
          // [lunchStart, lunchEnd)
          const t00Val = i * 60;
          const t30Val = i * 60 + 30;
          const lStartVal = lunchStartH * 60 + lunchStartM;
          const lEndVal = lunchEndH * 60 + lunchEndM;

          if (t00Val >= lStartVal && t00Val < lEndVal) isLunch00 = true;
          if (t30Val >= lStartVal && t30Val < lEndVal) isLunch30 = true;
        }
        
        if (!isTimePast && !isLunch00 && !existing?.find(a => a.start_time === time)) slots.push(time);
        if (!isTime30Past && !isLunch30 && !existing?.find(a => a.start_time === time30)) slots.push(time30);
      }
      
      res.json(slots);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
    }
  });

  // Create appointment (Refacted to fix saving issues)
  api.post('/appointments', async (req, res) => {
    // 1. ADICIONAR LOGS COMPLETOS NA ROTA
    console.log('📥 BODY RECEBIDO:', req.body);

    const { 
      barbershopId, 
      barberId, 
      serviceId, 
      clientName, 
      clientPhone, 
      date, 
      startTime 
    } = req.body;

    // 6. VALIDAR CAMPOS
    if (!barbershopId || !barberId || !serviceId || !clientName || !clientPhone || !date || !startTime) {
      console.log('❌ VALIDAÇÃO FALHOU: Campos obrigatórios ausentes');
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
      // 7. VALIDAR TIPOS E GARANTIR CLIENTE
      // Nota: A tabela appointments do banco usa client_id vinculado à tabela clients
      let { data: client, error: clientFetchErr } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', clientPhone)
        .eq('barbershop_id', barbershopId)
        .maybeSingle();

      if (!client) {
        console.log('📋 Criando novo cliente na tabela clients...');
        const { data: newC, error: createError } = await supabase
          .from('clients')
          .insert({
            id: crypto.randomUUID(),
            name: clientName,
            phone: clientPhone,
            barbershop_id: barbershopId
          })
          .select()
          .single();

        if (createError) throw createError;
        client = newC;
      }

      // Buscar duração do serviço
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', serviceId)
        .single();
      
      const duration = service?.duration_minutes || 30;
      
      // Cálculo de end_time
      const [sh, sm] = startTime.split(':').map(Number);
      const totalMinutes = sh * 60 + sm + duration;
      const eh = Math.floor(totalMinutes / 60);
      const em = totalMinutes % 60;
      const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

      // 2. GARANTIR QUE O INSERT ESTÁ SENDO EXECUTADO
      // Usando o padrão solicitado, mas ajustado para as colunas reais do banco
      const insertData = {
        id: crypto.randomUUID(),
        barbershop_id: barbershopId,
        barber_id: barberId,
        service_id: serviceId,
        client_id: client.id, // ID do cliente encontrado/criado
        date: date,
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled'
      };

      console.log('📝 TENTANDO INSERT NO SUPABASE:', insertData);

      const { data, error } = await supabase
        .from('appointments')
        .insert([insertData])
        .select();

      // 3. TRATAR ERRO CORRETAMENTE
      if (error) {
        console.error('🚨 ERRO NO INSERT:', error.message);
        return res.status(400).json({
          error: error.message,
          details: error
        });
      }

      // 5. GARANTIR RESPOSTA DE SUCESSO
      return res.json({
        success: true,
        data
      });

    } catch (e: any) {
      console.error('🔥 CRASH NA ROTA /api/appointments:', e);
      return res.status(400).json({ 
        error: e.message || 'Erro ao salvar agendamento', 
        details: e 
      });
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

  // Trocar senha do usuário autenticado
  api.post('/admin/change-password', authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = req.user.id;
      const userEmail = req.user.email;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'Todos os campos de senha são obrigatórios' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'A nova senha e a confirmação não coincidem' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
      }

      // 1. Buscar dados do usuário autenticado no banco
      let { data: user, error: fetchErr } = await supabase
        .from('users')
        .select('id, password_hash, email')
        .eq('id', userId)
        .maybeSingle();

      if (!user && userEmail) {
        const fallback = await supabase
          .from('users')
          .select('id, password_hash, email')
          .eq('email', userEmail)
          .maybeSingle();
        user = fallback.data;
        fetchErr = fallback.error;
      }

      if (fetchErr || !user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // 2. Validar senha atual
      const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentValid) {
        return res.status(400).json({ error: 'A senha atual informada está incorreta' });
      }

      // 3. Verificar se a nova senha é idêntica à atual
      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual' });
      }

      // 4. Gerar novo hash e atualizar no banco
      const newHash = await bcrypt.hash(newPassword, 10);
      const { error: updateErr } = await supabase
        .from('users')
        .update({
          password_hash: newHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateErr) {
        console.warn('[CHANGE_PASSWORD_ERR]', updateErr.message);
        return res.status(500).json({ error: 'Erro ao atualizar a senha no banco de dados' });
      }

      console.log(`[PASSWORD CHANGED] User ${user.email} successfully updated their password`);
      return res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (error: any) {
      console.error('[CHANGE_PASSWORD_CRASH]', error);
      return res.status(500).json({ error: 'Erro interno ao processar troca de senha' });
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
  api.patch('/admin/shop/:id?', authenticateToken, async (req: any, res) => {
    // 1. ADICIONAR LOGS
    console.log('BODY:', req.body);
    console.log('ID:', req.params.id);

    try {
      // 2. GARANTIR UPDATE CORRETO
      const targetId = req.params.id || req.user.barbershopId;

      const primaryColor = req.body.primary_color || req.body.primaryColor;
      const backgroundColor = req.body.background_color || req.body.backgroundColor || req.body.secondary_color || req.body.secondaryColor;
      const textColor = req.body.text_color || req.body.textColor;
      const rawLayout = req.body.booking_layout || req.body.bookingLayout || 'grid';

      // Serialize colors into booking_layout JSON to guarantee persistence even without dedicated DB columns
      let bookingLayoutPayload = rawLayout;
      try {
        const layoutObj = typeof rawLayout === 'string' && rawLayout.startsWith('{')
          ? JSON.parse(rawLayout)
          : { layout: rawLayout };
        if (primaryColor) layoutObj.primaryColor = primaryColor;
        if (backgroundColor) layoutObj.backgroundColor = backgroundColor;
        if (textColor) layoutObj.textColor = textColor;
        bookingLayoutPayload = JSON.stringify(layoutObj);
      } catch (e) {
        bookingLayoutPayload = JSON.stringify({
          layout: rawLayout,
          primaryColor,
          backgroundColor,
          textColor
        });
      }

      const updateData: any = {
        name: req.body.name,
        logo_url: req.body.logo_url || req.body.logoUrl,
        banner_url: req.body.banner_url || req.body.bannerUrl,
        whatsapp: req.body.whatsapp,
        phone: req.body.whatsapp,
        instagram: req.body.instagram,
        address: req.body.address,
        slug: req.body.slug,
        primary_color: primaryColor,
        secondary_color: backgroundColor, // store background color in secondary_color as well
        background_color: backgroundColor,
        text_color: textColor,
        booking_layout: bookingLayoutPayload,
        segment: req.body.segment,
        maps_url: req.body.maps_url || req.body.mapsUrl,
        show_whatsapp: req.body.show_whatsapp !== undefined ? req.body.show_whatsapp : req.body.showWhatsapp,
        show_instagram: req.body.show_instagram !== undefined ? req.body.show_instagram : req.body.showInstagram,
        show_address: req.body.show_address !== undefined ? req.body.show_address : req.body.showAddress,
        updated_at: new Date().toISOString()
      };

      // Limpar campos undefined
      Object.keys(updateData).forEach(key => {
        if ((updateData as any)[key] === undefined) delete (updateData as any)[key];
      });

      console.log('📝 TENTANDO UPDATE NO SUPABASE:', updateData);

      let { data, error } = await supabase
        .from('barbershops')
        .update(updateData)
        .eq('id', targetId)
        .select();

      // If optional columns do not exist yet in Supabase (e.g. background_color, text_color, segment), retry without them
      if (error && error.message?.includes('column')) {
        console.warn('⚠️ Coluna opcional ainda não existe no Supabase. Removendo campos não existentes e retentando...', error.message);
        if (error.message.includes('background_color')) delete updateData.background_color;
        if (error.message.includes('text_color')) delete updateData.text_color;
        if (error.message.includes('segment')) delete updateData.segment;

        const retry = await supabase
          .from('barbershops')
          .update(updateData)
          .eq('id', targetId)
          .select();
        
        if (retry.error && retry.error.message?.includes('column')) {
          if (retry.error.message.includes('background_color')) delete updateData.background_color;
          if (retry.error.message.includes('text_color')) delete updateData.text_color;
          if (retry.error.message.includes('segment')) delete updateData.segment;
          const retry2 = await supabase
            .from('barbershops')
            .update(updateData)
            .eq('id', targetId)
            .select();
          data = retry2.data;
          error = retry2.error;
        } else {
          data = retry.data;
          error = retry.error;
        }
      }

      // 3. TRATAR ERRO
      if (error) {
        console.error('🚨 ERRO NO UPDATE:', error.message);
        return res.status(400).json({ error });
      }

      const updatedShop = data?.[0] || {};
      return res.json({
        success: true,
        data: {
          ...updatedShop,
          primary_color: primaryColor || updatedShop.primary_color,
          primaryColor: primaryColor || updatedShop.primary_color,
          secondary_color: backgroundColor || updatedShop.secondary_color,
          secondaryColor: backgroundColor || updatedShop.secondary_color,
          background_color: backgroundColor || updatedShop.background_color,
          backgroundColor: backgroundColor || updatedShop.background_color,
          text_color: textColor || updatedShop.text_color,
          textColor: textColor || updatedShop.text_color,
          booking_layout: bookingLayoutPayload
        }
      });

    } catch (e: any) {
      console.error('🔥 CRASH NA ROTA /api/admin/shop:', e);
      return res.status(400).json({ 
        error: e.message || 'Erro ao salvar perfil', 
        details: e 
      });
    }
  });

  api.get('/admin/dashboard', authenticateToken, async (req: any, res) => {
    const { barbershopId } = (req as any).user;
    const { start, end } = req.query;
    console.log(`[DASHBOARD] Loading for shop ${barbershopId}, range: ${start} to ${end}`);
    
    try {
      // Use "date" column instead of "start_time" for date filtering
      let appointmentsQuery = supabase.from('appointments').select('*').eq('barbershop_id', barbershopId);
      
      if (start && end) {
        appointmentsQuery = appointmentsQuery.gte('date', start).lte('date', end);
      } else {
        // Fallback to current month if no range provided
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        appointmentsQuery = appointmentsQuery.gte('date', startOfMonth).lte('date', endOfMonth);
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
      
      const barberIds = (allBarbers || []).map(b => b.id.toString());
      const barbersMetaMap = nicheDb.getBarbersMetadataMap(barberIds);
      const enrichedBarbers = (allBarbers || []).map(b => ({
        ...b,
        commission_percentage: barbersMetaMap[b.id]?.commission_percentage ?? b.commission_percentage ?? 50
      }));

      // Calculate revenue and commissions
      let totalRevenue = 0;
      let totalCommissions = 0;
      (allAppointments || []).forEach(app => {
        if (app.status === 'completed' || app.status === 'confirmed') {
          const service = (allServices || []).find(s => s.id === app.service_id);
          const barber = enrichedBarbers.find(b => b.id === app.barber_id);
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
      const totalDraws = (allExpenses || [])
        .filter(e => e.category === 'draw')
        .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

      // Calculate appointments by barber
      const appointmentsByBarber = enrichedBarbers.map(barber => {
        const barberApps = (allAppointments || []).filter(app => app.barber_id === barber.id && (app.status === 'completed' || app.status === 'confirmed'));
        const count = barberApps.length;
        const revenue = barberApps.reduce((acc, app) => {
          const service = (allServices || []).find(s => s.id === app.service_id);
          return acc + (Number(service?.price) || 0);
        }, 0);
        return { 
          id: barber.id,
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
        totalDraws,
        netProfit: totalRevenue - totalCommissions - (totalExpenses - totalDraws),
        appointmentsByBarber
      });
    } catch (error: any) {
      console.error('[DASHBOARD_CATCH]', error);
      res.status(500).json({ error: 'Erro interno ao processar dashboard', details: error.message });
    }
  });

  // Finances / Expenses
  api.get('/admin/expenses', authenticateToken, async (req: any, res) => {
    const { start, end } = req.query;
    try {
      let query = supabase
        .from('finances')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .eq('type', 'expense');

      if (start && end) {
        query = query.gte('date', start).lte('date', end);
      }

      const { data: financesList, error } = await query.order('date', { ascending: false });
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
          id, date, start_time, end_time, status, client_id,
          clients (id, name, phone),
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
        clientId: (apt.clients as any)?.id || apt.client_id,
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

      const barberIds = (barbersList || []).map((b: any) => b.id.toString());
      const photosMap = nicheDb.getEntityPhotosMap(barberIds);
      const metaMap = nicheDb.getBarbersMetadataMap(barberIds);

      res.json((barbersList || []).map((b: any) => ({
        ...b,
        commission_percentage: metaMap[b.id]?.commission_percentage ?? b.commission_percentage ?? 50,
        photo_url: photosMap[b.id] || b.photo_url || b.avatar_url || null,
        photoUrl: photosMap[b.id] || b.photo_url || b.avatar_url || null,
        service_ids: Array.isArray(b.service_ids) ? b.service_ids : []
      })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
  });

  api.post('/admin/barbers', authenticateToken, async (req: any, res) => {
    const { name, commission_percentage, service_ids, photo_url, photoUrl } = req.body;
    try {
      const id = crypto.randomUUID();
      const finalPhoto = photo_url || photoUrl || null;

      const insertData: any = {
        id,
        barbershop_id: req.user.barbershopId,
        name,
        active: true
      };
      if (Array.isArray(service_ids)) {
        insertData.service_ids = service_ids;
      }

      let { error } = await supabase.from('barbers').insert(insertData);

      // If service_ids column doesn't exist yet, retry safely without it
      if (error && (error.code === 'PGRST204' || error.message?.includes('service_ids') || error.message?.includes('schema cache'))) {
        console.warn('[DB_FALLBACK] service_ids column not yet migrated in Supabase. Inserting without it.');
        delete insertData.service_ids;
        const retry = await supabase.from('barbers').insert(insertData);
        error = retry.error;
      }

      if (error) throw error;

      // Persist commission in nicheDb
      if (commission_percentage !== undefined) {
        nicheDb.upsertBarberMetadata(id, req.user.barbershopId, Number(commission_percentage));
      }

      // Persist photo safely in nicheDb
      if (finalPhoto) {
        nicheDb.upsertEntityPhoto(id, req.user.barbershopId, 'barber', finalPhoto);
      }

      res.json({ success: true, id, photo_url: finalPhoto });
    } catch (error) {
      console.error('[CREATE_BARBER_ERROR]', error);
      res.status(500).json({ error: 'Erro ao criar profissional' });
    }
  });

  api.patch('/admin/barbers/:id', authenticateToken, async (req: any, res) => {
    const { active, name, commission_percentage, service_ids, photo_url, photoUrl } = req.body;
    try {
      const updateData: any = {};
      if (active !== undefined) updateData.active = active;
      if (name !== undefined) updateData.name = name;
      if (service_ids !== undefined && Array.isArray(service_ids)) updateData.service_ids = service_ids;

      if (Object.keys(updateData).length > 0) {
        let { error } = await supabase
          .from('barbers')
          .update(updateData)
          .eq('id', req.params.id)
          .eq('barbershop_id', req.user.barbershopId);

        // If service_ids does not exist in schema cache, retry without it
        if (error && (error.code === 'PGRST204' || error.message?.includes('service_ids') || error.message?.includes('schema cache'))) {
          console.warn('[DB_FALLBACK] service_ids column not yet migrated in Supabase. Updating without it.');
          delete updateData.service_ids;
          if (Object.keys(updateData).length > 0) {
            const retry = await supabase
              .from('barbers')
              .update(updateData)
              .eq('id', req.params.id)
              .eq('barbershop_id', req.user.barbershopId);
            error = retry.error;
          } else {
            error = null;
          }
        }

        if (error) throw error;
      }

      // Save commission_percentage in nicheDb
      if (commission_percentage !== undefined) {
        nicheDb.upsertBarberMetadata(req.params.id, req.user.barbershopId, Number(commission_percentage));
      }

      // Update photo in nicheDb if provided
      if (photo_url !== undefined || photoUrl !== undefined) {
        nicheDb.upsertEntityPhoto(req.params.id, req.user.barbershopId, 'barber', photo_url ?? photoUrl);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[UPDATE_BARBER_ERROR]', error);
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
      
      const serviceIds = (servicesList || []).map((s: any) => s.id.toString());
      const photosMap = nicheDb.getEntityPhotosMap(serviceIds);

      res.json((servicesList || []).map(s => ({
        id: s.id,
        barbershopId: s.barbershop_id,
        name: s.name,
        durationMinutes: s.duration_minutes,
        price: s.price,
        active: s.active,
        image_url: photosMap[s.id] || s.image_url || s.photo_url || null,
        imageUrl: photosMap[s.id] || s.image_url || s.photo_url || null
      })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar serviços' });
    }
  });

  api.post('/admin/services', authenticateToken, async (req: any, res) => {
    const { name, durationMinutes, price, image_url, imageUrl, photo_url } = req.body;
    try {
      const id = crypto.randomUUID();
      const finalImage = image_url || imageUrl || photo_url || null;

      const { error } = await supabase.from('services').insert({
        id,
        barbershop_id: req.user.barbershopId,
        name,
        duration_minutes: Number(durationMinutes),
        price: Number(price),
        active: true
      });
      if (error) throw error;

      // Save photo in nicheDb
      if (finalImage) {
        nicheDb.upsertEntityPhoto(id, req.user.barbershopId, 'service', finalImage);
      }

      res.json({ success: true, id, image_url: finalImage });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar serviço' });
    }
  });

  api.patch('/admin/services/:id', authenticateToken, async (req: any, res) => {
    const { active, name, durationMinutes, price, image_url, imageUrl, photo_url } = req.body;
    try {
      const updateData: any = {};
      if (active !== undefined) updateData.active = active;
      if (name !== undefined) updateData.name = name;
      if (durationMinutes !== undefined) updateData.duration_minutes = durationMinutes;
      if (price !== undefined) updateData.price = price;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('services')
          .update(updateData)
          .eq('id', req.params.id)
          .eq('barbershop_id', req.user.barbershopId);
        if (error) throw error;
      }

      if (image_url !== undefined || imageUrl !== undefined || photo_url !== undefined) {
        nicheDb.upsertEntityPhoto(req.params.id, req.user.barbershopId, 'service', image_url ?? imageUrl ?? photo_url);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar serviço' });
    }
  });

  api.delete('/admin/services/:id', authenticateToken, async (req: any, res) => {
    try {
      console.log(`[DELETE_SERVICE] Attempting to delete service ${req.params.id} for shop ${req.user.barbershopId}`);
      
      // First delete associated appointments because of FK constraint
      const { error: apptErr } = await supabase
        .from('appointments')
        .delete()
        .eq('service_id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);

      if (apptErr) {
        console.error('[DELETE_SERVICE_APPOINTMENTS_ERR]', apptErr);
        // We continue anyway, maybe there were no appointments
      }

      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      
      if (error) {
        console.error('[DELETE_SERVICE_ERR]', error);
        throw error;
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[DELETE_SERVICE_CRASH]', error);
      res.status(500).json({ error: 'Erro ao excluir serviço', details: error.message });
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
      console.log(`[DELETE_CLIENTS] Attempting to delete ${ids.length} clients for shop ${req.user.barbershopId}`);
      
      // First delete associated appointments to clear Foreign Key constraints before deleting clients
      const { error: apptErr } = await supabase
        .from('appointments')
        .delete()
        .in('client_id', ids)
        .eq('barbershop_id', req.user.barbershopId);

      if (apptErr) {
        console.warn('[DELETE_CLIENTS_APPOINTMENTS_ERR]', apptErr);
      }

      const { error } = await supabase
        .from('clients')
        .delete()
        .in('id', ids)
        .eq('barbershop_id', req.user.barbershopId);
        
      if (error) {
        console.error('[DELETE_CLIENTS_ERR]', error);
        throw error;
      }
      
      console.log(`[DELETE_CLIENTS_SUCCESS] Excluded ${ids.length} clients.`);
      res.json({ success: true, count: ids.length });
    } catch (error: any) {
      console.error('[DELETE_CLIENTS_CRASH]', error);
      res.status(500).json({ error: 'Erro ao excluir clientes', details: error.message });
    }
  });

  // --- CLIENT CLINICAL RECORDS & ANAMNESIS (NICHE: PSYCHOLOGY & OTHERS) ---
  api.get('/admin/clients/:id/records', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    try {
      // 1. Fetch client details
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('barbershop_id', barbershopId)
        .single();

      if (clientErr || !client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }

      // 2. Fetch clinical notes
      const notes = nicheDb.getNotesByClient(barbershopId, clientId);

      // 3. Fetch anamnesis
      const anamnesis = nicheDb.getAnamnesis(barbershopId, clientId);

      // 4. Fetch client appointments history
      const { data: appts } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', clientId)
        .eq('barbershop_id', barbershopId)
        .order('date', { ascending: false });

      // Fetch service and barber names for human-readable display
      const { data: services } = await supabase
        .from('services')
        .select('id, name')
        .eq('barbershop_id', barbershopId);

      const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name')
        .eq('barbershop_id', barbershopId);

      const enrichedAppts = (appts || []).map(a => {
        const s = (services || []).find(srv => srv.id === a.service_id);
        const b = (barbers || []).find(brb => brb.id === a.barber_id);
        return {
          ...a,
          serviceName: s?.name || 'Sessão / Consulta',
          barberName: b?.name || 'Profissional'
        };
      });

      res.json({
        client,
        notes,
        anamnesis,
        appointments: enrichedAppts
      });
    } catch (error: any) {
      console.error('[CLIENT_RECORDS_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar prontuário do cliente' });
    }
  });

  api.post('/admin/clients/:id/notes', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const { 
      title, 
      content, 
      session_date, 
      session_time, 
      patient_mood, 
      therapeutic_goals, 
      techniques_used, 
      is_private 
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo da anotação são obrigatórios' });
    }

    try {
      const id = crypto.randomUUID();
      const newNote = nicheDb.createNote({
        id,
        barbershop_id: barbershopId,
        client_id: clientId,
        author_name: req.user.email || 'Psicólogo(a)',
        session_date: session_date || new Date().toISOString().split('T')[0],
        session_time: session_time || undefined,
        title,
        content,
        patient_mood,
        therapeutic_goals,
        techniques_used,
        is_private: is_private !== undefined ? (is_private ? 1 : 0) : 1
      });

      res.json({ success: true, note: newNote });
    } catch (error: any) {
      console.error('[CREATE_NOTE_ERR]', error);
      res.status(500).json({ error: 'Erro ao registrar anotação clínica' });
    }
  });

  api.put('/admin/clients/:id/notes/:noteId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const noteId = req.params.noteId;
    const { 
      title, 
      content, 
      session_date, 
      session_time, 
      patient_mood, 
      therapeutic_goals, 
      techniques_used, 
      is_private 
    } = req.body;

    try {
      const updated = nicheDb.updateNote(noteId, barbershopId, {
        title,
        content,
        session_date,
        session_time,
        patient_mood,
        therapeutic_goals,
        techniques_used,
        is_private: is_private !== undefined ? (is_private ? 1 : 0) : undefined
      });

      if (!updated) {
        return res.status(404).json({ error: 'Anotação não encontrada' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[UPDATE_NOTE_ERR]', error);
      res.status(500).json({ error: 'Erro ao atualizar anotação clínica' });
    }
  });

  api.delete('/admin/clients/:id/notes/:noteId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const noteId = req.params.noteId;

    try {
      const deleted = nicheDb.deleteNote(noteId, barbershopId);
      if (!deleted) {
        return res.status(404).json({ error: 'Anotação não encontrada' });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('[DELETE_NOTE_ERR]', error);
      res.status(500).json({ error: 'Erro ao excluir anotação' });
    }
  });

  api.post('/admin/clients/:id/anamnesis', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const {
      chief_complaint,
      history_of_problem,
      family_medical_history,
      current_medications,
      emergency_contact_name,
      emergency_contact_phone,
      notes
    } = req.body;

    try {
      const anamnesis = nicheDb.upsertAnamnesis({
        client_id: clientId,
        barbershop_id: barbershopId,
        chief_complaint,
        history_of_problem,
        family_medical_history,
        current_medications,
        emergency_contact_name,
        emergency_contact_phone,
        notes
      });

      res.json({ success: true, anamnesis });
    } catch (error: any) {
      console.error('[ANAMNESIS_ERR]', error);
      res.status(500).json({ error: 'Erro ao salvar ficha de anamnese' });
    }
  });

  // --- NICHE 2: AESTHETICS & BEAUTY (ANAMNESIS, BEFORE/AFTER PHOTOS, TOUCHUP CYCLES) ---
  api.get('/admin/clients/:id/aesthetics', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;

    try {
      const anamnesis = nicheDb.getAestheticsAnamnesis(barbershopId, clientId);
      const photos = nicheDb.getAestheticsPhotos(barbershopId, clientId);
      const touchups = nicheDb.getAestheticsTouchups(barbershopId, clientId);

      res.json({
        anamnesis: anamnesis || {
          skin_phototype: '',
          skin_type: '',
          allergies: '',
          contraindications: '',
          main_complaints: '',
          home_care_routine: '',
          treatment_plan: '',
          notes: ''
        },
        photos: photos || [],
        touchups: touchups || []
      });
    } catch (error: any) {
      console.error('[AESTHETICS_GET_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar dados de estética da cliente' });
    }
  });

  api.post('/admin/clients/:id/aesthetics/anamnesis', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const {
      skin_phototype,
      skin_type,
      allergies,
      contraindications,
      main_complaints,
      home_care_routine,
      treatment_plan,
      notes
    } = req.body;

    try {
      const anamnesis = nicheDb.upsertAestheticsAnamnesis({
        client_id: clientId,
        barbershop_id: barbershopId,
        skin_phototype,
        skin_type,
        allergies,
        contraindications,
        main_complaints,
        home_care_routine,
        treatment_plan,
        notes
      });

      res.json({ success: true, anamnesis });
    } catch (error: any) {
      console.error('[AESTHETICS_ANAMNESIS_ERR]', error);
      res.status(500).json({ error: 'Erro ao salvar anamnese estética' });
    }
  });

  api.post('/admin/clients/:id/aesthetics/photos', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const { procedure_name, date, before_photo_url, after_photo_url, notes } = req.body;

    if (!procedure_name) {
      return res.status(400).json({ error: 'Nome do procedimento é obrigatório' });
    }

    try {
      const id = crypto.randomUUID();
      const photoRecord = nicheDb.addAestheticsPhoto({
        id,
        barbershop_id: barbershopId,
        client_id: clientId,
        procedure_name,
        date: date || new Date().toISOString().split('T')[0],
        before_photo_url,
        after_photo_url,
        notes
      });

      res.json({ success: true, photo: photoRecord });
    } catch (error: any) {
      console.error('[AESTHETICS_PHOTO_ERR]', error);
      res.status(500).json({ error: 'Erro ao salvar fotos de evolução' });
    }
  });

  api.delete('/admin/clients/:id/aesthetics/photos/:photoId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const photoId = req.params.photoId;

    try {
      const deleted = nicheDb.deleteAestheticsPhoto(photoId, barbershopId);
      if (!deleted) return res.status(404).json({ error: 'Registro fotográfico não encontrado' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[AESTHETICS_PHOTO_DEL_ERR]', error);
      res.status(500).json({ error: 'Erro ao excluir registro fotográfico' });
    }
  });

  api.post('/admin/clients/:id/aesthetics/touchups', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const { procedure_name, performed_date, return_due_date, interval_days, notes } = req.body;

    if (!procedure_name || !return_due_date) {
      return res.status(400).json({ error: 'Procedimento e data de retorno são obrigatórios' });
    }

    try {
      const id = crypto.randomUUID();
      const touchup = nicheDb.createAestheticsTouchup({
        id,
        barbershop_id: barbershopId,
        client_id: clientId,
        procedure_name,
        performed_date: performed_date || new Date().toISOString().split('T')[0],
        return_due_date,
        interval_days: Number(interval_days || 15),
        status: 'pending',
        notes
      });

      res.json({ success: true, touchup });
    } catch (error: any) {
      console.error('[AESTHETICS_TOUCHUP_ERR]', error);
      res.status(500).json({ error: 'Erro ao criar alerta de retorno/retoque' });
    }
  });

  api.patch('/admin/clients/:id/aesthetics/touchups/:touchupId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const touchupId = req.params.touchupId;
    const { status } = req.body;

    if (!['pending', 'contacted', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    try {
      const updated = nicheDb.updateAestheticsTouchupStatus(touchupId, barbershopId, status);
      if (!updated) return res.status(404).json({ error: 'Alerta de retorno não encontrado' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[AESTHETICS_TOUCHUP_PATCH_ERR]', error);
      res.status(500).json({ error: 'Erro ao atualizar status do retorno' });
    }
  });

  api.delete('/admin/clients/:id/aesthetics/touchups/:touchupId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const touchupId = req.params.touchupId;

    try {
      const deleted = nicheDb.deleteAestheticsTouchup(touchupId, barbershopId);
      if (!deleted) return res.status(404).json({ error: 'Alerta não encontrado' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[AESTHETICS_TOUCHUP_DEL_ERR]', error);
      res.status(500).json({ error: 'Erro ao excluir alerta de retorno' });
    }
  });

  // --- NICHE: PET SHOP & BANHO E TOSA ---
  api.get('/admin/clients/:id/pets', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;

    try {
      const pets = nicheDb.getPets(barbershopId, clientId);
      res.json({ pets });
    } catch (error: any) {
      console.error('[PETS_GET_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar pets do cliente' });
    }
  });

  api.post('/admin/clients/:id/pets', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const { pet_name, species, breed, size, coat_type, birth_year, temperament, allergies_medical, special_instructions } = req.body;

    if (!pet_name) {
      return res.status(400).json({ error: 'Nome do pet é obrigatório' });
    }

    try {
      const id = crypto.randomUUID();
      const pet = nicheDb.createPet({
        id,
        barbershop_id: barbershopId,
        client_id: clientId,
        pet_name,
        species: species || 'Cão',
        breed,
        size,
        coat_type,
        birth_year,
        temperament,
        allergies_medical,
        special_instructions
      });

      res.json({ success: true, pet });
    } catch (error: any) {
      console.error('[PETS_POST_ERR]', error);
      res.status(500).json({ error: 'Erro ao cadastrar pet' });
    }
  });

  api.delete('/admin/clients/:id/pets/:petId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const petId = req.params.petId;

    try {
      const deleted = nicheDb.deletePet(petId, barbershopId);
      if (!deleted) return res.status(404).json({ error: 'Pet não encontrado' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[PETS_DEL_ERR]', error);
      res.status(500).json({ error: 'Erro ao remover pet' });
    }
  });

  // --- NICHE: OFICINA MECÂNICA & ESTÉTICA AUTOMOTIVA ---
  api.get('/admin/clients/:id/vehicles', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;

    try {
      const vehicles = nicheDb.getVehicles(barbershopId, clientId);
      res.json({ vehicles });
    } catch (error: any) {
      console.error('[VEHICLES_GET_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar veículos do cliente' });
    }
  });

  api.post('/admin/clients/:id/vehicles', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const { plate, brand, model, year, color, current_km, next_oil_change_km, fuel_level, pre_existing_damages, notes } = req.body;

    if (!plate || !brand || !model) {
      return res.status(400).json({ error: 'Placa, marca e modelo são obrigatórios' });
    }

    try {
      const id = crypto.randomUUID();
      const vehicle = nicheDb.createVehicle({
        id,
        barbershop_id: barbershopId,
        client_id: clientId,
        plate,
        brand,
        model,
        year,
        color,
        current_km: current_km ? Number(current_km) : undefined,
        next_oil_change_km: next_oil_change_km ? Number(next_oil_change_km) : undefined,
        fuel_level,
        pre_existing_damages,
        notes
      });

      res.json({ success: true, vehicle });
    } catch (error: any) {
      console.error('[VEHICLES_POST_ERR]', error);
      res.status(500).json({ error: 'Erro ao registrar veículo' });
    }
  });

  api.delete('/admin/clients/:id/vehicles/:vehicleId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const vehicleId = req.params.vehicleId;

    try {
      const deleted = nicheDb.deleteVehicle(vehicleId, barbershopId);
      if (!deleted) return res.status(404).json({ error: 'Veículo não encontrado' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[VEHICLES_DEL_ERR]', error);
      res.status(500).json({ error: 'Erro ao remover veículo' });
    }
  });

  // --- NICHE: BARBEARIA & SALÃO (PREFERÊNCIAS & COLORAÇÃO) ---
  api.get('/admin/clients/:id/style-preferences', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;

    try {
      const preferences = nicheDb.getStylePreferences(barbershopId, clientId);
      res.json({
        preferences: preferences || {
          hair_cut_style: '',
          beard_style: '',
          blade_sizes: '',
          hair_color_formula: '',
          shampoo_preference: '',
          aftershave_allergies: '',
          notes: ''
        }
      });
    } catch (error: any) {
      console.error('[STYLE_PREFS_GET_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar preferências de estilo' });
    }
  });

  api.post('/admin/clients/:id/style-preferences', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const { hair_cut_style, beard_style, blade_sizes, hair_color_formula, shampoo_preference, aftershave_allergies, notes } = req.body;

    try {
      const preferences = nicheDb.upsertStylePreferences({
        client_id: clientId,
        barbershop_id: barbershopId,
        hair_cut_style,
        beard_style,
        blade_sizes,
        hair_color_formula,
        shampoo_preference,
        aftershave_allergies,
        notes
      });

      res.json({ success: true, preferences });
    } catch (error: any) {
      console.error('[STYLE_PREFS_POST_ERR]', error);
      res.status(500).json({ error: 'Erro ao salvar preferências de estilo e coloração' });
    }
  });

  // --- NICHE: PERSONAL TRAINER & PILATES & NUTRIÇÃO ---
  api.get('/admin/clients/:id/fitness-assessments', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;

    try {
      const assessments = nicheDb.getFitnessAssessments(barbershopId, clientId);
      res.json({ assessments });
    } catch (error: any) {
      console.error('[FITNESS_GET_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar avaliações físicas' });
    }
  });

  api.post('/admin/clients/:id/fitness-assessments', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const {
      assessment_date, weight_kg, height_cm, body_fat_pct, muscle_mass_kg,
      chest_cm, waist_cm, abdomen_cm, hips_cm, arms_cm, thighs_cm,
      physical_restrictions, training_goal, workout_prescription, notes
    } = req.body;

    try {
      const id = crypto.randomUUID();
      const assessment = nicheDb.createFitnessAssessment({
        id,
        barbershop_id: barbershopId,
        client_id: clientId,
        assessment_date: assessment_date || new Date().toISOString().split('T')[0],
        weight_kg: weight_kg ? Number(weight_kg) : undefined,
        height_cm: height_cm ? Number(height_cm) : undefined,
        body_fat_pct: body_fat_pct ? Number(body_fat_pct) : undefined,
        muscle_mass_kg: muscle_mass_kg ? Number(muscle_mass_kg) : undefined,
        chest_cm: chest_cm ? Number(chest_cm) : undefined,
        waist_cm: waist_cm ? Number(waist_cm) : undefined,
        abdomen_cm: abdomen_cm ? Number(abdomen_cm) : undefined,
        hips_cm: hips_cm ? Number(hips_cm) : undefined,
        arms_cm: arms_cm ? Number(arms_cm) : undefined,
        thighs_cm: thighs_cm ? Number(thighs_cm) : undefined,
        physical_restrictions,
        training_goal,
        workout_prescription,
        notes
      });

      res.json({ success: true, assessment });
    } catch (error: any) {
      console.error('[FITNESS_POST_ERR]', error);
      res.status(500).json({ error: 'Erro ao salvar avaliação física' });
    }
  });

  api.delete('/admin/clients/:id/fitness-assessments/:assessmentId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const assessmentId = req.params.assessmentId;

    try {
      const deleted = nicheDb.deleteFitnessAssessment(assessmentId, barbershopId);
      if (!deleted) return res.status(404).json({ error: 'Avaliação não encontrada' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[FITNESS_DEL_ERR]', error);
      res.status(500).json({ error: 'Erro ao excluir avaliação física' });
    }
  });

  // --- NICHE: TATTOO & PIERCING ---
  api.get('/admin/clients/:id/tattoo-records', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;

    try {
      const records = nicheDb.getTattooRecords(barbershopId, clientId);
      res.json({ records });
    } catch (error: any) {
      console.error('[TATTOO_GET_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar registros de tatuagem/piercing' });
    }
  });

  api.post('/admin/clients/:id/tattoo-records', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const { title, placement, style, needle_batch, ink_batch, session_date, healing_stage, consent_signed, aftercare_instructions, notes } = req.body;

    if (!title || !placement) {
      return res.status(400).json({ error: 'Título do projeto e local do corpo são obrigatórios' });
    }

    try {
      const id = crypto.randomUUID();
      const record = nicheDb.createTattooRecord({
        id,
        barbershop_id: barbershopId,
        client_id: clientId,
        title,
        placement,
        style,
        needle_batch,
        ink_batch,
        session_date: session_date || new Date().toISOString().split('T')[0],
        healing_stage: healing_stage || 'Recente',
        consent_signed: consent_signed !== undefined ? (consent_signed ? 1 : 0) : 1,
        aftercare_instructions,
        notes
      });

      res.json({ success: true, record });
    } catch (error: any) {
      console.error('[TATTOO_POST_ERR]', error);
      res.status(500).json({ error: 'Erro ao registrar sessão de tatuagem/piercing' });
    }
  });

  api.delete('/admin/clients/:id/tattoo-records/:recordId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const recordId = req.params.recordId;

    try {
      const deleted = nicheDb.deleteTattooRecord(recordId, barbershopId);
      if (!deleted) return res.status(404).json({ error: 'Registro não encontrado' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[TATTOO_DEL_ERR]', error);
      res.status(500).json({ error: 'Erro ao excluir registro de tatuagem' });
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
    const { name, slug, email, password, segment } = req.body;
    
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

      // Create shop with segment / business_type
      const shopId = crypto.randomUUID();
      const shopType = req.body.business_type || req.body.businessType || segment || 'barbershop';
      const { error: shopErr } = await supabase
        .from('barbershops')
        .insert({
          id: shopId,
          name,
          slug: cleanSlug,
          segment: shopType,
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

  // Update shop segment / business_type (Master only)
  api.patch('/admin/master/shops/:id/segment', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { id } = req.params;
      const targetType = req.body.business_type || req.body.businessType || req.body.segment;

      if (!targetType) {
        return res.status(400).json({ error: 'business_type ou segment é obrigatório' });
      }

      const { error } = await supabase
        .from('barbershops')
        .update({ 
          segment: targetType, 
          business_type: targetType, // If column exists in Supabase, update it too
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) {
        // Fallback without business_type if column is named segment
        const { error: fallbackErr } = await supabase
          .from('barbershops')
          .update({ 
            segment: targetType, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', id);

        if (fallbackErr) throw fallbackErr;
      }

      res.json({ success: true, business_type: targetType, segment: targetType });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao alterar segmento do estabelecimento', details: e.message });
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

  // Catch-all for unhandled API routes so they return JSON 404 rather than Vite index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Rota API não encontrada: ${req.method} ${req.originalUrl}` });
  });

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
          const { data: existingUser, error: checkErr } = await supabase.from('users').select('id').eq('email', u.email).maybeSingle();
          
          if (checkErr && (checkErr.message?.includes('fetch failed') || (checkErr as any).message?.includes('ENOTFOUND'))) {
            console.error('\n[CRITICAL ERROR] 🚨 SUPABASE PROJECT PAUSED OR UNREACHABLE 🚨');
            console.error('The application cannot connect to Supabase (ENOTFOUND).');
            console.error('This usually happens when your Supabase Free Tier project is paused due to inactivity.');
            console.error('Please log in to your Supabase dashboard and restore your project.');
            break; // Stop trying if we can't even connect
          }

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
      } catch (e: any) {
        if (e?.message?.includes('fetch failed') || e?.message?.includes('ENOTFOUND')) {
          console.error('\n[CRITICAL ERROR] 🚨 SUPABASE PROJECT PAUSED OR UNREACHABLE 🚨');
          console.error('The application cannot connect to Supabase (ENOTFOUND).');
          console.error('This usually happens when your Supabase Free Tier project is paused due to inactivity.');
          console.error('Please log in to your Supabase dashboard and restore your project.');
          console.error(`URL attempted: ${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}\n`);
        } else {
          console.error('[STARTUP_SYNC_FAILED]', e);
        }
      }
    });
  }
}

startServer();

export default app;
// end
