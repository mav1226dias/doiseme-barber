import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import nodeCrypto from 'crypto';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';

import { supabaseAdmin as supabase, hasServiceRoleKey } from './src/db/supabaseAdmin.js';
import { cloudNicheDb } from './src/db/cloudNicheDb.js';
import { getSegment } from './src/lib/segments.js';
import {
  AffiliateCodeSchema,
  AffiliateLoginSchema,
  AffiliateProfileUpdateSchema,
  ApplyAffiliateCouponSchema,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_UPLOAD_BYTES,
  BillingCheckoutSchema,
  BillingLinkIntentSchema,
  CreateAffiliateSchema,
  CreateExpenseSchema,
  CreatePackageSchema,
  CreatePublicAppointmentSchema,
  CreateServiceSchema,
  LoginSchema,
  RegisterSchema,
  UpdateAffiliateSchema,
  UpdateServiceSchema,
  detectImageMagicType,
  sanitizePlainText,
  sanitizeSafeUrl,
  validatePasswordStrength
} from './src/lib/validation.js';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  buildInstanceName,
  formatBrDate,
  renderWhatsAppTemplate,
  resolveEvolutionConfig,
  resolveCronSecret,
  testEvolutionServer,
  connectEvolutionInstance,
  getEvolutionConnectionState,
  logoutEvolutionInstance,
  sendEvolutionTextMessage
} from './src/services/evolutionService.js';

const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production';

const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

function resolveJwtSecret(): { secret: string; configuredInEnv: boolean } {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return { secret: envSecret, configuredInEnv: true };
  }

  if (IS_PRODUCTION) {
    console.error(
      '[SECURITY_CRITICAL] JWT_SECRET não definido ou curto demais (< 16 caracteres) em produção! Configure JWT_SECRET nas variáveis de ambiente imediatamente.'
    );
    // Ephemeral CSPRNG secret — never uses a static predictable string in source code
    return { secret: nodeCrypto.randomBytes(48).toString('hex'), configuredInEnv: false };
  }

  // Local dev fallback: persist an ephemeral CSPRNG key in /tmp so restarts don't invalidate active dev sessions
  const devSecretFile = '/tmp/.doiseme-dev-jwt-secret';
  try {
    if (fs.existsSync(devSecretFile)) {
      const existing = fs.readFileSync(devSecretFile, 'utf8').trim();
      if (existing.length >= 32) {
        return { secret: existing, configuredInEnv: false };
      }
    }
    const generated = nodeCrypto.randomBytes(48).toString('hex');
    fs.writeFileSync(devSecretFile, generated, { mode: 0o600 });
    console.warn('[SECURITY] JWT_SECRET ausente em dev. Chave aleatória temporária gerada em /tmp.');
    return { secret: generated, configuredInEnv: false };
  } catch {
    return { secret: nodeCrypto.randomBytes(48).toString('hex'), configuredInEnv: false };
  }
}

const { secret: JWT_SECRET, configuredInEnv: hasJwtSecretEnv } = resolveJwtSecret();

const SESSION_COOKIE_NAME = 'doiseme_session';
const AUTHORIZED_MASTER_EMAILS = [
  'marcusdoiseme@doiseme.com',
  'marcusdias2014mv@gmail.com',
  'admin@doiseme.com'
];

const app = express();
app.set('trust proxy', 1);

const uploadsBaseDir = isVercel
  ? path.join('/tmp', 'doiseme-data', 'uploads')
  : path.join(process.cwd(), 'data', 'uploads');

let startupSyncPromise: Promise<void> | null = null;

