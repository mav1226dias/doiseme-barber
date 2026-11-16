import { z } from 'zod';

/**
 * Strip ASCII control characters (except newlines/tabs where allowed) and trim.
 */
export function sanitizePlainText(input: unknown, maxLen = 500, allowNewlines = false): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  str = allowNewlines
    ? str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    : str.replace(/[\u0000-\u001F\u007F]/g, ' ');
  return str.trim().slice(0, maxLen);
}

/**
 * Validate URLs safely to block XSS schemes (javascript:, vbscript:, data:text/html).
 * Allows relative /uploads/ or / paths, https:// URLs, and optionally http:// in non-strict fields.
 */
export function sanitizeSafeUrl(input: unknown, allowRelative = true): string | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Explicitly block dangerous schemes regardless of casing/whitespace
  const compact = raw.replace(/[\u0000-\u0020]/g, '').toLowerCase();
  if (
    compact.startsWith('javascript:') ||
    compact.startsWith('vbscript:') ||
    compact.startsWith('data:text/html') ||
    compact.startsWith('data:application/javascript')
  ) {
    return null;
  }

  if (allowRelative && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw.slice(0, 1000);
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, 1000);
    }
  } catch {
    return null;
  }

  return null;
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: 'A senha deve ter no mínimo 8 caracteres.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'A senha excede o tamanho máximo permitido.' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, error: 'A senha deve conter pelo menos uma letra e um número.' };
  }
  return { valid: true };
}

export const HexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor hexadecimal inválida (use formato #RRGGBB)');

export const IsoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)');

export const TimeHHMMSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)');

export const LoginSchema = z.object({
  email: z.string().trim().email('E-mail inválido').max(200),
  password: z.string().min(1, 'Senha é obrigatória').max(200),
  rememberMe: z.boolean().optional().default(true)
});

export const RegisterSchema = z.object({
  businessName: z.string().trim().min(2, 'O nome do estabelecimento deve ter pelo menos 2 caracteres.').max(120),
  ownerName: z.string().trim().min(2, 'Informe seu nome completo.').max(120),
  slug: z.string().trim().min(3, 'O link personalizado deve ter pelo menos 3 caracteres válidos.').max(80),
  email: z.string().trim().email('Informe um e-mail válido.').max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  segment: z.string().trim().max(60).optional(),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres.').max(128),
  confirmPassword: z.string().optional(),
  seedStarterServices: z.boolean().optional(),
  createOwnerAsProfessional: z.boolean().optional(),
  acceptedTerms: z.boolean().optional(),
  referralCode: z.string().trim().max(40).optional().nullable()
});

export const CreatePublicAppointmentSchema = z.object({
  barbershopId: z.string().trim().min(1).max(100),
  barberId: z.string().trim().min(1).max(100),
  serviceId: z.string().trim().min(1).max(100),
  clientName: z.string().trim().min(2, 'Informe seu nome.').max(120),
  clientPhone: z.string().trim().min(8, 'Informe um telefone válido.').max(30),
  date: IsoDateSchema,
  startTime: TimeHHMMSchema,
  notes: z.string().max(2000).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(5).max(720).optional()
});

export const CreateServiceSchema = z.object({
  name: z.string().trim().min(1, 'Nome do serviço é obrigatório.').max(120),
  durationMinutes: z.coerce.number().int().min(5, 'Duração mínima de 5 minutos.').max(720, 'Duração máxima de 720 minutos.'),
  price: z.coerce.number().finite().min(0, 'O preço não pode ser negativo.').max(100000, 'Valor acima do limite permitido.'),
  image_url: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().max(1000).optional().nullable(),
  photo_url: z.string().max(1000).optional().nullable()
});

export const UpdateServiceSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(720).optional(),
  price: z.coerce.number().finite().min(0).max(100000).optional(),
  image_url: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().max(1000).optional().nullable(),
  photo_url: z.string().max(1000).optional().nullable()
});

export const CreateExpenseSchema = z.object({
  description: z.string().trim().min(1, 'Descrição é obrigatória.').max(250),
  amount: z.coerce.number().finite().positive('O valor deve ser maior que zero.').max(1000000),
  category: z.string().trim().min(1).max(60),
  date: IsoDateSchema,
  barberId: z.string().trim().max(100).optional().nullable()
});

export const CreatePackageSchema = z.object({
  clientName: z.string().trim().min(1, 'Nome do cliente é obrigatório.').max(120),
  clientWhatsapp: z.string().trim().min(8, 'WhatsApp inválido.').max(30),
  packageName: z.string().trim().min(1, 'Nome do pacote é obrigatório.').max(120),
  totalQuantity: z.coerce.number().int().min(1, 'Quantidade mínima de 1 sessão.').max(500),
  pricePaid: z.coerce.number().finite().min(0, 'Valor inválido.').max(1000000)
});

export const BillingCheckoutSchema = z.object({
  planId: z.enum(['essencial', 'profissional', 'premium']),
  billingCycle: z.enum(['monthly', 'annual']).optional().default('monthly')
});

export const BillingLinkIntentSchema = z.object({
  planId: z.enum(['essencial', 'profissional', 'premium'])
});

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Inspects decoded binary buffer magic bytes to verify genuine image content
 * and prevent polyglot / SVG / HTML / JS / executable uploads.
 */
export function detectImageMagicType(buf: Buffer): { mime: string; ext: string } | null {
  if (!buf || buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }

  // GIF87a / GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { mime: 'image/gif', ext: '.gif' };
  }

  return null;
}

export const AffiliateCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{3,30}$/, 'Código de indicação inválido (use 3 a 30 letras minúsculas, números, "-" ou "_").');

export const CreateAffiliateSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do parceiro/afiliado.').max(120),
  email: z.string().trim().email('E-mail inválido.').max(200),
  password: z.string().min(8, 'A senha do portal deve ter no mínimo 8 caracteres.').max(128),
  phoneWhatsapp: z.string().trim().max(30).optional().nullable(),
  pixKey: z.string().trim().max(150).optional().nullable(),
  code: AffiliateCodeSchema,
  commissionPercent: z.coerce.number().min(5, 'Comissão mínima de 5%.').max(50, 'Comissão máxima de 50%.').default(25),
  niche: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable()
});

export const UpdateAffiliateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  password: z.string().min(8).max(128).optional().or(z.literal('')),
  phoneWhatsapp: z.string().trim().max(30).optional().nullable(),
  pixKey: z.string().trim().max(150).optional().nullable(),
  code: AffiliateCodeSchema.optional(),
  commissionPercent: z.coerce.number().min(5).max(50).optional(),
  niche: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional()
});

export const AffiliateLoginSchema = z.object({
  email: z.string().trim().email('Informe seu e-mail cadastrado.').max(200),
  password: z.string().min(1, 'Informe sua senha.').max(200),
  rememberMe: z.boolean().optional().default(true)
});

export const AffiliateProfileUpdateSchema = z.object({
  phoneWhatsapp: z.string().trim().max(30).optional().nullable(),
  pixKey: z.string().trim().max(150).optional().nullable(),
  newPassword: z.string().min(8).max(128).optional().or(z.literal(''))
});

export const ApplyAffiliateCouponSchema = z.object({
  code: AffiliateCodeSchema
});
