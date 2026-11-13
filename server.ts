import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import nodeCrypto from 'crypto';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';

import { supabaseAdmin as supabase, hasServiceRoleKey } from './src/db/supabaseAdmin';
import { cloudNicheDb } from './src/db/cloudNicheDb';
import { getSegment } from './src/lib/segments';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-doiseme';
if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY] JWT_SECRET não definido nas variáveis de ambiente. Usando chave padrão apenas para desenvolvimento.');
}

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

  // Rate limiting for login & public auth endpoints
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 15,
    message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const RESERVED_SLUGS = new Set([
    'admin', 'api', 'login', 'cadastro', 'register', 'signup',
    'recuperar-senha', 'redefinir-senha', 'master', 'b', 'doiseme',
    'suporte', 'app', 'www', 'public', 'health', 'seed'
  ]);

  const hashResetToken = (rawToken: string) =>
    nodeCrypto.createHash('sha256').update(rawToken).digest('hex');

  const getAppBaseUrl = (req: any) => {
    const envUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
    if (envUrl && envUrl !== 'MY_APP_URL') return envUrl;
    const origin = req.headers?.origin?.trim().replace(/\/+$/, '');
    if (origin) return origin;
    return `${req.protocol}://${req.get('host')}`;
  };

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
  };

  const normalizeSupportWhatsapp = (raw?: string | null): string => {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }
    return digits;
  };

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
        const { data: shop } = await supabase
          .from('barbershops')
          .select('is_blocked, expires_at')
          .eq('id', user.barbershopId)
          .maybeSingle();
        
        if (shop) {
          if (shop.is_blocked) {
            return res.status(403).json({ error: 'Sua conta está bloqueada pelo administrador.' });
          }
          if (shop.expires_at && new Date(shop.expires_at) < new Date()) {
            const pathAllowedWhenExpired =
              req.path === '/admin/shop-info' ||
              req.path.startsWith('/admin/billing') ||
              req.path === '/public/support-contact';
            if (!pathAllowedWhenExpired) {
              return res.status(403).json({
                error: 'Seu período de teste ou assinatura expirou.',
                subscriptionExpired: true
              });
            }
            req.subscriptionExpired = true;
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

    if (isMasterRole && isAuthorized) {
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

  // DEBUG: List all shops for internal diagnostics (Master only)
  api.get('/admin/debug/shops', authenticateToken, requireMaster, async (req: any, res) => {
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

  // Upload proxy to Supabase Storage (scoped per tenant)
  api.post('/admin/upload', authenticateToken, async (req: any, res) => {
    const { filePath, content, contentType } = req.body;
    const BUCKET_NAME = 'barbearias-assets';
    
    if (!filePath || !content) {
      return res.status(400).json({ error: 'Faltando dados de upload' });
    }

    // Scope upload path by barbershopId to prevent cross-tenant overwrites
    const sanitizedPath = String(filePath)
      .replace(/\.\./g, '')
      .replace(/^\/+/, '');
    const tenantPrefix = `shops/${req.user.barbershopId}/`;
    const scopedFilePath = sanitizedPath.startsWith('shops/')
      ? sanitizedPath
      : `${tenantPrefix}${sanitizedPath}`;

    try {
      const buffer = Buffer.from(content, 'base64');
      
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(scopedFilePath, buffer, {
          contentType: contentType || 'image/png',
          upsert: true
        });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(scopedFilePath);
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
      const photosMap = await cloudNicheDb.getEntityPhotosMap(barberIds);

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
      const photosMap = await cloudNicheDb.getEntityPhotosMap(serviceIds);

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

  // Check if slug is available for self-service signup
  api.get('/auth/check-slug/:slug', async (req, res) => {
    try {
      const cleanSlug = standardizeSlug(req.params.slug || '');
      if (!cleanSlug || cleanSlug.length < 3) {
        return res.json({
          available: false,
          normalizedSlug: cleanSlug || '',
          reason: 'O link deve ter pelo menos 3 caracteres.'
        });
      }
      if (RESERVED_SLUGS.has(cleanSlug)) {
        return res.json({
          available: false,
          normalizedSlug: cleanSlug,
          reason: 'Este link é reservado pelo sistema.'
        });
      }

      const { data: existingShop, error } = await supabase
        .from('barbershops')
        .select('id')
        .eq('slug', cleanSlug)
        .maybeSingle();

      if (error) throw error;

      return res.json({
        available: !existingShop,
        normalizedSlug: cleanSlug,
        reason: existingShop ? 'Este link já está em uso por outro estabelecimento.' : undefined
      });
    } catch (error: any) {
      console.error('[CHECK_SLUG_ERR]', error);
      return res.status(500).json({ available: false, error: 'Erro ao verificar disponibilidade do link' });
    }
  });

  // Self-service shop + owner registration (14-day free trial)
  api.post('/auth/register', registerLimiter, async (req, res) => {
    const {
      businessName,
      ownerName,
      slug,
      email,
      phone,
      segment,
      password,
      confirmPassword,
      seedStarterServices = true,
      createOwnerAsProfessional = true
    } = req.body;

    if (!businessName || !ownerName || !slug || !email || !password) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const cleanBusinessName = String(businessName).trim();
    const cleanOwnerName = String(ownerName).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = phone ? String(phone).trim() : '';
    const cleanSlug = standardizeSlug(String(slug));

    if (cleanBusinessName.length < 2) {
      return res.status(400).json({ error: 'O nome do estabelecimento deve ter pelo menos 2 caracteres.' });
    }
    if (cleanOwnerName.length < 2) {
      return res.status(400).json({ error: 'Informe seu nome completo.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (!cleanSlug || cleanSlug.length < 3) {
      return res.status(400).json({ error: 'O link personalizado deve ter pelo menos 3 caracteres válidos.' });
    }
    if (RESERVED_SLUGS.has(cleanSlug)) {
      return res.status(400).json({ error: 'Este link personalizado é reservado. Escolha outro.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    try {
      const { data: existingSlug, error: slugErr } = await supabase
        .from('barbershops')
        .select('id')
        .eq('slug', cleanSlug)
        .maybeSingle();

      if (slugErr) throw slugErr;
      if (existingSlug) {
        return res.status(400).json({ error: 'Este link personalizado já está em uso. Escolha outro.' });
      }

      const { data: existingUser, error: emailErr } = await supabase
        .from('users')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (emailErr) throw emailErr;
      if (existingUser) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.' });
      }

      const preset = getSegment(segment);
      const shopId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const trialDays = 7;
      const trialExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

      const shopPayload: Record<string, any> = {
        id: shopId,
        name: cleanBusinessName,
        slug: cleanSlug,
        segment: preset.id,
        whatsapp: cleanPhone || null,
        phone: cleanPhone || null,
        primary_color: preset.defaultColors.primary,
        secondary_color: preset.defaultColors.secondary,
        is_blocked: false,
        expires_at: trialExpiresAt
      };

      let { error: shopInsertErr } = await supabase.from('barbershops').insert(shopPayload);
      if (shopInsertErr && shopInsertErr.message?.includes('column')) {
        delete shopPayload.segment;
        const retryShop = await supabase.from('barbershops').insert(shopPayload);
        shopInsertErr = retryShop.error;
      }
      if (shopInsertErr) throw shopInsertErr;

      // Initialize default business hours
      const { error: settingsErr } = await supabase.from('shop_settings').insert({
        id: crypto.randomUUID(),
        barbershop_id: shopId,
        config: DEFAULT_SETTINGS
      });
      if (settingsErr) {
        console.warn('[REGISTER_SETTINGS_WARN]', settingsErr.message);
      }

      // Create admin user (rollback shop if user creation fails)
      const passwordHash = await bcrypt.hash(password, 10);
      const { error: userInsertErr } = await supabase.from('users').insert({
        id: userId,
        barbershop_id: shopId,
        name: cleanOwnerName,
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'admin'
      });

      if (userInsertErr) {
        await supabase.from('shop_settings').delete().eq('barbershop_id', shopId);
        await supabase.from('barbershops').delete().eq('id', shopId);
        throw userInsertErr;
      }

      // Optional: Create owner as first active professional so booking link works immediately
      let createdBarberId: string | null = null;
      if (createOwnerAsProfessional) {
        createdBarberId = crypto.randomUUID();
        const { error: barberErr } = await supabase.from('barbers').insert({
          id: createdBarberId,
          barbershop_id: shopId,
          name: cleanOwnerName,
          active: true
        });
        if (barberErr) {
          console.warn('[REGISTER_BARBER_WARN]', barberErr.message);
          createdBarberId = null;
        }
      }

      // Optional: Seed starter services for the chosen niche
      if (seedStarterServices && preset.suggestedServices.length > 0) {
        const servicesPayload = preset.suggestedServices.slice(0, 4).map((srv) => ({
          id: crypto.randomUUID(),
          barbershop_id: shopId,
          name: srv.name,
          duration_minutes: srv.durationMinutes,
          price: srv.price,
          active: true
        }));
        const { error: srvErr } = await supabase.from('services').insert(servicesPayload);
        if (srvErr) {
          console.warn('[REGISTER_SERVICES_WARN]', srvErr.message);
        }
      }

      const token = jwt.sign(
        {
          id: userId,
          barbershopId: shopId,
          role: 'admin',
          email: cleanEmail
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log(`[REGISTER SUCCESS] New tenant created: ${cleanBusinessName} (/b/${cleanSlug}) by ${cleanEmail}`);

      return res.status(201).json({
        success: true,
        token,
        trialDays,
        user: {
          id: userId,
          name: cleanOwnerName,
          email: cleanEmail,
          role: 'admin',
          barbershopId: shopId
        },
        shop: {
          id: shopId,
          name: cleanBusinessName,
          slug: cleanSlug,
          segment: preset.id,
          expires_at: trialExpiresAt
        }
      });
    } catch (error: any) {
      console.error('[REGISTER_ERROR]', error);
      return res.status(500).json({ error: 'Erro ao criar estabelecimento. Tente novamente.', details: error.message });
    }
  });

  // Public Support WhatsApp contact for password recovery & account help
  api.get('/public/support-contact', async (_req, res) => {
    try {
      const saved = await cloudNicheDb.getPlatformSetting('support_whatsapp');
      const raw = saved || process.env.SUPPORT_WHATSAPP || '';
      const whatsapp = normalizeSupportWhatsapp(raw);
      return res.json({
        configured: Boolean(whatsapp),
        whatsapp,
        raw: saved || process.env.SUPPORT_WHATSAPP || ''
      });
    } catch (error: any) {
      console.error('[SUPPORT_CONTACT_GET_ERR]', error);
      return res.status(500).json({ configured: false, whatsapp: '' });
    }
  });

  // Verify reset token validity
  api.get('/auth/verify-reset-token', async (req, res) => {
    const rawToken = String(req.query.token || '').trim();
    if (!rawToken || rawToken.length < 20) {
      return res.status(400).json({ valid: false, error: 'Link de redefinição inválido.' });
    }

    try {
      const tokenHash = hashResetToken(rawToken);
      const record = await cloudNicheDb.getPasswordResetTokenByHash(tokenHash);

      if (!record) {
        return res.status(400).json({ valid: false, error: 'Link de redefinição não encontrado ou inválido.' });
      }
      if (record.used_at) {
        return res.status(400).json({ valid: false, error: 'Este link já foi utilizado. Solicite uma nova recuperação.' });
      }
      if (new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ valid: false, error: 'Este link expirou (validade de 30 minutos). Solicite um novo.' });
      }

      return res.json({
        valid: true,
        emailMasked: maskEmail(record.email)
      });
    } catch (error: any) {
      console.error('[VERIFY_RESET_TOKEN_ERR]', error);
      return res.status(500).json({ valid: false, error: 'Erro ao validar link de redefinição.' });
    }
  });

  // Reset Password using token
  api.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;
    const rawToken = String(token || '').trim();

    if (!rawToken || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    try {
      const tokenHash = hashResetToken(rawToken);
      const record = await cloudNicheDb.getPasswordResetTokenByHash(tokenHash);

      if (!record) {
        return res.status(400).json({ error: 'Link de redefinição inválido.' });
      }
      if (record.used_at) {
        return res.status(400).json({ error: 'Este link já foi utilizado.' });
      }
      if (new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Este link expirou. Solicite uma nova recuperação.' });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      let { error: updateErr } = await supabase
        .from('users')
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', record.user_id);

      if (updateErr && updateErr.message?.includes('updated_at')) {
        const retryUpdate = await supabase
          .from('users')
          .update({ password_hash: newHash })
          .eq('id', record.user_id);
        updateErr = retryUpdate.error;
      }

      if (updateErr) throw updateErr;

      await cloudNicheDb.markPasswordResetTokenUsed(record.id);
      console.log(`[PASSWORD_RESET_SUCCESS] Senha redefinida para ${record.email}`);

      return res.json({ success: true, message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
    } catch (error: any) {
      console.error('[RESET_PASSWORD_ERR]', error);
      return res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
  });

  api.post('/auth/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    console.log(`[LOGIN ATTEMPT] Email: ${cleanEmail}`);
    
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
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
        console.warn(`[LOGIN WARN] User not found: ${cleanEmail}`);
        return res.status(401).json({ error: 'Usuário não encontrado ou credenciais inválidas' });
      }

      let subscriptionExpired = false;
      // Check shop status if NOT a master user
      if (user.role !== 'master') {
        const { data: shop } = await supabase
          .from('barbershops')
          .select('is_blocked, expires_at')
          .eq('id', user.barbershop_id)
          .maybeSingle();

        if (shop) {
          if (shop.is_blocked) {
            return res.status(403).json({ error: 'Este estabelecimento está bloqueado. Entre em contato com o suporte.' });
          }
          if (shop.expires_at) {
            const expiryDate = new Date(shop.expires_at);
            if (expiryDate < new Date()) {
              subscriptionExpired = true;
            }
          }
        }
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        console.warn(`[LOGIN WARN] Invalid password for ${cleanEmail}`);
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      console.log(`[LOGIN SUCCESS] User authenticated: ${user.email} (Role: ${user.role}, Expired: ${subscriptionExpired})`);
      const token = jwt.sign({ 
        id: user.id, 
        barbershopId: user.barbershop_id, 
        role: user.role,
        email: user.email 
      }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        token, 
        subscriptionExpired,
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
      const barbersMetaMap = await cloudNicheDb.getBarbersMetadataMap(barberIds);
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
      const photosMap = await cloudNicheDb.getEntityPhotosMap(barberIds);
      const metaMap = await cloudNicheDb.getBarbersMetadataMap(barberIds);

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

      // Persist commission
      if (commission_percentage !== undefined) {
        await cloudNicheDb.upsertBarberMetadata(id, req.user.barbershopId, Number(commission_percentage));
      }

      // Persist photo safely
      if (finalPhoto) {
        await cloudNicheDb.upsertEntityPhoto(id, req.user.barbershopId, 'barber', finalPhoto);
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

      // Save commission_percentage
      if (commission_percentage !== undefined) {
        await cloudNicheDb.upsertBarberMetadata(req.params.id, req.user.barbershopId, Number(commission_percentage));
      }

      // Update photo if provided
      if (photo_url !== undefined || photoUrl !== undefined) {
        await cloudNicheDb.upsertEntityPhoto(req.params.id, req.user.barbershopId, 'barber', photo_url ?? photoUrl);
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
      const photosMap = await cloudNicheDb.getEntityPhotosMap(serviceIds);

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

      // Save photo
      if (finalImage) {
        await cloudNicheDb.upsertEntityPhoto(id, req.user.barbershopId, 'service', finalImage);
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
        await cloudNicheDb.upsertEntityPhoto(req.params.id, req.user.barbershopId, 'service', image_url ?? imageUrl ?? photo_url);
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
      const notes = await cloudNicheDb.getNotesByClient(barbershopId, clientId);

      // 3. Fetch anamnesis
      const anamnesis = await cloudNicheDb.getAnamnesis(barbershopId, clientId);

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
      const newNote = await cloudNicheDb.createNote({
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
      const updated = await cloudNicheDb.updateNote(noteId, barbershopId, {
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
      const deleted = await cloudNicheDb.deleteNote(noteId, barbershopId);
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
      const anamnesis = await cloudNicheDb.upsertAnamnesis({
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
      const anamnesis = await cloudNicheDb.getAestheticsAnamnesis(barbershopId, clientId);
      const photos = await cloudNicheDb.getAestheticsPhotos(barbershopId, clientId);
      const touchups = await cloudNicheDb.getAestheticsTouchups(barbershopId, clientId);

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
      const anamnesis = await cloudNicheDb.upsertAestheticsAnamnesis({
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
      const photoRecord = await cloudNicheDb.addAestheticsPhoto({
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
      const deleted = await cloudNicheDb.deleteAestheticsPhoto(photoId, barbershopId);
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
      const touchup = await cloudNicheDb.createAestheticsTouchup({
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
      const updated = await cloudNicheDb.updateAestheticsTouchupStatus(touchupId, barbershopId, status);
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
      const deleted = await cloudNicheDb.deleteAestheticsTouchup(touchupId, barbershopId);
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
      const pets = await cloudNicheDb.getPets(barbershopId, clientId);
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
      const pet = await cloudNicheDb.createPet({
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
      const deleted = await cloudNicheDb.deletePet(petId, barbershopId);
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
      const vehicles = await cloudNicheDb.getVehicles(barbershopId, clientId);
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
      const vehicle = await cloudNicheDb.createVehicle({
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
      const deleted = await cloudNicheDb.deleteVehicle(vehicleId, barbershopId);
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
      const preferences = await cloudNicheDb.getStylePreferences(barbershopId, clientId);
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
      const preferences = await cloudNicheDb.upsertStylePreferences({
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
      const assessments = await cloudNicheDb.getFitnessAssessments(barbershopId, clientId);
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
      const assessment = await cloudNicheDb.createFitnessAssessment({
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
      const deleted = await cloudNicheDb.deleteFitnessAssessment(assessmentId, barbershopId);
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
      const records = await cloudNicheDb.getTattooRecords(barbershopId, clientId);
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
      const record = await cloudNicheDb.createTattooRecord({
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
      const deleted = await cloudNicheDb.deleteTattooRecord(recordId, barbershopId);
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

  // Generate password reset link for any shop's admin (Master only)
  api.post('/admin/master/shops/:id/reset-link', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { id } = req.params;
      const { data: adminUsers, error: userErr } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('barbershop_id', id)
        .order('created_at', { ascending: true });

      if (userErr) throw userErr;
      const targetUser = (adminUsers || []).find((u: any) => u.role === 'admin') || adminUsers?.[0];
      if (!targetUser) {
        return res.status(404).json({ error: 'Nenhum usuário administrador encontrado para este estabelecimento.' });
      }

      await cloudNicheDb.invalidateUserResetTokens(targetUser.id);
      const rawToken = nodeCrypto.randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await cloudNicheDb.createPasswordResetToken({
        id: crypto.randomUUID(),
        user_id: targetUser.id,
        email: targetUser.email,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      });

      const resetUrl = `${getAppBaseUrl(req)}/admin/redefinir-senha?token=${rawToken}`;
      res.json({ success: true, resetUrl, adminEmail: targetUser.email });
    } catch (e: any) {
      console.error('[MASTER_RESET_LINK_ERR]', e);
      res.status(500).json({ error: 'Erro ao gerar link de redefinição de senha', details: e.message });
    }
  });

  // Update Support WhatsApp (Master only)
  api.post('/admin/master/support-contact', authenticateToken, requireMaster, async (req, res) => {
    try {
      const normalized = normalizeSupportWhatsapp(req.body?.whatsapp);
      if (!normalized || normalized.length < 10) {
        return res.status(400).json({ error: 'Informe um número de WhatsApp válido com DDD (ex: 5511999999999).' });
      }
      await cloudNicheDb.setPlatformSetting('support_whatsapp', normalized);
      res.json({ success: true, whatsapp: normalized });
    } catch (e: any) {
      console.error('[MASTER_SUPPORT_CONTACT_ERR]', e);
      res.status(500).json({ error: 'Erro ao salvar WhatsApp do suporte', details: e.message });
    }
  });

  // Cloud Persistence & Security Diagnostics (Master only)
  api.get('/admin/master/cloud-status', authenticateToken, requireMaster, async (req, res) => {
    try {
      const cloudStatus = await cloudNicheDb.checkCloudStatus();
      res.json({
        ...cloudStatus,
        security: {
          hasJwtSecret: Boolean(process.env.JWT_SECRET),
          hasServiceRoleKey,
          nodeEnv: process.env.NODE_ENV || 'development'
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao verificar status da nuvem', details: e.message });
    }
  });

  api.get('/admin/master/migration-sql', authenticateToken, requireMaster, async (req, res) => {
    try {
      const sqlPath = path.join(process.cwd(), 'supabase_niche_migration.sql');
      if (!fs.existsSync(sqlPath)) {
        return res.status(404).json({ error: 'Arquivo de migração não encontrado' });
      }
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      res.json({ sql });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao ler script SQL', details: e.message });
    }
  });

  api.post('/admin/master/migrate-niche-to-cloud', authenticateToken, requireMaster, async (req, res) => {
    try {
      const summary = await cloudNicheDb.migrateAllLocalToSupabase();
      res.json({ success: true, ...summary });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao migrar registros locais para o Supabase', details: e.message });
    }
  });

  // --- SAAS PLANS, BILLING & MERCADO PAGO ---
  const SAAS_PLANS = [
    {
      id: 'essencial',
      name: 'Agenda Individual',
      subtitle: 'Ideal para quem trabalha sozinho (1 profissional)',
      monthlyPrice: 59.90,
      annualPrice: 479.00,
      highlighted: false,
      badge: '1 Profissional',
      features: [
        '1 profissional ativo na agenda',
        'Link exclusivo de agendamento (/b/sua-marca)',
        'Cadastro de clientes e histórico completo',
        'Agenda inteligente sem conflitos de horário'
      ]
    },
    {
      id: 'profissional',
      name: 'Plano Pro',
      subtitle: 'Perfeito para equipes de 1 a 3 funcionários',
      monthlyPrice: 99.90,
      annualPrice: 859.00,
      highlighted: false,
      badge: 'Equipe 1 a 3',
      features: [
        'Até 4 profissionais ativos (dono + equipe)',
        'Cálculo automático de comissões',
        'Controle financeiro diário e despesas',
        'Prontuários, anamnese e fotos do seu nicho'
      ]
    },
    {
      id: 'premium',
      name: 'Plano Completo',
      subtitle: 'Retenção, pacotes e lucro sem limites',
      monthlyPrice: 119.90,
      annualPrice: 997.00,
      highlighted: true,
      badge: 'Melhor Custo-Benefício',
      features: [
        'Profissionais e serviços ilimitados',
        'Campanhas de reativação p/ trazer clientes sumidos',
        'Pacotes de sessões e combos recorrentes',
        'Vitrine VIP (logo, banner e paleta personalizada)',
        'Implantação assistida + Suporte VIP no WhatsApp'
      ]
    }
  ];

  const getMpAccessToken = async (): Promise<string> => {
    const saved = await cloudNicheDb.getPlatformSetting('mp_access_token');
    return (saved || process.env.MP_ACCESS_TOKEN || '').trim();
  };

  const getPlatformPixKey = async (): Promise<string> => {
    const saved = await cloudNicheDb.getPlatformSetting('pix_key');
    return (saved || process.env.MP_PIX_KEY || '').trim();
  };

  const getPlatformPixProfile = async () => {
    const [pixKey, receiverName, receiverCity] = await Promise.all([
      getPlatformPixKey(),
      cloudNicheDb.getPlatformSetting('pix_receiver_name'),
      cloudNicheDb.getPlatformSetting('pix_receiver_city')
    ]);
    return {
      pixKey,
      receiverName: (receiverName || 'DOISEME PRO').trim(),
      receiverCity: (receiverCity || 'SAO PAULO').trim()
    };
  };

  const getMpPaymentLinks = async (): Promise<Record<string, string>> => {
    const raw = await cloudNicheDb.getPlatformSetting('mp_payment_links');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  };

  // Official Banco Central PIX BR Code (EMVCo + CRC16-CCITT)
  const formatTlv = (id: string, value: string): string => {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const sanitizePixAscii = (text: string, maxLen: number): string => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
      .slice(0, maxLen);
  };

  const normalizePixKeyForBrCode = (rawKey: string): string => {
    const trimmed = rawKey.trim();
    if (!trimmed) return '';
    if (trimmed.includes('@')) return trimmed.toLowerCase();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    if (trimmed.startsWith('+')) {
      return '+' + trimmed.replace(/\D/g, '');
    }
    if (trimmed.includes('(') || trimmed.includes(')')) {
      const digits = trimmed.replace(/\D/g, '');
      return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
    }
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 13 && digitsOnly.startsWith('55')) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.length === 11 || digitsOnly.length === 14) {
      return digitsOnly;
    }
    return trimmed;
  };

  const crc16Ccitt = (payload: string): string => {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  };

  const generatePixBrCode = (params: {
    pixKey: string;
    receiverName: string;
    receiverCity: string;
    amount: number;
    txid?: string;
  }): string => {
    const normalizedKey = normalizePixKeyForBrCode(params.pixKey);
    const name = sanitizePixAscii(params.receiverName, 25) || 'DOISEME PRO';
    const city = sanitizePixAscii(params.receiverCity, 15) || 'SAO PAULO';
    const amountStr = Number(params.amount).toFixed(2);
    const txid = (params.txid || 'DOISEMEPRO').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'DOISEMEPRO';

    const merchantAccount = formatTlv('00', 'br.gov.bcb.pix') + formatTlv('01', normalizedKey);
    const additionalData = formatTlv('05', txid);

    const payloadWithoutCrc =
      formatTlv('00', '01') +
      formatTlv('26', merchantAccount) +
      formatTlv('52', '0000') +
      formatTlv('53', '986') +
      formatTlv('54', amountStr) +
      formatTlv('58', 'BR') +
      formatTlv('59', name) +
      formatTlv('60', city) +
      formatTlv('62', additionalData) +
      '6304';

    return payloadWithoutCrc + crc16Ccitt(payloadWithoutCrc);
  };

  const maskSecretToken = (token: string): string => {
    if (!token) return '';
    if (token.length <= 14) return '••••••••••••';
    return `${token.slice(0, 10)}••••••${token.slice(-4)}`;
  };

  const approveSaasPaymentIdempotently = async (paymentId: string, mpPaymentId?: string | null) => {
    const payment = await cloudNicheDb.getSaasPaymentById(paymentId);
    if (!payment) return { ok: false, reason: 'not_found' as const };

    if (payment.status === 'approved') {
      if (mpPaymentId && !payment.mp_payment_id) {
        await cloudNicheDb.updateSaasPayment(payment.id, { mp_payment_id: mpPaymentId });
      }
      const { data: shop } = await supabase
        .from('barbershops')
        .select('expires_at')
        .eq('id', payment.barbershop_id)
        .maybeSingle();
      return { ok: true, alreadyApproved: true, newExpiresAt: shop?.expires_at || null, payment };
    }

    const { data: shop } = await supabase
      .from('barbershops')
      .select('expires_at, is_blocked')
      .eq('id', payment.barbershop_id)
      .maybeSingle();

    const now = Date.now();
    const currentExpiry = shop?.expires_at ? new Date(shop.expires_at).getTime() : 0;
    const baseTime = currentExpiry > now ? currentExpiry : now;
    const daysAdded = Number(payment.days_added) || (payment.billing_cycle === 'annual' ? 365 : 30);
    const newExpiresAt = new Date(baseTime + daysAdded * 24 * 60 * 60 * 1000).toISOString();

    const { error: shopErr } = await supabase
      .from('barbershops')
      .update({ expires_at: newExpiresAt, is_blocked: false })
      .eq('id', payment.barbershop_id);
    if (shopErr) throw shopErr;

    const paidAt = new Date().toISOString();
    await cloudNicheDb.updateSaasPayment(payment.id, {
      status: 'approved',
      mp_payment_id: mpPaymentId || payment.mp_payment_id || null,
      paid_at: paidAt
    });

    return {
      ok: true,
      alreadyApproved: false,
      newExpiresAt,
      payment: { ...payment, status: 'approved', paid_at: paidAt, mp_payment_id: mpPaymentId || payment.mp_payment_id }
    };
  };

  // Public SaaS Plans list (Landing Page & Subscription page)
  api.get('/public/plans', (_req, res) => {
    res.json({ plans: SAAS_PLANS, trialDays: 7 });
  });

  // Admin Billing Status & Payment History
  api.get('/admin/billing/status', authenticateToken, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const { data: shop, error } = await supabase
        .from('barbershops')
        .select('id, name, slug, segment, is_blocked, expires_at, created_at')
        .eq('id', shopId)
        .maybeSingle();
      if (error) throw error;

      const [payments, mpToken, pixProfile, mpLinks, savedWhatsapp] = await Promise.all([
        cloudNicheDb.getSaasPaymentsByShop(shopId),
        getMpAccessToken(),
        getPlatformPixProfile(),
        getMpPaymentLinks(),
        cloudNicheDb.getPlatformSetting('support_whatsapp')
      ]);

      const supportWhatsapp = normalizeSupportWhatsapp(savedWhatsapp || process.env.SUPPORT_WHATSAPP || '');
      const isExpired = Boolean(shop?.expires_at && new Date(shop.expires_at) < new Date());

      res.json({
        shop,
        isExpired,
        plans: SAAS_PLANS,
        payments,
        mpConfigured: Boolean(mpToken),
        pixKeyConfigured: Boolean(pixProfile.pixKey),
        pixKey: pixProfile.pixKey || null,
        mpLinks,
        supportWhatsapp
      });
    } catch (e: any) {
      console.error('[BILLING_STATUS_ERR]', e);
      res.status(500).json({ error: 'Erro ao carregar status da assinatura', details: e.message });
    }
  });

  // Create Mercado Pago Checkout Pro Preference
  api.post('/admin/billing/checkout', authenticateToken, async (req: any, res) => {
    try {
      const { planId, billingCycle } = req.body;
      const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
      const plan = SAAS_PLANS.find((p) => p.id === planId);
      if (!plan) {
        return res.status(400).json({ error: 'Plano selecionado inválido.' });
      }

      const mpToken = await getMpAccessToken();
      if (!mpToken) {
        return res.status(400).json({
          error: 'Mercado Pago ainda não configurado no Painel Master. Utilize a opção de pagamento via PIX.'
        });
      }

      const amount = cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
      const daysAdded = cycle === 'annual' ? 365 : 30;
      const paymentId = `pay_${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      const baseUrl = getAppBaseUrl(req);
      const isHttps = baseUrl.startsWith('https://');

      await cloudNicheDb.createSaasPayment({
        id: paymentId,
        barbershop_id: req.user.barbershopId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount,
        billing_cycle: cycle,
        payment_method: 'mercadopago_checkout',
        external_reference: paymentId,
        status: 'pending',
        days_added: daysAdded,
        created_at: nowIso,
        updated_at: nowIso
      });

      const preferenceBody: any = {
        items: [
          {
            id: `${plan.id}_${cycle}`,
            title: `DoisemePRO - Plano ${plan.name} (${cycle === 'annual' ? 'Anual' : 'Mensal'})`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: Number(amount.toFixed(2))
          }
        ],
        external_reference: paymentId,
        back_urls: {
          success: `${baseUrl}/admin/assinatura?payment=success&ref=${paymentId}`,
          failure: `${baseUrl}/admin/assinatura?payment=failure&ref=${paymentId}`,
          pending: `${baseUrl}/admin/assinatura?payment=pending&ref=${paymentId}`
        },
        statement_descriptor: 'DOISEMEPRO'
      };

      if (req.user?.email) {
        preferenceBody.payer = { email: req.user.email };
      }
      if (isHttps) {
        preferenceBody.auto_return = 'approved';
        preferenceBody.notification_url = `${baseUrl}/api/webhooks/mercadopago`;
      }

      const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferenceBody)
      });

      const mpData: any = await mpResponse.json();
      if (!mpResponse.ok) {
        console.error('[MP_CHECKOUT_ERR]', mpData);
        await cloudNicheDb.updateSaasPayment(paymentId, { status: 'failed' });
        return res.status(400).json({
          error: mpData?.message || 'Não foi possível criar o link de pagamento no Mercado Pago. Verifique o Access Token no Painel Master.'
        });
      }

      await cloudNicheDb.updateSaasPayment(paymentId, {
        mp_preference_id: mpData.id || null
      });

      return res.json({
        paymentId,
        preferenceId: mpData.id,
        checkoutUrl: mpData.init_point || mpData.sandbox_init_point
      });
    } catch (e: any) {
      console.error('[BILLING_CHECKOUT_ERR]', e);
      res.status(500).json({ error: 'Erro ao iniciar checkout no Mercado Pago', details: e.message });
    }
  });

  // Create Instant PIX via Mercado Pago API OR Official Banco Central BR Code (using Chave PIX)
  api.post('/admin/billing/pix', authenticateToken, async (req: any, res) => {
    try {
      const { planId, billingCycle } = req.body;
      const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
      const plan = SAAS_PLANS.find((p) => p.id === planId);
      if (!plan) {
        return res.status(400).json({ error: 'Plano selecionado inválido.' });
      }

      const [mpToken, pixProfile, savedWhatsapp] = await Promise.all([
        getMpAccessToken(),
        getPlatformPixProfile(),
        cloudNicheDb.getPlatformSetting('support_whatsapp')
      ]);

      const amount = cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
      const daysAdded = cycle === 'annual' ? 365 : 30;
      const paymentId = `pix_${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      const supportWhatsapp = normalizeSupportWhatsapp(savedWhatsapp || process.env.SUPPORT_WHATSAPP || '');

      const buildBrCodeResponse = async () => {
        const txid = paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
        const brCode = generatePixBrCode({
          pixKey: pixProfile.pixKey,
          receiverName: pixProfile.receiverName,
          receiverCity: pixProfile.receiverCity,
          amount,
          txid
        });
        const dataUrl = await QRCode.toDataURL(brCode, { width: 320, margin: 2 });
        const qrCodeBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');

        return {
          mode: 'brcode_pix',
          paymentId,
          amount,
          planName: plan.name,
          billingCycle: cycle,
          pixKey: pixProfile.pixKey,
          qrCode: brCode,
          qrCodeBase64,
          supportWhatsapp
        };
      };

      if (mpToken) {
        await cloudNicheDb.createSaasPayment({
          id: paymentId,
          barbershop_id: req.user.barbershopId,
          plan_id: plan.id,
          plan_name: plan.name,
          amount,
          billing_cycle: cycle,
          payment_method: 'mercadopago_pix',
          external_reference: paymentId,
          status: 'pending',
          days_added: daysAdded,
          created_at: nowIso,
          updated_at: nowIso
        });

        const baseUrl = getAppBaseUrl(req);
        const payerEmail = req.user?.email || `assinatura+${req.user.barbershopId}@doiseme.com`;
        const pixPayload: any = {
          transaction_amount: Number(amount.toFixed(2)),
          description: `DoisemePRO - Plano ${plan.name} (${cycle === 'annual' ? 'Anual' : 'Mensal'})`,
          payment_method_id: 'pix',
          external_reference: paymentId,
          payer: {
            email: payerEmail,
            first_name: 'Assinante',
            last_name: 'DoisemePRO'
          }
        };
        if (baseUrl.startsWith('https://')) {
          pixPayload.notification_url = `${baseUrl}/api/webhooks/mercadopago`;
        }

        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mpToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': paymentId
          },
          body: JSON.stringify(pixPayload)
        });

        const mpData: any = await mpRes.json();
        if (mpRes.ok && mpData?.point_of_interaction?.transaction_data?.qr_code) {
          const tx = mpData.point_of_interaction.transaction_data;
          await cloudNicheDb.updateSaasPayment(paymentId, {
            mp_payment_id: String(mpData.id)
          });

          return res.json({
            mode: 'mercadopago_pix',
            paymentId,
            mpPaymentId: String(mpData.id),
            amount,
            planName: plan.name,
            billingCycle: cycle,
            qrCode: tx.qr_code,
            qrCodeBase64: tx.qr_code_base64 || null,
            ticketUrl: tx.ticket_url || null
          });
        }

        console.warn('[MP_PIX_WARN]', mpData?.message || mpData);
        if (!pixProfile.pixKey) {
          await cloudNicheDb.updateSaasPayment(paymentId, { status: 'failed' });
          return res.status(400).json({
            error: mpData?.message || 'Não foi possível gerar o PIX pelo Mercado Pago. Cadastre sua Chave PIX no Painel Master.'
          });
        }

        await cloudNicheDb.updateSaasPayment(paymentId, { payment_method: 'pix_manual' });
        return res.json(await buildBrCodeResponse());
      }

      if (pixProfile.pixKey) {
        await cloudNicheDb.createSaasPayment({
          id: paymentId,
          barbershop_id: req.user.barbershopId,
          plan_id: plan.id,
          plan_name: plan.name,
          amount,
          billing_cycle: cycle,
          payment_method: 'pix_manual',
          external_reference: paymentId,
          status: 'pending',
          days_added: daysAdded,
          created_at: nowIso,
          updated_at: nowIso
        });

        return res.json(await buildBrCodeResponse());
      }

      return res.status(400).json({
        error: 'Nenhuma Chave PIX foi cadastrada no Painel Master ainda.'
      });
    } catch (e: any) {
      console.error('[BILLING_PIX_ERR]', e);
      res.status(500).json({ error: 'Erro ao gerar pagamento PIX', details: e.message });
    }
  });

  // Register intent when tenant uses a Mercado Pago App Payment Link (created from mobile app)
  api.post('/admin/billing/link-intent', authenticateToken, async (req: any, res) => {
    try {
      const { planId } = req.body;
      const plan = SAAS_PLANS.find((p) => p.id === planId);
      if (!plan) {
        return res.status(400).json({ error: 'Plano selecionado inválido.' });
      }

      const links = await getMpPaymentLinks();
      const paymentUrl = links[plan.id];
      if (!paymentUrl) {
        return res.status(400).json({ error: 'Link de pagamento não configurado para este plano.' });
      }

      // App Payment Links have a fixed monthly price
      const cycle = 'monthly';
      const amount = plan.monthlyPrice;
      const daysAdded = 30;
      const paymentId = `lnk_${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();

      await cloudNicheDb.createSaasPayment({
        id: paymentId,
        barbershop_id: req.user.barbershopId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount,
        billing_cycle: cycle,
        payment_method: 'mercadopago_link',
        external_reference: paymentId,
        status: 'pending',
        days_added: daysAdded,
        created_at: nowIso,
        updated_at: nowIso
      });

      return res.json({ paymentId, paymentUrl, amount, planName: plan.name });
    } catch (e: any) {
      console.error('[BILLING_LINK_INTENT_ERR]', e);
      res.status(500).json({ error: 'Erro ao registrar link de pagamento', details: e.message });
    }
  });

  // Verify / Poll a Payment Status
  api.post('/admin/billing/verify/:paymentId', authenticateToken, async (req: any, res) => {
    try {
      const payment = await cloudNicheDb.getSaasPaymentById(req.params.paymentId);
      if (!payment) {
        return res.status(404).json({ error: 'Pagamento não encontrado.' });
      }
      if (req.user.role !== 'master' && payment.barbershop_id !== req.user.barbershopId) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      if (payment.status === 'approved') {
        const { data: shop } = await supabase
          .from('barbershops')
          .select('expires_at')
          .eq('id', payment.barbershop_id)
          .maybeSingle();
        return res.json({ status: 'approved', newExpiresAt: shop?.expires_at || null });
      }

      const mpToken = await getMpAccessToken();
      if (!mpToken) {
        return res.json({
          status: payment.status,
          message: 'Pagamento aguardando confirmação manual do administrador.'
        });
      }

      let mpPayment: any = null;
      if (payment.mp_payment_id) {
        const r = await fetch(`https://api.mercadopago.com/v1/payments/${payment.mp_payment_id}`, {
          headers: { 'Authorization': `Bearer ${mpToken}` }
        });
        if (r.ok) mpPayment = await r.json();
      } else {
        const r = await fetch(
          `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(payment.external_reference)}&sort=date_created&criteria=desc`,
          { headers: { 'Authorization': `Bearer ${mpToken}` } }
        );
        if (r.ok) {
          const searchData: any = await r.json();
          const results = searchData?.results || [];
          mpPayment = results.find((item: any) => item.status === 'approved') || results[0] || null;
        }
      }

      if (mpPayment?.status === 'approved') {
        const refMatches = !mpPayment.external_reference || mpPayment.external_reference === payment.external_reference;
        const paidAmountOk = Number(mpPayment.transaction_amount || 0) + 0.01 >= Number(payment.amount);
        const currencyOk = !mpPayment.currency_id || mpPayment.currency_id === 'BRL';
        if (refMatches && paidAmountOk && currencyOk) {
          const result = await approveSaasPaymentIdempotently(payment.id, String(mpPayment.id));
          return res.json({ status: 'approved', newExpiresAt: result.newExpiresAt });
        }
        console.warn('[BILLING_VERIFY_MISMATCH]', {
          paymentId: payment.id,
          expectedAmount: payment.amount,
          mpAmount: mpPayment.transaction_amount,
          expectedRef: payment.external_reference,
          mpRef: mpPayment.external_reference
        });
      }

      return res.json({
        status: mpPayment?.status || payment.status,
        message: 'Pagamento ainda pendente de confirmação no Mercado Pago.'
      });
    } catch (e: any) {
      console.error('[BILLING_VERIFY_ERR]', e);
      res.status(500).json({ error: 'Erro ao verificar pagamento', details: e.message });
    }
  });

  // Mercado Pago Webhook (Public, validates directly against MP API)
  api.post('/webhooks/mercadopago', async (req, res) => {
    try {
      const rawPaymentId =
        req.body?.data?.id ||
        req.body?.id ||
        req.query?.['data.id'] ||
        req.query?.id;

      const eventType = req.body?.type || req.body?.topic || req.query?.topic;
      const mpPaymentId = rawPaymentId ? String(rawPaymentId).trim() : '';
      if (!mpPaymentId || !/^\d+$/.test(mpPaymentId) || (eventType && !String(eventType).includes('payment'))) {
        return res.status(200).json({ received: true });
      }

      const mpToken = await getMpAccessToken();
      if (!mpToken) {
        return res.status(200).json({ received: true, skipped: 'no_mp_token' });
      }

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        headers: { 'Authorization': `Bearer ${mpToken}` }
      });
      if (!mpRes.ok) {
        return res.status(200).json({ received: true });
      }

      const mpData: any = await mpRes.json();
      if (mpData?.status === 'approved' && mpData?.external_reference) {
        const localPayment = await cloudNicheDb.getSaasPaymentById(String(mpData.external_reference));
        if (localPayment) {
          const paidAmountOk = Number(mpData.transaction_amount || 0) + 0.01 >= Number(localPayment.amount);
          const currencyOk = !mpData.currency_id || mpData.currency_id === 'BRL';
          if (paidAmountOk && currencyOk) {
            await approveSaasPaymentIdempotently(localPayment.id, String(mpData.id));
            console.log(`[MP_WEBHOOK_APPROVED] Payment ${localPayment.id} approved automatically.`);
          } else {
            console.warn('[MP_WEBHOOK_AMOUNT_MISMATCH]', localPayment.id, mpData.transaction_amount, localPayment.amount);
          }
        }
      }

      return res.status(200).json({ received: true });
    } catch (e) {
      console.error('[MP_WEBHOOK_ERR]', e);
      return res.status(200).json({ received: true });
    }
  });

  // Master Gateway Config & Payments Management
  api.get('/admin/master/billing-config', authenticateToken, requireMaster, async (_req, res) => {
    try {
      const [mpToken, pixProfile, mpLinks] = await Promise.all([
        getMpAccessToken(),
        getPlatformPixProfile(),
        getMpPaymentLinks()
      ]);
      res.json({
        mpConfigured: Boolean(mpToken),
        mpTokenMasked: maskSecretToken(mpToken),
        pixKey: pixProfile.pixKey,
        pixReceiverName: pixProfile.receiverName,
        pixReceiverCity: pixProfile.receiverCity,
        mpLinks
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao carregar configuração de pagamentos', details: e.message });
    }
  });

  api.post('/admin/master/billing-config', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { mpAccessToken, pixKey, pixReceiverName, pixReceiverCity, mpLinks } = req.body;

      if (typeof mpAccessToken === 'string' && mpAccessToken.trim()) {
        const cleanToken = mpAccessToken.trim();
        if (!cleanToken.startsWith('APP_USR-') && !cleanToken.startsWith('TEST-')) {
          return res.status(400).json({
            error: 'Access Token inválido. O token do Mercado Pago começa com APP_USR- ou TEST-.'
          });
        }
        await cloudNicheDb.setPlatformSetting('mp_access_token', cleanToken);
      }

      if (typeof pixKey === 'string') {
        await cloudNicheDb.setPlatformSetting('pix_key', pixKey.trim());
      }
      if (typeof pixReceiverName === 'string') {
        await cloudNicheDb.setPlatformSetting('pix_receiver_name', pixReceiverName.trim() || 'DOISEME PRO');
      }
      if (typeof pixReceiverCity === 'string') {
        await cloudNicheDb.setPlatformSetting('pix_receiver_city', pixReceiverCity.trim() || 'SAO PAULO');
      }
      if (mpLinks && typeof mpLinks === 'object') {
        const cleanedLinks: Record<string, string> = {};
        for (const key of ['essencial', 'profissional', 'premium']) {
          if (typeof mpLinks[key] === 'string' && mpLinks[key].trim()) {
            const rawUrl = mpLinks[key].trim();
            try {
              const parsed = new URL(rawUrl);
              if (parsed.protocol !== 'https:') {
                return res.status(400).json({ error: `O link do plano ${key} deve começar com https://.` });
              }
              cleanedLinks[key] = parsed.toString();
            } catch {
              return res.status(400).json({ error: `Link inválido para o plano ${key}.` });
            }
          }
        }
        await cloudNicheDb.setPlatformSetting('mp_payment_links', JSON.stringify(cleanedLinks));
      }

      const [updatedToken, updatedProfile, updatedLinks] = await Promise.all([
        getMpAccessToken(),
        getPlatformPixProfile(),
        getMpPaymentLinks()
      ]);
      res.json({
        success: true,
        mpConfigured: Boolean(updatedToken),
        mpTokenMasked: maskSecretToken(updatedToken),
        pixKey: updatedProfile.pixKey,
        pixReceiverName: updatedProfile.receiverName,
        pixReceiverCity: updatedProfile.receiverCity,
        mpLinks: updatedLinks
      });
    } catch (e: any) {
      console.error('[MASTER_BILLING_CONFIG_ERR]', e);
      res.status(500).json({ error: 'Erro ao salvar configuração de pagamentos', details: e.message });
    }
  });

  api.get('/admin/master/payments', authenticateToken, requireMaster, async (_req, res) => {
    try {
      const payments = await cloudNicheDb.getAllSaasPayments();
      const { data: shops } = await supabase.from('barbershops').select('id, name, slug');
      const shopMap = new Map((shops || []).map((s: any) => [s.id, s]));

      const enriched = payments.map((p: any) => ({
        ...p,
        shopName: shopMap.get(p.barbershop_id)?.name || p.barbershop_id,
        shopSlug: shopMap.get(p.barbershop_id)?.slug || ''
      }));

      res.json({ payments: enriched });
    } catch (e: any) {
      console.error('[MASTER_PAYMENTS_ERR]', e);
      res.status(500).json({ error: 'Erro ao listar pagamentos SaaS', details: e.message });
    }
  });

  api.post('/admin/master/payments/:id/approve', authenticateToken, requireMaster, async (req, res) => {
    try {
      const result = await approveSaasPaymentIdempotently(req.params.id);
      if (!result.ok) {
        return res.status(404).json({ error: 'Pagamento não encontrado.' });
      }
      res.json({
        success: true,
        alreadyApproved: result.alreadyApproved,
        newExpiresAt: result.newExpiresAt,
        payment: result.payment
      });
    } catch (e: any) {
      console.error('[MASTER_PAYMENT_APPROVE_ERR]', e);
      res.status(500).json({ error: 'Erro ao aprovar pagamento', details: e.message });
    }
  });

  // --- END MASTER ADMIN ROUTES ---

  // Protected Seed Endpoint (Master Admin only)
  api.post('/seed', authenticateToken, requireMaster, async (req, res) => {
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
        message: 'Sistema sincronizado com sucesso!'
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
          
          if (checkErr) {
            if (checkErr.message?.includes('fetch failed') || (checkErr as any).message?.includes('ENOTFOUND')) {
              console.error('\n[CRITICAL ERROR] 🚨 SUPABASE PROJECT PAUSED OR UNREACHABLE 🚨');
              console.error('The application cannot connect to Supabase (ENOTFOUND).');
              console.error('This usually happens when your Supabase Free Tier project is paused due to inactivity.');
              console.error('Please log in to your Supabase dashboard and restore your project.');
              break; // Stop trying if we can't even connect
            }
            console.error(`[STARTUP] Error checking master user ${u.email}:`, checkErr);
            continue;
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

        // Seed initial Mercado Pago App Payment Link if mp_payment_links not yet saved
        try {
          const existingLinksRaw = await cloudNicheDb.getPlatformSetting('mp_payment_links');
          if (!existingLinksRaw) {
            await cloudNicheDb.setPlatformSetting(
              'mp_payment_links',
              JSON.stringify({ essencial: 'https://mpago.la/2GNFS1S' })
            );
            console.log('[STARTUP] Seeded default Essencial Mercado Pago link.');
          }
        } catch (linkSeedErr) {
          console.warn('[STARTUP_MP_LINK_SEED_WARN]', linkSeedErr);
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