export async function ensureStartupSync() {
  if (startupSyncPromise) return startupSyncPromise;
  startupSyncPromise = (async () => {
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

    try {
      console.log('[STARTUP] Ensuring root shop & syncing Master users...');
      const { data: rootShop } = await supabase
        .from('barbershops')
        .select('id')
        .eq('id', 'shop-1')
        .maybeSingle();

      if (!rootShop) {
        const { error: rootShopErr } = await supabase.from('barbershops').insert({
          id: 'shop-1',
          name: 'Doiseme System',
          slug: 'doiseme',
          segment: 'barbershop',
          is_blocked: false
        });
        if (rootShopErr) {
          console.warn('[STARTUP] Could not create root shop-1:', rootShopErr.message);
        } else {
          console.log('[STARTUP] Root shop-1 created.');
        }
      }

      const masterBootstrapPass = process.env.MASTER_BOOTSTRAP_PASSWORD?.trim();
      const masterUsers = [
        { email: 'marcusdoiseme@doiseme.com', name: 'Marcus Doiseme' },
        { email: 'admin@doiseme.com', name: 'Admin Doiseme' },
        { email: 'marcusdias2014mv@gmail.com', name: 'Marcus Dias' }
      ];

      for (const u of masterUsers) {
        const { data: existingUser, error: checkErr } = await supabase
          .from('users')
          .select('id')
          .ilike('email', u.email)
          .maybeSingle();

        if (checkErr) {
          if (checkErr.message?.includes('fetch failed') || (checkErr as any).message?.includes('ENOTFOUND')) {
            console.error('\n[CRITICAL ERROR] 🚨 SUPABASE PROJECT PAUSED OR UNREACHABLE 🚨');
            console.error('The application cannot connect to Supabase (ENOTFOUND).');
            console.error('This usually happens when your Supabase Free Tier project is paused due to inactivity.');
            console.error('Please log in to your Supabase dashboard and restore your project.');
            break;
          }
          console.error(`[STARTUP] Error checking master user ${u.email}:`, checkErr);
          continue;
        }

        if (existingUser) {
          const { error } = await supabase.from('users').update({ role: 'master' }).eq('id', existingUser.id);
          if (!error) console.log(`[STARTUP] Verified master role for ${u.email}.`);
        } else if (masterBootstrapPass || !IS_PRODUCTION) {
          const initialPass = masterBootstrapPass || nodeCrypto.randomBytes(18).toString('base64url');
          console.log(`[STARTUP] Bootstrapping master user: ${u.email}`);
          const passwordHash = await bcrypt.hash(initialPass, 12);
          const { error } = await supabase.from('users').insert({
            id: crypto.randomUUID(),
            barbershop_id: 'shop-1',
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
        console.error(`URL attempted: ${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}\n`);
      } else {
        console.error('[STARTUP_SYNC_FAILED]', e);
      }
    }
  })();
  return startupSyncPromise;
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  const getClientIp = (req: any): string => {
    const xff = req.headers?.['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      return xff.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  };

  const recordSecurityEvent = (
    req: any,
    params: {
      eventType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      details?: string;
      userEmail?: string;
    }
  ) => {
    const ip = getClientIp(req);
    const email = params.userEmail || req.user?.email || null;
    if (params.severity === 'high' || params.severity === 'critical') {
      console.warn(
        `[SECURITY_AUDIT:${params.severity.toUpperCase()}] ${params.eventType} | ip=${ip} | ${req.method} ${req.originalUrl || req.path}${email ? ` | user=${email}` : ''}${params.details ? ` | ${params.details}` : ''}`
      );
    }
    void cloudNicheDb.createSecurityLog({
      id: crypto.randomUUID(),
      event_type: params.eventType,
      severity: params.severity,
      ip,
      method: req.method,
      path: String(req.originalUrl || req.path || '').slice(0, 200),
      user_id: req.user?.id ? String(req.user.id) : null,
      user_email: email ? String(email).slice(0, 150) : null,
      barbershop_id: req.user?.barbershopId ? String(req.user.barbershopId) : null,
      details: params.details ? String(params.details).slice(0, 500) : null
    });
  };

  const safeErrorResponse = (err: any, fallbackMessage: string) => {
    if (IS_PRODUCTION) {
      return { error: fallbackMessage };
    }
    return {
      error: fallbackMessage,
      ...(err?.message ? { details: err.message } : {})
    };
  };

  // Origin Allowlist for CORS & CSRF
  const buildStaticAllowedOrigins = (): Set<string> => {
    const set = new Set<string>();
    const addUrlOrigin = (raw?: string) => {
      if (!raw) return;
      const trimmed = raw.trim().replace(/^["']|["']$/g, '');
      if (!trimmed || trimmed === 'MY_APP_URL') return;
      try {
        set.add(new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`).origin);
      } catch {
        // ignore invalid URL
      }
    };
    addUrlOrigin(process.env.APP_URL);
    addUrlOrigin(process.env.VERCEL_URL);
    addUrlOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
    if (process.env.TRUSTED_ORIGINS) {
      process.env.TRUSTED_ORIGINS.split(',').forEach((item) => addUrlOrigin(item));
    }
    if (!IS_PRODUCTION) {
      set.add('http://localhost:3000');
      set.add('http://127.0.0.1:3000');
      set.add(`http://localhost:${PORT}`);
    }
    return set;
  };

  const staticAllowedOrigins = buildStaticAllowedOrigins();

  const isAllowedOrigin = (originHeader: string | undefined, req?: any): boolean => {
    if (!originHeader) return true; // Non-browser / same-origin tool / webhook calls without Origin
    try {
      const parsed = new URL(originHeader);
      if (staticAllowedOrigins.has(parsed.origin)) return true;

      // Match same host dynamically
      const reqHost = req?.get?.('host');
      if (reqHost && parsed.host === reqHost) return true;

      // Allow Google AI Studio preview frames & Vercel deployment previews over HTTPS
      if (parsed.protocol === 'https:') {
        if (
          parsed.hostname === 'aistudio.google.com' ||
          parsed.hostname.endsWith('.run.app') ||
          parsed.hostname.endsWith('.vercel.app')
        ) {
          return true;
        }
      }
      if (!IS_PRODUCTION && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const parseCookies = (cookieHeader?: string): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!cookieHeader || typeof cookieHeader !== 'string') return out;
    cookieHeader.split(';').forEach((part) => {
      const idx = part.indexOf('=');
      if (idx <= 0) return;
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    });
    return out;
  };

  const isSecureRequest = (req: any): boolean => {
    const proto = String(req.headers?.['x-forwarded-proto'] || req.protocol || '').split(',')[0].trim().toLowerCase();
    return req.secure || proto === 'https';
  };

  const setSessionCookie = (res: any, req: any, token: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000) => {
    const secure = isSecureRequest(req) || IS_PRODUCTION;
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/api',
      maxAge: maxAgeMs
    });
  };

  const clearSessionCookie = (res: any, req: any) => {
    const secure = isSecureRequest(req) || IS_PRODUCTION;
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/api'
    });
  };

  app.disable('x-powered-by');

  // 1. Block direct HTTP exposure of sensitive files (.env, SQLite DBs, SQL scripts, source files)
  app.use((req, res, next) => {
    const p = (req.path || '').toLowerCase();
    if (
      /(\/\.env|\/\.git|\.db($|-)|\.sql$|\/data\/|\/package(-lock)?\.json$|\/tsconfig\.json$|\/server\.ts$|\/vercel\.json$)/i.test(
        p
      )
    ) {
      recordSecurityEvent(req, {
        eventType: 'EXPOSED_FILE_PROBE',
        severity: 'high',
        details: `Tentativa de acesso direto a arquivo protegido: ${req.path}`
      });
      return res.status(404).json({ error: 'Recurso não encontrado' });
    }
    next();
  });

  // 2. Enforce HTTPS in production behind reverse proxy (Vercel / Cloud Run / Nginx)
  app.use((req, res, next) => {
    if (!IS_PRODUCTION || process.env.ALLOW_INSECURE_HTTP === 'true') {
      return next();
    }
    const host = String(req.get('host') || '');
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
      return next();
    }
    const xfProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    if (xfProto === 'http') {
      if (req.method === 'GET' || req.method === 'HEAD') {
        return res.redirect(301, `https://${host}${req.originalUrl}`);
      }
      return res.status(403).json({ error: 'HTTPS é obrigatório em produção.' });
    }
    next();
  });

  // 3. Comprehensive Security Headers (Helmet + strict CSP + HSTS + Referrer + Permissions-Policy)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: [
            "'self'",
            'https://*.supabase.co',
            'wss://*.supabase.co',
            'https://api.mercadopago.com'
          ],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: [
            "'self'",
            'https://aistudio.google.com',
            'https://*.google.com',
            'https://*.googleusercontent.com',
            'https://*.run.app'
          ]
        }
      },
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false // Managed strictly via CSP frame-ancestors so AI Studio iframe remains functional
    })
  );

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
    next();
  });

  // 4. Restricted CORS Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin, req)) {
      recordSecurityEvent(req, {
        eventType: 'CORS_BLOCKED',
        severity: 'medium',
        details: `Origem CORS não autorizada: ${origin}`
      });
      return res.status(403).json({ error: 'Origem não permitida pela política de CORS.' });
    }
    next();
  });

  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      if (!origin || isAllowedOrigin(origin, req)) {
        callback(null, {
          origin: origin || true,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With']
        });
      } else {
        callback(new Error('Origin not allowed by CORS'));
      }
    })
  );

  // Route-scoped larger JSON payload parser ONLY for image upload endpoint
  app.use('/api/admin/upload', express.json({ limit: '10mb' }));
  // Tight default payload limits elsewhere
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  app.use(
    '/uploads',
    express.static(uploadsBaseDir, {
      maxAge: '1d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    })
  );

  // API Routes
  const api = express.Router();

  // Global Rate Limiter for all /api routes
  const globalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res) => {
      recordSecurityEvent(req, {
        eventType: 'RATE_LIMIT_GLOBAL',
        severity: 'medium',
        details: 'Limite global de requisições excedido'
      });
      res.status(429).json({ error: 'Muitas requisições deste endereço IP. Aguarde alguns minutos.' });
    }
  });
  api.use(globalApiLimiter);

  // CSRF Protection on state-changing API routes
  api.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    // Machine-to-machine webhooks / cron use their own signature / secret validation
    if (req.path === '/webhooks/mercadopago' || req.path.startsWith('/cron/')) {
      return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const authHeader = req.headers.authorization;
    const hasBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
    const cookies = parseCookies(req.headers.cookie);
    const hasSessionCookie = Boolean(cookies[SESSION_COOKIE_NAME]);

    if (origin && !isAllowedOrigin(origin, req)) {
      recordSecurityEvent(req, {
        eventType: 'CSRF_BLOCKED',
        severity: 'high',
        details: `Origin inválido em mutação: ${origin}`
      });
      return res.status(403).json({ error: 'Requisição bloqueada pela proteção CSRF.' });
    }

    if (!origin && referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (!isAllowedOrigin(refOrigin, req)) {
          recordSecurityEvent(req, {
            eventType: 'CSRF_BLOCKED',
            severity: 'high',
            details: `Referer inválido em mutação: ${refOrigin}`
          });
          return res.status(403).json({ error: 'Origem da requisição não autorizada (CSRF).' });
        }
      } catch {
        return res.status(403).json({ error: 'Cabeçalho Referer inválido.' });
      }
    }

    // If authenticating exclusively via HttpOnly cookie without Bearer token, require valid Origin/Referer or custom X-Requested-With header
    if (hasSessionCookie && !hasBearer) {
      const hasCustomHeader = Boolean(req.headers['x-requested-with'] || req.headers['x-csrf-token']);
      if (!origin && !referer && !hasCustomHeader) {
        recordSecurityEvent(req, {
          eventType: 'CSRF_MISSING_PROOF',
          severity: 'high',
          details: 'Mutação com cookie de sessão sem Origin/Referer ou cabeçalho customizado'
        });
        return res.status(403).json({ error: 'Validação CSRF necessária para esta operação.' });
      }
    }

    next();
  });

  if (!IS_PRODUCTION) {
    api.use((req, _res, next) => {
      console.log(`[API_REQ] ${req.method} ${req.path}`);
      next();
    });
  }
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

  // Rate limiters for authentication, public booking, billing, reset, and file uploads
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res) => {
      recordSecurityEvent(req, {
        eventType: 'RATE_LIMIT_LOGIN',
        severity: 'high',
        details: `Bloqueio temporário de força bruta no login`,
        userEmail: req.body?.email ? String(req.body.email).trim().toLowerCase() : undefined
      });
      res.status(429).json({ error: 'Muitas tentativas de login. Tente novamente mais tarde.' });
    }
  });

  const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res) => {
      recordSecurityEvent(req, {
        eventType: 'RATE_LIMIT_REGISTER',
        severity: 'medium',
        details: 'Excesso de tentativas de cadastro'
      });
      res.status(429).json({ error: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.' });
    }
  });

  const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res) => {
      recordSecurityEvent(req, {
        eventType: 'RATE_LIMIT_PASSWORD_RESET',
        severity: 'high',
        details: 'Excesso de requisições de redefinição/troca de senha'
      });
      res.status(429).json({ error: 'Muitas tentativas de redefinição de senha. Aguarde antes de tentar novamente.' });
    }
  });

  const bookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res) => {
      recordSecurityEvent(req, {
        eventType: 'RATE_LIMIT_BOOKING',
        severity: 'medium',
        details: 'Excesso de criação de agendamentos públicos'
      });
      res.status(429).json({ error: 'Muitos agendamentos em sequência. Aguarde alguns minutos.' });
    }
  });

  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res) => {
      recordSecurityEvent(req, {
        eventType: 'RATE_LIMIT_UPLOAD',
        severity: 'medium',
        details: 'Excesso de uploads'
      });
      res.status(429).json({ error: 'Muitos uploads em um curto intervalo. Aguarde alguns minutos.' });
    }
  });

  const billingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res) => {
      recordSecurityEvent(req, {
        eventType: 'RATE_LIMIT_BILLING',
        severity: 'medium',
        details: 'Excesso de requisições de pagamento'
      });
      res.status(429).json({ error: 'Muitas solicitações de pagamento. Aguarde um instante.' });
    }
  });

  const affiliateClickLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { ok: false, error: 'Muitas requisições.' }
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
    const host = req.get('host');
    if (host) return `${req.protocol}://${host}`;
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return 'http://localhost:3000';
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

  // Auth Middleware (Bearer token or HttpOnly session cookie + live DB user/role verification)
  const authenticateToken = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
      const cookies = parseCookies(req.headers.cookie);
      const token = bearerToken || cookies[SESSION_COOKIE_NAME] || null;

      if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({ error: 'Sessão inválida ou expirada. Por favor, faça login novamente.' });
      }

      const decoded: any = await new Promise((resolve, reject) => {
        jwt.verify(token, JWT_SECRET, (err: any, payload: any) => {
          if (err) reject(err);
          else resolve(payload);
        });
      });

      if (decoded?.typ === 'affiliate' || decoded?.role === 'affiliate') {
        recordSecurityEvent(req, {
          eventType: 'CROSS_ROLE_TOKEN_REJECTED',
          severity: 'high',
          details: 'Token de afiliado rejeitado em rota administrativa',
          userEmail: decoded?.email
        });
        return res.status(403).json({ error: 'Token de parceiro não tem acesso ao painel de estabelecimentos.' });
      }

      // Live DB verification so deleted/demoted/password-reset users cannot continue using stale tokens
      if (decoded?.id) {
        const { data: liveUser, error: liveUserErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', decoded.id)
          .maybeSingle();

        if (!liveUserErr) {
          if (!liveUser) {
            recordSecurityEvent(req, {
              eventType: 'REVOKED_USER_TOKEN',
              severity: 'high',
              details: `Token usado para usuário removido (id=${decoded.id})`,
              userEmail: decoded.email
            });
            return res.status(401).json({ error: 'Conta não encontrada. Faça login novamente.' });
          }

          if (!decoded.isImpersonating && decoded.role !== liveUser.role) {
            recordSecurityEvent(req, {
              eventType: 'ROLE_MISMATCH_TOKEN',
              severity: 'critical',
              details: `Role no token (${decoded.role}) difere do banco (${liveUser.role})`,
              userEmail: liveUser.email
            });
            return res.status(403).json({ error: 'Permissões alteradas. Faça login novamente.' });
          }

          if (liveUser.role === 'master') {
            const liveEmail = String(liveUser.email || '').toLowerCase();
            if (!AUTHORIZED_MASTER_EMAILS.includes(liveEmail)) {
              recordSecurityEvent(req, {
                eventType: 'UNAUTHORIZED_MASTER_ROLE',
                severity: 'critical',
                details: `Conta com role master não autorizada na lista mestra`,
                userEmail: liveEmail
              });
              return res.status(403).json({ error: 'Acesso não autorizado.' });
            }
          }

          // Invalidate tokens issued strictly before last password change (5s clock-skew tolerance)
          if (liveUser.updated_at && decoded.iat) {
            const updatedMs = new Date(liveUser.updated_at).getTime();
            const issuedMs = Number(decoded.iat) * 1000;
            if (!Number.isNaN(updatedMs) && updatedMs - issuedMs > 5000) {
              recordSecurityEvent(req, {
                eventType: 'STALE_PASSWORD_TOKEN',
                severity: 'medium',
                details: 'Token emitido antes da última alteração de senha rejeitado',
                userEmail: liveUser.email
              });
              return res.status(401).json({ error: 'Sessão expirada após alteração de senha. Faça login novamente.' });
            }
          }
        }
      }

      req.user = decoded;

      // Enforce shop block / subscription expiry for non-master users
      if (decoded.role !== 'master' && decoded.barbershopId) {
        const { data: shop } = await supabase
          .from('barbershops')
          .select('is_blocked, expires_at')
          .eq('id', decoded.barbershopId)
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
    } catch (err: any) {
      recordSecurityEvent(req, {
        eventType: 'JWT_INVALID',
        severity: 'low',
        details: err?.message || 'Token JWT inválido ou expirado'
      });
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
  };

  // Super Admin Check Middleware
  const requireMaster = (req: any, res: any, next: any) => {
    const userEmail = req.user?.email?.toLowerCase();
    const isAuthorized = Boolean(userEmail && AUTHORIZED_MASTER_EMAILS.includes(userEmail));
    const isMasterRole = req.user?.role === 'master';

    if (isMasterRole && isAuthorized) {
      next();
    } else {
      recordSecurityEvent(req, {
        eventType: 'UNAUTHORIZED_MASTER_ACCESS',
        severity: 'critical',
        details: `Tentativa de acesso ao Painel Master (role=${req.user?.role || 'none'})`
      });
      res.status(403).json({ error: 'Acesso restrito ao Administrador Geral.' });
    }
  };

  // Owner or Master Check Middleware (Blocks role === 'barber')
  const requireOwnerOrMaster = (req: any, res: any, next: any) => {
    if (req.user?.role === 'barber') {
      recordSecurityEvent(req, {
        eventType: 'UNAUTHORIZED_OWNER_ROUTE',
        severity: 'medium',
        details: `Profissional tentou acessar rota exclusiva de proprietário`
      });
      return res.status(403).json({ error: 'Acesso restrito ao administrador do estabelecimento.' });
    }
    next();
  };

  // Resolve Barber ID for logged-in professional
  const resolveBarberId = async (user: any): Promise<string | null> => {
    if (!user) return null;
    if (user.barberId) return String(user.barberId);
    if (user.id) {
      const account = await cloudNicheDb.getBarberAccountByUserId(String(user.id));
      if (account?.barber_id) return account.barber_id;
    }
    return null;
  };

  // Dedicated Affiliate Portal Auth Middleware (strictly separated from admin/master/barber sessions)
  const authenticateAffiliate = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

      if (!bearerToken || bearerToken === 'null' || bearerToken === 'undefined') {
        return res.status(401).json({ error: 'Faça login no Portal de Afiliados para continuar.' });
      }

      const decoded: any = await new Promise((resolve, reject) => {
        jwt.verify(bearerToken, JWT_SECRET, (err: any, payload: any) => {
          if (err) reject(err);
          else resolve(payload);
        });
      });

      if (decoded?.typ !== 'affiliate' || decoded?.role !== 'affiliate' || !decoded?.id) {
        return res.status(403).json({ error: 'Sessão inválida para o Portal de Afiliados.' });
      }

      const affiliate = await cloudNicheDb.getAffiliateById(String(decoded.id));
      if (!affiliate) {
        return res.status(401).json({ error: 'Conta de afiliado não encontrada.' });
      }
      if (!affiliate.active) {
        return res.status(403).json({ error: 'Sua conta de parceiro está pausada ou desativada.' });
      }

      req.affiliate = affiliate;
      next();
    } catch {
      return res.status(401).json({ error: 'Sessão do afiliado inválida ou expirada.' });
    }
  };

  // Helper: Generates idempotent D+15 recurring commission when a referred shop's SaaS payment is approved
  const createCommissionForSaasPayment = async (payment: any) => {
    try {
      if (!payment || payment.status !== 'approved') return null;
      const grossAmount = Number(payment.amount) || 0;
      if (grossAmount <= 0) return null;

      const referral = await cloudNicheDb.getReferralByShopId(payment.barbershop_id);
      if (!referral) return null;

      const affiliate = await cloudNicheDb.getAffiliateById(referral.affiliate_id);
      if (!affiliate || !affiliate.active) return null;

      const rate = Math.max(0.01, Math.min(0.5, Number(affiliate.commission_rate) || 0.25));
      const commissionAmount = Number((grossAmount * rate).toFixed(2));
      if (commissionAmount <= 0) return null;

      const paidMs = payment.paid_at ? new Date(payment.paid_at).getTime() : Date.now();
      const baseMs = Number.isNaN(paidMs) ? Date.now() : paidMs;
      const availableAt = new Date(baseMs + 15 * 24 * 60 * 60 * 1000).toISOString();

      const { commission } = await cloudNicheDb.createAffiliateCommissionIdempotent({
        id: `comm_${nodeCrypto.randomUUID()}`,
        affiliate_id: affiliate.id,
        shop_id: payment.barbershop_id,
        payment_id: payment.id,
        plan_id: payment.plan_id || 'essencial',
        plan_name: payment.plan_name || 'Assinatura',
        gross_amount: grossAmount,
        commission_rate: rate,
        commission_amount: commissionAmount,
        status: 'pending',
        available_at: availableAt
      });

      return commission;
    } catch (err: any) {
      console.warn('[AFFILIATE_COMMISSION_HOOK_WARN]', err?.message || err);
      return null;
    }
  };

  api.get('/health', async (_req, res) => {
    try {
      const { error } = await supabase.from('barbershops').select('id').limit(1);
      if (error) {
        return res.status(500).json({ status: 'error', database: 'failed' });
      }
      res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch {
      res.status(500).json({ status: 'error' });
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

  // DEBUG endpoint disabled in production
  if (!IS_PRODUCTION) {
    api.get('/admin/debug/shops', authenticateToken, requireMaster, async (_req: any, res) => {
      try {
        const { data, error } = await supabase.from('barbershops').select('id, name, slug, is_blocked');
        if (error) console.warn('[DEBUG_DB_SCAN_WARN]', error.message);
        res.json({ count: data?.length, shops: data });
      } catch (e: any) {
        res.status(500).json(safeErrorResponse(e, 'Erro interno'));
      }
    });
  }

  // Public Affiliate Referral Lookup (returns non-sensitive badge metadata + promotional catalog)
  api.get('/public/affiliate/:code', async (req, res) => {
    try {
      const parsed = AffiliateCodeSchema.safeParse(req.params.code);
      if (!parsed.success) {
        return res.json({ valid: false });
      }
      const affiliate = await cloudNicheDb.getAffiliateByCode(parsed.data);
      if (!affiliate || !affiliate.active) {
        return res.json({ valid: false });
      }
      const firstName = String(affiliate.name || '').trim().split(/\s+/)[0] || 'Parceiro';
      return res.json({
        valid: true,
        code: affiliate.code,
        firstName,
        niche: affiliate.niche || null,
        trialDays: 7,
        plans: buildPublicPlansList(true)
      });
    } catch {
      return res.json({ valid: false });
    }
  });

  // Public Affiliate Click Tracking (counts visit & unique visitor hash without PII)
  api.post('/public/affiliate/:code/click', affiliateClickLimiter, async (req, res) => {
    try {
      const parsed = AffiliateCodeSchema.safeParse(req.params.code);
      if (!parsed.success) {
        return res.json({ ok: false });
      }
      const affiliate = await cloudNicheDb.getAffiliateByCode(parsed.data);
      if (!affiliate || !affiliate.active) {
        return res.json({ ok: false });
      }

      const rawVisitorId =
        typeof req.body?.visitorId === 'string'
          ? req.body.visitorId.trim().slice(0, 80)
          : '';
      const rawIp = String(req.ip || req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
      const rawUa = String(req.headers['user-agent'] || '').slice(0, 120);
      const fingerprintSource = rawVisitorId
        ? `${affiliate.id}|vid:${rawVisitorId}`
        : `${affiliate.id}|ip:${rawIp}|ua:${rawUa}`;
      const visitorHash = nodeCrypto
        .createHash('sha256')
        .update(fingerprintSource)
        .digest('hex')
        .slice(0, 24);

      await cloudNicheDb.recordAffiliateClick(affiliate.id, visitorHash);
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: false });
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
        if (error) console.warn('[SHOP_NOT_FOUND_WARN]', identifier);
        return res.status(404).json({
          error: 'Estabelecimento não encontrado'
        });
      }

      if (shop.is_blocked) {
        return res.status(403).json({
          error: 'Estabelecimento temporariamente indisponível',
          details: 'Este espaço está com agendamentos pausados no momento.'
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
      res.status(500).json(safeErrorResponse(e, 'Erro interno ao buscar barbearia'));
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

  // Upload proxy to Supabase Storage (scoped per tenant + strict MIME/magic-bytes/size enforcement)
  api.post('/admin/upload', uploadLimiter, authenticateToken, async (req: any, res) => {
    const { filePath, content, contentType } = req.body || {};
    const BUCKET_NAME = 'barbearias-assets';

    if (!filePath || !content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Faltando dados de upload.' });
    }

    // Strip optional base64 data URI prefix safely while inspecting declared MIME
    let cleanBase64 = content.trim();
    let declaredMime = typeof contentType === 'string' ? contentType.trim().toLowerCase() : '';
    const dataUriMatch = /^data:([^;]+);base64,(.*)$/is.exec(cleanBase64);
    if (dataUriMatch) {
      if (!declaredMime) declaredMime = dataUriMatch[1].toLowerCase();
      cleanBase64 = dataUriMatch[2];
    }
    if (declaredMime === 'image/jpg') declaredMime = 'image/jpeg';

    if (declaredMime && !ALLOWED_IMAGE_MIME_TYPES.has(declaredMime)) {
      recordSecurityEvent(req, {
        eventType: 'INVALID_UPLOAD_MIME',
        severity: 'high',
        details: `Tipo MIME rejeitado no upload: ${declaredMime}`
      });
      return res.status(415).json({ error: 'Formato não permitido. Envie apenas imagens PNG, JPG, WEBP ou GIF.' });
    }

    // Scope upload path by barbershopId and prevent path traversal
    const sanitizedPath = String(filePath)
      .replace(/\\/g, '/')
      .replace(/\.\./g, '')
      .replace(/^\/+/, '');
    const ext = path.extname(sanitizedPath).toLowerCase();
    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
    if (!allowedExtensions.has(ext)) {
      recordSecurityEvent(req, {
        eventType: 'INVALID_UPLOAD_EXT',
        severity: 'high',
        details: `Extensão proibida no upload: ${ext || '(none)'}`
      });
      return res.status(400).json({ error: 'Extensão de arquivo não permitida. Use .png, .jpg, .webp ou .gif.' });
    }

    const tenantPrefix = `shops/${req.user.barbershopId}/`;
    if (sanitizedPath.startsWith('shops/') && !sanitizedPath.startsWith(tenantPrefix)) {
      recordSecurityEvent(req, {
        eventType: 'CROSS_TENANT_UPLOAD',
        severity: 'critical',
        details: `Tentativa de upload fora do tenant: ${sanitizedPath}`
      });
      return res.status(403).json({ error: 'Acesso negado para caminho de armazenamento de outro estabelecimento.' });
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
      recordSecurityEvent(req, {
        eventType: 'UPLOAD_SIZE_EXCEEDED',
        severity: 'medium',
        details: `Upload fora do limite (${buffer.length} bytes)`
      });
      return res.status(413).json({ error: 'A imagem excede o limite máximo de 5 MB.' });
    }

    const detected = detectImageMagicType(buffer);
    if (!detected) {
      recordSecurityEvent(req, {
        eventType: 'INVALID_UPLOAD_MAGIC_BYTES',
        severity: 'critical',
        details: `Conteúdo binário não corresponde a uma imagem válida (file=${path.basename(sanitizedPath)})`
      });
      return res.status(415).json({ error: 'Arquivo inválido ou corrompido. Envie uma imagem real (PNG, JPG, WEBP ou GIF).' });
    }

    // Generate collision-free safe path preserving validated extension matching actual magic bytes
    const rawDir = path.posix.dirname(sanitizedPath.startsWith(tenantPrefix) ? sanitizedPath : `${tenantPrefix}${sanitizedPath}`);
    const safeDir = rawDir.replace(/[^a-zA-Z0-9/_-]/g, '_');
    const safeBase = path.basename(sanitizedPath, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'image';
    const finalFileName = `${safeBase}-${Date.now()}-${nodeCrypto.randomBytes(4).toString('hex')}${detected.ext}`;
    const scopedFilePath = `${safeDir}/${finalFileName}`;

    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(scopedFilePath, buffer, {
          contentType: detected.mime,
          upsert: false
        });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(scopedFilePath);
        return res.json({ publicUrl });
      }

      console.warn('[SERVER_UPLOAD_SUPABASE_WARN] Falling back to local storage:', error.message);

      if (!fs.existsSync(uploadsBaseDir)) {
        fs.mkdirSync(uploadsBaseDir, { recursive: true, mode: 0o750 });
      }
      const targetDiskPath = path.join(uploadsBaseDir, finalFileName);
      fs.writeFileSync(targetDiskPath, buffer);

      return res.json({ publicUrl: `/uploads/${finalFileName}` });
    } catch (e: any) {
      console.error('[SERVER_UPLOAD_CATCH]', e);
      try {
        if (!fs.existsSync(uploadsBaseDir)) {
          fs.mkdirSync(uploadsBaseDir, { recursive: true, mode: 0o750 });
        }
        fs.writeFileSync(path.join(uploadsBaseDir, finalFileName), buffer);
        return res.json({ publicUrl: `/uploads/${finalFileName}` });
      } catch (diskErr: any) {
        return res.status(500).json(safeErrorResponse(diskErr, 'Erro interno ao salvar imagem'));
      }
    }
  });

  type PlanId = 'trial' | 'essencial' | 'profissional' | 'premium';
  const PLAN_META: Record<
    PlanId,
    {
      id: PlanId;
      name: string;
      monthlyPrice: number;
      annualPrice: number;
      promoMonthlyPrice: number;
      promoAnnualPrice: number;
      maxActiveProfessionals: number | null;
    }
  > = {
    trial: {
      id: 'trial',
      name: 'Teste Grátis (7 dias)',
      monthlyPrice: 0,
      annualPrice: 0,
      promoMonthlyPrice: 0,
      promoAnnualPrice: 0,
      maxActiveProfessionals: null
    },
    essencial: {
      id: 'essencial',
      name: 'Agenda Individual (Básico)',
      monthlyPrice: 79.9,
      annualPrice: 659.0,
      promoMonthlyPrice: 59.9,
      promoAnnualPrice: 479.0,
      maxActiveProfessionals: 1
    },
    profissional: {
      id: 'profissional',
      name: 'Plano Pro',
      monthlyPrice: 119.9,
      annualPrice: 1039.0,
      promoMonthlyPrice: 99.9,
      promoAnnualPrice: 859.0,
      maxActiveProfessionals: 4
    },
    premium: {
      id: 'premium',
      name: 'Plano Completo',
      monthlyPrice: 139.9,
      annualPrice: 1197.0,
      promoMonthlyPrice: 119.9,
      promoAnnualPrice: 997.0,
      maxActiveProfessionals: null
    }
  };

  const normalizePlanId = (raw?: string | null): PlanId => {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'essencial' || v === 'solo' || v === 'basico' || v === 'básico') return 'essencial';
    if (v === 'profissional' || v === 'pro') return 'profissional';
    if (v === 'premium' || v === 'completo') return 'premium';
    return 'trial';
  };

  const getPlanMeta = (raw?: string | null) => PLAN_META[normalizePlanId(raw)];

  const getShopPlansMap = async (): Promise<Record<string, PlanId>> => {
    try {
      const raw = await cloudNicheDb.getPlatformSetting('shop_plans_map');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const out: Record<string, PlanId> = {};
      for (const [k, v] of Object.entries(parsed)) {
        out[k] = normalizePlanId(String(v));
      }
      return out;
    } catch {
      return {};
    }
  };

  const setShopPlan = async (shopId: string, rawPlanId: string): Promise<PlanId> => {
    const planId = normalizePlanId(rawPlanId);
    const currentMap = await getShopPlansMap();
    currentMap[shopId] = planId;
    await cloudNicheDb.setPlatformSetting('shop_plans_map', JSON.stringify(currentMap));

    try {
      const { error } = await supabase
        .from('barbershops')
        .update({ plan_id: planId })
        .eq('id', shopId);
      if (error && !String(error.message || '').toLowerCase().includes('plan_id') && error.code !== 'PGRST204') {
        console.warn('[SET_SHOP_PLAN_COLUMN_WARN]', error.message);
      }
    } catch {
      // Ignore if column does not exist yet in Supabase
    }
    return planId;
  };

  const resolveShopPlanId = (shop: any, plansMap?: Record<string, PlanId>): PlanId => {
    if (plansMap && plansMap[shop?.id]) {
      return normalizePlanId(plansMap[shop.id]);
    }
    if (shop?.plan_id) {
      return normalizePlanId(shop.plan_id);
    }
    return 'trial';
  };

  api.get('/admin/shop-info', authenticateToken, async (req: any, res) => {
    try {
      const [{ data, error }, plansMap] = await Promise.all([
        supabase
          .from('barbershops')
          .select('*')
          .eq('id', req.user.barbershopId)
          .single(),
        getShopPlansMap()
      ]);
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

      const resolvedPlanId = resolveShopPlanId(data, plansMap);
      const planMeta = getPlanMeta(resolvedPlanId);

      res.json({
        ...data,
        plan_id: resolvedPlanId,
        plan_name: planMeta.name,
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

  // Helpers de fuso horário (Brasil - America/Sao_Paulo) e intervalos de agenda
  const getSaoPauloNow = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const map: Record<string, string> = {};
    parts.forEach((p) => { map[p.type] = p.value; });
    const rawHour = Number(map.hour);
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = Number(map.minute);
    return {
      dateStr: `${map.year}-${map.month}-${map.day}`,
      hour,
      minute,
      totalMinutes: hour * 60 + minute
    };
  };

  const timeToMinutes = (t?: string | null, fallback = 0): number => {
    if (!t || typeof t !== 'string' || !t.includes(':')) return fallback;
    const [hStr, mStr] = t.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (Number.isNaN(h) || Number.isNaN(m)) return fallback;
    return h * 60 + m;
  };

  const minutesToTime = (totalMins: number): string => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMins)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const dispatchAppointmentWhatsApp = async (params: {
    shopId: string;
    appointmentId?: string | null;
    eventType: 'confirmation' | 'reminder_24h' | 'reminder_2h' | 'cancellation';
    clientName: string;
    clientPhone: string;
    date: string;
    startTime: string;
    serviceName?: string;
    barberName?: string;
    shopName?: string;
  }): Promise<{ sent?: boolean; skipped?: boolean; reason?: string; error?: string }> => {
    try {
      const evoConfig = await resolveEvolutionConfig();
      if (!evoConfig.apiUrl || !evoConfig.apiKey) {
        return { skipped: true, reason: 'server_not_configured' };
      }

      const integration = await cloudNicheDb.getWhatsAppIntegration(params.shopId);
      if (!integration || integration.connection_status !== 'connected') {
        return { skipped: true, reason: 'instance_not_connected' };
      }

      const toggleEnabled =
        params.eventType === 'confirmation'
          ? Boolean(integration.auto_confirm_enabled)
          : params.eventType === 'reminder_24h'
          ? Boolean(integration.reminder_24h_enabled)
          : params.eventType === 'reminder_2h'
          ? Boolean(integration.reminder_2h_enabled)
          : Boolean(integration.auto_cancel_enabled);

      if (!toggleEnabled) {
        return { skipped: true, reason: 'toggle_disabled' };
      }

      if (params.appointmentId) {
        const alreadySent = await cloudNicheDb.hasSentWhatsAppEvent(params.appointmentId, params.eventType);
        if (alreadySent) {
          return { skipped: true, reason: 'already_sent' };
        }
      }

      let shopName = params.shopName || '';
      if (!shopName) {
        const { data: shopRow } = await supabase
          .from('barbershops')
          .select('name')
          .eq('id', params.shopId)
          .maybeSingle();
        shopName = shopRow?.name || 'Estabelecimento';
      }

      const template =
        params.eventType === 'confirmation'
          ? (integration.template_confirm || DEFAULT_WHATSAPP_TEMPLATES.template_confirm)
          : params.eventType === 'reminder_24h'
          ? (integration.template_reminder_24h || DEFAULT_WHATSAPP_TEMPLATES.template_reminder_24h)
          : params.eventType === 'reminder_2h'
          ? (integration.template_reminder_2h || DEFAULT_WHATSAPP_TEMPLATES.template_reminder_2h)
          : (integration.template_cancel || DEFAULT_WHATSAPP_TEMPLATES.template_cancel);

      const messageText = renderWhatsAppTemplate(template, {
        cliente: params.clientName || 'Cliente',
        estabelecimento: shopName,
        servico: params.serviceName || 'Atendimento',
        profissional: params.barberName || 'Equipe',
        data: formatBrDate(params.date),
        horario: String(params.startTime || '').slice(0, 5)
      });

      const sendRes = await sendEvolutionTextMessage(
        evoConfig,
        integration.instance_name,
        params.clientPhone,
        messageText
      );

      await cloudNicheDb.createWhatsAppLog({
        id: crypto.randomUUID(),
        barbershop_id: params.shopId,
        appointment_id: params.appointmentId || null,
        event_type: params.eventType,
        recipient_phone: params.clientPhone,
        recipient_name: params.clientName || null,
        message_text: messageText,
        status: sendRes.ok ? 'sent' : 'failed',
        error_message: sendRes.ok ? null : (sendRes.error || 'Falha no envio'),
        provider_message_id: sendRes.messageId || null
      });

      return sendRes.ok ? { sent: true } : { sent: false, error: sendRes.error };
    } catch (err: any) {
      console.warn('[WHATSAPP_DISPATCH_WARN]', err?.message || err);
      return { sent: false, error: err?.message || 'Erro interno' };
    }
  };

  const buildOccupiedIntervals = (rows: any[]): Array<[number, number]> => {
    return (rows || []).map((appt) => {
      const startMin = timeToMinutes(appt.start_time, -1);
      if (startMin < 0) return null;
      const rawEnd = timeToMinutes(appt.end_time, -1);
      const endMin = rawEnd > startMin ? rawEnd : startMin + 30;
      return [startMin, endMin] as [number, number];
    }).filter((x): x is [number, number] => Boolean(x));
  };

  // Get available slots
  api.get('/barbershops/:id/availability', async (req, res) => {
    const date = String(req.query.date || '').trim();
    const barberId = String(req.query.barberId || '').trim();
    const serviceId = String(req.query.serviceId || '').trim();
    const durationQuery = Number(req.query.durationMinutes || 0);

    if (!date || !barberId) return res.status(400).json({ error: 'Data e profissional são obrigatórios' });

    try {
      const spNow = getSaoPauloNow();
      if (date < spNow.dateStr) return res.json([]);

      const targetDate = new Date(`${date}T12:00:00Z`);
      if (Number.isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Data inválida' });
      }
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = days[targetDate.getUTCDay()];

      const config = await getShopSettings(req.params.id);
      const dayConfig = (config as any)[dayName];

      if (!dayConfig || dayConfig.isClosed) return res.json([]);

      // Resolver duração do serviço selecionado (suporta sessões longas de horas/diárias)
      let serviceDuration = durationQuery > 0 ? Math.min(720, Math.max(15, durationQuery)) : 30;
      if (serviceId && !serviceId.startsWith('sug-')) {
        const { data: svc } = await supabase
          .from('services')
          .select('duration_minutes')
          .eq('id', serviceId)
          .maybeSingle();
        if (svc?.duration_minutes) {
          serviceDuration = Math.min(720, Math.max(15, Number(svc.duration_minutes)));
        }
      }

      let existing: any[] = [];
      if (barberId !== 'prof-default-1') {
        const { data: apptRows, error } = await supabase
          .from('appointments')
          .select('start_time, end_time, status')
          .eq('barber_id', barberId)
          .eq('date', date)
          .in('status', ['scheduled', 'blocked']);

        if (error) {
          if (error.code !== '22P02') throw error;
        } else {
          existing = apptRows || [];
        }
      }

      const occupiedIntervals = buildOccupiedIntervals(existing);

      const openMinutes = timeToMinutes(dayConfig.open, 9 * 60);
      const closeMinutes = timeToMinutes(dayConfig.close, 18 * 60);

      const hasLunch = Boolean(dayConfig.hasLunchBreak);
      const lunchStart = hasLunch ? timeToMinutes(dayConfig.lunchOpen, 12 * 60) : -1;
      const lunchEnd = hasLunch ? timeToMinutes(dayConfig.lunchClose, 13 * 60) : -1;

      const slots: string[] = [];
      const isToday = date === spNow.dateStr;

      for (let slotStart = openMinutes; slotStart + serviceDuration <= closeMinutes; slotStart += 30) {
        const slotEnd = slotStart + serviceDuration;

        // Bloqueia todos os horários que já passaram na data de hoje (inclusive o minuto atual)
        if (isToday && slotStart <= spNow.totalMinutes) {
          continue;
        }

        // Bloqueia se o atendimento invadir o horário de almoço
        if (hasLunch && lunchEnd > lunchStart && slotStart < lunchEnd && slotEnd > lunchStart) {
          continue;
        }

        // Bloqueia se o intervalo [slotStart, slotEnd) colidir com qualquer agendamento ou bloqueio
        const hasConflict = occupiedIntervals.some(([apptStart, apptEnd]) => slotStart < apptEnd && slotEnd > apptStart);
        if (hasConflict) {
          continue;
        }

        slots.push(minutesToTime(slotStart));
      }

      res.json(slots);
    } catch (error) {
      console.error('[AVAILABILITY_ERR]', error);
      res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
    }
  });

  // Create appointment (rate-limited, Zod-validated, parameterized PostgREST phone lookup)
  api.post('/appointments', bookingLimiter, async (req, res) => {
    const parsedBody = CreatePublicAppointmentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const firstIssue = parsedBody.error.issues[0]?.message || 'Dados do agendamento inválidos.';
      return res.status(400).json({ error: firstIssue });
    }

    const {
      barbershopId,
      barberId,
      serviceId,
      clientName,
      clientPhone,
      date,
      startTime,
      notes,
      durationMinutes
    } = parsedBody.data;

    try {
      const { data: targetShopRow, error: targetShopErr } = await supabase
        .from('barbershops')
        .select('id, is_blocked')
        .eq('id', barbershopId)
        .maybeSingle();

      if (targetShopErr) throw targetShopErr;
      if (!targetShopRow) {
        return res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      }
      if (targetShopRow.is_blocked) {
        return res.status(403).json({ error: 'Este estabelecimento não está aceitando agendamentos no momento.' });
      }

      const spNow = getSaoPauloNow();
      const reqStartMinutes = timeToMinutes(String(startTime), -1);
      if (reqStartMinutes < 0) {
        return res.status(400).json({ error: 'Horário de início inválido.' });
      }
      if (String(date) < spNow.dateStr || (String(date) === spNow.dateStr && reqStartMinutes <= spNow.totalMinutes)) {
        return res.status(400).json({ error: 'Este horário já passou. Por favor, escolha um horário futuro.' });
      }

      let resolvedBarberName = 'Equipe';
      if (barberId !== 'prof-default-1') {
        const { data: validBarber } = await supabase
          .from('barbers')
          .select('id, name')
          .eq('id', barberId)
          .eq('barbershop_id', barbershopId)
          .maybeSingle();
        if (!validBarber) {
          return res.status(404).json({ error: 'Profissional não encontrado neste estabelecimento.' });
        }
        if (validBarber.name) resolvedBarberName = validBarber.name;
      }

      const cleanPhone = String(clientPhone).replace(/\D/g, '');
      const trimmedPhone = String(clientPhone).trim();
      const lookupPhone = cleanPhone || trimmedPhone;
      if (!lookupPhone || lookupPhone.length < 8) {
        return res.status(400).json({ error: 'Telefone inválido.' });
      }

      // Parameterized queries (no PostgREST string interpolation in .or())
      let { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('barbershop_id', barbershopId)
        .eq('phone', lookupPhone)
        .limit(1)
        .maybeSingle();

      if (!client && trimmedPhone !== lookupPhone) {
        const fallbackLookup = await supabase
          .from('clients')
          .select('id')
          .eq('barbershop_id', barbershopId)
          .eq('phone', trimmedPhone)
          .limit(1)
          .maybeSingle();
        client = fallbackLookup.data;
      }

      const sanitizedClientName = sanitizePlainText(clientName, 120);
      if (!client) {
        const { data: newC, error: createError } = await supabase
          .from('clients')
          .insert({
            id: crypto.randomUUID(),
            name: sanitizedClientName,
            phone: lookupPhone,
            barbershop_id: barbershopId
          })
          .select()
          .single();

        if (createError) throw createError;
        client = newC;
      }

      // Buscar duração e nome do serviço (suporta sessões longas)
      let duration = Number(durationMinutes) > 0 ? Math.min(720, Math.max(15, Number(durationMinutes))) : 30;
      let resolvedServiceName = 'Atendimento';
      let resolvedServiceId: string | null = String(serviceId);
      if (!resolvedServiceId.startsWith('sug-')) {
        const { data: service } = await supabase
          .from('services')
          .select('name, duration_minutes')
          .eq('id', resolvedServiceId)
          .eq('barbershop_id', barbershopId)
          .maybeSingle();
        if (!service) {
          return res.status(404).json({ error: 'Serviço não encontrado neste estabelecimento.' });
        }
        if (service?.name) resolvedServiceName = service.name;
        if (service?.duration_minutes) {
          duration = Math.min(720, Math.max(15, Number(service.duration_minutes)));
        }
      } else {
        resolvedServiceId = null;
      }

      const totalMinutes = reqStartMinutes + duration;
      const endTime = minutesToTime(totalMinutes);

      // Validar conflito de intervalo na agenda do profissional
      if (barberId !== 'prof-default-1') {
        const { data: dayAppts, error: conflictFetchErr } = await supabase
          .from('appointments')
          .select('start_time, end_time, status')
          .eq('barbershop_id', barbershopId)
          .eq('barber_id', barberId)
          .eq('date', date)
          .in('status', ['scheduled', 'blocked']);

        if (!conflictFetchErr && dayAppts) {
          const occupied = buildOccupiedIntervals(dayAppts);
          const hasOverlap = occupied.some(([aStart, aEnd]) => reqStartMinutes < aEnd && totalMinutes > aStart);
          if (hasOverlap) {
            return res.status(409).json({ error: 'Este horário acabou de ser ocupado. Por favor, selecione outro horário.' });
          }
        }
      }

      const trimmedNotes = notes ? sanitizePlainText(notes, 2000, true) : '';
      const appointmentId = crypto.randomUUID();
      const baseInsert: Record<string, any> = {
        id: appointmentId,
        barbershop_id: barbershopId,
        barber_id: barberId === 'prof-default-1' ? null : barberId,
        service_id: resolvedServiceId,
        client_id: client.id,
        date,
        start_time: minutesToTime(reqStartMinutes),
        end_time: endTime,
        status: 'scheduled'
      };

      let insertResult = await supabase
        .from('appointments')
        .insert([trimmedNotes ? { ...baseInsert, notes: trimmedNotes } : baseInsert])
        .select();

      // Fallback caso a coluna `notes` ainda não tenha sido adicionada na tabela appointments do Supabase
      if (insertResult.error && trimmedNotes && /notes|column|schema cache/i.test(insertResult.error.message || '')) {
        insertResult = await supabase.from('appointments').insert([baseInsert]).select();
      }

      if (insertResult.error) {
        console.error('🚨 ERRO NO INSERT:', insertResult.error.message);
        return res.status(400).json(safeErrorResponse(insertResult.error, 'Não foi possível criar o agendamento.'));
      }

      if (trimmedNotes) {
        await cloudNicheDb.upsertAppointmentNote(appointmentId, barbershopId, trimmedNotes);
      }

      // Disparo automático de confirmação via WhatsApp (não bloqueia agendamento se VPS não configurada)
      await Promise.race([
        dispatchAppointmentWhatsApp({
          shopId: barbershopId,
          appointmentId,
          eventType: 'confirmation',
          clientName: sanitizedClientName,
          clientPhone: lookupPhone,
          date,
          startTime: minutesToTime(reqStartMinutes),
          serviceName: resolvedServiceName,
          barberName: resolvedBarberName
        }),
        new Promise((resolve) => setTimeout(resolve, 3500))
      ]);

      return res.json({
        success: true,
        data: insertResult.data
      });
    } catch (e: any) {
      console.error('🔥 CRASH NA ROTA /api/appointments:', e);
      return res.status(400).json(safeErrorResponse(e, 'Erro ao salvar agendamento'));
    }
  });

  // --- ADMIN AUTH ---
  api.get('/admin/settings', authenticateToken, async (req: any, res) => {
    const settings = await getShopSettings(req.user.barbershopId);
    res.json(settings);
  });

  api.post('/admin/settings', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const shopId = req.user.barbershopId;
    const config = {
      ...(typeof req.body === 'object' && req.body ? req.body : {}),
      _scheduleConfirmed: true
    };
    
    try {
      const { error } = await supabase
        .from('shop_settings')
        .upsert({
          id: crypto.randomUUID(),
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

  // Trocar senha do usuário autenticado (rate-limited + senha forte >= 8 chars + invalida tokens anteriores)
  api.post('/admin/change-password', resetLimiter, authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body || {};
      const userId = req.user.id;
      const userEmail = req.user.email;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'Todos os campos de senha são obrigatórios' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'A nova senha e a confirmação não coincidem' });
      }

      const pwdCheck = validatePasswordStrength(String(newPassword));
      if (!pwdCheck.valid) {
        return res.status(400).json({ error: pwdCheck.error || 'Senha fraca.' });
      }

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

      const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentValid) {
        recordSecurityEvent(req, {
          eventType: 'CHANGE_PASSWORD_WRONG_CURRENT',
          severity: 'medium',
          details: 'Senha atual incorreta ao tentar alterar senha'
        });
        return res.status(400).json({ error: 'A senha atual informada está incorreta' });
      }

      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual' });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
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

      // Issue fresh token/cookie so current session stays valid while older tokens are revoked
      const freshToken = jwt.sign(
        {
          id: req.user.id,
          barbershopId: req.user.barbershopId,
          role: req.user.role,
          email: req.user.email,
          ...(req.user.barberId ? { barberId: req.user.barberId } : {})
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      setSessionCookie(res, req, freshToken);

      console.log(`[PASSWORD CHANGED] User ${user.email} successfully updated their password`);
      return res.json({ success: true, token: freshToken, message: 'Senha alterada com sucesso!' });
    } catch (error: any) {
      console.error('[CHANGE_PASSWORD_CRASH]', error);
      return res.status(500).json(safeErrorResponse(error, 'Erro interno ao processar troca de senha'));
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

  // Self-service shop + owner registration (7-day free trial)
  api.post('/auth/register', registerLimiter, async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || 'Dados de cadastro inválidos.';
      return res.status(400).json({ error: firstErr });
    }

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
      createOwnerAsProfessional = true,
      acceptedTerms,
      referralCode
    } = parsed.data;

    if (acceptedTerms === false) {
      return res.status(400).json({ error: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade (LGPD).' });
    }

    const cleanBusinessName = sanitizePlainText(businessName, 120);
    const cleanOwnerName = sanitizePlainText(ownerName, 120);
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = phone ? sanitizePlainText(phone, 30) : '';
    const cleanSlug = standardizeSlug(String(slug));

    if (!cleanSlug || cleanSlug.length < 3) {
      return res.status(400).json({ error: 'O link personalizado deve ter pelo menos 3 caracteres válidos.' });
    }
    if (RESERVED_SLUGS.has(cleanSlug)) {
      return res.status(400).json({ error: 'Este link personalizado é reservado. Escolha outro.' });
    }
    const pwdStrength = validatePasswordStrength(password);
    if (!pwdStrength.valid) {
      return res.status(400).json({ error: pwdStrength.error });
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
        plan_id: 'trial',
        whatsapp: cleanPhone || null,
        phone: cleanPhone || null,
        primary_color: preset.defaultColors.primary,
        secondary_color: preset.defaultColors.secondary,
        is_blocked: false,
        expires_at: trialExpiresAt
      };

      let { error: shopInsertErr } = await supabase.from('barbershops').insert(shopPayload);
      if (shopInsertErr && (shopInsertErr.code === 'PGRST204' || shopInsertErr.message?.includes('column') || shopInsertErr.message?.includes('schema cache'))) {
        if (shopInsertErr.message?.includes('plan_id')) {
          delete shopPayload.plan_id;
        } else {
          delete shopPayload.plan_id;
          delete shopPayload.segment;
        }
        const retryShop = await supabase.from('barbershops').insert(shopPayload);
        shopInsertErr = retryShop.error;
      }
      if (shopInsertErr) throw shopInsertErr;

      await setShopPlan(shopId, 'trial');

      // Initialize default business hours
      const { error: settingsErr } = await supabase.from('shop_settings').insert({
        id: crypto.randomUUID(),
        barbershop_id: shopId,
        config: DEFAULT_SETTINGS
      });
      if (settingsErr) {
        console.warn('[REGISTER_SETTINGS_WARN]', settingsErr.message);
      }

      // Create admin user with bcrypt cost 12 (rollback shop if user creation fails)
      const passwordHash = await bcrypt.hash(password, 12);
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

      // Optional: Affiliate Referral Attribution (with anti-self-referral guard)
      let attributedReferralCode: string | null = null;
      if (referralCode) {
        const parsedCode = AffiliateCodeSchema.safeParse(referralCode);
        if (parsedCode.success) {
          try {
            const affiliate = await cloudNicheDb.getAffiliateByCode(parsedCode.data);
            if (affiliate && affiliate.active) {
              const sameEmail = String(affiliate.email || '').trim().toLowerCase() === cleanEmail;
              const affPhoneDigits = String(affiliate.phone_whatsapp || '').replace(/\D/g, '');
              const userPhoneDigits = cleanPhone.replace(/\D/g, '');
              const samePhone =
                affPhoneDigits.length >= 10 &&
                userPhoneDigits.length >= 10 &&
                affPhoneDigits.slice(-10) === userPhoneDigits.slice(-10);

              if (sameEmail || samePhone) {
                recordSecurityEvent(req, {
                  eventType: 'AFFILIATE_SELF_REFERRAL_BLOCKED',
                  severity: 'medium',
                  details: `Autoindicação bloqueada no cadastro (${cleanEmail} -> código ${affiliate.code}, shop=${shopId})`,
                  userEmail: cleanEmail
                });
              } else {
                await cloudNicheDb.createReferralAttribution({
                  shop_id: shopId,
                  affiliate_id: affiliate.id,
                  affiliate_code: affiliate.code,
                  referred_email: cleanEmail
                });
                attributedReferralCode = affiliate.code;
              }
            }
          } catch (refErr: any) {
            console.warn('[REGISTER_REFERRAL_WARN]', refErr?.message || refErr);
          }
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
      setSessionCookie(res, req, token);

      console.log(`[REGISTER SUCCESS] New tenant created: ${cleanBusinessName} (/b/${cleanSlug}) by ${cleanEmail}${attributedReferralCode ? ` [ref:${attributedReferralCode}]` : ''}`);

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
      return res.status(500).json(safeErrorResponse(error, 'Erro ao criar estabelecimento. Tente novamente.'));
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

  // Verify reset token validity (rate-limited, 30-min expiry enforced)
  api.get('/auth/verify-reset-token', resetLimiter, async (req, res) => {
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

  // Reset Password using expiring one-time token (rate-limited + password strength + token invalidation)
  api.post('/auth/reset-password', resetLimiter, async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body || {};
    const rawToken = String(token || '').trim();

    if (!rawToken || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }
    const pwdCheck = validatePasswordStrength(String(newPassword));
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.error });
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    try {
      const tokenHash = hashResetToken(rawToken);
      const record = await cloudNicheDb.getPasswordResetTokenByHash(tokenHash);

      if (!record) {
        recordSecurityEvent(req, {
          eventType: 'RESET_TOKEN_INVALID',
          severity: 'medium',
          details: 'Tentativa de redefinição com token inexistente'
        });
        return res.status(400).json({ error: 'Link de redefinição inválido.' });
      }
      if (record.used_at) {
        return res.status(400).json({ error: 'Este link já foi utilizado.' });
      }
      if (new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Este link expirou. Solicite uma nova recuperação.' });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
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
      return res.status(500).json(safeErrorResponse(error, 'Erro ao redefinir senha.'));
    }
  });

  // Logout endpoint (clears HttpOnly session cookie)
  api.post('/auth/logout', (req, res) => {
    clearSessionCookie(res, req);
    return res.json({ success: true });
  });

  api.post('/auth/login', loginLimiter, async (req, res) => {
    if (IS_PRODUCTION && !hasJwtSecretEnv) {
      return res.status(503).json({
        error: 'Configuração de segurança incompleta no servidor (JWT_SECRET ausente).'
      });
    }

    const parsedLogin = LoginSchema.safeParse(req.body);
    if (!parsedLogin.success) {
      return res.status(400).json({ error: parsedLogin.error.issues[0]?.message || 'Email e senha são obrigatórios' });
    }

    const cleanEmail = parsedLogin.data.email.trim().toLowerCase();
    const password = parsedLogin.data.password;

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (error) {
        console.error(`[LOGIN ERROR] Supabase query failed:`, error.message);
        return res.status(500).json(safeErrorResponse(error, 'Erro na conexão com o banco de dados'));
      }

      if (!user) {
        recordSecurityEvent(req, {
          eventType: 'LOGIN_FAILED_UNKNOWN_USER',
          severity: 'low',
          userEmail: cleanEmail
        });
        return res.status(401).json({ error: 'E-mail ou senha inválidos' });
      }

      // Check password first before disclosing shop status (mitigates user/shop enumeration)
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        recordSecurityEvent(req, {
          eventType: 'LOGIN_FAILED_BAD_PASSWORD',
          severity: 'low',
          userEmail: cleanEmail
        });
        return res.status(401).json({ error: 'E-mail ou senha inválidos' });
      }

      let subscriptionExpired = false;
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

      let resolvedBarberId: string | null = null;
      if (user.role === 'barber') {
        resolvedBarberId = (user as any).barber_id || (await cloudNicheDb.getBarberAccountByUserId(user.id))?.barber_id || null;
        if (!resolvedBarberId) {
          return res.status(403).json({
            error: 'Conta de profissional sem vínculo ativo. Peça ao administrador do estabelecimento para vincular seu acesso.'
          });
        }
        const { data: linkedBarber } = await supabase
          .from('barbers')
          .select('id, active')
          .eq('id', resolvedBarberId)
          .eq('barbershop_id', user.barbershop_id)
          .maybeSingle();

        if (!linkedBarber || linkedBarber.active === false) {
          return res.status(403).json({
            error: 'Seu acesso de profissional está desativado no momento. Fale com o administrador.'
          });
        }
      }

      console.log(`[LOGIN SUCCESS] User authenticated: ${user.email} (Role: ${user.role}, BarberId: ${resolvedBarberId || 'n/a'}, Expired: ${subscriptionExpired})`);
      const tokenPayload: Record<string, any> = {
        id: user.id,
        barbershopId: user.barbershop_id,
        role: user.role,
        email: user.email
      };
      if (resolvedBarberId) {
        tokenPayload.barberId = resolvedBarberId;
      }

      const rememberMe = parsedLogin.data.rememberMe !== false;
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: rememberMe ? '30d' : '7d' });
      setSessionCookie(res, req, token, (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000);

      res.json({
        token,
        subscriptionExpired,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          barbershopId: user.barbershop_id,
          ...(resolvedBarberId ? { barberId: resolvedBarberId } : {})
        }
      });
    } catch (error: any) {
      console.error(`[LOGIN FATAL ERROR]`, error);
      res.status(500).json(safeErrorResponse(error, 'Erro interno ao processar login'));
    }
  });

  // --- PROTECTED ADMIN ROUTES ---
  
  // Dashboard stats (Owner / Master only)
  api.patch('/admin/shop/:id?', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const requestedId = req.params.id ? String(req.params.id).trim() : null;
      if (requestedId && requestedId !== req.user.barbershopId && req.user.role !== 'master') {
        console.warn(`[SECURITY_ALERT] Cross-tenant shop update blocked: user=${req.user.email} ownShop=${req.user.barbershopId} target=${requestedId}`);
        return res.status(403).json({ error: 'Acesso negado: você não tem permissão para alterar outro estabelecimento.' });
      }
      const targetId = (req.user.role === 'master' && requestedId) ? requestedId : req.user.barbershopId;

      let validatedSlug: string | undefined = undefined;
      if (req.body.slug !== undefined) {
        const normalizedSlug = standardizeSlug(String(req.body.slug));
        if (!normalizedSlug || normalizedSlug.length < 3) {
          return res.status(400).json({ error: 'O link personalizado deve ter pelo menos 3 caracteres válidos.' });
        }
        if (RESERVED_SLUGS.has(normalizedSlug)) {
          return res.status(400).json({ error: 'Este link personalizado é reservado pelo sistema.' });
        }
        const { data: conflictingShop } = await supabase
          .from('barbershops')
          .select('id')
          .eq('slug', normalizedSlug)
          .neq('id', targetId)
          .maybeSingle();
        if (conflictingShop) {
          return res.status(400).json({ error: 'Este link personalizado já está sendo utilizado por outro estabelecimento.' });
        }
        validatedSlug = normalizedSlug;
      }

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

      const safeLogo = req.body.logo_url !== undefined || req.body.logoUrl !== undefined
        ? sanitizeSafeUrl(req.body.logo_url ?? req.body.logoUrl)
        : undefined;
      const safeBanner = req.body.banner_url !== undefined || req.body.bannerUrl !== undefined
        ? sanitizeSafeUrl(req.body.banner_url ?? req.body.bannerUrl)
        : undefined;
      const safeMaps = req.body.maps_url !== undefined || req.body.mapsUrl !== undefined
        ? sanitizeSafeUrl(req.body.maps_url ?? req.body.mapsUrl, false)
        : undefined;

      const updateData: any = {
        name: req.body.name !== undefined ? sanitizePlainText(req.body.name, 120) : undefined,
        logo_url: safeLogo === null ? null : safeLogo,
        banner_url: safeBanner === null ? null : safeBanner,
        whatsapp: req.body.whatsapp !== undefined ? sanitizePlainText(req.body.whatsapp, 30) : undefined,
        phone: req.body.whatsapp !== undefined ? sanitizePlainText(req.body.whatsapp, 30) : undefined,
        instagram: req.body.instagram !== undefined ? sanitizePlainText(req.body.instagram, 80) : undefined,
        address: req.body.address !== undefined ? sanitizePlainText(req.body.address, 250) : undefined,
        slug: validatedSlug,
        primary_color: primaryColor,
        secondary_color: backgroundColor, // store background color in secondary_color as well
        background_color: backgroundColor,
        text_color: textColor,
        booking_layout: bookingLayoutPayload,
        segment: req.body.segment,
        maps_url: safeMaps === null ? null : safeMaps,
        show_whatsapp: req.body.show_whatsapp !== undefined ? Boolean(req.body.show_whatsapp) : req.body.showWhatsapp,
        show_instagram: req.body.show_instagram !== undefined ? Boolean(req.body.show_instagram) : req.body.showInstagram,
        show_address: req.body.show_address !== undefined ? Boolean(req.body.show_address) : req.body.showAddress,
        updated_at: new Date().toISOString()
      };

      // Limpar campos undefined
      Object.keys(updateData).forEach(key => {
        if ((updateData as any)[key] === undefined) delete (updateData as any)[key];
      });

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

      if (error) {
        console.error('🚨 ERRO NO UPDATE:', error.message);
        return res.status(400).json(safeErrorResponse(error, 'Erro ao atualizar perfil do estabelecimento'));
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
      return res.status(400).json(safeErrorResponse(e, 'Erro ao salvar perfil'));
    }
  });

  api.get('/admin/dashboard', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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
        return res.status(500).json(safeErrorResponse(appErr || svcErr || brbErr, 'Erro ao carregar dados do banco de dados'));
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
      res.status(500).json(safeErrorResponse(error, 'Erro interno ao processar dashboard'));
    }
  });

  // Finances / Expenses (Owner / Master only)
  api.get('/admin/expenses', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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

  api.post('/admin/expenses', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const parsed = CreateExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados de despesa inválidos.' });
    }
    const { description, amount, category, date, barberId } = parsed.data;
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('finances').insert({
        id,
        barbershop_id: req.user.barbershopId,
        type: 'expense',
        description: sanitizePlainText(description, 250),
        amount: Number(amount),
        category: sanitizePlainText(category, 60),
        date,
        barber_id: barberId || null
      });
      if (error) throw error;
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar despesa' });
    }
  });

  api.delete('/admin/expenses/:id', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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

  // Individual Professional Commissions Summary (Part 5)
  api.get('/admin/my-commissions', authenticateToken, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const requestedBarberId = req.query.barberId ? String(req.query.barberId) : null;
      const barberId = req.user.role === 'barber'
        ? await resolveBarberId(req.user)
        : requestedBarberId;

      if (!barberId) {
        return res.status(400).json({ error: 'Profissional não identificado para consulta de comissões.' });
      }

      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const start = String(req.query.start || defaultStart);
      const end = String(req.query.end || defaultEnd);

      const [barberRes, metaMap, apptsRes, servicesRes, drawsRes] = await Promise.all([
        supabase.from('barbers').select('*').eq('id', barberId).eq('barbershop_id', shopId).maybeSingle(),
        cloudNicheDb.getBarbersMetadataMap([barberId]),
        supabase
          .from('appointments')
          .select('id, date, start_time, end_time, status, service_id, clients (name)')
          .eq('barbershop_id', shopId)
          .eq('barber_id', barberId)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false })
          .order('start_time', { ascending: false }),
        supabase.from('services').select('id, name, price').eq('barbershop_id', shopId),
        supabase
          .from('finances')
          .select('id, description, amount, date')
          .eq('barbershop_id', shopId)
          .eq('type', 'expense')
          .eq('category', 'draw')
          .eq('barber_id', barberId)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false })
      ]);

      if (apptsRes.error) throw apptsRes.error;
      const commissionPercentage = Number(
        metaMap[barberId]?.commission_percentage ?? barberRes.data?.commission_percentage ?? 50
      );

      const servicesMap = new Map((servicesRes.data || []).map((s: any) => [s.id, s]));
      const items: any[] = [];
      let totalRevenue = 0;
      let totalCommission = 0;
      let completedCount = 0;
      let scheduledCount = 0;

      (apptsRes.data || []).forEach((apt: any) => {
        if (apt.status === 'scheduled') {
          scheduledCount += 1;
        }
        if (apt.status === 'completed' || apt.status === 'confirmed') {
          completedCount += 1;
          const srv = servicesMap.get(apt.service_id);
          const price = Number(srv?.price || 0);
          const commissionEarned = (price * commissionPercentage) / 100;
          totalRevenue += price;
          totalCommission += commissionEarned;
          items.push({
            id: apt.id,
            date: apt.date,
            startTime: apt.start_time,
            endTime: apt.end_time,
            status: apt.status,
            clientName: (apt.clients as any)?.name || 'Cliente',
            serviceName: srv?.name || 'Atendimento',
            price,
            commissionEarned
          });
        }
      });

      const draws = (drawsRes.data || []).map((d: any) => ({
        id: d.id,
        date: d.date,
        description: d.description || 'Vale / Adiantamento',
        amount: Number(d.amount || 0)
      }));
      const totalDraws = draws.reduce((acc: number, d: any) => acc + d.amount, 0);

      res.json({
        barber: barberRes.data ? { id: barberRes.data.id, name: barberRes.data.name } : { id: barberId, name: 'Profissional' },
        range: { start, end },
        commissionPercentage,
        completedCount,
        scheduledCount,
        totalRevenue,
        totalCommission,
        totalDraws,
        netPayable: totalCommission - totalDraws,
        items,
        draws
      });
    } catch (error: any) {
      console.error('[MY_COMMISSIONS_ERR]', error);
      res.status(500).json({ error: 'Erro ao calcular suas comissões' });
    }
  });

  // Onboarding First-Steps Checklist (Owner / Master only)
  api.get('/admin/onboarding-checklist', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const [shopRes, settingsRes, servicesRes, barbersRes, shopPhotosMap] = await Promise.all([
        supabase.from('barbershops').select('*').eq('id', shopId).maybeSingle(),
        supabase.from('shop_settings').select('config').eq('barbershop_id', shopId).maybeSingle(),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('barbershop_id', shopId).eq('active', true),
        supabase.from('barbers').select('id', { count: 'exact', head: true }).eq('barbershop_id', shopId).eq('active', true),
        cloudNicheDb.getEntityPhotosMap([shopId])
      ]);

      let parsedConfig: any = {};
      if (settingsRes.data?.config) {
        if (typeof settingsRes.data.config === 'string') {
          try { parsedConfig = JSON.parse(settingsRes.data.config); } catch { parsedConfig = {}; }
        } else {
          parsedConfig = settingsRes.data.config;
        }
      }

      const servicesCount = servicesRes.count || 0;
      const barbersCount = barbersRes.count || 0;
      const shop: any = shopRes.data || {};
      const hasSchedule = Boolean(parsedConfig._scheduleConfirmed);
      const hasServices = servicesCount > 0;
      const hasBarbers = barbersCount > 0;
      const hasSharedProfile = Boolean(parsedConfig._shareConfirmed || shop.whatsapp || shop.logo_url || shopPhotosMap[shopId] || shop.address);

      const steps = [
        {
          id: 'schedule',
          title: 'Configure seus horários',
          description: 'Defina dias abertos, abertura, fechamento e intervalo de almoço.',
          completed: hasSchedule,
          path: '/admin/settings',
          cta: 'Definir Horários'
        },
        {
          id: 'services',
          title: 'Cadastre seus serviços',
          description: 'Adicione procedimentos, valores e duração correta de cada atendimento.',
          completed: hasServices,
          path: '/admin/services',
          cta: 'Ver Serviços'
        },
        {
          id: 'barbers',
          title: 'Configure sua equipe',
          description: 'Adicione profissionais, comissões e acessos individuais se desejar.',
          completed: hasBarbers,
          path: '/admin/barbers',
          cta: 'Gerenciar Equipe'
        },
        {
          id: 'share',
          title: 'Compartilhe seu link e QR Code',
          description: 'Personalize sua vitrine e envie seu link público para os clientes agendarem.',
          completed: hasSharedProfile,
          path: '/admin/profile',
          cta: 'Meu Site & QR Code'
        }
      ];

      res.json({
        shopSlug: shop.slug || '',
        shopName: shop.name || '',
        completedCount: steps.filter(s => s.completed).length,
        totalCount: steps.length,
        steps
      });
    } catch (error: any) {
      console.error('[ONBOARDING_CHECKLIST_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar checklist inicial' });
    }
  });

  api.post('/admin/onboarding-confirm-share', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const currentSettings = await getShopSettings(shopId);
      const { data: rawRow } = await supabase
        .from('shop_settings')
        .select('config')
        .eq('barbershop_id', shopId)
        .maybeSingle();

      let rawObj: any = { ...currentSettings };
      if (rawRow?.config) {
        try {
          rawObj = typeof rawRow.config === 'string' ? JSON.parse(rawRow.config) : rawRow.config;
        } catch {
          rawObj = { ...currentSettings };
        }
      }

      const nextConfig = { ...rawObj, _shareConfirmed: true };
      await supabase
        .from('shop_settings')
        .upsert({
          id: crypto.randomUUID(),
          barbershop_id: shopId,
          config: JSON.stringify(nextConfig),
          updated_at: new Date().toISOString()
        }, { onConflict: 'barbershop_id' });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao confirmar etapa' });
    }
  });

  // Client Packages (Owner / Master only)
  api.get('/admin/packages', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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

  api.post('/admin/packages', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const parsed = CreatePackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados de pacote inválidos.' });
    }
    const { clientName, clientWhatsapp, packageName, totalQuantity, pricePaid } = parsed.data;
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('client_packages').insert({
        id,
        barbershop_id: req.user.barbershopId,
        client_name: sanitizePlainText(clientName, 120),
        client_whatsapp: sanitizePlainText(clientWhatsapp, 30),
        package_name: sanitizePlainText(packageName, 120),
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

  api.get('/admin/packages/search', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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

  api.post('/admin/packages/use/:id', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const { data: pkg, error: fetchError } = await supabase
        .from('client_packages')
        .select('remaining_quantity')
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId)
        .single();
      
      if (fetchError || !pkg) throw new Error('Pacote não encontrado');
      if (pkg.remaining_quantity <= 0) throw new Error('Pacote esgotado');

      const { error: updateError } = await supabase
        .from('client_packages')
        .update({ remaining_quantity: pkg.remaining_quantity - 1 })
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);
      
      if (updateError) throw updateError;
      res.json({ success: true, remaining: pkg.remaining_quantity - 1 });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao usar pacote' });
    }
  });

  api.delete('/admin/packages/:id', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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

  // Appointments (Scoped to barberId when req.user.role === 'barber')
  api.get('/admin/appointments', authenticateToken, async (req: any, res) => {
    const { barbershopId } = req.user;
    const { date } = req.query;

    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          clients (id, name, phone),
          barbers (name),
          services (name, price, duration_minutes)
        `)
        .eq('barbershop_id', barbershopId)
        .order('start_time');

      if (req.user.role === 'barber') {
        const barberId = await resolveBarberId(req.user);
        if (!barberId) {
          return res.json([]);
        }
        query = query.eq('barber_id', barberId);
      }

      if (date) {
        query = query.eq('date', date);
      }

      const { data: rawAppointments, error } = await query;
      if (error) throw error;

      const apptIds = (rawAppointments || []).map((a: any) => a.id).filter(Boolean);
      const sidecarNotesMap = await cloudNicheDb.getAppointmentNotesMap(apptIds);

      const results = (rawAppointments || []).map((apt: any) => ({
        id: apt.id,
        date: apt.date,
        startTime: apt.start_time,
        endTime: apt.end_time,
        status: apt.status,
        notes: apt.notes || sidecarNotesMap[apt.id] || '',
        clientId: (apt.clients as any)?.id || apt.client_id,
        clientName: (apt.clients as any)?.name,
        clientPhone: (apt.clients as any)?.phone,
        barberId: apt.barber_id,
        barberName: (apt.barbers as any)?.name,
        serviceName: (apt.services as any)?.name,
        servicePrice: (apt.services as any)?.price,
        durationMinutes: (apt.services as any)?.duration_minutes
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
      let query = supabase
        .from('appointments')
        .update({ status })
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId);

      if (req.user.role === 'barber') {
        const barberId = await resolveBarberId(req.user);
        if (!barberId) return res.status(403).json({ error: 'Acesso não vinculado a profissional.' });
        query = query.eq('barber_id', barberId);
      }

      const { data: updatedRows, error } = await query.select('id');
      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        return res.status(404).json({ error: 'Agendamento não encontrado ou sem permissão.' });
      }

      if (status === 'cancelled') {
        const { data: aptDetail } = await supabase
          .from('appointments')
          .select('id, date, start_time, clients(name, phone), barbers(name), services(name)')
          .eq('id', req.params.id)
          .eq('barbershop_id', req.user.barbershopId)
          .maybeSingle();

        if (aptDetail && (aptDetail.clients as any)?.phone) {
          await Promise.race([
            dispatchAppointmentWhatsApp({
              shopId: req.user.barbershopId,
              appointmentId: aptDetail.id,
              eventType: 'cancellation',
              clientName: (aptDetail.clients as any)?.name || 'Cliente',
              clientPhone: (aptDetail.clients as any)?.phone,
              date: aptDetail.date,
              startTime: aptDetail.start_time,
              serviceName: (aptDetail.services as any)?.name || 'Atendimento',
              barberName: (aptDetail.barbers as any)?.name || 'Equipe'
            }),
            new Promise((resolve) => setTimeout(resolve, 3500))
          ]);
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  });

  api.post('/admin/appointments', authenticateToken, async (req: any, res) => {
    const { barberId: bodyBarberId, serviceId, clientName, clientPhone, date, startTime, notes } = req.body;
    const barbershopId = req.user.barbershopId;

    try {
      let barberId = bodyBarberId;
      if (req.user.role === 'barber') {
        const ownBarberId = await resolveBarberId(req.user);
        if (!ownBarberId) return res.status(403).json({ error: 'Conta sem profissional vinculado.' });
        barberId = ownBarberId;
      }

      const cleanPhone = String(clientPhone || '').replace(/\D/g, '');
      let { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('barbershop_id', barbershopId)
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (!client) {
        const clientId = crypto.randomUUID();
        const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
          id: clientId,
          barbershop_id: barbershopId,
          name: clientName,
          phone: cleanPhone,
        }).select().single();
        if (clientErr) throw clientErr;
        client = newClient;
      }

      const { data: barberRow } = await supabase
        .from('barbers')
        .select('id')
        .eq('id', barberId)
        .eq('barbershop_id', barbershopId)
        .maybeSingle();
      if (!barberRow) {
        return res.status(404).json({ error: 'Profissional não encontrado neste estabelecimento' });
      }

      const { data: service, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .eq('barbershop_id', barbershopId)
        .maybeSingle();

      if (svcErr || !service) return res.status(404).json({ error: 'Serviço não encontrado neste estabelecimento' });

      const startMin = timeToMinutes(startTime, -1);
      if (startMin < 0) return res.status(400).json({ error: 'Horário de início inválido.' });
      const endMin = startMin + Number(service.duration_minutes || 30);
      const endTime = minutesToTime(endMin);

      const { data: dayAppts } = await supabase
        .from('appointments')
        .select('start_time, end_time, status')
        .eq('barbershop_id', barbershopId)
        .eq('barber_id', barberId)
        .eq('date', date)
        .in('status', ['scheduled', 'blocked']);

      const occupied = buildOccupiedIntervals(dayAppts || []);
      const hasOverlap = occupied.some(([aStart, aEnd]) => startMin < aEnd && endMin > aStart);
      if (hasOverlap) {
        return res.status(409).json({ error: 'Horário em conflito com outro atendimento ou bloqueio.' });
      }

      const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';
      const appointmentId = crypto.randomUUID();
      const baseInsert: Record<string, any> = {
        id: appointmentId,
        barbershop_id: barbershopId,
        barber_id: barberId,
        service_id: serviceId,
        client_id: client.id,
        date,
        start_time: minutesToTime(startMin),
        end_time: endTime,
        status: 'scheduled'
      };

      let apptInsert = await supabase
        .from('appointments')
        .insert(trimmedNotes ? { ...baseInsert, notes: trimmedNotes } : baseInsert);

      if (apptInsert.error && trimmedNotes && /notes|column|schema cache/i.test(apptInsert.error.message || '')) {
        apptInsert = await supabase.from('appointments').insert(baseInsert);
      }

      if (apptInsert.error) throw apptInsert.error;

      if (trimmedNotes) {
        await cloudNicheDb.upsertAppointmentNote(appointmentId, barbershopId, trimmedNotes);
      }

      res.json({ success: true, appointmentId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar agendamento' });
    }
  });

  api.post('/admin/appointments/block', authenticateToken, async (req: any, res) => {
    const { date, startTime, endTime, barberId: bodyBarberId } = req.body; // endTime is optional
    try {
      let barberId = bodyBarberId;
      if (req.user.role === 'barber') {
        const ownBarberId = await resolveBarberId(req.user);
        if (!ownBarberId) return res.status(403).json({ error: 'Conta sem profissional vinculado.' });
        barberId = ownBarberId;
      }

      if (barberId) {
        const { data: ownedBarber } = await supabase
          .from('barbers')
          .select('id')
          .eq('id', barberId)
          .eq('barbershop_id', req.user.barbershopId)
          .maybeSingle();
        if (!ownedBarber) {
          return res.status(404).json({ error: 'Profissional não encontrado neste estabelecimento.' });
        }
      }

      let { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId)
        .eq('phone', '00000000000')
        .maybeSingle();
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

  // Barbers (GET allowed for barber to see own profile in Agenda; mutations restricted to Owner/Master)
  api.get('/admin/barbers', authenticateToken, async (req: any, res) => {
    try {
      let query = supabase
        .from('barbers')
        .select('*')
        .eq('barbershop_id', req.user.barbershopId);

      if (req.user.role === 'barber') {
        const ownBarberId = await resolveBarberId(req.user);
        if (!ownBarberId) return res.json([]);
        query = query.eq('id', ownBarberId);
      }

      const { data: barbersList, error } = await query;
      if (error) throw error;

      const barberIds = (barbersList || []).map((b: any) => b.id.toString());
      const [photosMap, metaMap, accountsMap] = await Promise.all([
        cloudNicheDb.getEntityPhotosMap(barberIds),
        cloudNicheDb.getBarbersMetadataMap(barberIds),
        req.user.role === 'barber'
          ? Promise.resolve({} as Record<string, { user_id: string; email: string }>)
          : cloudNicheDb.getBarberAccountsByShop(req.user.barbershopId)
      ]);

      res.json((barbersList || []).map((b: any) => ({
        ...b,
        commission_percentage: metaMap[b.id]?.commission_percentage ?? b.commission_percentage ?? 50,
        photo_url: photosMap[b.id] || b.photo_url || b.avatar_url || null,
        photoUrl: photosMap[b.id] || b.photo_url || b.avatar_url || null,
        service_ids: Array.isArray(b.service_ids) ? b.service_ids : [],
        loginEmail: accountsMap[b.id]?.email || null
      })));
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
  });

  api.post('/admin/barbers', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const { name, commission_percentage, commissionPercentage, service_ids, photo_url, photoUrl, loginEmail, loginPassword } = req.body;
    const effectiveCommission = commission_percentage ?? commissionPercentage;
    const cleanBarberName = sanitizePlainText(name, 120);
    if (!cleanBarberName) {
      return res.status(400).json({ error: 'Nome do profissional é obrigatório.' });
    }
    if (effectiveCommission !== undefined && (!Number.isFinite(Number(effectiveCommission)) || Number(effectiveCommission) < 0 || Number(effectiveCommission) > 100)) {
      return res.status(400).json({ error: 'Comissão deve estar entre 0% e 100%.' });
    }
    try {
      // Enforce plan team limit for non-master owners
      if (req.user.role !== 'master' && !req.user.isImpersonating) {
        const [{ data: shopRow }, plansMap, { data: activeBarbers }] = await Promise.all([
          supabase.from('barbershops').select('id, plan_id').eq('id', req.user.barbershopId).maybeSingle(),
          getShopPlansMap(),
          supabase.from('barbers').select('id').eq('barbershop_id', req.user.barbershopId).eq('active', true)
        ]);
        const currentPlanId = resolveShopPlanId(shopRow || { id: req.user.barbershopId }, plansMap);
        const planMeta = getPlanMeta(currentPlanId);
        if (planMeta.maxActiveProfessionals !== null && (activeBarbers || []).length >= planMeta.maxActiveProfessionals) {
          return res.status(403).json({
            error: `Seu plano atual (${planMeta.name}) permite até ${planMeta.maxActiveProfessionals} profissional(is) ativo(s). Faça upgrade em Assinatura ou solicite ao suporte.`
          });
        }
      }

      const cleanLoginEmail = typeof loginEmail === 'string' ? loginEmail.trim().toLowerCase() : '';
      const cleanLoginPassword = typeof loginPassword === 'string' ? loginPassword : '';

      if (cleanLoginEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanLoginEmail)) {
          return res.status(400).json({ error: 'Informe um e-mail válido para o acesso do profissional.' });
        }
        const pwCheck = validatePasswordStrength(cleanLoginPassword);
        if (!pwCheck.valid) {
          return res.status(400).json({ error: pwCheck.error || 'A senha do profissional deve ter no mínimo 8 caracteres com letras e números.' });
        }
        const { data: existingEmailUser } = await supabase
          .from('users')
          .select('id')
          .ilike('email', cleanLoginEmail)
          .maybeSingle();
        if (existingEmailUser) {
          return res.status(400).json({ error: 'Este e-mail já está em uso por outro usuário.' });
        }
      }

      const id = crypto.randomUUID();
      const rawFinalPhoto = photo_url || photoUrl || null;
      const finalPhoto = rawFinalPhoto ? sanitizeSafeUrl(rawFinalPhoto) : null;
      if (rawFinalPhoto && !finalPhoto) {
        return res.status(400).json({ error: 'URL da foto inválida.' });
      }

      const insertData: any = {
        id,
        barbershop_id: req.user.barbershopId,
        name: cleanBarberName,
        active: true
      };
      if (Array.isArray(service_ids)) {
        insertData.service_ids = service_ids.map((sid: any) => sanitizePlainText(sid, 100)).filter(Boolean);
      }

      let { error } = await supabase.from('barbers').insert(insertData);

      if (error && (error.code === 'PGRST204' || error.message?.includes('service_ids') || error.message?.includes('schema cache'))) {
        console.warn('[DB_FALLBACK] service_ids column not yet migrated in Supabase. Inserting without it.');
        delete insertData.service_ids;
        const retry = await supabase.from('barbers').insert(insertData);
        error = retry.error;
      }

      if (error) throw error;

      if (effectiveCommission !== undefined) {
        await cloudNicheDb.upsertBarberMetadata(id, req.user.barbershopId, Number(effectiveCommission));
      }

      if (finalPhoto) {
        await cloudNicheDb.upsertEntityPhoto(id, req.user.barbershopId, 'barber', finalPhoto);
      }

      if (cleanLoginEmail) {
        const userId = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(cleanLoginPassword, 12);
        const userInsertPayload: Record<string, any> = {
          id: userId,
          barbershop_id: req.user.barbershopId,
          name: cleanBarberName,
          email: cleanLoginEmail,
          password_hash: passwordHash,
          role: 'barber',
          barber_id: id
        };
        let { error: userErr } = await supabase.from('users').insert(userInsertPayload);
        if (userErr && (userErr.message?.includes('barber_id') || userErr.message?.includes('schema cache'))) {
          delete userInsertPayload.barber_id;
          const retryUser = await supabase.from('users').insert(userInsertPayload);
          userErr = retryUser.error;
        }
        if (userErr) throw userErr;

        await cloudNicheDb.upsertBarberAccount({
          barber_id: id,
          user_id: userId,
          barbershop_id: req.user.barbershopId,
          email: cleanLoginEmail
        });
      }

      res.json({ success: true, id, photo_url: finalPhoto, loginEmail: cleanLoginEmail || null });
    } catch (error: any) {
      console.error('[CREATE_BARBER_ERROR]', error);
      res.status(500).json(safeErrorResponse(error, 'Erro ao criar profissional'));
    }
  });

  api.patch('/admin/barbers/:id', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const { active, name, commission_percentage, service_ids, photo_url, photoUrl, loginEmail, loginPassword, removeAccess } = req.body;
    try {
      const barberId = req.params.id;
      const shopId = req.user.barbershopId;

      const { data: targetBarber, error: targetBarberErr } = await supabase
        .from('barbers')
        .select('id, active, name')
        .eq('id', barberId)
        .eq('barbershop_id', shopId)
        .maybeSingle();
      if (targetBarberErr) throw targetBarberErr;
      if (!targetBarber) {
        return res.status(404).json({ error: 'Profissional não encontrado neste estabelecimento.' });
      }

      if (active === true && req.user.role !== 'master' && !req.user.isImpersonating) {
        const [{ data: shopRow }, plansMap, { data: activeBarbers }] = await Promise.all([
          supabase.from('barbershops').select('id, plan_id').eq('id', shopId).maybeSingle(),
          getShopPlansMap(),
          supabase.from('barbers').select('id').eq('barbershop_id', shopId).eq('active', true)
        ]);
        if (!targetBarber.active) {
          const currentPlanId = resolveShopPlanId(shopRow || { id: shopId }, plansMap);
          const planMeta = getPlanMeta(currentPlanId);
          if (planMeta.maxActiveProfessionals !== null && (activeBarbers || []).length >= planMeta.maxActiveProfessionals) {
            return res.status(403).json({
              error: `Seu plano atual (${planMeta.name}) permite até ${planMeta.maxActiveProfessionals} profissional(is) ativo(s). Faça upgrade em Assinatura.`
            });
          }
        }
      }

      const cleanLoginEmail = typeof loginEmail === 'string' ? loginEmail.trim().toLowerCase() : undefined;
      const cleanLoginPassword = typeof loginPassword === 'string' ? loginPassword : undefined;

      // Validate credentials payload before mutating
      const existingAccount = await cloudNicheDb.getBarberAccountByBarberId(barberId);
      if (!removeAccess && cleanLoginEmail !== undefined && cleanLoginEmail !== '') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanLoginEmail)) {
          return res.status(400).json({ error: 'Informe um e-mail válido para o acesso do profissional.' });
        }
        const { data: emailConflict } = await supabase
          .from('users')
          .select('id')
          .ilike('email', cleanLoginEmail)
          .maybeSingle();
        if (emailConflict && emailConflict.id !== existingAccount?.user_id) {
          return res.status(400).json({ error: 'Este e-mail já está em uso por outro usuário.' });
        }
        if (!existingAccount) {
          const pwCheck = validatePasswordStrength(cleanLoginPassword || '');
          if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error || 'Defina uma senha com no mínimo 8 caracteres, com letras e números.' });
          }
        }
        if (cleanLoginPassword) {
          const pwCheck = validatePasswordStrength(cleanLoginPassword);
          if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error || 'A nova senha deve ter no mínimo 8 caracteres, com letras e números.' });
          }
        }
      }

      if (commission_percentage !== undefined && (!Number.isFinite(Number(commission_percentage)) || Number(commission_percentage) < 0 || Number(commission_percentage) > 100)) {
        return res.status(400).json({ error: 'Comissão deve estar entre 0% e 100%.' });
      }

      const rawPhotoInput = photo_url !== undefined ? photo_url : photoUrl;
      const sanitizedPhoto = rawPhotoInput ? sanitizeSafeUrl(rawPhotoInput) : null;
      if (rawPhotoInput && !sanitizedPhoto) {
        return res.status(400).json({ error: 'URL da foto inválida.' });
      }

      const updateData: any = {};
      if (active !== undefined) updateData.active = Boolean(active);
      if (name !== undefined) {
        const cleanName = sanitizePlainText(name, 120);
        if (!cleanName) return res.status(400).json({ error: 'Nome inválido.' });
        updateData.name = cleanName;
      }
      if (service_ids !== undefined && Array.isArray(service_ids)) {
        updateData.service_ids = service_ids.map((sid: any) => sanitizePlainText(sid, 100)).filter(Boolean);
      }

      if (Object.keys(updateData).length > 0) {
        let { error } = await supabase
          .from('barbers')
          .update(updateData)
          .eq('id', barberId)
          .eq('barbershop_id', shopId);

        if (error && (error.code === 'PGRST204' || error.message?.includes('service_ids') || error.message?.includes('schema cache'))) {
          console.warn('[DB_FALLBACK] service_ids column not yet migrated in Supabase. Updating without it.');
          delete updateData.service_ids;
          if (Object.keys(updateData).length > 0) {
            const retry = await supabase
              .from('barbers')
              .update(updateData)
              .eq('id', barberId)
              .eq('barbershop_id', shopId);
            error = retry.error;
          } else {
            error = null;
          }
        }

        if (error) throw error;
      }

      if (commission_percentage !== undefined) {
        await cloudNicheDb.upsertBarberMetadata(barberId, shopId, Number(commission_percentage));
      }

      if (photo_url !== undefined || photoUrl !== undefined) {
        await cloudNicheDb.upsertEntityPhoto(barberId, shopId, 'barber', sanitizedPhoto);
      }

      if (removeAccess === true) {
        if (existingAccount?.user_id) {
          await supabase.from('users').delete().eq('id', existingAccount.user_id).eq('barbershop_id', shopId).eq('role', 'barber');
        }
        await cloudNicheDb.deleteBarberAccount(barberId);
      } else if (cleanLoginEmail !== undefined && cleanLoginEmail !== '') {
        if (existingAccount) {
          const userUpdate: Record<string, any> = {
            email: cleanLoginEmail,
            ...(name ? { name: sanitizePlainText(name, 120) } : {})
          };
          if (cleanLoginPassword && validatePasswordStrength(cleanLoginPassword).valid) {
            userUpdate.password_hash = await bcrypt.hash(cleanLoginPassword, 12);
            userUpdate.updated_at = new Date().toISOString();
          }
          await supabase.from('users').update(userUpdate).eq('id', existingAccount.user_id).eq('barbershop_id', shopId);
          await cloudNicheDb.upsertBarberAccount({
            barber_id: barberId,
            user_id: existingAccount.user_id,
            barbershop_id: shopId,
            email: cleanLoginEmail
          });
        } else if (cleanLoginPassword && validatePasswordStrength(cleanLoginPassword).valid) {
          const userId = crypto.randomUUID();
          const passwordHash = await bcrypt.hash(cleanLoginPassword, 12);
          const { data: barberRow } = await supabase.from('barbers').select('name').eq('id', barberId).maybeSingle();
          const userInsertPayload: Record<string, any> = {
            id: userId,
            barbershop_id: shopId,
            name: sanitizePlainText(name || barberRow?.name || 'Profissional', 120),
            email: cleanLoginEmail,
            password_hash: passwordHash,
            role: 'barber',
            barber_id: barberId
          };
          let { error: userErr } = await supabase.from('users').insert(userInsertPayload);
          if (userErr && (userErr.message?.includes('barber_id') || userErr.message?.includes('schema cache'))) {
            delete userInsertPayload.barber_id;
            const retryUser = await supabase.from('users').insert(userInsertPayload);
            userErr = retryUser.error;
          }
          if (userErr) throw userErr;

          await cloudNicheDb.upsertBarberAccount({
            barber_id: barberId,
            user_id: userId,
            barbershop_id: shopId,
            email: cleanLoginEmail
          });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[UPDATE_BARBER_ERROR]', error);
      res.status(500).json(safeErrorResponse(error, 'Erro ao atualizar profissional'));
    }
  });

  // Services (Read allowed for Agenda; mutations restricted to Owner/Master)
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

  api.post('/admin/services', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const parsed = CreateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados do serviço inválidos.' });
    }
    const { name, durationMinutes, price, image_url, imageUrl, photo_url } = parsed.data;
    const rawFinalImage = image_url || imageUrl || photo_url || null;
    const finalImage = rawFinalImage ? sanitizeSafeUrl(rawFinalImage) : null;
    if (rawFinalImage && !finalImage) {
      return res.status(400).json({ error: 'URL da imagem do serviço inválida.' });
    }
    try {
      const id = crypto.randomUUID();

      const { error } = await supabase.from('services').insert({
        id,
        barbershop_id: req.user.barbershopId,
        name: sanitizePlainText(name, 120),
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

  api.patch('/admin/services/:id', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const parsed = UpdateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados de atualização inválidos.' });
    }
    const { active, name, durationMinutes, price, image_url, imageUrl, photo_url } = parsed.data;
    const rawImage = image_url !== undefined ? image_url : (imageUrl !== undefined ? imageUrl : photo_url);
    const cleanImage = rawImage ? sanitizeSafeUrl(rawImage) : null;
    if (rawImage && !cleanImage) {
      return res.status(400).json({ error: 'URL da imagem do serviço inválida.' });
    }
    try {
      const { data: existingService, error: svcCheckErr } = await supabase
        .from('services')
        .select('id')
        .eq('id', req.params.id)
        .eq('barbershop_id', req.user.barbershopId)
        .maybeSingle();
      if (svcCheckErr) throw svcCheckErr;
      if (!existingService) {
        return res.status(404).json({ error: 'Serviço não encontrado neste estabelecimento.' });
      }

      const updateData: any = {};
      if (active !== undefined) updateData.active = active;
      if (name !== undefined) updateData.name = sanitizePlainText(name, 120);
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
        await cloudNicheDb.upsertEntityPhoto(req.params.id, req.user.barbershopId, 'service', cleanImage);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar serviço' });
    }
  });

  api.delete('/admin/services/:id', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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
      res.status(500).json(safeErrorResponse(error, 'Erro ao excluir serviço'));
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

  // Inactive Clients (no appointments in last 20 days - Owner / Master only)
  api.get('/admin/inactive-clients', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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
      if (req.user.role === 'barber') {
        const barberId = await resolveBarberId(req.user);
        if (!barberId) return res.json([]);
        const { data: appts, error: apptErr } = await supabase
          .from('appointments')
          .select('client_id')
          .eq('barbershop_id', req.user.barbershopId)
          .eq('barber_id', barberId);
        if (apptErr) throw apptErr;

        const clientIds = Array.from(new Set((appts || []).map((a: any) => a.client_id).filter(Boolean)));
        if (clientIds.length === 0) return res.json([]);

        const { data: scopedClients, error } = await supabase
          .from('clients')
          .select('*')
          .eq('barbershop_id', req.user.barbershopId)
          .in('id', clientIds)
          .neq('phone', '00000000000')
          .order('name');
        if (error) throw error;
        return res.json(scopedClients || []);
      }

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

  api.post('/admin/clients', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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

  api.post('/admin/clients/batch', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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

  const deleteClientsForShop = async (barbershopId: string, rawIds: unknown[]) => {
    const cleanIds = Array.from(
      new Set((rawIds || []).map((id) => String(id || '').trim()).filter(Boolean))
    );
    if (cleanIds.length === 0) {
      return { count: 0 };
    }

    console.log(`[DELETE_CLIENTS] Attempting to delete ${cleanIds.length} client(s) for shop ${barbershopId}`);

    // 1. Delete associated appointments first to satisfy FK constraints
    const { error: apptErr } = await supabase
      .from('appointments')
      .delete()
      .in('client_id', cleanIds)
      .eq('barbershop_id', barbershopId);

    if (apptErr) {
      console.error('[DELETE_CLIENTS_APPOINTMENTS_ERR]', apptErr);
      throw new Error(`Erro ao remover agendamentos do cliente: ${apptErr.message}`);
    }

    // 2. Delete associated clinical/niche records across cloud & local fallback
    await cloudNicheDb.deleteClientsData(barbershopId, cleanIds);

    // 3. Delete client records themselves
    const { data: deletedRows, error } = await supabase
      .from('clients')
      .delete()
      .in('id', cleanIds)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      console.error('[DELETE_CLIENTS_ERR]', error);
      throw error;
    }

    const deletedCount = Array.isArray(deletedRows) ? deletedRows.length : cleanIds.length;
    console.log(`[DELETE_CLIENTS_SUCCESS] Excluded ${deletedCount} client(s).`);
    return { count: deletedCount };
  };

  api.delete('/admin/clients', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const queryIds =
      typeof req.query?.ids === 'string'
        ? req.query.ids.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
    const ids = Array.isArray(req.body?.ids) && req.body.ids.length > 0 ? req.body.ids : queryIds;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nenhum cliente selecionado' });
    }

    try {
      const result = await deleteClientsForShop(req.user.barbershopId, ids);
      res.json({ success: true, count: result.count });
    } catch (error: any) {
      console.error('[DELETE_CLIENTS_CRASH]', error);
      res.status(500).json(safeErrorResponse(error, 'Erro ao excluir clientes'));
    }
  });

  api.post('/admin/clients/delete', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nenhum cliente selecionado' });
    }

    try {
      const result = await deleteClientsForShop(req.user.barbershopId, ids);
      res.json({ success: true, count: result.count });
    } catch (error: any) {
      console.error('[POST_DELETE_CLIENTS_CRASH]', error);
      res.status(500).json(safeErrorResponse(error, 'Erro ao excluir clientes'));
    }
  });

  api.delete('/admin/clients/:id', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'ID do cliente inválido' });
    }

    try {
      const result = await deleteClientsForShop(req.user.barbershopId, [id]);
      if (result.count === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado neste estabelecimento' });
      }
      res.json({ success: true, count: result.count });
    } catch (error: any) {
      console.error('[DELETE_SINGLE_CLIENT_CRASH]', error);
      res.status(500).json(safeErrorResponse(error, 'Erro ao excluir cliente'));
    }
  });

  // --- CLIENT CLINICAL RECORDS & ANAMNESIS (NICHE: PSYCHOLOGY & OTHERS) ---
  api.use('/admin/clients/:id/*', authenticateToken, async (req: any, res, next) => {
    try {
      const clientId = String(req.params.id || '').trim();
      const barbershopId = req.user?.barbershopId;
      if (!clientId || !barbershopId) {
        return res.status(400).json({ error: 'Cliente inválido.' });
      }
      const { data: clientRow, error: clientCheckErr } = await supabase
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('barbershop_id', barbershopId)
        .maybeSingle();
      if (clientCheckErr) throw clientCheckErr;
      if (!clientRow) {
        return res.status(404).json({ error: 'Cliente não encontrado neste estabelecimento.' });
      }
      next();
    } catch (err: any) {
      console.error('[CLIENT_SCOPE_CHECK_ERR]', err);
      res.status(500).json({ error: 'Erro ao validar cliente do estabelecimento.' });
    }
  });

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

      const apptIds = (appts || []).map((a: any) => a.id).filter(Boolean);
      const sidecarNotesMap = await cloudNicheDb.getAppointmentNotesMap(apptIds);

      const enrichedAppts = (appts || []).map(a => {
        const s = (services || []).find(srv => srv.id === a.service_id);
        const b = (barbers || []).find(brb => brb.id === a.barber_id);
        return {
          ...a,
          notes: a.notes || sidecarNotesMap[a.id] || '',
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

    const cleanProcedure = sanitizePlainText(procedure_name, 150);
    if (!cleanProcedure) {
      return res.status(400).json({ error: 'Nome do procedimento é obrigatório' });
    }

    const cleanBeforeUrl = before_photo_url ? sanitizeSafeUrl(before_photo_url) : undefined;
    const cleanAfterUrl = after_photo_url ? sanitizeSafeUrl(after_photo_url) : undefined;
    if ((before_photo_url && !cleanBeforeUrl) || (after_photo_url && !cleanAfterUrl)) {
      return res.status(400).json({ error: 'URL de imagem inválida.' });
    }

    try {
      const id = crypto.randomUUID();
      const photoRecord = await cloudNicheDb.addAestheticsPhoto({
        id,
        barbershop_id: barbershopId,
        client_id: clientId,
        procedure_name: cleanProcedure,
        date: sanitizePlainText(date, 20) || new Date().toISOString().split('T')[0],
        before_photo_url: cleanBeforeUrl,
        after_photo_url: cleanAfterUrl,
        notes: notes ? sanitizePlainText(notes, 1000, true) : undefined
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

  // --- NICHE: PROJETOS CRIATIVOS (MARCENARIA, ARQUITETURA, FOTOGRAFIA, AUDIOVISUAL) ---
  api.get('/admin/clients/:id/creative-projects', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;

    try {
      const projects = await cloudNicheDb.getCreativeProjects(barbershopId, clientId);
      res.json({ projects });
    } catch (error: any) {
      console.error('[CREATIVE_PROJECTS_GET_ERR]', error);
      res.status(500).json({ error: 'Erro ao carregar projetos e produções' });
    }
  });

  api.post('/admin/clients/:id/creative-projects', authenticateToken, async (req: any, res) => {
    const clientId = req.params.id;
    const barbershopId = req.user.barbershopId;
    const {
      segment_type,
      project_title,
      category_or_style,
      location_or_room,
      dimensions_or_scope,
      materials_or_specs,
      status,
      delivery_date,
      deliverable_link,
      estimated_value,
      notes
    } = req.body;

    const cleanTitle = sanitizePlainText(project_title, 150);
    if (!cleanTitle) {
      return res.status(400).json({ error: 'O título do projeto / ensaio é obrigatório.' });
    }

    const cleanDeliverableUrl = deliverable_link ? sanitizeSafeUrl(deliverable_link) : undefined;
    if (deliverable_link && !cleanDeliverableUrl) {
      return res.status(400).json({ error: 'Link de entrega inválido. Utilize http:// ou https://.' });
    }

    try {
      const project = await cloudNicheDb.createCreativeProject({
        id: crypto.randomUUID(),
        barbershop_id: barbershopId,
        client_id: clientId,
        segment_type: sanitizePlainText(segment_type, 60) || 'woodwork',
        project_title: cleanTitle,
        category_or_style: category_or_style ? sanitizePlainText(category_or_style, 120) : undefined,
        location_or_room: location_or_room ? sanitizePlainText(location_or_room, 120) : undefined,
        dimensions_or_scope: dimensions_or_scope ? sanitizePlainText(dimensions_or_scope, 300) : undefined,
        materials_or_specs: materials_or_specs ? sanitizePlainText(materials_or_specs, 500, true) : undefined,
        status: status ? sanitizePlainText(status, 80) : 'Briefing / Orçamento',
        delivery_date: delivery_date ? sanitizePlainText(delivery_date, 20) : undefined,
        deliverable_link: cleanDeliverableUrl,
        estimated_value: estimated_value !== undefined && estimated_value !== '' && Number.isFinite(Number(estimated_value)) ? Number(estimated_value) : undefined,
        notes: notes ? sanitizePlainText(notes, 1000, true) : undefined
      });

      res.json({ success: true, project });
    } catch (error: any) {
      console.error('[CREATIVE_PROJECTS_POST_ERR]', error);
      res.status(500).json({ error: 'Erro ao registrar projeto' });
    }
  });

  api.patch('/admin/clients/:id/creative-projects/:projectId/status', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const projectId = req.params.projectId;
    const { status } = req.body;

    if (!status || !String(status).trim()) {
      return res.status(400).json({ error: 'Status é obrigatório.' });
    }

    try {
      const updated = await cloudNicheDb.updateCreativeProjectStatus(projectId, barbershopId, String(status).trim());
      if (!updated) return res.status(404).json({ error: 'Projeto não encontrado.' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[CREATIVE_PROJECTS_PATCH_ERR]', error);
      res.status(500).json({ error: 'Erro ao atualizar status do projeto' });
    }
  });

  api.delete('/admin/clients/:id/creative-projects/:projectId', authenticateToken, async (req: any, res) => {
    const barbershopId = req.user.barbershopId;
    const projectId = req.params.projectId;

    try {
      const deleted = await cloudNicheDb.deleteCreativeProject(projectId, barbershopId);
      if (!deleted) return res.status(404).json({ error: 'Projeto não encontrado' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('[CREATIVE_PROJECTS_DEL_ERR]', error);
      res.status(500).json({ error: 'Erro ao excluir projeto' });
    }
  });

  // --- CAMPAIGNS (Owner / Master only) ---
  api.post('/admin/campaigns', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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

  api.get('/admin/campaigns', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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
        await supabase.from('notifications').delete().in('id', expiredIds).eq('barbershop_id', req.user.barbershopId);
      }

      res.json(activeCampaigns);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao carregar campanhas' });
    }
  });

  api.delete('/admin/campaigns/:id', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
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
    const { name, slug, email, password, segment, plan_id, planId, phone, whatsapp, expires_at } = req.body;
    const cleanName = sanitizePlainText(name, 120);
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanName || !slug || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'E-mail do administrador inválido.' });
    }

    const pwCheck = validatePasswordStrength(String(password));
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error || 'A senha deve ter no mínimo 8 caracteres, com letras e números.' });
    }

    try {
      const cleanSlug = standardizeSlug(slug);
      if (cleanSlug.length < 3 || RESERVED_SLUGS.has(cleanSlug)) {
        return res.status(400).json({ error: 'Slug inválido ou reservado.' });
      }
      
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
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: 'Este email já está cadastrado.' });
      }

      // Create shop with segment / business_type / plan_id
      const shopId = crypto.randomUUID();
      const shopType = req.body.business_type || req.body.businessType || segment || 'barbershop';
      const targetPlanId = normalizePlanId(plan_id || planId || 'trial');
      const cleanContact = whatsapp || phone ? sanitizePlainText(whatsapp || phone, 40) : null;
      const defaultExpires = expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const insertShopPayload: Record<string, any> = {
        id: shopId,
        name: cleanName,
        slug: cleanSlug,
        segment: shopType,
        plan_id: targetPlanId,
        whatsapp: cleanContact,
        phone: cleanContact,
        is_blocked: false,
        expires_at: defaultExpires
      };

      let { error: shopErr } = await supabase.from('barbershops').insert(insertShopPayload);
      if (shopErr && (shopErr.code === 'PGRST204' || shopErr.message?.includes('plan_id') || shopErr.message?.includes('schema cache'))) {
        delete insertShopPayload.plan_id;
        const retry = await supabase.from('barbershops').insert(insertShopPayload);
        shopErr = retry.error;
      }

      if (shopErr) throw shopErr;

      await setShopPlan(shopId, targetPlanId);

      // Create Admin User
      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(String(password), 12);
      const { error: userErr } = await supabase
        .from('users')
        .insert({
          id: userId,
          barbershop_id: shopId,
          name: `${cleanName} Admin`,
          email: cleanEmail,
          password_hash: passwordHash,
          role: 'admin'
        });

      if (userErr) throw userErr;

      res.json({ 
        success: true, 
        message: 'Estabelecimento e administrador criados com sucesso!', 
        shop: { id: shopId, name: cleanName, slug: cleanSlug, plan_id: targetPlanId, plan_name: getPlanMeta(targetPlanId).name },
        admin: { email: cleanEmail }
      });
    } catch (e: any) {
      console.error('[MASTER_CREATE_SHOP_ERROR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao criar estabelecimento'));
    }
  });

  // List all shops (Master only) — enriched with plan, permission, admin contact & payment totals
  api.get('/admin/master/shops', authenticateToken, requireMaster, async (req, res) => {
    try {
      const [{ data: shopsRows, error }, { data: usersRows }, plansMap, payments] = await Promise.all([
        supabase.from('barbershops').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('id, barbershop_id, name, email, role, created_at').order('created_at', { ascending: true }),
        getShopPlansMap(),
        cloudNicheDb.getAllSaasPayments()
      ]);

      if (error) throw error;

      const usersByShop = new Map<string, any[]>();
      for (const u of usersRows || []) {
        const list = usersByShop.get(u.barbershop_id) || [];
        list.push(u);
        usersByShop.set(u.barbershop_id, list);
      }

      const paidByShop = new Map<string, { totalPaid: number; lastPaymentAt: string | null }>();
      for (const p of payments || []) {
        if (p.status !== 'approved') continue;
        const prev = paidByShop.get(p.barbershop_id) || { totalPaid: 0, lastPaymentAt: null };
        prev.totalPaid += Number(p.amount) || 0;
        const pDate = p.paid_at || p.created_at || null;
        if (pDate && (!prev.lastPaymentAt || pDate > prev.lastPaymentAt)) {
          prev.lastPaymentAt = pDate;
        }
        paidByShop.set(p.barbershop_id, prev);
      }

      const enriched = (shopsRows || []).map((shop: any) => {
        const shopUsers = usersByShop.get(shop.id) || [];
        const adminUser =
          shopUsers.find((u) => u.role === 'admin') ||
          shopUsers.find((u) => u.role === 'master') ||
          shopUsers.find((u) => u.role !== 'barber') ||
          shopUsers[0] ||
          null;
        const planId = resolveShopPlanId(shop, plansMap);
        const planMeta = getPlanMeta(planId);
        const payStats = paidByShop.get(shop.id) || { totalPaid: 0, lastPaymentAt: null };

        return {
          ...shop,
          plan_id: planId,
          plan_name: planMeta.name,
          plan_monthly_price: planMeta.monthlyPrice,
          admin_name: adminUser?.name || null,
          admin_email: adminUser?.email || null,
          contact_whatsapp: shop.whatsapp || shop.phone || '',
          total_paid: Number(payStats.totalPaid.toFixed(2)),
          last_payment_at: payStats.lastPaymentAt
        };
      });

      res.json(enriched);
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao buscar lojas'));
    }
  });

  // Update shop plan, permission & optional manual payment recording (Master only)
  api.patch('/admin/master/shops/:id/plan', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        plan_id,
        planId,
        is_blocked,
        expires_at,
        extend_days,
        record_payment,
        payment_amount,
        billing_cycle
      } = req.body;

      const rawPlan = plan_id || planId;
      if (!rawPlan) {
        return res.status(400).json({ error: 'Informe o nível do plano (plan_id).' });
      }

      const { data: existingShop, error: fetchErr } = await supabase
        .from('barbershops')
        .select('id, name, expires_at, is_blocked')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!existingShop) {
        return res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      }

      const targetPlanId = await setShopPlan(id, String(rawPlan));
      const planMeta = getPlanMeta(targetPlanId);

      const shopUpdates: Record<string, any> = {};
      let finalBlocked = Boolean(existingShop.is_blocked);
      let finalExpiresAt = existingShop.expires_at || null;

      if (typeof is_blocked === 'boolean') {
        shopUpdates.is_blocked = is_blocked;
        finalBlocked = is_blocked;
      }

      if (expires_at !== undefined) {
        shopUpdates.expires_at = expires_at;
        finalExpiresAt = expires_at;
      } else if (extend_days !== undefined && Number(extend_days) > 0) {
        const now = Date.now();
        const curr = existingShop.expires_at ? new Date(existingShop.expires_at).getTime() : 0;
        const base = curr > now ? curr : now;
        finalExpiresAt = new Date(base + Number(extend_days) * 24 * 60 * 60 * 1000).toISOString();
        shopUpdates.expires_at = finalExpiresAt;
      }

      if (Object.keys(shopUpdates).length > 0) {
        const { error: updErr } = await supabase
          .from('barbershops')
          .update(shopUpdates)
          .eq('id', id);
        if (updErr) throw updErr;
      }

      let recordedPayment: any = null;
      if (record_payment === true && targetPlanId !== 'trial') {
        const cycle = billing_cycle === 'annual' ? 'annual' : 'monthly';
        const defaultAmt = cycle === 'annual' ? planMeta.annualPrice : planMeta.monthlyPrice;
        const amount = payment_amount !== undefined && Number(payment_amount) > 0 ? Number(payment_amount) : defaultAmt;
        const daysAdded = Number(extend_days) > 0 ? Number(extend_days) : (cycle === 'annual' ? 365 : 30);
        const nowIso = new Date().toISOString();
        const paymentId = `pay_manual_${crypto.randomUUID()}`;

        recordedPayment = {
          id: paymentId,
          barbershop_id: id,
          plan_id: targetPlanId,
          plan_name: planMeta.name,
          amount,
          billing_cycle: cycle,
          payment_method: 'manual_master',
          external_reference: `master:${id}:${Date.now()}`,
          status: 'approved',
          days_added: daysAdded,
          paid_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso
        };
        await cloudNicheDb.createSaasPayment(recordedPayment);
        await createCommissionForSaasPayment(recordedPayment);
      }

      res.json({
        success: true,
        shop_id: id,
        plan_id: targetPlanId,
        plan_name: planMeta.name,
        is_blocked: finalBlocked,
        expires_at: finalExpiresAt,
        recordedPayment
      });
    } catch (e: any) {
      console.error('[MASTER_UPDATE_PLAN_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao atualizar plano do estabelecimento'));
    }
  });

  // Update shop admin contact phone / WhatsApp (Master only)
  api.patch('/admin/master/shops/:id/contact', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { id } = req.params;
      const rawContact = req.body.whatsapp ?? req.body.phone ?? '';
      const cleanContact = String(rawContact).trim() || null;

      let { error } = await supabase
        .from('barbershops')
        .update({ whatsapp: cleanContact, phone: cleanContact })
        .eq('id', id);

      if (error && (error.code === 'PGRST204' || error.message?.includes('whatsapp') || error.message?.includes('phone'))) {
        const retry = await supabase
          .from('barbershops')
          .update(error.message?.includes('whatsapp') ? { phone: cleanContact } : { whatsapp: cleanContact })
          .eq('id', id);
        error = retry.error;
      }

      if (error) throw error;
      res.json({ success: true, whatsapp: cleanContact || '' });
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao atualizar contato da loja'));
    }
  });

  // Toggle block status (grant / revoke usage permission)
  api.post('/admin/master/shops/:id/toggle-block', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { id } = req.params;
      const { is_blocked, expires_at, extend_days_if_expired } = req.body;

      const updates: Record<string, any> = { is_blocked: Boolean(is_blocked) };
      let finalExpiresAt: string | null | undefined = undefined;

      if (expires_at !== undefined) {
        updates.expires_at = expires_at;
        finalExpiresAt = expires_at;
      } else if (is_blocked === false && extend_days_if_expired && Number(extend_days_if_expired) > 0) {
        const { data: currentShop } = await supabase
          .from('barbershops')
          .select('expires_at')
          .eq('id', id)
          .maybeSingle();
        const currExp = currentShop?.expires_at ? new Date(currentShop.expires_at).getTime() : 0;
        if (!currExp || currExp < Date.now()) {
          finalExpiresAt = new Date(Date.now() + Number(extend_days_if_expired) * 24 * 60 * 60 * 1000).toISOString();
          updates.expires_at = finalExpiresAt;
        }
      }

      const { error } = await supabase
        .from('barbershops')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      res.json({ success: true, is_blocked: Boolean(is_blocked), expires_at: finalExpiresAt });
    } catch (e: any) {
      res.status(500).json({ error: 'Erro ao alterar permissão de uso do estabelecimento' });
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

  // Master Analytics Dashboard (Revenue + Niche + Date Range filtering)
  api.get('/admin/master/analytics', authenticateToken, requireMaster, async (req, res) => {
    try {
      const startParam = typeof req.query.start === 'string' && req.query.start.trim() ? req.query.start.trim().slice(0, 10) : '';
      const endParam = typeof req.query.end === 'string' && req.query.end.trim() ? req.query.end.trim().slice(0, 10) : '';
      const segmentFilter = typeof req.query.segment === 'string' && req.query.segment.trim() ? req.query.segment.trim() : 'all';

      const [
        { data: allShops, error: shopsErr },
        { data: allUsers },
        plansMap,
        allPayments
      ] = await Promise.all([
        supabase.from('barbershops').select('*'),
        supabase.from('users').select('id, barbershop_id, role'),
        getShopPlansMap(),
        cloudNicheDb.getAllSaasPayments()
      ]);

      if (shopsErr) throw shopsErr;

      const shopsList = allShops || [];
      const matchingShops = segmentFilter !== 'all'
        ? shopsList.filter((s: any) => (s.segment || s.business_type || 'barbershop') === segmentFilter)
        : shopsList;
      const matchingShopIds = new Set(matchingShops.map((s: any) => s.id));
      const shopLookup = new Map(shopsList.map((s: any) => [s.id, s]));

      const nowMs = Date.now();
      let activeShops = 0;
      let blockedShops = 0;
      let expiredShops = 0;
      let trialShops = 0;
      let paidShops = 0;
      let mrrEstimate = 0;

      const planCounts: Record<PlanId, { planId: PlanId; name: string; count: number; activeCount: number; mrr: number }> = {
        trial: { planId: 'trial', name: PLAN_META.trial.name, count: 0, activeCount: 0, mrr: 0 },
        essencial: { planId: 'essencial', name: PLAN_META.essencial.name, count: 0, activeCount: 0, mrr: 0 },
        profissional: { planId: 'profissional', name: PLAN_META.profissional.name, count: 0, activeCount: 0, mrr: 0 },
        premium: { planId: 'premium', name: PLAN_META.premium.name, count: 0, activeCount: 0, mrr: 0 }
      };

      const segmentStats = new Map<string, {
        segment: string;
        segmentName: string;
        shopsCount: number;
        activeShopsCount: number;
        paidShopsCount: number;
        saasRevenue: number;
        approvedPaymentsCount: number;
        mrrEstimate: number;
        ecosystemRevenue: number;
        ecosystemAppointmentsCount: number;
      }>();

      const ensureSegmentStat = (segId: string) => {
        const key = segId || 'barbershop';
        if (!segmentStats.has(key)) {
          segmentStats.set(key, {
            segment: key,
            segmentName: getSegment(key).name,
            shopsCount: 0,
            activeShopsCount: 0,
            paidShopsCount: 0,
            saasRevenue: 0,
            approvedPaymentsCount: 0,
            mrrEstimate: 0,
            ecosystemRevenue: 0,
            ecosystemAppointmentsCount: 0
          });
        }
        return segmentStats.get(key)!;
      };

      for (const s of matchingShops) {
        const segId = s.segment || s.business_type || 'barbershop';
        const segStat = ensureSegmentStat(segId);
        segStat.shopsCount += 1;

        const isBlocked = Boolean(s.is_blocked);
        const isExpired = Boolean(s.expires_at && new Date(s.expires_at).getTime() < nowMs);
        const isActive = !isBlocked && !isExpired;
        const planId = resolveShopPlanId(s, plansMap);
        const planMeta = getPlanMeta(planId);

        if (isBlocked) blockedShops += 1;
        else if (isExpired) expiredShops += 1;
        else activeShops += 1;

        if (planId === 'trial') trialShops += 1;
        else paidShops += 1;

        planCounts[planId].count += 1;
        if (isActive) {
          segStat.activeShopsCount += 1;
          planCounts[planId].activeCount += 1;
          if (planId !== 'trial') {
            segStat.paidShopsCount += 1;
            mrrEstimate += planMeta.monthlyPrice;
            planCounts[planId].mrr += planMeta.monthlyPrice;
            segStat.mrrEstimate += planMeta.monthlyPrice;
          }
        }
      }

      const inDateRange = (isoOrDate?: string | null) => {
        if (!isoOrDate) return !startParam && !endParam;
        const day = String(isoOrDate).slice(0, 10);
        if (startParam && day < startParam) return false;
        if (endParam && day > endParam) return false;
        return true;
      };

      let saasRevenue = 0;
      let manualRevenue = 0;
      let gatewayRevenue = 0;
      let approvedPaymentsCount = 0;
      let pendingPaymentsCount = 0;
      let pendingPaymentsAmount = 0;
      const filteredApprovedPayments: any[] = [];

      for (const p of allPayments || []) {
        if (!matchingShopIds.has(p.barbershop_id)) continue;
        const shop = shopLookup.get(p.barbershop_id);
        const segId = shop?.segment || shop?.business_type || 'barbershop';

        if (p.status === 'pending') {
          if (inDateRange(p.created_at)) {
            pendingPaymentsCount += 1;
            pendingPaymentsAmount += Number(p.amount) || 0;
          }
          continue;
        }

        if (p.status === 'approved') {
          const effectiveDate = p.paid_at || p.created_at;
          if (!inDateRange(effectiveDate)) continue;
          const amt = Number(p.amount) || 0;
          saasRevenue += amt;
          approvedPaymentsCount += 1;
          if (p.payment_method === 'manual_master') {
            manualRevenue += amt;
          } else {
            gatewayRevenue += amt;
          }
          const segStat = ensureSegmentStat(segId);
          segStat.saasRevenue += amt;
          segStat.approvedPaymentsCount += 1;

          filteredApprovedPayments.push({
            id: p.id,
            barbershop_id: p.barbershop_id,
            shopName: shop?.name || p.barbershop_id,
            segment: segId,
            segmentName: getSegment(segId).name,
            plan_id: p.plan_id,
            plan_name: p.plan_name,
            amount: amt,
            billing_cycle: p.billing_cycle,
            payment_method: p.payment_method,
            paid_at: effectiveDate
          });
        }
      }

      // Fetch appointments + services to calculate Store Ecosystem Revenue
      let ecosystemRevenue = 0;
      let ecosystemAppointmentsCount = 0;
      try {
        let apptQuery = supabase.from('appointments').select('id, barbershop_id, service_id, status, date');
        if (startParam) apptQuery = apptQuery.gte('date', startParam);
        if (endParam) apptQuery = apptQuery.lte('date', endParam);
        const [{ data: appts }, { data: services }] = await Promise.all([
          apptQuery,
          supabase.from('services').select('id, price')
        ]);

        const priceMap = new Map((services || []).map((sv: any) => [sv.id, Number(sv.price) || 0]));
        for (const a of appts || []) {
          if (!matchingShopIds.has(a.barbershop_id)) continue;
          ecosystemAppointmentsCount += 1;
          const shop = shopLookup.get(a.barbershop_id);
          const segStat = ensureSegmentStat(shop?.segment || shop?.business_type || 'barbershop');
          segStat.ecosystemAppointmentsCount += 1;
          if (a.status === 'completed' || a.status === 'confirmed') {
            const val = priceMap.get(a.service_id) || 0;
            ecosystemRevenue += val;
            segStat.ecosystemRevenue += val;
          }
        }
      } catch (ecoErr: any) {
        console.warn('[MASTER_ANALYTICS_ECO_WARN]', ecoErr?.message);
      }

      const filteredUsersCount = (allUsers || []).filter((u: any) => matchingShopIds.has(u.barbershop_id)).length;

      const bySegment = Array.from(segmentStats.values())
        .map((row) => ({
          ...row,
          saasRevenue: Number(row.saasRevenue.toFixed(2)),
          mrrEstimate: Number(row.mrrEstimate.toFixed(2)),
          ecosystemRevenue: Number(row.ecosystemRevenue.toFixed(2))
        }))
        .sort((a, b) => (b.saasRevenue - a.saasRevenue) || (b.mrrEstimate - a.mrrEstimate) || (b.shopsCount - a.shopsCount));

      res.json({
        filters: {
          start: startParam || null,
          end: endParam || null,
          segment: segmentFilter
        },
        summary: {
          totalShops: matchingShops.length,
          activeShops,
          blockedShops,
          expiredShops,
          trialShops,
          paidShops,
          totalUsers: filteredUsersCount,
          saasRevenue: Number(saasRevenue.toFixed(2)),
          manualRevenue: Number(manualRevenue.toFixed(2)),
          gatewayRevenue: Number(gatewayRevenue.toFixed(2)),
          approvedPaymentsCount,
          pendingPaymentsCount,
          pendingPaymentsAmount: Number(pendingPaymentsAmount.toFixed(2)),
          mrrEstimate: Number(mrrEstimate.toFixed(2)),
          ecosystemRevenue: Number(ecosystemRevenue.toFixed(2)),
          ecosystemAppointmentsCount
        },
        planBreakdown: Object.values(planCounts).map((item) => ({
          ...item,
          mrr: Number(item.mrr.toFixed(2))
        })),
        bySegment,
        recentApprovedPayments: filteredApprovedPayments.slice(0, 12)
      });
    } catch (e: any) {
      console.error('[MASTER_ANALYTICS_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao calcular métricas administrativas'));
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao alterar segmento do estabelecimento'));
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
      
      if (shopError || !shop) {
        return res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      }

      // Create a master-elevated token for this specific shop
      const token = jwt.sign({ 
        id: (req as any).user.id, 
        barbershopId: shopId, 
        role: 'master',
        email: (req as any).user.email,
        isImpersonating: true
      }, JWT_SECRET, { expiresIn: '2h' });

      setSessionCookie(res, req, token, 2 * 60 * 60 * 1000);
      recordSecurityEvent(req, {
        eventType: 'MASTER_IMPERSONATE',
        severity: 'low',
        details: `Master assumiu sessão da loja ${shop.slug} (${shopId})`
      });
      
      res.json({ success: true, token, shop });
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao entrar no dashboard'));
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao gerar link de redefinição de senha'));
    }
  });

  // Delete an entire shop and all dependent data (Master only)
  const handleDeleteShopMaster = async (req: any, res: any) => {
    const { id } = req.params;
    try {
      if (!id || id === 'shop-1') {
        return res.status(400).json({ error: 'O estabelecimento raiz do sistema não pode ser excluído.' });
      }
      if (req.user?.barbershopId === id) {
        return res.status(400).json({ error: 'Você não pode excluir o estabelecimento ao qual está conectado.' });
      }

      const { data: targetShop, error: shopCheckErr } = await supabase
        .from('barbershops')
        .select('id, name, slug')
        .eq('id', id)
        .maybeSingle();

      if (shopCheckErr) throw shopCheckErr;
      if (!targetShop) {
        return res.status(404).json({ error: 'Estabelecimento não encontrado.' });
      }

      const { data: shopUsers, error: usersFetchErr } = await supabase
        .from('users')
        .select('id, role')
        .eq('barbershop_id', id);

      if (usersFetchErr) throw usersFetchErr;
      if ((shopUsers || []).some((u: any) => u.role === 'master')) {
        return res.status(400).json({ error: 'Não é permitido excluir um estabelecimento que possui usuário Master.' });
      }

      const userIds = (shopUsers || []).map((u: any) => u.id);
      console.log(`[MASTER_DELETE_SHOP] Deleting shop "${targetShop.name}" (${id}) and all child records...`);

      // 1. Delete niche/cloud/local records (notes, anamnesis, photos, touchups, pets, vehicles, saas_payments, reset tokens)
      await cloudNicheDb.deleteShopData(id, userIds);

      // 2. Delete core tables in strict foreign-key dependency order
      const deleteByShopId = async (table: string, ignoreMissing = false) => {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('barbershop_id', id);
        if (error) {
          const msg = String(error.message || '').toLowerCase();
          if (ignoreMissing && (error.code === 'PGRST205' || error.code === '42P01' || msg.includes('does not exist'))) {
            return;
          }
          throw new Error(`Falha ao limpar ${table}: ${error.message}`);
        }
      };

      await deleteByShopId('notifications', true);
      await deleteByShopId('appointments');
      await deleteByShopId('finances');
      await deleteByShopId('client_packages', true);
      await deleteByShopId('clients');
      await deleteByShopId('services');
      await deleteByShopId('barbers');
      await deleteByShopId('shop_settings');
      await deleteByShopId('users');

      // 3. Finally delete the barbershop row itself
      const { data: deletedShop, error: shopDelErr } = await supabase
        .from('barbershops')
        .delete()
        .eq('id', id)
        .select('id');

      if (shopDelErr) throw shopDelErr;
      if (!deletedShop || deletedShop.length === 0) {
        return res.status(404).json({ error: 'Estabelecimento não pôde ser removido ou já foi excluído.' });
      }

      console.log(`[MASTER_DELETE_SHOP_SUCCESS] Deleted "${targetShop.name}" (${id}).`);
      res.json({ success: true, deletedId: id, deletedName: targetShop.name });
    } catch (e: any) {
      console.error('[MASTER_DELETE_SHOP_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao excluir estabelecimento'));
    }
  };

  api.delete('/admin/master/shops/:id', authenticateToken, requireMaster, handleDeleteShopMaster);
  api.post('/admin/master/shops/:id/delete', authenticateToken, requireMaster, handleDeleteShopMaster);

  // Security Audit Logs (Master only)
  api.get('/admin/master/security-logs', authenticateToken, requireMaster, async (req, res) => {
    try {
      const rawLimit = Number(req.query.limit || 100);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 100;
      const logs = await cloudNicheDb.getRecentSecurityLogs(limit);
      res.json({ logs });
    } catch (e: any) {
      console.error('[MASTER_SECURITY_LOGS_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao consultar logs de segurança'));
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao salvar WhatsApp do suporte'));
    }
  });

  // Cloud Persistence & Security Diagnostics (Master only)
  api.get('/admin/master/cloud-status', authenticateToken, requireMaster, async (req, res) => {
    try {
      const cloudStatus = await cloudNicheDb.checkCloudStatus();
      res.json({
        ...cloudStatus,
        security: {
          hasJwtSecret: hasJwtSecretEnv,
          hasServiceRoleKey,
          nodeEnv: process.env.NODE_ENV || 'development'
        }
      });
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao verificar status da nuvem'));
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao ler script SQL'));
    }
  });

  api.post('/admin/master/migrate-niche-to-cloud', authenticateToken, requireMaster, async (req, res) => {
    try {
      const summary = await cloudNicheDb.migrateAllLocalToSupabase();
      res.json({ success: true, ...summary });
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao migrar registros locais para o Supabase'));
    }
  });

  // --- SAAS PLANS, BILLING & MERCADO PAGO ---
  const SAAS_PLANS = [
    {
      id: 'premium',
      name: 'Plano Completo',
      subtitle: 'Retenção, pacotes e lucro sem limites',
      monthlyPrice: 139.90,
      annualPrice: 1197.00,
      promoMonthlyPrice: 119.90,
      promoAnnualPrice: 997.00,
      highlighted: true,
      badge: 'Mais Lucrativo · Recomendado',
      features: [
        'Profissionais e serviços ilimitados',
        'Campanhas de reativação p/ trazer clientes sumidos',
        'Pacotes de sessões e combos recorrentes',
        'Vitrine VIP (logo, banner e paleta personalizada)',
        'Implantação assistida + Suporte VIP no WhatsApp'
      ]
    },
    {
      id: 'profissional',
      name: 'Plano Pro',
      subtitle: 'Perfeito para equipes de 1 a 3 funcionários',
      monthlyPrice: 119.90,
      annualPrice: 1039.00,
      promoMonthlyPrice: 99.90,
      promoAnnualPrice: 859.00,
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
      id: 'essencial',
      name: 'Agenda Individual',
      subtitle: 'Opção de entrada para quem trabalha sozinho',
      monthlyPrice: 79.90,
      annualPrice: 659.00,
      promoMonthlyPrice: 59.90,
      promoAnnualPrice: 479.00,
      highlighted: false,
      badge: '1 Profissional',
      features: [
        '1 profissional ativo na agenda',
        'Link exclusivo de agendamento (/b/sua-marca)',
        'Cadastro de clientes e histórico completo',
        'Agenda inteligente sem conflitos de horário'
      ]
    }
  ];

  const buildPublicPlansList = (promoApplied: boolean) =>
    SAAS_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      subtitle: plan.subtitle,
      regularMonthlyPrice: plan.monthlyPrice,
      regularAnnualPrice: plan.annualPrice,
      monthlyPrice: promoApplied ? plan.promoMonthlyPrice : plan.monthlyPrice,
      annualPrice: promoApplied ? plan.promoAnnualPrice : plan.annualPrice,
      promoApplied,
      highlighted: plan.highlighted,
      badge: plan.badge,
      features: plan.features
    }));

  const resolveShopPromoStatus = async (shopId: string) => {
    try {
      const referral = await cloudNicheDb.getReferralByShopId(shopId);
      if (!referral) {
        return { promoApplied: false, partnerCode: null as string | null, partnerFirstName: null as string | null };
      }
      const affiliate = await cloudNicheDb.getAffiliateById(referral.affiliate_id);
      const firstName = affiliate?.name ? String(affiliate.name).trim().split(/\s+/)[0] : null;
      return {
        promoApplied: true,
        partnerCode: referral.affiliate_code || affiliate?.code || null,
        partnerFirstName: firstName
      };
    } catch {
      return { promoApplied: false, partnerCode: null as string | null, partnerFirstName: null as string | null };
    }
  };

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

    if (payment.plan_id) {
      await setShopPlan(payment.barbershop_id, normalizePlanId(payment.plan_id));
    }

    const approvedPayment = {
      ...payment,
      status: 'approved',
      paid_at: paidAt,
      mp_payment_id: mpPaymentId || payment.mp_payment_id
    };
    await createCommissionForSaasPayment(approvedPayment);

    return {
      ok: true,
      alreadyApproved: false,
      newExpiresAt,
      payment: approvedPayment
    };
  };

  // Public SaaS Plans list (Landing Page & Affiliate Sales Page)
  api.get('/public/plans', async (req, res) => {
    try {
      const refRaw = typeof req.query.ref === 'string' ? req.query.ref : '';
      let promoApplied = false;
      let partner: { code: string; firstName: string; niche: string | null } | null = null;
      if (refRaw) {
        const parsed = AffiliateCodeSchema.safeParse(refRaw);
        if (parsed.success) {
          const affiliate = await cloudNicheDb.getAffiliateByCode(parsed.data);
          if (affiliate && affiliate.active) {
            promoApplied = true;
            partner = {
              code: affiliate.code,
              firstName: String(affiliate.name || '').trim().split(/\s+/)[0] || 'Parceiro',
              niche: affiliate.niche || null
            };
          }
        }
      }
      res.json({ plans: buildPublicPlansList(promoApplied), trialDays: 7, promoApplied, partner });
    } catch {
      res.json({ plans: buildPublicPlansList(false), trialDays: 7, promoApplied: false, partner: null });
    }
  });

  // Admin Billing Status & Payment History (Owner / Master only)
  api.get('/admin/billing/status', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const [{ data: shop, error }, plansMap, promoStatus] = await Promise.all([
        supabase
          .from('barbershops')
          .select('*')
          .eq('id', shopId)
          .maybeSingle(),
        getShopPlansMap(),
        resolveShopPromoStatus(shopId)
      ]);
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
      const currentPlanId = resolveShopPlanId(shop || { id: shopId }, plansMap);
      const currentPlanMeta = getPlanMeta(currentPlanId);

      res.json({
        shop: shop
          ? {
              id: shop.id,
              name: shop.name,
              slug: shop.slug,
              segment: shop.segment,
              is_blocked: shop.is_blocked,
              expires_at: shop.expires_at,
              created_at: shop.created_at,
              plan_id: currentPlanId,
              plan_name: currentPlanMeta.name
            }
          : null,
        currentPlanId,
        currentPlanName: currentPlanMeta.name,
        isExpired,
        promoApplied: promoStatus.promoApplied,
        partnerCode: promoStatus.partnerCode,
        partnerFirstName: promoStatus.partnerFirstName,
        plans: buildPublicPlansList(promoStatus.promoApplied),
        payments,
        mpConfigured: Boolean(mpToken),
        pixKeyConfigured: Boolean(pixProfile.pixKey),
        pixKey: pixProfile.pixKey || null,
        mpLinks,
        supportWhatsapp
      });
    } catch (e: any) {
      console.error('[BILLING_STATUS_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao carregar status da assinatura'));
    }
  });

  // Apply Affiliate Promotional Coupon before checkout/PIX payment (Owner / Master only)
  api.post('/admin/billing/apply-coupon', authenticateToken, requireOwnerOrMaster, billingLimiter, async (req: any, res) => {
    try {
      const parsed = ApplyAffiliateCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Código promocional inválido.' });
      }

      const shopId = req.user.barbershopId;
      const affiliate = await cloudNicheDb.getAffiliateByCode(parsed.data.code);
      if (!affiliate || !affiliate.active) {
        return res.status(404).json({ error: 'Código promocional não encontrado ou inativo.' });
      }

      const partnerFirstName = String(affiliate.name || '').trim().split(/\s+/)[0] || 'Parceiro';
      const existingReferral = await cloudNicheDb.getReferralByShopId(shopId);
      if (existingReferral) {
        const sameAffiliate =
          existingReferral.affiliate_id === affiliate.id ||
          String(existingReferral.affiliate_code || '').toLowerCase() === String(affiliate.code || '').toLowerCase();
        if (sameAffiliate) {
          return res.json({
            success: true,
            alreadyApplied: true,
            promoApplied: true,
            partnerCode: affiliate.code,
            partnerFirstName,
            plans: buildPublicPlansList(true)
          });
        }
        return res.status(409).json({
          error: `Sua conta já possui o código promocional ${String(existingReferral.affiliate_code || '').toUpperCase()} vinculado.`
        });
      }

      const { data: shopRow } = await supabase
        .from('barbershops')
        .select('email, phone')
        .eq('id', shopId)
        .maybeSingle();

      const ownerEmail = String(req.user.email || '').trim().toLowerCase();
      const shopEmail = String(shopRow?.email || '').trim().toLowerCase();
      const affEmail = String(affiliate.email || '').trim().toLowerCase();
      const shopPhoneDigits = String(shopRow?.phone || '').replace(/\D/g, '');
      const affPhoneDigits = String(affiliate.phone_whatsapp || '').replace(/\D/g, '');

      const sameEmail = Boolean(affEmail && (ownerEmail === affEmail || shopEmail === affEmail));
      const samePhone =
        affPhoneDigits.length >= 10 &&
        shopPhoneDigits.length >= 10 &&
        affPhoneDigits.slice(-10) === shopPhoneDigits.slice(-10);

      if (sameEmail || samePhone) {
        recordSecurityEvent(req, {
          eventType: 'AFFILIATE_SELF_REFERRAL_BLOCKED',
          severity: 'medium',
          details: `Autoindicação bloqueada ao aplicar cupom no checkout (${ownerEmail || shopEmail} -> ${affiliate.code}, shop=${shopId})`,
          userEmail: ownerEmail || shopEmail || undefined
        });
        return res.status(400).json({ error: 'Você não pode aplicar seu próprio código de parceiro na sua loja.' });
      }

      await cloudNicheDb.createReferralAttribution({
        shop_id: shopId,
        affiliate_id: affiliate.id,
        affiliate_code: affiliate.code,
        referred_email: ownerEmail || shopEmail || ''
      });

      return res.json({
        success: true,
        promoApplied: true,
        partnerCode: affiliate.code,
        partnerFirstName,
        plans: buildPublicPlansList(true)
      });
    } catch (e: any) {
      console.error('[BILLING_APPLY_COUPON_ERR]', e);
      return res.status(500).json(safeErrorResponse(e, 'Erro ao aplicar código promocional'));
    }
  });

  // Create Mercado Pago Checkout Pro Preference (Owner / Master only)
  api.post('/admin/billing/checkout', authenticateToken, requireOwnerOrMaster, billingLimiter, async (req: any, res) => {
    try {
      const parsed = BillingCheckoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Plano selecionado inválido.' });
      }
      const { planId, billingCycle } = parsed.data;
      const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
      const plan = SAAS_PLANS.find((p) => p.id === planId);
      if (!plan) {
        return res.status(400).json({ error: 'Plano selecionado inválido.' });
      }

      const [mpToken, promoStatus] = await Promise.all([
        getMpAccessToken(),
        resolveShopPromoStatus(req.user.barbershopId)
      ]);
      if (!mpToken) {
        return res.status(400).json({
          error: 'Mercado Pago ainda não configurado no Painel Master. Utilize a opção de pagamento via PIX.'
        });
      }

      const amount =
        cycle === 'annual'
          ? promoStatus.promoApplied
            ? plan.promoAnnualPrice
            : plan.annualPrice
          : promoStatus.promoApplied
            ? plan.promoMonthlyPrice
            : plan.monthlyPrice;
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao iniciar checkout no Mercado Pago'));
    }
  });

  // Create Instant PIX via Mercado Pago API OR Official Banco Central BR Code (using Chave PIX)
  api.post('/admin/billing/pix', authenticateToken, requireOwnerOrMaster, billingLimiter, async (req: any, res) => {
    try {
      const parsed = BillingCheckoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Plano selecionado inválido.' });
      }
      const { planId, billingCycle } = parsed.data;
      const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
      const plan = SAAS_PLANS.find((p) => p.id === planId);
      if (!plan) {
        return res.status(400).json({ error: 'Plano selecionado inválido.' });
      }

      const [mpToken, pixProfile, savedWhatsapp, promoStatus] = await Promise.all([
        getMpAccessToken(),
        getPlatformPixProfile(),
        cloudNicheDb.getPlatformSetting('support_whatsapp'),
        resolveShopPromoStatus(req.user.barbershopId)
      ]);

      const amount =
        cycle === 'annual'
          ? promoStatus.promoApplied
            ? plan.promoAnnualPrice
            : plan.annualPrice
          : promoStatus.promoApplied
            ? plan.promoMonthlyPrice
            : plan.monthlyPrice;
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao gerar pagamento PIX'));
    }
  });

  // Register intent when tenant uses a Mercado Pago App Payment Link (created from mobile app)
  api.post('/admin/billing/link-intent', authenticateToken, requireOwnerOrMaster, billingLimiter, async (req: any, res) => {
    try {
      const parsed = BillingLinkIntentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Plano selecionado inválido.' });
      }
      const { planId } = parsed.data;
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
      const promoStatus = await resolveShopPromoStatus(req.user.barbershopId);
      const cycle = 'monthly';
      const amount = promoStatus.promoApplied ? plan.promoMonthlyPrice : plan.monthlyPrice;
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao registrar link de pagamento'));
    }
  });

  // Verify / Poll a Payment Status
  api.post('/admin/billing/verify/:paymentId', authenticateToken, requireOwnerOrMaster, billingLimiter, async (req: any, res) => {
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
        recordSecurityEvent(req, {
          eventType: 'PAYMENT_VERIFICATION_MISMATCH',
          severity: 'high',
          details: `Pagamento ${payment.id}: esperado=${payment.amount}, MP=${mpPayment.transaction_amount}, moeda=${mpPayment.currency_id}`
        });
      }

      return res.json({
        status: mpPayment?.status || payment.status,
        message: 'Pagamento ainda pendente de confirmação no Mercado Pago.'
      });
    } catch (e: any) {
      console.error('[BILLING_VERIFY_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao verificar pagamento'));
    }
  });

  // Mercado Pago Webhook (Public, verifies HMAC signature if configured + validates directly against MP API)
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

      const webhookSecret =
        process.env.MP_WEBHOOK_SECRET?.trim() ||
        (await cloudNicheDb.getPlatformSetting('mp_webhook_secret'))?.trim() ||
        '';
      if (webhookSecret) {
        const xSig = String(req.headers['x-signature'] || '');
        const xReqId = String(req.headers['x-request-id'] || '');
        const sigParts: Record<string, string> = {};
        xSig.split(',').forEach((kv) => {
          const [k, v] = kv.split('=').map((s) => s.trim());
          if (k && v) sigParts[k] = v;
        });
        const ts = sigParts.ts || '';
        const v1 = sigParts.v1 || '';
        if (!ts || !v1) {
          recordSecurityEvent(req, {
            eventType: 'WEBHOOK_SIGNATURE_MISSING',
            severity: 'high',
            details: `Webhook Mercado Pago sem assinatura para payment=${mpPaymentId}`
          });
          return res.status(401).json({ error: 'Assinatura do webhook ausente.' });
        }
        const manifest = `id:${mpPaymentId};request-id:${xReqId};ts:${ts};`;
        const expectedHex = nodeCrypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
        const providedBuf = Buffer.from(v1, 'utf8');
        const expectedBuf = Buffer.from(expectedHex, 'utf8');
        if (providedBuf.length !== expectedBuf.length || !nodeCrypto.timingSafeEqual(providedBuf, expectedBuf)) {
          recordSecurityEvent(req, {
            eventType: 'WEBHOOK_SIGNATURE_INVALID',
            severity: 'critical',
            details: `Assinatura HMAC inválida no webhook para payment=${mpPaymentId}`
          });
          return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
        }
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
            recordSecurityEvent(req, {
              eventType: 'PAYMENT_AMOUNT_MISMATCH',
              severity: 'critical',
              details: `Webhook payment ${localPayment.id}: esperado=${localPayment.amount}, recebido=${mpData.transaction_amount}, moeda=${mpData.currency_id}`
            });
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao carregar configuração de pagamentos'));
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao salvar configuração de pagamentos'));
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao listar pagamentos SaaS'));
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
      res.status(500).json(safeErrorResponse(e, 'Erro ao aprovar pagamento'));
    }
  });

  // --- AFFILIATE & PARTNER PROGRAM (MASTER ADMIN + PARTNER PORTAL) ---
  const formatSafeAffiliate = (aff: any) => ({
    id: aff.id,
    name: aff.name,
    email: aff.email,
    phoneWhatsapp: aff.phone_whatsapp || '',
    pixKey: aff.pix_key || '',
    code: aff.code,
    commissionRate: Number(aff.commission_rate) || 0.25,
    commissionPercent: Math.round((Number(aff.commission_rate) || 0.25) * 100),
    niche: aff.niche || '',
    notes: aff.notes || '',
    active: Boolean(aff.active),
    createdAt: aff.created_at,
    updatedAt: aff.updated_at
  });

  const computeShopSubscriptionStatus = (shop: any, plansMap: Record<string, any>) => {
    if (!shop) return { planId: 'trial', planName: 'Teste Grátis', status: 'expired' as const };
    const planId = resolveShopPlanId(shop, plansMap);
    const planMeta = getPlanMeta(planId);
    const isBlocked = Boolean(shop.is_blocked);
    const isExpired = Boolean(shop.expires_at && new Date(shop.expires_at) < new Date());
    const status = isBlocked
      ? ('blocked' as const)
      : isExpired
        ? ('expired' as const)
        : planId === 'trial'
          ? ('trial' as const)
          : ('active' as const);
    return { planId, planName: planMeta.name, status };
  };

  // Master Admin: List affiliates with aggregated KPIs + recent commission ledger
  api.get('/admin/master/affiliates', authenticateToken, requireMaster, async (_req, res) => {
    try {
      await cloudNicheDb.promoteMaturedCommissions();
      const [affiliates, referrals, commissions, shopsRes, plansMap, clicksMap] = await Promise.all([
        cloudNicheDb.listAffiliates(),
        cloudNicheDb.listAllReferrals(),
        cloudNicheDb.listAffiliateCommissions(undefined, 500),
        supabase.from('barbershops').select('id, name, slug, segment, plan_id, is_blocked, expires_at, created_at'),
        getShopPlansMap(),
        cloudNicheDb.getAffiliateClicksMap()
      ]);

      const shopMap = new Map<string, any>((shopsRes.data || []).map((s: any) => [s.id, s]));
      const affMap = new Map<string, any>(affiliates.map((a) => [a.id, a]));

      const enrichedAffiliates = affiliates.map((aff) => {
        const affRefs = referrals.filter((r) => r.affiliate_id === aff.id);
        const affComms = commissions.filter((c) => c.affiliate_id === aff.id);

        let activePaidCount = 0;
        let trialCount = 0;
        for (const r of affRefs) {
          const shop = shopMap.get(r.shop_id);
          const { status } = computeShopSubscriptionStatus(shop, plansMap);
          if (status === 'active') activePaidCount += 1;
          else if (status === 'trial') trialCount += 1;
        }

        const clickEntry = clicksMap[aff.id] || { totalClicks: 0, uniqueClicks: 0, lastClickedAt: null };
        const totalClicks = clickEntry.totalClicks;
        const uniqueClicks = clickEntry.uniqueClicks;
        const signupConversionRate =
          totalClicks > 0 ? Number(((affRefs.length / totalClicks) * 100).toFixed(1)) : 0;
        const paidConversionRate =
          totalClicks > 0 ? Number(((activePaidCount / totalClicks) * 100).toFixed(1)) : 0;
        const trialToPaidRate =
          affRefs.length > 0 ? Number(((activePaidCount / affRefs.length) * 100).toFixed(1)) : 0;

        const pendingAmount = affComms
          .filter((c) => c.status === 'pending')
          .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
        const availableAmount = affComms
          .filter((c) => c.status === 'available')
          .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
        const paidAmount = affComms
          .filter((c) => c.status === 'paid')
          .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
        const totalSalesVolume = affComms
          .filter((c) => c.status !== 'reversed')
          .reduce((sum, c) => sum + (Number(c.gross_amount) || 0), 0);

        return {
          ...formatSafeAffiliate(aff),
          stats: {
            totalClicks,
            uniqueClicks,
            lastClickedAt: clickEntry.lastClickedAt,
            referralsCount: affRefs.length,
            activePaidCount,
            trialCount,
            signupConversionRate,
            paidConversionRate,
            trialToPaidRate,
            pendingAmount: Number(pendingAmount.toFixed(2)),
            availableAmount: Number(availableAmount.toFixed(2)),
            paidAmount: Number(paidAmount.toFixed(2)),
            totalEarned: Number((pendingAmount + availableAmount + paidAmount).toFixed(2)),
            totalSalesVolume: Number(totalSalesVolume.toFixed(2))
          }
        };
      });

      const enrichedCommissions = commissions.map((c) => {
        const shop = shopMap.get(c.shop_id);
        const aff = affMap.get(c.affiliate_id);
        return {
          ...c,
          affiliateName: aff?.name || 'Afiliado removido',
          affiliateCode: aff?.code || '',
          shopName: shop?.name || c.shop_id,
          shopSlug: shop?.slug || ''
        };
      });

      const summary = enrichedAffiliates.reduce(
        (acc, a) => {
          if (a.active) acc.activeAffiliates += 1;
          acc.totalClicks += a.stats.totalClicks;
          acc.totalUniqueClicks += a.stats.uniqueClicks;
          acc.totalReferrals += a.stats.referralsCount;
          acc.totalTrials += a.stats.trialCount;
          acc.totalActivePaid += a.stats.activePaidCount;
          acc.pendingPayouts += a.stats.pendingAmount;
          acc.availablePayouts += a.stats.availableAmount;
          acc.totalPaid += a.stats.paidAmount;
          return acc;
        },
        {
          activeAffiliates: 0,
          totalClicks: 0,
          totalUniqueClicks: 0,
          totalReferrals: 0,
          totalTrials: 0,
          totalActivePaid: 0,
          pendingPayouts: 0,
          availablePayouts: 0,
          totalPaid: 0
        }
      );

      const overallSignupConversionRate =
        summary.totalClicks > 0
          ? Number(((summary.totalReferrals / summary.totalClicks) * 100).toFixed(1))
          : 0;
      const overallPaidConversionRate =
        summary.totalClicks > 0
          ? Number(((summary.totalActivePaid / summary.totalClicks) * 100).toFixed(1))
          : 0;

      res.json({
        summary: {
          ...summary,
          overallSignupConversionRate,
          overallPaidConversionRate,
          pendingPayouts: Number(summary.pendingPayouts.toFixed(2)),
          availablePayouts: Number(summary.availablePayouts.toFixed(2)),
          totalPaid: Number(summary.totalPaid.toFixed(2))
        },
        affiliates: enrichedAffiliates,
        commissions: enrichedCommissions
      });
    } catch (e: any) {
      console.error('[MASTER_AFFILIATES_LIST_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao carregar programa de afiliados'));
    }
  });

  // Master Admin: Create new affiliate / niche influencer
  api.post('/admin/master/affiliates', authenticateToken, requireMaster, async (req, res) => {
    try {
      const parsed = CreateAffiliateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos para afiliado.' });
      }

      const { name, email, password, phoneWhatsapp, pixKey, code, commissionPercent, niche, notes } = parsed.data;
      const pwdCheck = validatePasswordStrength(password);
      if (!pwdCheck.valid) {
        return res.status(400).json({ error: pwdCheck.error });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = code.trim().toLowerCase();

      if (RESERVED_SLUGS.has(cleanCode)) {
        return res.status(400).json({ error: 'Este código de indicação é reservado. Escolha outro.' });
      }

      const [existingEmail, existingCode] = await Promise.all([
        cloudNicheDb.getAffiliateByEmail(cleanEmail),
        cloudNicheDb.getAffiliateByCode(cleanCode)
      ]);
      if (existingEmail) {
        return res.status(400).json({ error: 'Já existe um afiliado cadastrado com este e-mail.' });
      }
      if (existingCode) {
        return res.status(400).json({ error: 'Este código de indicação já está em uso por outro parceiro.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const created = await cloudNicheDb.createAffiliate({
        id: `aff_${nodeCrypto.randomUUID()}`,
        name: sanitizePlainText(name, 120),
        email: cleanEmail,
        password_hash: passwordHash,
        phone_whatsapp: phoneWhatsapp ? sanitizePlainText(phoneWhatsapp, 30) : null,
        pix_key: pixKey ? sanitizePlainText(pixKey, 150) : null,
        code: cleanCode,
        commission_rate: Number((commissionPercent / 100).toFixed(4)),
        niche: niche ? sanitizePlainText(niche, 80) : null,
        notes: notes ? sanitizePlainText(notes, 500, true) : null,
        active: 1
      });

      res.status(201).json({ success: true, affiliate: formatSafeAffiliate(created) });
    } catch (e: any) {
      console.error('[MASTER_AFFILIATE_CREATE_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao cadastrar afiliado'));
    }
  });

  // Master Admin: Update affiliate profile, commission %, or active toggle
  api.patch('/admin/master/affiliates/:id', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await cloudNicheDb.getAffiliateById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Afiliado não encontrado.' });
      }

      const parsed = UpdateAffiliateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' });
      }

      const updates: Record<string, any> = {};
      const data = parsed.data;

      if (data.name !== undefined) updates.name = sanitizePlainText(data.name, 120);
      if (data.email !== undefined) {
        const cleanEmail = data.email.trim().toLowerCase();
        if (cleanEmail !== existing.email.toLowerCase()) {
          const dup = await cloudNicheDb.getAffiliateByEmail(cleanEmail);
          if (dup && dup.id !== id) {
            return res.status(400).json({ error: 'E-mail já utilizado por outro afiliado.' });
          }
        }
        updates.email = cleanEmail;
      }
      if (data.code !== undefined) {
        const cleanCode = data.code.trim().toLowerCase();
        if (RESERVED_SLUGS.has(cleanCode)) {
          return res.status(400).json({ error: 'Código reservado pelo sistema.' });
        }
        if (cleanCode !== existing.code.toLowerCase()) {
          const dupCode = await cloudNicheDb.getAffiliateByCode(cleanCode);
          if (dupCode && dupCode.id !== id) {
            return res.status(400).json({ error: 'Código já utilizado por outro afiliado.' });
          }
        }
        updates.code = cleanCode;
      }
      if (data.phoneWhatsapp !== undefined) {
        updates.phone_whatsapp = data.phoneWhatsapp ? sanitizePlainText(data.phoneWhatsapp, 30) : null;
      }
      if (data.pixKey !== undefined) {
        updates.pix_key = data.pixKey ? sanitizePlainText(data.pixKey, 150) : null;
      }
      if (data.commissionPercent !== undefined) {
        updates.commission_rate = Number((data.commissionPercent / 100).toFixed(4));
      }
      if (data.niche !== undefined) {
        updates.niche = data.niche ? sanitizePlainText(data.niche, 80) : null;
      }
      if (data.notes !== undefined) {
        updates.notes = data.notes ? sanitizePlainText(data.notes, 500, true) : null;
      }
      if (data.active !== undefined) {
        updates.active = data.active ? 1 : 0;
      }
      if (data.password && data.password.trim().length > 0) {
        const pwdCheck = validatePasswordStrength(data.password);
        if (!pwdCheck.valid) {
          return res.status(400).json({ error: pwdCheck.error });
        }
        updates.password_hash = await bcrypt.hash(data.password, 12);
      }

      const updated = await cloudNicheDb.updateAffiliate(id, updates);
      res.json({ success: true, affiliate: formatSafeAffiliate(updated || existing) });
    } catch (e: any) {
      console.error('[MASTER_AFFILIATE_UPDATE_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao atualizar afiliado'));
    }
  });

  // Master Admin: Delete affiliate
  api.delete('/admin/master/affiliates/:id', authenticateToken, requireMaster, async (req, res) => {
    try {
      const deleted = await cloudNicheDb.deleteAffiliate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Afiliado não encontrado.' });
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('[MASTER_AFFILIATE_DELETE_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao excluir afiliado'));
    }
  });

  // Master Admin: Mark matured (or pending) commissions of an affiliate as paid via PIX
  api.post('/admin/master/affiliates/:id/payout', authenticateToken, requireMaster, async (req: any, res) => {
    try {
      const affiliate = await cloudNicheDb.getAffiliateById(req.params.id);
      if (!affiliate) {
        return res.status(404).json({ error: 'Afiliado não encontrado.' });
      }
      await cloudNicheDb.promoteMaturedCommissions();
      const includePending = Boolean(req.body?.includePending);
      const payoutReference = req.body?.payoutReference
        ? sanitizePlainText(req.body.payoutReference, 120)
        : `PIX_${new Date().toISOString().slice(0, 10)}`;

      const result = await cloudNicheDb.markAffiliateCommissionsPaid(affiliate.id, {
        includePending,
        payoutReference
      });

      if (result.count === 0) {
        return res.status(400).json({
          error: 'Nenhuma comissão liberada para pagamento neste momento.'
        });
      }

      recordSecurityEvent(req, {
        eventType: 'AFFILIATE_PAYOUT_MARKED',
        severity: 'low',
        details: `Repasse PIX marcado como pago para ${affiliate.name} (${affiliate.code}): R$ ${result.totalAmount.toFixed(2)} (${result.count} comissão(ões))`
      });

      res.json({ success: true, ...result, payoutReference });
    } catch (e: any) {
      console.error('[MASTER_AFFILIATE_PAYOUT_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao registrar repasse de comissão'));
    }
  });

  // Affiliate Partner Portal: Login
  api.post('/affiliate/auth/login', loginLimiter, async (req, res) => {
    try {
      const parsed = AffiliateLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Credenciais inválidas.' });
      }
      const cleanEmail = parsed.data.email.trim().toLowerCase();
      const affiliate = await cloudNicheDb.getAffiliateByEmail(cleanEmail);
      if (!affiliate) {
        return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
      }

      const validPassword = await bcrypt.compare(parsed.data.password, affiliate.password_hash);
      if (!validPassword) {
        recordSecurityEvent(req, {
          eventType: 'AFFILIATE_LOGIN_FAILED',
          severity: 'low',
          userEmail: cleanEmail,
          details: 'Tentativa de login no Portal de Afiliados com senha inválida'
        });
        return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
      }

      if (!affiliate.active) {
        return res.status(403).json({ error: 'Sua conta de parceiro está desativada. Fale com o suporte.' });
      }

      const rememberMe = parsed.data.rememberMe !== false;
      const token = jwt.sign(
        {
          id: affiliate.id,
          code: affiliate.code,
          email: affiliate.email,
          role: 'affiliate',
          typ: 'affiliate'
        },
        JWT_SECRET,
        { expiresIn: rememberMe ? '30d' : '7d' }
      );

      res.json({
        token,
        affiliate: formatSafeAffiliate(affiliate)
      });
    } catch (e: any) {
      console.error('[AFFILIATE_LOGIN_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao autenticar parceiro'));
    }
  });

  // Affiliate Partner Portal: Dashboard overview, referrals & recurring commissions
  api.get('/affiliate/me', authenticateAffiliate, async (req: any, res) => {
    try {
      const affiliate = req.affiliate;
      await cloudNicheDb.promoteMaturedCommissions();

      const [referrals, commissions, plansMap, clicksMap] = await Promise.all([
        cloudNicheDb.listReferralsByAffiliateId(affiliate.id),
        cloudNicheDb.listAffiliateCommissions(affiliate.id, 300),
        getShopPlansMap(),
        cloudNicheDb.getAffiliateClicksMap()
      ]);

      const shopIds = referrals.map((r) => r.shop_id);
      let shopsList: any[] = [];
      if (shopIds.length > 0) {
        const { data: shopsData, error: shopsErr } = await supabase
          .from('barbershops')
          .select('id, name, segment, plan_id, is_blocked, expires_at, created_at')
          .in('id', shopIds);
        if (shopsErr) throw shopsErr;
        shopsList = shopsData || [];
      }
      const shopMap = new Map<string, any>(shopsList.map((s) => [s.id, s]));

      const referralItems = referrals.map((r) => {
        const shop = shopMap.get(r.shop_id);
        const { planId, planName, status } = computeShopSubscriptionStatus(shop, plansMap);
        return {
          shopId: r.shop_id,
          shopName: shop?.name || 'Estabelecimento',
          segment: shop?.segment || 'barbershop',
          planId,
          planName,
          status,
          registeredAt: r.created_at,
          expiresAt: shop?.expires_at || null
        };
      });

      const commissionItems = commissions.map((c) => {
        const shop = shopMap.get(c.shop_id);
        return {
          id: c.id,
          shopId: c.shop_id,
          shopName: shop?.name || 'Assinante',
          planId: c.plan_id,
          planName: c.plan_name,
          grossAmount: Number(c.gross_amount) || 0,
          commissionRate: Number(c.commission_rate) || 0.25,
          commissionAmount: Number(c.commission_amount) || 0,
          status: c.status,
          availableAt: c.available_at,
          paidAt: c.paid_at,
          payoutReference: c.payout_reference,
          createdAt: c.created_at
        };
      });

      const pendingAmount = commissionItems
        .filter((c) => c.status === 'pending')
        .reduce((sum, c) => sum + c.commissionAmount, 0);
      const availableAmount = commissionItems
        .filter((c) => c.status === 'available')
        .reduce((sum, c) => sum + c.commissionAmount, 0);
      const paidAmount = commissionItems
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + c.commissionAmount, 0);

      const clickEntry = clicksMap[affiliate.id] || { totalClicks: 0, uniqueClicks: 0, lastClickedAt: null };
      const clicksCount = clickEntry.totalClicks;
      const uniqueClicks = clickEntry.uniqueClicks;
      const trialCount = referralItems.filter((r) => r.status === 'trial').length;
      const activePaidCount = referralItems.filter((r) => r.status === 'active').length;
      const signupConversionRate =
        clicksCount > 0 ? Number(((referralItems.length / clicksCount) * 100).toFixed(1)) : 0;
      const paidConversionRate =
        clicksCount > 0 ? Number(((activePaidCount / clicksCount) * 100).toFixed(1)) : 0;
      const trialToPaidRate =
        referralItems.length > 0 ? Number(((activePaidCount / referralItems.length) * 100).toFixed(1)) : 0;

      res.json({
        affiliate: formatSafeAffiliate(affiliate),
        metrics: {
          clicksCount,
          uniqueClicks,
          lastClickedAt: clickEntry.lastClickedAt,
          referralsCount: referralItems.length,
          trialCount,
          activePaidCount,
          signupConversionRate,
          paidConversionRate,
          trialToPaidRate,
          pendingAmount: Number(pendingAmount.toFixed(2)),
          availableAmount: Number(availableAmount.toFixed(2)),
          paidAmount: Number(paidAmount.toFixed(2)),
          totalEarned: Number((pendingAmount + availableAmount + paidAmount).toFixed(2))
        },
        referrals: referralItems,
        commissions: commissionItems
      });
    } catch (e: any) {
      console.error('[AFFILIATE_ME_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao carregar dados do afiliado'));
    }
  });

  // Affiliate Partner Portal: Update own PIX key, WhatsApp, or password
  api.patch('/affiliate/me/profile', authenticateAffiliate, async (req: any, res) => {
    try {
      const parsed = AffiliateProfileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' });
      }

      const updates: Record<string, any> = {};
      if (parsed.data.pixKey !== undefined) {
        updates.pix_key = parsed.data.pixKey ? sanitizePlainText(parsed.data.pixKey, 150) : null;
      }
      if (parsed.data.phoneWhatsapp !== undefined) {
        updates.phone_whatsapp = parsed.data.phoneWhatsapp ? sanitizePlainText(parsed.data.phoneWhatsapp, 30) : null;
      }
      if (parsed.data.newPassword && parsed.data.newPassword.trim().length > 0) {
        const pwdCheck = validatePasswordStrength(parsed.data.newPassword);
        if (!pwdCheck.valid) {
          return res.status(400).json({ error: pwdCheck.error });
        }
        updates.password_hash = await bcrypt.hash(parsed.data.newPassword, 12);
      }

      const updated = await cloudNicheDb.updateAffiliate(req.affiliate.id, updates);
      res.json({
        success: true,
        affiliate: formatSafeAffiliate(updated || req.affiliate)
      });
    } catch (e: any) {
      console.error('[AFFILIATE_PROFILE_UPDATE_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao atualizar perfil do parceiro'));
    }
  });

  // --- WHATSAPP AUTOMATION (PART 6 - EVOLUTION API v2) ---

  // Master Admin: Global Evolution API Server Configuration
  api.get('/admin/master/evolution-config', authenticateToken, requireMaster, async (_req, res) => {
    try {
      const [config, cronSecret] = await Promise.all([resolveEvolutionConfig(), resolveCronSecret()]);
      const maskedKey = config.apiKey
        ? `${config.apiKey.slice(0, 4)}${'•'.repeat(Math.max(4, Math.min(12, config.apiKey.length - 6)))}${config.apiKey.slice(-2)}`
        : '';

      res.json({
        configured: Boolean(config.apiUrl && config.apiKey),
        apiUrl: config.apiUrl,
        apiKeyMasked: maskedKey,
        source: config.source,
        cronSecretConfigured: Boolean(cronSecret),
        cronSecretMasked: cronSecret ? `${cronSecret.slice(0, 3)}••••${cronSecret.slice(-2)}` : ''
      });
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao carregar configuração da Evolution API'));
    }
  });

  api.post('/admin/master/evolution-config', authenticateToken, requireMaster, async (req, res) => {
    try {
      const { apiUrl, apiKey, cronSecret } = req.body || {};
      const cleanUrl = String(apiUrl || '').trim().replace(/\/+$/, '');
      const cleanKey = String(apiKey || '').trim();
      const cleanCron = String(cronSecret || '').trim();

      if (cleanUrl && !/^https?:\/\/.+/i.test(cleanUrl)) {
        return res.status(400).json({ error: 'A URL da Evolution API deve começar com http:// ou https://' });
      }

      if (cleanUrl) {
        await cloudNicheDb.setPlatformSetting('evolution_api_url', cleanUrl);
      } else if (apiUrl === '') {
        await cloudNicheDb.setPlatformSetting('evolution_api_url', '');
      }

      if (cleanKey) {
        await cloudNicheDb.setPlatformSetting('evolution_api_key', cleanKey);
      }

      if (cleanCron) {
        await cloudNicheDb.setPlatformSetting('cron_secret', cleanCron);
      }

      const resolved = await resolveEvolutionConfig();
      res.json({
        success: true,
        configured: Boolean(resolved.apiUrl && resolved.apiKey),
        apiUrl: resolved.apiUrl,
        source: resolved.source
      });
    } catch (e: any) {
      console.error('[MASTER_EVOLUTION_SAVE_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao salvar configuração da Evolution API'));
    }
  });

  api.post('/admin/master/evolution-test', authenticateToken, requireMaster, async (_req, res) => {
    try {
      const config = await resolveEvolutionConfig();
      const result = await testEvolutionServer(config);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e.message || 'Erro ao testar Evolution API' });
    }
  });

  // Shop Owner: WhatsApp Integration & Automation Rules
  api.get('/admin/whatsapp/config', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const [evoConfig, shopRes, existingIntegration, logs] = await Promise.all([
        resolveEvolutionConfig(),
        supabase.from('barbershops').select('id, name, slug').eq('id', shopId).maybeSingle(),
        cloudNicheDb.getWhatsAppIntegration(shopId),
        cloudNicheDb.getWhatsAppLogsByShop(shopId, 25)
      ]);

      const serverConfigured = Boolean(evoConfig.apiUrl && evoConfig.apiKey);
      const instanceName = existingIntegration?.instance_name || buildInstanceName(shopRes.data?.slug, shopId);

      let integration = existingIntegration || {
        barbershop_id: shopId,
        instance_name: instanceName,
        provider: 'evolution',
        connection_status: 'disconnected',
        connected_phone: null,
        auto_confirm_enabled: 0,
        reminder_24h_enabled: 0,
        reminder_2h_enabled: 0,
        auto_cancel_enabled: 0,
        ...DEFAULT_WHATSAPP_TEMPLATES
      };

      let serverReachable = serverConfigured;
      if (serverConfigured && existingIntegration) {
        const liveState = await getEvolutionConnectionState(evoConfig, integration.instance_name);
        serverReachable = liveState.reachable;
        if (liveState.reachable && liveState.connectionStatus !== integration.connection_status) {
          await cloudNicheDb.updateWhatsAppConnection(
            shopId,
            liveState.connectionStatus,
            liveState.connectedPhone ?? integration.connected_phone
          );
          integration = {
            ...integration,
            connection_status: liveState.connectionStatus,
            connected_phone: liveState.connectedPhone ?? integration.connected_phone
          };
        }
      }

      res.json({
        serverConfigured,
        serverReachable,
        shopName: shopRes.data?.name || '',
        integration: {
          ...integration,
          auto_confirm_enabled: Boolean(integration.auto_confirm_enabled),
          reminder_24h_enabled: Boolean(integration.reminder_24h_enabled),
          reminder_2h_enabled: Boolean(integration.reminder_2h_enabled),
          auto_cancel_enabled: Boolean(integration.auto_cancel_enabled)
        },
        defaultTemplates: DEFAULT_WHATSAPP_TEMPLATES,
        logs
      });
    } catch (e: any) {
      console.error('[WHATSAPP_CONFIG_GET_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao carregar configurações de WhatsApp'));
    }
  });

  api.put('/admin/whatsapp/config', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const {
        auto_confirm_enabled,
        reminder_24h_enabled,
        reminder_2h_enabled,
        auto_cancel_enabled,
        template_confirm,
        template_reminder_24h,
        template_reminder_2h,
        template_cancel
      } = req.body || {};

      const [existing, shopRes] = await Promise.all([
        cloudNicheDb.getWhatsAppIntegration(shopId),
        supabase.from('barbershops').select('slug').eq('id', shopId).maybeSingle()
      ]);

      const instanceName = existing?.instance_name || buildInstanceName(shopRes.data?.slug, shopId);
      const saved = await cloudNicheDb.upsertWhatsAppIntegration({
        barbershop_id: shopId,
        instance_name: instanceName,
        provider: 'evolution',
        connection_status: existing?.connection_status || 'disconnected',
        connected_phone: existing?.connected_phone || null,
        auto_confirm_enabled: auto_confirm_enabled ? 1 : 0,
        reminder_24h_enabled: reminder_24h_enabled ? 1 : 0,
        reminder_2h_enabled: reminder_2h_enabled ? 1 : 0,
        auto_cancel_enabled: auto_cancel_enabled ? 1 : 0,
        template_confirm: String(template_confirm || DEFAULT_WHATSAPP_TEMPLATES.template_confirm).trim(),
        template_reminder_24h: String(template_reminder_24h || DEFAULT_WHATSAPP_TEMPLATES.template_reminder_24h).trim(),
        template_reminder_2h: String(template_reminder_2h || DEFAULT_WHATSAPP_TEMPLATES.template_reminder_2h).trim(),
        template_cancel: String(template_cancel || DEFAULT_WHATSAPP_TEMPLATES.template_cancel).trim()
      });

      res.json({
        success: true,
        integration: {
          ...saved,
          auto_confirm_enabled: Boolean(saved.auto_confirm_enabled),
          reminder_24h_enabled: Boolean(saved.reminder_24h_enabled),
          reminder_2h_enabled: Boolean(saved.reminder_2h_enabled),
          auto_cancel_enabled: Boolean(saved.auto_cancel_enabled)
        }
      });
    } catch (e: any) {
      console.error('[WHATSAPP_CONFIG_PUT_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao salvar regras e modelos de WhatsApp'));
    }
  });

  api.post('/admin/whatsapp/connect', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const evoConfig = await resolveEvolutionConfig();
      if (!evoConfig.apiUrl || !evoConfig.apiKey) {
        return res.status(412).json({
          code: 'EVOLUTION_NOT_CONFIGURED',
          error: 'Servidor Evolution API ainda não configurado. Defina a URL e API Key no Painel Master ou variáveis de ambiente quando sua VPS estiver ativa.'
        });
      }

      const [existing, shopRes] = await Promise.all([
        cloudNicheDb.getWhatsAppIntegration(shopId),
        supabase.from('barbershops').select('slug').eq('id', shopId).maybeSingle()
      ]);

      const instanceName = existing?.instance_name || buildInstanceName(shopRes.data?.slug, shopId);
      const pairingPhone = typeof req.body?.phoneNumber === 'string' ? req.body.phoneNumber.trim() : '';

      if (!existing) {
        await cloudNicheDb.upsertWhatsAppIntegration({
          barbershop_id: shopId,
          instance_name: instanceName,
          provider: 'evolution',
          connection_status: 'connecting',
          ...DEFAULT_WHATSAPP_TEMPLATES
        });
      }

      const result = await connectEvolutionInstance(evoConfig, instanceName, pairingPhone || undefined);
      if (!result.ok) {
        return res.status(502).json({ error: result.error || 'Não foi possível gerar conexão na Evolution API.' });
      }

      await cloudNicheDb.updateWhatsAppConnection(
        shopId,
        result.connectionStatus,
        result.connectedPhone ?? existing?.connected_phone ?? null
      );

      res.json({
        success: true,
        instanceName,
        connectionStatus: result.connectionStatus,
        connectedPhone: result.connectedPhone,
        qrBase64: result.qrBase64,
        pairingCode: result.pairingCode
      });
    } catch (e: any) {
      console.error('[WHATSAPP_CONNECT_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro ao iniciar conexão do WhatsApp'));
    }
  });

  api.get('/admin/whatsapp/status', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const [evoConfig, existing] = await Promise.all([
        resolveEvolutionConfig(),
        cloudNicheDb.getWhatsAppIntegration(shopId)
      ]);

      if (!existing) {
        return res.json({ serverConfigured: Boolean(evoConfig.apiUrl && evoConfig.apiKey), connectionStatus: 'disconnected', connectedPhone: null });
      }
      if (!evoConfig.apiUrl || !evoConfig.apiKey) {
        return res.json({ serverConfigured: false, connectionStatus: existing.connection_status, connectedPhone: existing.connected_phone });
      }

      const live = await getEvolutionConnectionState(evoConfig, existing.instance_name);
      if (live.reachable && (live.connectionStatus !== existing.connection_status || (live.connectedPhone && live.connectedPhone !== existing.connected_phone))) {
        await cloudNicheDb.updateWhatsAppConnection(
          shopId,
          live.connectionStatus,
          live.connectedPhone ?? existing.connected_phone
        );
      }

      res.json({
        serverConfigured: true,
        serverReachable: live.reachable,
        connectionStatus: live.reachable ? live.connectionStatus : existing.connection_status,
        connectedPhone: live.connectedPhone ?? existing.connected_phone
      });
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao consultar status do WhatsApp'));
    }
  });

  api.post('/admin/whatsapp/disconnect', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const [evoConfig, existing] = await Promise.all([
        resolveEvolutionConfig(),
        cloudNicheDb.getWhatsAppIntegration(shopId)
      ]);

      if (existing) {
        if (evoConfig.apiUrl && evoConfig.apiKey) {
          await logoutEvolutionInstance(evoConfig, existing.instance_name);
        }
        await cloudNicheDb.updateWhatsAppConnection(shopId, 'disconnected', null);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao desconectar WhatsApp'));
    }
  });

  api.post('/admin/whatsapp/test', authenticateToken, requireOwnerOrMaster, async (req: any, res) => {
    try {
      const shopId = req.user.barbershopId;
      const { phone, message } = req.body || {};
      const cleanPhone = String(phone || '').replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        return res.status(400).json({ error: 'Informe um número de WhatsApp válido com DDD.' });
      }

      const [evoConfig, integration, shopRes] = await Promise.all([
        resolveEvolutionConfig(),
        cloudNicheDb.getWhatsAppIntegration(shopId),
        supabase.from('barbershops').select('name').eq('id', shopId).maybeSingle()
      ]);

      if (!evoConfig.apiUrl || !evoConfig.apiKey) {
        return res.status(412).json({
          code: 'EVOLUTION_NOT_CONFIGURED',
          error: 'Configure o servidor Evolution API (URL e Key) quando sua VPS estiver ativa para enviar testes.'
        });
      }
      if (!integration || integration.connection_status !== 'connected') {
        return res.status(400).json({ error: 'Conecte o WhatsApp da loja primeiro para enviar mensagens de teste.' });
      }

      const textToSend =
        String(message || '').trim() ||
        `Teste automático do *DoisemePRO* para *${shopRes.data?.name || 'sua loja'}* ✅\nSua automação de WhatsApp está operando normalmente!`;

      const sendRes = await sendEvolutionTextMessage(evoConfig, integration.instance_name, cleanPhone, textToSend);
      await cloudNicheDb.createWhatsAppLog({
        id: crypto.randomUUID(),
        barbershop_id: shopId,
        event_type: 'test',
        recipient_phone: cleanPhone,
        recipient_name: 'Teste Manual',
        message_text: textToSend,
        status: sendRes.ok ? 'sent' : 'failed',
        error_message: sendRes.ok ? null : (sendRes.error || 'Falha no teste'),
        provider_message_id: sendRes.messageId || null
      });

      if (!sendRes.ok) {
        return res.status(502).json({ error: sendRes.error || 'Falha ao enviar mensagem de teste.' });
      }

      res.json({ success: true, messageId: sendRes.messageId });
    } catch (e: any) {
      res.status(500).json(safeErrorResponse(e, 'Erro ao enviar teste'));
    }
  });

  // Scheduled Reminders Cron Route (Vercel Cron or cron-job.org every 15 min)
  const handleRemindersCron = async (req: any, res: any) => {
    try {
      const configuredSecret = await resolveCronSecret();
      const authHeader = String(req.headers['authorization'] || '');
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const providedSecret = String(
        req.query?.secret || req.headers['x-cron-secret'] || bearerToken || ''
      ).trim();

      let authorized = false;
      if (configuredSecret && providedSecret === configuredSecret) {
        authorized = true;
      } else if (!configuredSecret && req.headers['x-vercel-cron']) {
        authorized = true;
      } else if (bearerToken) {
        try {
          const decoded: any = jwt.verify(bearerToken, JWT_SECRET);
          if (decoded?.role === 'master') authorized = true;
        } catch {
          // not a valid master jwt
        }
      }

      if (!authorized) {
        return res.status(401).json({ error: 'Não autorizado para executar rotina de lembretes.' });
      }

      const evoConfig = await resolveEvolutionConfig();
      if (!evoConfig.apiUrl || !evoConfig.apiKey) {
        return res.json({
          ok: true,
          skipped: true,
          reason: 'evolution_not_configured',
          processedShops: 0,
          sent24h: 0,
          sent2h: 0,
          failed: 0
        });
      }

      const activeIntegrations = await cloudNicheDb.getAllActiveWhatsAppReminderIntegrations();
      if (activeIntegrations.length === 0) {
        return res.json({
          ok: true,
          processedShops: 0,
          sent24h: 0,
          sent2h: 0,
          failed: 0
        });
      }

      const spNow = getSaoPauloNow();
      const [spY, spM, spD] = spNow.dateStr.split('-').map(Number);
      const spNowMs = Date.UTC(spY, spM - 1, spD, spNow.hour, spNow.minute, 0);
      const tomorrowDate = new Date(Date.UTC(spY, spM - 1, spD + 1));
      const tomorrowStr = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getUTCDate()).padStart(2, '0')}`;

      let sent24h = 0;
      let sent2h = 0;
      let failed = 0;

      for (const integ of activeIntegrations) {
        const { data: shopRow } = await supabase
          .from('barbershops')
          .select('id, name, is_blocked, expires_at')
          .eq('id', integ.barbershop_id)
          .maybeSingle();

        if (!shopRow || shopRow.is_blocked) continue;
        if (shopRow.expires_at && new Date(shopRow.expires_at) < new Date()) continue;

        const { data: appts } = await supabase
          .from('appointments')
          .select('id, date, start_time, status, clients(name, phone), barbers(name), services(name)')
          .eq('barbershop_id', integ.barbershop_id)
          .eq('status', 'scheduled')
          .in('date', [spNow.dateStr, tomorrowStr]);

        for (const apt of appts || []) {
          const phone = (apt.clients as any)?.phone;
          if (!phone || !apt.date || !apt.start_time) continue;

          const [ay, am, ad] = String(apt.date).split('-').map(Number);
          const [ah, amin] = String(apt.start_time).split(':').map(Number);
          if ([ay, am, ad, ah, amin].some((n) => Number.isNaN(n))) continue;

          const aptMs = Date.UTC(ay, am - 1, ad, ah, amin, 0);
          const diffMinutes = (aptMs - spNowMs) / 60000;
          if (diffMinutes <= 5) continue;

          if (integ.reminder_2h_enabled && diffMinutes >= 30 && diffMinutes <= 155) {
            const r = await dispatchAppointmentWhatsApp({
              shopId: integ.barbershop_id,
              appointmentId: apt.id,
              eventType: 'reminder_2h',
              clientName: (apt.clients as any)?.name || 'Cliente',
              clientPhone: phone,
              date: apt.date,
              startTime: apt.start_time,
              serviceName: (apt.services as any)?.name || 'Atendimento',
              barberName: (apt.barbers as any)?.name || 'Equipe',
              shopName: shopRow.name
            });
            if (r.sent) sent2h += 1;
            else if (r.sent === false) failed += 1;
          }

          if (integ.reminder_24h_enabled && diffMinutes >= 1080 && diffMinutes <= 1680) {
            const r = await dispatchAppointmentWhatsApp({
              shopId: integ.barbershop_id,
              appointmentId: apt.id,
              eventType: 'reminder_24h',
              clientName: (apt.clients as any)?.name || 'Cliente',
              clientPhone: phone,
              date: apt.date,
              startTime: apt.start_time,
              serviceName: (apt.services as any)?.name || 'Atendimento',
              barberName: (apt.barbers as any)?.name || 'Equipe',
              shopName: shopRow.name
            });
            if (r.sent) sent24h += 1;
            else if (r.sent === false) failed += 1;
          }
        }
      }

      res.json({
        ok: true,
        processedShops: activeIntegrations.length,
        sent24h,
        sent2h,
        failed
      });
    } catch (e: any) {
      console.error('[CRON_WHATSAPP_REMINDERS_ERR]', e);
      res.status(500).json(safeErrorResponse(e, 'Erro na rotina de lembretes WhatsApp'));
    }
  };

  api.get('/cron/whatsapp-reminders', handleRemindersCron);
  api.post('/cron/whatsapp-reminders', handleRemindersCron);

  // --- END MASTER ADMIN ROUTES ---

  // Protected Seed Endpoint (Master Admin only; completely disabled in production)
  if (!IS_PRODUCTION) {
    api.post('/seed', authenticateToken, requireMaster, async (req, res) => {
      try {
        console.log('[SEED] Starting database sync...');
        const shopId = 'shop-1';
        const { data: existingShop } = await supabase.from('barbershops').select('*').eq('id', shopId).maybeSingle();
        
        const bootstrapPass =
          process.env.MASTER_BOOTSTRAP_PASSWORD?.trim() || nodeCrypto.randomBytes(24).toString('base64url');
        const hashAdmin = await bcrypt.hash(bootstrapPass, 12);
        const hashMarcus = await bcrypt.hash(bootstrapPass, 12);

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
            password_hash: hashAdmin,
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
        res.status(500).json(safeErrorResponse(error, 'Falha na sincronização inicial'));
      }
    });
  }

  // API 404 Handler - Prevent falling through to SPA HTML
  api.use((req, res) => {
    console.warn(`[API_404] ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: 'Rota da API não encontrada',
      path: req.originalUrl 
    });
  });

  // API Global Error Handler (never leaks internal stack or raw error messages in production)
  api.use((err: any, req: any, res: any, _next: any) => {
    if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && (err as any)?.status === 400 && 'body' in err)) {
      return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
    }
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({ error: 'Tamanho máximo do payload excedido.' });
    }
    console.error(`[API_ERROR] ${req.method} ${req.originalUrl}:`, err);
    res.status(err?.status && err.status >= 400 && err.status < 600 ? err.status : 500).json(
      safeErrorResponse(err, 'Erro interno na API')
    );
  });

  app.use('/api', api);

  // Catch-all for unhandled API routes so they return JSON 404 rather than Vite index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Rota API não encontrada: ${req.method} ${req.originalUrl}` });
  });

  // Static assets & Vite dev middleware (only outside Vercel serverless)
  if (!isVercel) {
    if (process.env.NODE_ENV !== 'production') {
      const vitePkg = ['vi', 'te'].join('');
      const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
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

    app.listen(PORT, '0.0.0.0', async () => {
      console.log(`Server running on http://localhost:${PORT}`);
      await ensureStartupSync();
    });
  }
}

export const serverReady = startServer();

export default app;
// end
