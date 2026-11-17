import { supabaseAdmin } from './supabaseAdmin.js';
import {
  nicheDb,
  ClinicalNote,
  PatientAnamnesis,
  AestheticsAnamnesis,
  AestheticsPhoto,
  AestheticsTouchup,
  ClientPet,
  ClientVehicle,
  ClientStylePreference,
  ClientFitnessAssessment,
  ClientTattooRecord,
  ClientCreativeProject,
  AffiliateRecord,
  AffiliateReferralRecord,
  AffiliateCommissionRecord
} from './nicheDb.js';

const warnedTables = new Set<string>();
let affiliateClickWriteLock: Promise<any> = Promise.resolve();
let salesChannelMetricsWriteLock: Promise<any> = Promise.resolve();

function isTableMissingOrUnmigrated(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

function logFallbackOnce(table: string, error: any) {
  if (!warnedTables.has(table)) {
    warnedTables.add(table);
    console.warn(`[CLOUD_DB_FALLBACK] Tabela "${table}" ainda não criada no Supabase (${error?.code || error?.message}). Usando SQLite local temporariamente.`);
  }
}

export const NICHE_CLOUD_TABLES = [
  'client_clinical_notes',
  'patient_anamnesis',
  'aesthetics_anamnesis',
  'aesthetics_photos',
  'aesthetics_touchups',
  'client_pets',
  'client_vehicles',
  'client_style_preferences',
  'client_fitness_assessments',
  'client_tattoo_records',
  'client_creative_projects',
  'appointment_notes',
  'entity_photos',
  'barber_metadata',
  'barber_accounts',
  'password_reset_tokens',
  'platform_settings',
  'saas_payments',
  'whatsapp_integrations',
  'whatsapp_logs',
  'security_logs',
  'affiliates',
  'affiliate_referrals',
  'affiliate_commissions'
] as const;

const CONFLICT_KEYS: Record<string, string> = {
  client_clinical_notes: 'id',
  patient_anamnesis: 'client_id',
  aesthetics_anamnesis: 'client_id',
  aesthetics_photos: 'id',
  aesthetics_touchups: 'id',
  client_pets: 'id',
  client_vehicles: 'id',
  client_style_preferences: 'client_id',
  client_fitness_assessments: 'id',
  client_tattoo_records: 'id',
  client_creative_projects: 'id',
  appointment_notes: 'appointment_id',
  entity_photos: 'entity_id',
  barber_metadata: 'barber_id',
  barber_accounts: 'barber_id',
  password_reset_tokens: 'id',
  platform_settings: 'key',
  saas_payments: 'id',
  whatsapp_integrations: 'barbershop_id',
  whatsapp_logs: 'id',
  security_logs: 'id',
  affiliates: 'id',
  affiliate_referrals: 'shop_id',
  affiliate_commissions: 'id'
};

export const cloudNicheDb = {
  // --- DIAGNOSTICS & MIGRATION ---
  async checkCloudStatus(): Promise<{
    readyCount: number;
    totalCount: number;
    tables: { table: string; ready: boolean; localRows: number; error?: string }[];
  }> {
    const localData = nicheDb.getAllForMigration();
    const tables: { table: string; ready: boolean; localRows: number; error?: string }[] = [];

    for (const table of NICHE_CLOUD_TABLES) {
      const { error } = await supabaseAdmin.from(table).select('*').limit(1);
      const ready = !error;
      if (ready) warnedTables.delete(table);
      tables.push({
        table,
        ready,
        localRows: (localData[table] || []).length,
        error: error ? `${error.code || 'ERR'}: ${error.message}` : undefined
      });
    }

    return {
      readyCount: tables.filter(t => t.ready).length,
      totalCount: NICHE_CLOUD_TABLES.length,
      tables
    };
  },

  async migrateAllLocalToSupabase(): Promise<{
    migratedTotal: number;
    results: { table: string; localCount: number; migrated: number; status: 'ok' | 'missing_table' | 'error'; error?: string }[];
  }> {
    const localData = nicheDb.getAllForMigration();
    const results: { table: string; localCount: number; migrated: number; status: 'ok' | 'missing_table' | 'error'; error?: string }[] = [];
    let migratedTotal = 0;

    for (const table of NICHE_CLOUD_TABLES) {
      const rows = localData[table] || [];
      if (rows.length === 0) {
        const { error: probeErr } = await supabaseAdmin.from(table).select('*').limit(1);
        results.push({
          table,
          localCount: 0,
          migrated: 0,
          status: probeErr ? (isTableMissingOrUnmigrated(probeErr) ? 'missing_table' : 'error') : 'ok',
          error: probeErr?.message
        });
        continue;
      }

      const conflictKey = CONFLICT_KEYS[table] || 'id';
      const { error } = await supabaseAdmin
        .from(table)
        .upsert(rows, { onConflict: conflictKey });

      if (error) {
        results.push({
          table,
          localCount: rows.length,
          migrated: 0,
          status: isTableMissingOrUnmigrated(error) ? 'missing_table' : 'error',
          error: error.message
        });
      } else {
        warnedTables.delete(table);
        migratedTotal += rows.length;
        results.push({
          table,
          localCount: rows.length,
          migrated: rows.length,
          status: 'ok'
        });
      }
    }

    return { migratedTotal, results };
  },

  // --- CLINICAL NOTES ---
  async getNotesByClient(barbershopId: string, clientId: string): Promise<ClinicalNote[]> {
    const { data, error } = await supabaseAdmin
      .from('client_clinical_notes')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_clinical_notes', error);
        return nicheDb.getNotesByClient(barbershopId, clientId);
      }
      throw error;
    }
    return (data || []) as ClinicalNote[];
  },

  async createNote(note: Omit<ClinicalNote, 'created_at' | 'updated_at'>): Promise<ClinicalNote> {
    const now = new Date().toISOString();
    const record: ClinicalNote = {
      ...note,
      author_name: note.author_name || undefined,
      session_time: note.session_time || undefined,
      is_private: note.is_private ?? 1,
      created_at: now,
      updated_at: now
    };

    const { error } = await supabaseAdmin.from('client_clinical_notes').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_clinical_notes', error);
        return nicheDb.createNote(note);
      }
      throw error;
    }
    return record;
  },

  async updateNote(
    id: string,
    barbershopId: string,
    data: Partial<Omit<ClinicalNote, 'id' | 'barbershop_id' | 'client_id' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.session_date !== undefined) updatePayload.session_date = data.session_date;
    if (data.session_time !== undefined) updatePayload.session_time = data.session_time;
    if (data.patient_mood !== undefined) updatePayload.patient_mood = data.patient_mood;
    if (data.therapeutic_goals !== undefined) updatePayload.therapeutic_goals = data.therapeutic_goals;
    if (data.techniques_used !== undefined) updatePayload.techniques_used = data.techniques_used;
    if (data.is_private !== undefined) updatePayload.is_private = data.is_private;

    const { data: updatedRows, error } = await supabaseAdmin
      .from('client_clinical_notes')
      .update(updatePayload)
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_clinical_notes', error);
        return nicheDb.updateNote(id, barbershopId, data);
      }
      throw error;
    }
    return (updatedRows || []).length > 0;
  },

  async deleteNote(id: string, barbershopId: string): Promise<boolean> {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('client_clinical_notes')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_clinical_notes', error);
        return nicheDb.deleteNote(id, barbershopId);
      }
      throw error;
    }
    return (deletedRows || []).length > 0;
  },

  // --- PSYCHOLOGY ANAMNESIS ---
  async getAnamnesis(barbershopId: string, clientId: string): Promise<PatientAnamnesis | null> {
    const { data, error } = await supabaseAdmin
      .from('patient_anamnesis')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('patient_anamnesis', error);
        return nicheDb.getAnamnesis(barbershopId, clientId);
      }
      throw error;
    }
    return (data as PatientAnamnesis) || null;
  },

  async upsertAnamnesis(data: Omit<PatientAnamnesis, 'updated_at'>): Promise<PatientAnamnesis> {
    const now = new Date().toISOString();
    const record: PatientAnamnesis = { ...data, updated_at: now };

    const { error } = await supabaseAdmin
      .from('patient_anamnesis')
      .upsert(record, { onConflict: 'client_id' });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('patient_anamnesis', error);
        return nicheDb.upsertAnamnesis(data);
      }
      throw error;
    }
    return record;
  },

  // --- AESTHETICS ANAMNESIS ---
  async getAestheticsAnamnesis(barbershopId: string, clientId: string): Promise<AestheticsAnamnesis | null> {
    const { data, error } = await supabaseAdmin
      .from('aesthetics_anamnesis')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_anamnesis', error);
        return nicheDb.getAestheticsAnamnesis(barbershopId, clientId);
      }
      throw error;
    }
    return (data as AestheticsAnamnesis) || null;
  },

  async upsertAestheticsAnamnesis(data: Omit<AestheticsAnamnesis, 'updated_at'>): Promise<AestheticsAnamnesis> {
    const now = new Date().toISOString();
    const record: AestheticsAnamnesis = { ...data, updated_at: now };

    const { error } = await supabaseAdmin
      .from('aesthetics_anamnesis')
      .upsert(record, { onConflict: 'client_id' });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_anamnesis', error);
        return nicheDb.upsertAestheticsAnamnesis(data);
      }
      throw error;
    }
    return record;
  },

  // --- AESTHETICS PHOTOS ---
  async getAestheticsPhotos(barbershopId: string, clientId: string): Promise<AestheticsPhoto[]> {
    const { data, error } = await supabaseAdmin
      .from('aesthetics_photos')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_photos', error);
        return nicheDb.getAestheticsPhotos(barbershopId, clientId);
      }
      throw error;
    }
    return (data || []) as AestheticsPhoto[];
  },

  async addAestheticsPhoto(data: Omit<AestheticsPhoto, 'created_at'>): Promise<AestheticsPhoto> {
    const now = new Date().toISOString();
    const record: AestheticsPhoto = { ...data, created_at: now };

    const { error } = await supabaseAdmin.from('aesthetics_photos').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_photos', error);
        return nicheDb.addAestheticsPhoto(data);
      }
      throw error;
    }
    return record;
  },

  async deleteAestheticsPhoto(id: string, barbershopId: string): Promise<boolean> {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('aesthetics_photos')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_photos', error);
        return nicheDb.deleteAestheticsPhoto(id, barbershopId);
      }
      throw error;
    }
    return (deletedRows || []).length > 0;
  },

  // --- AESTHETICS TOUCHUPS ---
  async getAestheticsTouchups(barbershopId: string, clientId?: string): Promise<AestheticsTouchup[]> {
    let query = supabaseAdmin
      .from('aesthetics_touchups')
      .select('*')
      .eq('barbershop_id', barbershopId);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query.order('return_due_date', { ascending: true });
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_touchups', error);
        return nicheDb.getAestheticsTouchups(barbershopId, clientId);
      }
      throw error;
    }
    return (data || []) as AestheticsTouchup[];
  },

  async createAestheticsTouchup(data: Omit<AestheticsTouchup, 'created_at'>): Promise<AestheticsTouchup> {
    const now = new Date().toISOString();
    const record: AestheticsTouchup = {
      ...data,
      interval_days: data.interval_days || 15,
      status: data.status || 'pending',
      created_at: now
    };

    const { error } = await supabaseAdmin.from('aesthetics_touchups').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_touchups', error);
        return nicheDb.createAestheticsTouchup(data);
      }
      throw error;
    }
    return record;
  },

  async updateAestheticsTouchupStatus(
    id: string,
    barbershopId: string,
    status: 'pending' | 'contacted' | 'completed'
  ): Promise<boolean> {
    const { data: updatedRows, error } = await supabaseAdmin
      .from('aesthetics_touchups')
      .update({ status })
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_touchups', error);
        return nicheDb.updateAestheticsTouchupStatus(id, barbershopId, status);
      }
      throw error;
    }
    return (updatedRows || []).length > 0;
  },

  async deleteAestheticsTouchup(id: string, barbershopId: string): Promise<boolean> {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('aesthetics_touchups')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('aesthetics_touchups', error);
        return nicheDb.deleteAestheticsTouchup(id, barbershopId);
      }
      throw error;
    }
    return (deletedRows || []).length > 0;
  },

  // --- PET SHOP ---
  async getPets(barbershopId: string, clientId: string): Promise<ClientPet[]> {
    const { data, error } = await supabaseAdmin
      .from('client_pets')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .order('pet_name', { ascending: true });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_pets', error);
        return nicheDb.getPets(barbershopId, clientId);
      }
      throw error;
    }
    return (data || []) as ClientPet[];
  },

  async createPet(data: Omit<ClientPet, 'created_at' | 'updated_at'>): Promise<ClientPet> {
    const now = new Date().toISOString();
    const record: ClientPet = {
      ...data,
      species: data.species || 'Cão',
      created_at: now,
      updated_at: now
    };

    const { error } = await supabaseAdmin.from('client_pets').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_pets', error);
        return nicheDb.createPet(data);
      }
      throw error;
    }
    return record;
  },

  async deletePet(id: string, barbershopId: string): Promise<boolean> {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('client_pets')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_pets', error);
        return nicheDb.deletePet(id, barbershopId);
      }
      throw error;
    }
    return (deletedRows || []).length > 0;
  },

  // --- VEHICLES ---
  async getVehicles(barbershopId: string, clientId: string): Promise<ClientVehicle[]> {
    const { data, error } = await supabaseAdmin
      .from('client_vehicles')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_vehicles', error);
        return nicheDb.getVehicles(barbershopId, clientId);
      }
      throw error;
    }
    return (data || []) as ClientVehicle[];
  },

  async createVehicle(data: Omit<ClientVehicle, 'created_at' | 'updated_at'>): Promise<ClientVehicle> {
    const now = new Date().toISOString();
    const record: ClientVehicle = {
      ...data,
      plate: data.plate.toUpperCase(),
      created_at: now,
      updated_at: now
    };

    const { error } = await supabaseAdmin.from('client_vehicles').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_vehicles', error);
        return nicheDb.createVehicle(data);
      }
      throw error;
    }
    return record;
  },

  async deleteVehicle(id: string, barbershopId: string): Promise<boolean> {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('client_vehicles')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_vehicles', error);
        return nicheDb.deleteVehicle(id, barbershopId);
      }
      throw error;
    }
    return (deletedRows || []).length > 0;
  },

  // --- BARBERIA & SALÃO STYLE PREFERENCES ---
  async getStylePreferences(barbershopId: string, clientId: string): Promise<ClientStylePreference | null> {
    const { data, error } = await supabaseAdmin
      .from('client_style_preferences')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_style_preferences', error);
        return nicheDb.getStylePreferences(barbershopId, clientId);
      }
      throw error;
    }
    return (data as ClientStylePreference) || null;
  },

  async upsertStylePreferences(data: Omit<ClientStylePreference, 'updated_at'>): Promise<ClientStylePreference> {
    const now = new Date().toISOString();
    const record: ClientStylePreference = { ...data, updated_at: now };

    const { error } = await supabaseAdmin
      .from('client_style_preferences')
      .upsert(record, { onConflict: 'client_id' });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_style_preferences', error);
        return nicheDb.upsertStylePreferences(data);
      }
      throw error;
    }
    return record;
  },

  // --- FITNESS ASSESSMENTS ---
  async getFitnessAssessments(barbershopId: string, clientId: string): Promise<ClientFitnessAssessment[]> {
    const { data, error } = await supabaseAdmin
      .from('client_fitness_assessments')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .order('assessment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_fitness_assessments', error);
        return nicheDb.getFitnessAssessments(barbershopId, clientId);
      }
      throw error;
    }
    return (data || []) as ClientFitnessAssessment[];
  },

  async createFitnessAssessment(data: Omit<ClientFitnessAssessment, 'created_at'>): Promise<ClientFitnessAssessment> {
    const now = new Date().toISOString();
    const record: ClientFitnessAssessment = { ...data, created_at: now };

    const { error } = await supabaseAdmin.from('client_fitness_assessments').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_fitness_assessments', error);
        return nicheDb.createFitnessAssessment(data);
      }
      throw error;
    }
    return record;
  },

  async deleteFitnessAssessment(id: string, barbershopId: string): Promise<boolean> {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('client_fitness_assessments')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_fitness_assessments', error);
        return nicheDb.deleteFitnessAssessment(id, barbershopId);
      }
      throw error;
    }
    return (deletedRows || []).length > 0;
  },

  // --- TATTOO & PIERCING ---
  async getTattooRecords(barbershopId: string, clientId: string): Promise<ClientTattooRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('client_tattoo_records')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_tattoo_records', error);
        return nicheDb.getTattooRecords(barbershopId, clientId);
      }
      throw error;
    }
    return (data || []) as ClientTattooRecord[];
  },

  async createTattooRecord(data: Omit<ClientTattooRecord, 'created_at'>): Promise<ClientTattooRecord> {
    const now = new Date().toISOString();
    const record: ClientTattooRecord = {
      ...data,
      healing_stage: data.healing_stage || 'Recente',
      consent_signed: data.consent_signed ?? 1,
      created_at: now
    };

    const { error } = await supabaseAdmin.from('client_tattoo_records').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_tattoo_records', error);
        return nicheDb.createTattooRecord(data);
      }
      throw error;
    }
    return record;
  },

  async deleteTattooRecord(id: string, barbershopId: string): Promise<boolean> {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('client_tattoo_records')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_tattoo_records', error);
        return nicheDb.deleteTattooRecord(id, barbershopId);
      }
      throw error;
    }
    return (deletedRows || []).length > 0;
  },

  // --- PROJETOS CRIATIVOS (MARCENARIA, ARQUITETURA, FOTOGRAFIA, AUDIOVISUAL) ---
  async getCreativeProjects(barbershopId: string, clientId: string): Promise<ClientCreativeProject[]> {
    const { data, error } = await supabaseAdmin
      .from('client_creative_projects')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_creative_projects', error);
        return nicheDb.getCreativeProjects(barbershopId, clientId);
      }
      throw error;
    }
    return (data || []) as ClientCreativeProject[];
  },

  async createCreativeProject(data: Omit<ClientCreativeProject, 'created_at' | 'updated_at'>): Promise<ClientCreativeProject> {
    const now = new Date().toISOString();
    const record: ClientCreativeProject = {
      ...data,
      status: data.status || 'Briefing / Orçamento',
      created_at: now,
      updated_at: now
    };

    const { error } = await supabaseAdmin.from('client_creative_projects').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_creative_projects', error);
        return nicheDb.createCreativeProject(data);
      }
      throw error;
    }
    return record;
  },

  async updateCreativeProjectStatus(id: string, barbershopId: string, status: string): Promise<boolean> {
    const now = new Date().toISOString();
    const { data: updatedRows, error } = await supabaseAdmin
      .from('client_creative_projects')
      .update({ status, updated_at: now })
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_creative_projects', error);
        return nicheDb.updateCreativeProjectStatus(id, barbershopId, status);
      }
      throw error;
    }
    return (updatedRows || []).length > 0;
  },

  async deleteCreativeProject(id: string, barbershopId: string): Promise<boolean> {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('client_creative_projects')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('client_creative_projects', error);
        return nicheDb.deleteCreativeProject(id, barbershopId);
      }
      throw error;
    }
    return (deletedRows || []).length > 0;
  },

  // --- APPOINTMENT NOTES ---
  async upsertAppointmentNote(appointmentId: string, barbershopId: string, notes: string): Promise<void> {
    const trimmed = String(notes || '').trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('appointment_notes').upsert(
      {
        appointment_id: appointmentId,
        barbershop_id: barbershopId,
        notes: trimmed,
        updated_at: now
      },
      { onConflict: 'appointment_id' }
    );

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('appointment_notes', error);
        nicheDb.upsertAppointmentNote(appointmentId, barbershopId, trimmed);
        return;
      }
      console.warn('[APPT_NOTE_UPSERT_WARN]', error.message);
    }
  },

  async getAppointmentNotesMap(appointmentIds: string[]): Promise<Record<string, string>> {
    if (!appointmentIds.length) return {};
    const { data, error } = await supabaseAdmin
      .from('appointment_notes')
      .select('appointment_id, notes')
      .in('appointment_id', appointmentIds);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('appointment_notes', error);
        return nicheDb.getAppointmentNotesMap(appointmentIds);
      }
      return {};
    }

    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => {
      if (r.notes) map[r.appointment_id] = r.notes;
    });
    return map;
  },

  // --- ENTITY PHOTOS ---
  async upsertEntityPhoto(entityId: string, barbershopId: string, entityType: 'barber' | 'service', photoUrl: string | null): Promise<void> {
    const now = new Date().toISOString();
    if (!photoUrl) {
      const { error } = await supabaseAdmin.from('entity_photos').delete().eq('entity_id', entityId);
      if (error && isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('entity_photos', error);
        nicheDb.upsertEntityPhoto(entityId, barbershopId, entityType, null);
      }
      return;
    }

    const { error } = await supabaseAdmin.from('entity_photos').upsert(
      {
        entity_id: entityId,
        barbershop_id: barbershopId,
        entity_type: entityType,
        photo_url: photoUrl,
        updated_at: now
      },
      { onConflict: 'entity_id' }
    );

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('entity_photos', error);
        nicheDb.upsertEntityPhoto(entityId, barbershopId, entityType, photoUrl);
        return;
      }
      throw error;
    }
  },

  async getEntityPhotosMap(entityIds: string[]): Promise<Record<string, string>> {
    if (!entityIds.length) return {};
    const { data, error } = await supabaseAdmin
      .from('entity_photos')
      .select('entity_id, photo_url')
      .in('entity_id', entityIds);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('entity_photos', error);
        return nicheDb.getEntityPhotosMap(entityIds);
      }
      throw error;
    }

    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => {
      map[r.entity_id] = r.photo_url;
    });
    return map;
  },

  // --- BARBER METADATA ---
  async upsertBarberMetadata(barberId: string, barbershopId: string, commissionPercentage: number): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('barber_metadata').upsert(
      {
        barber_id: barberId,
        barbershop_id: barbershopId,
        commission_percentage: commissionPercentage,
        updated_at: now
      },
      { onConflict: 'barber_id' }
    );

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('barber_metadata', error);
        nicheDb.upsertBarberMetadata(barberId, barbershopId, commissionPercentage);
        return;
      }
      throw error;
    }
  },

  async getBarbersMetadataMap(barberIds: string[]): Promise<Record<string, { commission_percentage: number }>> {
    if (!barberIds.length) return {};
    const { data, error } = await supabaseAdmin
      .from('barber_metadata')
      .select('barber_id, commission_percentage')
      .in('barber_id', barberIds);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('barber_metadata', error);
        return nicheDb.getBarbersMetadataMap(barberIds);
      }
      throw error;
    }

    const map: Record<string, { commission_percentage: number }> = {};
    (data || []).forEach((r: any) => {
      map[r.barber_id] = { commission_percentage: r.commission_percentage };
    });
    return map;
  },

  // --- BARBER ACCOUNTS (INDIVIDUAL PROFESSIONAL LOGIN LINK) ---
  async upsertBarberAccount(data: {
    barber_id: string;
    user_id: string;
    barbershop_id: string;
    email: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('barber_accounts').upsert(
      {
        barber_id: data.barber_id,
        user_id: data.user_id,
        barbershop_id: data.barbershop_id,
        email: data.email,
        created_at: now,
        updated_at: now
      },
      { onConflict: 'barber_id' }
    );

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('barber_accounts', error);
        nicheDb.upsertBarberAccount(data);
        return;
      }
      throw error;
    }
  },

  async getBarberAccountByUserId(userId: string): Promise<{ barber_id: string; user_id: string; barbershop_id: string; email: string } | null> {
    const { data, error } = await supabaseAdmin
      .from('barber_accounts')
      .select('barber_id, user_id, barbershop_id, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('barber_accounts', error);
        return nicheDb.getBarberAccountByUserId(userId);
      }
      throw error;
    }
    return data || null;
  },

  async getBarberAccountByBarberId(barberId: string): Promise<{ barber_id: string; user_id: string; barbershop_id: string; email: string } | null> {
    const { data, error } = await supabaseAdmin
      .from('barber_accounts')
      .select('barber_id, user_id, barbershop_id, email')
      .eq('barber_id', barberId)
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('barber_accounts', error);
        return nicheDb.getBarberAccountByBarberId(barberId);
      }
      throw error;
    }
    return data || null;
  },

  async getBarberAccountsByShop(barbershopId: string): Promise<Record<string, { user_id: string; email: string }>> {
    const { data, error } = await supabaseAdmin
      .from('barber_accounts')
      .select('barber_id, user_id, email')
      .eq('barbershop_id', barbershopId);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('barber_accounts', error);
        return nicheDb.getBarberAccountsByShop(barbershopId);
      }
      throw error;
    }

    const map: Record<string, { user_id: string; email: string }> = {};
    (data || []).forEach((r: any) => {
      map[r.barber_id] = { user_id: r.user_id, email: r.email };
    });
    return map;
  },

  async deleteBarberAccount(barberId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('barber_accounts')
      .delete()
      .eq('barber_id', barberId);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('barber_accounts', error);
        nicheDb.deleteBarberAccount(barberId);
        return;
      }
      throw error;
    }
  },

  // --- PASSWORD RESET TOKENS ---
  async invalidateUserResetTokens(userId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: now })
      .eq('user_id', userId)
      .is('used_at', null);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('password_reset_tokens', error);
        nicheDb.invalidateUserResetTokens(userId);
        return;
      }
      throw error;
    }
  },

  async createPasswordResetToken(data: {
    id: string;
    user_id: string;
    email: string;
    token_hash: string;
    expires_at: string;
    created_at: string;
  }): Promise<void> {
    const { error } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({ ...data, used_at: null });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('password_reset_tokens', error);
        nicheDb.createPasswordResetToken(data);
        return;
      }
      throw error;
    }
  },

  async getPasswordResetTokenByHash(tokenHash: string): Promise<{
    id: string;
    user_id: string;
    email: string;
    token_hash: string;
    expires_at: string;
    used_at: string | null;
    created_at: string;
  } | null> {
    const { data, error } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('password_reset_tokens', error);
        return nicheDb.getPasswordResetTokenByHash(tokenHash);
      }
      throw error;
    }
    return data || null;
  },

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: now })
      .eq('id', id);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('password_reset_tokens', error);
        nicheDb.markPasswordResetTokenUsed(id);
        return;
      }
      throw error;
    }
  },

  // --- PLATFORM SETTINGS ---
  async getPlatformSetting(key: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('platform_settings', error);
        return nicheDb.getPlatformSetting(key);
      }
      throw error;
    }
    return data?.value ?? null;
  },

  async setPlatformSetting(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({ key, value, updated_at: now }, { onConflict: 'key' });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('platform_settings', error);
        nicheDb.setPlatformSetting(key, value);
        return;
      }
      throw error;
    }
  },

  // --- SAAS PAYMENTS ---
  async createSaasPayment(data: {
    id: string;
    barbershop_id: string;
    plan_id: string;
    plan_name: string;
    amount: number;
    billing_cycle: string;
    payment_method: string;
    external_reference: string;
    mp_preference_id?: string | null;
    mp_payment_id?: string | null;
    status: string;
    days_added: number;
    paid_at?: string | null;
    created_at: string;
    updated_at: string;
  }): Promise<void> {
    const { error } = await supabaseAdmin.from('saas_payments').insert(data);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('saas_payments', error);
        nicheDb.createSaasPayment(data);
        return;
      }
      throw error;
    }
  },

  async updateSaasPayment(id: string, updates: Record<string, any>): Promise<void> {
    const payload = { ...updates, updated_at: updates.updated_at || new Date().toISOString() };
    const { error } = await supabaseAdmin.from('saas_payments').update(payload).eq('id', id);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('saas_payments', error);
        nicheDb.updateSaasPayment(id, payload);
        return;
      }
      throw error;
    }
  },

  async getSaasPaymentById(id: string): Promise<any | null> {
    const { data, error } = await supabaseAdmin.from('saas_payments').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('saas_payments', error);
        return nicheDb.getSaasPaymentById(id);
      }
      throw error;
    }
    return data || null;
  },

  async getSaasPaymentsByShop(barbershopId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('saas_payments')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('saas_payments', error);
        return nicheDb.getSaasPaymentsByShop(barbershopId);
      }
      throw error;
    }
    return data || [];
  },

  async getAllSaasPayments(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('saas_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('saas_payments', error);
        return nicheDb.getAllSaasPayments();
      }
      throw error;
    }
    return data || [];
  },

  async deleteClientsData(barbershopId: string, clientIds: string[]): Promise<void> {
    const cleanIds = Array.from(new Set(clientIds.map(id => String(id || '').trim()).filter(Boolean)));
    if (cleanIds.length === 0) return;

    const clientTables = [
      'client_clinical_notes',
      'patient_anamnesis',
      'aesthetics_anamnesis',
      'aesthetics_photos',
      'aesthetics_touchups',
      'client_pets',
      'client_vehicles',
      'client_style_preferences',
      'client_fitness_assessments',
      'client_tattoo_records',
      'client_creative_projects'
    ];

    for (const table of clientTables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('barbershop_id', barbershopId)
        .in('client_id', cleanIds);

      if (error && !isTableMissingOrUnmigrated(error)) {
        console.warn(`[CLOUD_DB_CLIENT_CLEANUP_WARN] ${table}:`, error.message);
      }
    }

    nicheDb.deleteClientsData(barbershopId, cleanIds);
  },

  async deleteShopData(barbershopId: string, userIds: string[] = []): Promise<void> {
    const shopTables = [
      'client_clinical_notes',
      'patient_anamnesis',
      'aesthetics_anamnesis',
      'aesthetics_photos',
      'aesthetics_touchups',
      'client_pets',
      'client_vehicles',
      'client_style_preferences',
      'client_fitness_assessments',
      'client_tattoo_records',
      'client_creative_projects',
      'appointment_notes',
      'entity_photos',
      'barber_metadata',
      'barber_accounts',
      'saas_payments',
      'whatsapp_integrations',
      'whatsapp_logs'
    ];

    for (const table of shopTables) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('barbershop_id', barbershopId);

      if (error && !isTableMissingOrUnmigrated(error)) {
        console.warn(`[CLOUD_DB_SHOP_CLEANUP_WARN] ${table}:`, error.message);
      }
    }

    const cleanUserIds = Array.from(new Set(userIds.map(id => String(id || '').trim()).filter(Boolean)));
    if (cleanUserIds.length > 0) {
      const { error } = await supabaseAdmin
        .from('password_reset_tokens')
        .delete()
        .in('user_id', cleanUserIds);

      if (error && !isTableMissingOrUnmigrated(error)) {
        console.warn('[CLOUD_DB_SHOP_CLEANUP_WARN] password_reset_tokens:', error.message);
      }
    }

    const { error: refDelErr } = await supabaseAdmin
      .from('affiliate_referrals')
      .delete()
      .eq('shop_id', barbershopId);
    if (refDelErr && !isTableMissingOrUnmigrated(refDelErr)) {
      console.warn('[CLOUD_DB_SHOP_CLEANUP_WARN] affiliate_referrals:', refDelErr.message);
    }

    const { error: commDelErr } = await supabaseAdmin
      .from('affiliate_commissions')
      .delete()
      .eq('shop_id', barbershopId)
      .neq('status', 'paid');
    if (commDelErr && !isTableMissingOrUnmigrated(commDelErr)) {
      console.warn('[CLOUD_DB_SHOP_CLEANUP_WARN] affiliate_commissions:', commDelErr.message);
    }

    nicheDb.deleteShopData(barbershopId, cleanUserIds);
  },

  // --- WHATSAPP INTEGRATIONS & LOGS (PART 6) ---
  async getWhatsAppIntegration(barbershopId: string): Promise<any | null> {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_integrations')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('whatsapp_integrations', error);
        return nicheDb.getWhatsAppIntegration(barbershopId);
      }
      throw error;
    }
    return data || null;
  },

  async getAllActiveWhatsAppReminderIntegrations(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_integrations')
      .select('*')
      .eq('connection_status', 'connected');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('whatsapp_integrations', error);
        return nicheDb.getAllActiveWhatsAppReminderIntegrations();
      }
      throw error;
    }
    return (data || []).filter((row: any) => Boolean(row.reminder_24h_enabled || row.reminder_2h_enabled));
  },

  async upsertWhatsAppIntegration(data: {
    barbershop_id: string;
    instance_name: string;
    provider?: string;
    connection_status?: string;
    connected_phone?: string | null;
    auto_confirm_enabled?: number;
    reminder_24h_enabled?: number;
    reminder_2h_enabled?: number;
    auto_cancel_enabled?: number;
    template_confirm: string;
    template_reminder_24h: string;
    template_reminder_2h: string;
    template_cancel: string;
  }): Promise<any> {
    const existing = await this.getWhatsAppIntegration(data.barbershop_id);
    const now = new Date().toISOString();
    const payload = {
      barbershop_id: data.barbershop_id,
      instance_name: data.instance_name || existing?.instance_name || `doiseme_${data.barbershop_id.slice(0, 8)}`,
      provider: data.provider || existing?.provider || 'evolution',
      connection_status: data.connection_status ?? existing?.connection_status ?? 'disconnected',
      connected_phone: data.connected_phone !== undefined ? data.connected_phone : (existing?.connected_phone ?? null),
      auto_confirm_enabled: data.auto_confirm_enabled ?? existing?.auto_confirm_enabled ?? 0,
      reminder_24h_enabled: data.reminder_24h_enabled ?? existing?.reminder_24h_enabled ?? 0,
      reminder_2h_enabled: data.reminder_2h_enabled ?? existing?.reminder_2h_enabled ?? 0,
      auto_cancel_enabled: data.auto_cancel_enabled ?? existing?.auto_cancel_enabled ?? 0,
      template_confirm: data.template_confirm,
      template_reminder_24h: data.template_reminder_24h,
      template_reminder_2h: data.template_reminder_2h,
      template_cancel: data.template_cancel,
      created_at: existing?.created_at || now,
      updated_at: now
    };

    const { error } = await supabaseAdmin
      .from('whatsapp_integrations')
      .upsert(payload, { onConflict: 'barbershop_id' });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('whatsapp_integrations', error);
        return nicheDb.upsertWhatsAppIntegration(payload);
      }
      throw error;
    }
    return payload;
  },

  async updateWhatsAppConnection(barbershopId: string, connectionStatus: string, connectedPhone?: string | null): Promise<void> {
    const updatePayload: Record<string, any> = {
      connection_status: connectionStatus,
      updated_at: new Date().toISOString()
    };
    if (connectedPhone !== undefined) {
      updatePayload.connected_phone = connectedPhone;
    }

    const { error } = await supabaseAdmin
      .from('whatsapp_integrations')
      .update(updatePayload)
      .eq('barbershop_id', barbershopId);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('whatsapp_integrations', error);
        nicheDb.updateWhatsAppConnection(barbershopId, connectionStatus, connectedPhone);
        return;
      }
      throw error;
    }
  },

  async createWhatsAppLog(log: {
    id: string;
    barbershop_id: string;
    appointment_id?: string | null;
    event_type: string;
    recipient_phone: string;
    recipient_name?: string | null;
    message_text: string;
    status: string;
    error_message?: string | null;
    provider_message_id?: string | null;
  }): Promise<void> {
    const payload = {
      ...log,
      appointment_id: log.appointment_id || null,
      recipient_name: log.recipient_name || null,
      error_message: log.error_message || null,
      provider_message_id: log.provider_message_id || null,
      created_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from('whatsapp_logs').insert(payload);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('whatsapp_logs', error);
        nicheDb.createWhatsAppLog(payload);
        return;
      }
      throw error;
    }
  },

  async getWhatsAppLogsByShop(barbershopId: string, limit = 30): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_logs')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('whatsapp_logs', error);
        return nicheDb.getWhatsAppLogsByShop(barbershopId, limit);
      }
      throw error;
    }
    return data || [];
  },

  async hasSentWhatsAppEvent(appointmentId: string, eventType: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_logs')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('event_type', eventType)
      .eq('status', 'sent')
      .limit(1);

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('whatsapp_logs', error);
        return nicheDb.hasSentWhatsAppEvent(appointmentId, eventType);
      }
      throw error;
    }
    return Boolean(data && data.length > 0);
  },

  async createSecurityLog(entry: {
    id: string;
    event_type: string;
    severity: string;
    ip?: string | null;
    method?: string | null;
    path?: string | null;
    user_id?: string | null;
    user_email?: string | null;
    barbershop_id?: string | null;
    details?: string | null;
  }): Promise<void> {
    const payload = {
      id: entry.id,
      event_type: entry.event_type,
      severity: entry.severity,
      ip: entry.ip || null,
      method: entry.method || null,
      path: entry.path || null,
      user_id: entry.user_id || null,
      user_email: entry.user_email || null,
      barbershop_id: entry.barbershop_id || null,
      details: entry.details || null,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabaseAdmin.from('security_logs').insert(payload);
      if (error) {
        if (isTableMissingOrUnmigrated(error)) {
          logFallbackOnce('security_logs', error);
        }
        nicheDb.createSecurityLog(payload);
      }
    } catch {
      nicheDb.createSecurityLog(payload);
    }
  },

  async getRecentSecurityLogs(limit = 100): Promise<any[]> {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
    try {
      const { data, error } = await supabaseAdmin
        .from('security_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(safeLimit);

      if (error) {
        if (isTableMissingOrUnmigrated(error)) {
          logFallbackOnce('security_logs', error);
          return nicheDb.getRecentSecurityLogs(safeLimit);
        }
        throw error;
      }
      return data || [];
    } catch {
      return nicheDb.getRecentSecurityLogs(safeLimit);
    }
  },

  // --- AFFILIATES & RECURRING COMMISSIONS ---
  async createAffiliate(data: Omit<AffiliateRecord, 'created_at' | 'updated_at'>): Promise<AffiliateRecord> {
    const now = new Date().toISOString();
    const record: AffiliateRecord = {
      ...data,
      email: String(data.email).trim().toLowerCase(),
      code: String(data.code).trim().toLowerCase(),
      phone_whatsapp: data.phone_whatsapp || null,
      pix_key: data.pix_key || null,
      niche: data.niche || null,
      notes: data.notes || null,
      active: data.active ?? 1,
      created_at: now,
      updated_at: now
    };

    const { error } = await supabaseAdmin.from('affiliates').insert(record);
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliates', error);
        return nicheDb.createAffiliate(data);
      }
      throw error;
    }
    return record;
  },

  async getAffiliateById(id: string): Promise<AffiliateRecord | null> {
    const { data, error } = await supabaseAdmin.from('affiliates').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliates', error);
        return nicheDb.getAffiliateById(id);
      }
      throw error;
    }
    return (data as AffiliateRecord) || null;
  },

  async getAffiliateByCode(code: string): Promise<AffiliateRecord | null> {
    const clean = String(code || '').trim().toLowerCase();
    if (!clean) return null;
    const { data, error } = await supabaseAdmin.from('affiliates').select('*').ilike('code', clean).maybeSingle();
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliates', error);
        return nicheDb.getAffiliateByCode(clean);
      }
      throw error;
    }
    return (data as AffiliateRecord) || null;
  },

  async getAffiliateByEmail(email: string): Promise<AffiliateRecord | null> {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return null;
    const { data, error } = await supabaseAdmin.from('affiliates').select('*').ilike('email', clean).maybeSingle();
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliates', error);
        return nicheDb.getAffiliateByEmail(clean);
      }
      throw error;
    }
    return (data as AffiliateRecord) || null;
  },

  async listAffiliates(): Promise<AffiliateRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliates', error);
        return nicheDb.listAffiliates();
      }
      throw error;
    }
    return (data || []) as AffiliateRecord[];
  },

  async updateAffiliate(
    id: string,
    updates: Partial<Omit<AffiliateRecord, 'id' | 'created_at'>>
  ): Promise<AffiliateRecord | null> {
    const allowed = [
      'name',
      'email',
      'password_hash',
      'phone_whatsapp',
      'pix_key',
      'code',
      'commission_rate',
      'niche',
      'notes',
      'active'
    ];
    const payload: Record<string, any> = {
      updated_at: updates.updated_at || new Date().toISOString()
    };
    for (const [k, v] of Object.entries(updates)) {
      if (!allowed.includes(k) || v === undefined) continue;
      if (k === 'email' || k === 'code') {
        payload[k] = String(v).trim().toLowerCase();
      } else {
        payload[k] = v;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('affiliates')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliates', error);
        return nicheDb.updateAffiliate(id, payload);
      }
      throw error;
    }
    return (data as AffiliateRecord) || null;
  },

  async deleteAffiliate(id: string): Promise<boolean> {
    const { data: deleted, error } = await supabaseAdmin
      .from('affiliates')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliates', error);
        return nicheDb.deleteAffiliate(id);
      }
      throw error;
    }

    const { error: refErr } = await supabaseAdmin.from('affiliate_referrals').delete().eq('affiliate_id', id);
    if (refErr && !isTableMissingOrUnmigrated(refErr)) {
      console.warn('[AFFILIATE_DELETE_REF_WARN]', refErr.message);
    }
    const { error: commErr } = await supabaseAdmin
      .from('affiliate_commissions')
      .delete()
      .eq('affiliate_id', id)
      .neq('status', 'paid');
    if (commErr && !isTableMissingOrUnmigrated(commErr)) {
      console.warn('[AFFILIATE_DELETE_COMM_WARN]', commErr.message);
    }

    const wasDeleted = Boolean(deleted && deleted.length > 0);
    if (wasDeleted) {
      try {
        await this.removeAffiliateClickStats(id);
      } catch (clickErr: any) {
        console.warn('[AFFILIATE_DELETE_CLICK_WARN]', clickErr?.message || clickErr);
      }
    }

    return wasDeleted;
  },

  async createReferralAttribution(
    data: Omit<AffiliateReferralRecord, 'created_at'> & { created_at?: string }
  ): Promise<AffiliateReferralRecord> {
    const existing = await this.getReferralByShopId(data.shop_id);
    if (existing) return existing;

    const record: AffiliateReferralRecord = {
      shop_id: data.shop_id,
      affiliate_id: data.affiliate_id,
      affiliate_code: String(data.affiliate_code).trim().toLowerCase(),
      referred_email: data.referred_email || null,
      created_at: data.created_at || new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from('affiliate_referrals')
      .upsert(record, { onConflict: 'shop_id', ignoreDuplicates: true });

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliate_referrals', error);
        return nicheDb.createReferralAttribution(record);
      }
      throw error;
    }
    return (await this.getReferralByShopId(data.shop_id)) || record;
  },

  async getReferralByShopId(shopId: string): Promise<AffiliateReferralRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('affiliate_referrals')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliate_referrals', error);
        return nicheDb.getReferralByShopId(shopId);
      }
      throw error;
    }
    return (data as AffiliateReferralRecord) || null;
  },

  async listReferralsByAffiliateId(affiliateId: string): Promise<AffiliateReferralRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('affiliate_referrals')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliate_referrals', error);
        return nicheDb.listReferralsByAffiliateId(affiliateId);
      }
      throw error;
    }
    return (data || []) as AffiliateReferralRecord[];
  },

  async listAllReferrals(): Promise<AffiliateReferralRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('affiliate_referrals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliate_referrals', error);
        return nicheDb.listAllReferrals();
      }
      throw error;
    }
    return (data || []) as AffiliateReferralRecord[];
  },

  async createAffiliateCommissionIdempotent(
    data: Omit<AffiliateCommissionRecord, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
  ): Promise<{ created: boolean; commission: AffiliateCommissionRecord }> {
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from('affiliate_commissions')
      .select('*')
      .eq('payment_id', data.payment_id)
      .maybeSingle();

    if (lookupErr) {
      if (isTableMissingOrUnmigrated(lookupErr)) {
        logFallbackOnce('affiliate_commissions', lookupErr);
        return nicheDb.createAffiliateCommissionIdempotent(data);
      }
      throw lookupErr;
    }

    if (existing) {
      return { created: false, commission: existing as AffiliateCommissionRecord };
    }

    const now = new Date().toISOString();
    const record: AffiliateCommissionRecord = {
      ...data,
      paid_at: data.paid_at || null,
      payout_reference: data.payout_reference || null,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now
    };

    const { error: insertErr } = await supabaseAdmin
      .from('affiliate_commissions')
      .upsert(record, { onConflict: 'payment_id', ignoreDuplicates: true });

    if (insertErr) {
      if (isTableMissingOrUnmigrated(insertErr)) {
        logFallbackOnce('affiliate_commissions', insertErr);
        return nicheDb.createAffiliateCommissionIdempotent(record);
      }
      throw insertErr;
    }

    return { created: true, commission: record };
  },

  async promoteMaturedCommissions(nowIso = new Date().toISOString()): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('affiliate_commissions')
      .update({ status: 'available', updated_at: nowIso })
      .eq('status', 'pending')
      .lte('available_at', nowIso)
      .select('id');

    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliate_commissions', error);
        return nicheDb.promoteMaturedCommissions(nowIso);
      }
      throw error;
    }
    return (data || []).length;
  },

  async listAffiliateCommissions(affiliateId?: string, limit = 500): Promise<AffiliateCommissionRecord[]> {
    const safeLimit = Math.max(1, Math.min(2000, Math.floor(Number(limit) || 500)));
    let query = supabaseAdmin
      .from('affiliate_commissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (affiliateId) {
      query = query.eq('affiliate_id', affiliateId);
    }

    const { data, error } = await query;
    if (error) {
      if (isTableMissingOrUnmigrated(error)) {
        logFallbackOnce('affiliate_commissions', error);
        return nicheDb.listAffiliateCommissions(affiliateId, safeLimit);
      }
      throw error;
    }
    return (data || []) as AffiliateCommissionRecord[];
  },

  async markAffiliateCommissionsPaid(
    affiliateId: string,
    options?: { includePending?: boolean; payoutReference?: string | null }
  ): Promise<{ count: number; totalAmount: number }> {
    const now = new Date().toISOString();
    const statuses = options?.includePending ? ['available', 'pending'] : ['available'];

    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from('affiliate_commissions')
      .select('id, commission_amount')
      .eq('affiliate_id', affiliateId)
      .in('status', statuses);

    if (fetchErr) {
      if (isTableMissingOrUnmigrated(fetchErr)) {
        logFallbackOnce('affiliate_commissions', fetchErr);
        return nicheDb.markAffiliateCommissionsPaid(affiliateId, options);
      }
      throw fetchErr;
    }

    const list = (rows || []) as Array<{ id: string; commission_amount: number }>;
    if (!list.length) return { count: 0, totalAmount: 0 };

    const totalAmount = Number(
      list.reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0).toFixed(2)
    );

    const { error: updErr } = await supabaseAdmin
      .from('affiliate_commissions')
      .update({
        status: 'paid',
        paid_at: now,
        payout_reference: options?.payoutReference || null,
        updated_at: now
      })
      .eq('affiliate_id', affiliateId)
      .in('status', statuses);

    if (updErr) {
      if (isTableMissingOrUnmigrated(updErr)) {
        logFallbackOnce('affiliate_commissions', updErr);
        return nicheDb.markAffiliateCommissionsPaid(affiliateId, options);
      }
      throw updErr;
    }

    return { count: list.length, totalAmount };
  },

  async getAffiliateClicksMap(): Promise<
    Record<string, { totalClicks: number; uniqueClicks: number; lastClickedAt: string | null }>
  > {
    try {
      const raw = await this.getPlatformSetting('affiliate_clicks_map');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const result: Record<string, { totalClicks: number; uniqueClicks: number; lastClickedAt: string | null }> = {};
      for (const [affId, entry] of Object.entries(parsed as Record<string, any>)) {
        if (!entry || typeof entry !== 'object') continue;
        result[affId] = {
          totalClicks: Math.max(0, Math.floor(Number(entry.totalClicks) || 0)),
          uniqueClicks: Math.max(0, Math.floor(Number(entry.uniqueClicks) || 0)),
          lastClickedAt: typeof entry.lastClickedAt === 'string' ? entry.lastClickedAt : null
        };
      }
      return result;
    } catch {
      return {};
    }
  },

  async recordAffiliateClick(
    affiliateId: string,
    visitorHash?: string | null
  ): Promise<{ totalClicks: number; uniqueClicks: number; lastClickedAt: string | null }> {
    const runTask = affiliateClickWriteLock.then(async () => {
      let map: Record<
        string,
        {
          totalClicks: number;
          uniqueClicks: number;
          recentVisitorHashes: string[];
          lastClickedAt: string | null;
        }
      > = {};

      try {
        const raw = await this.getPlatformSetting('affiliate_clicks_map');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            map = parsed;
          }
        }
      } catch {
        map = {};
      }

      const existing = map[affiliateId] || {
        totalClicks: 0,
        uniqueClicks: 0,
        recentVisitorHashes: [],
        lastClickedAt: null
      };

      const hashes = Array.isArray(existing.recentVisitorHashes) ? [...existing.recentVisitorHashes] : [];
      const cleanHash = typeof visitorHash === 'string' && visitorHash.trim() ? visitorHash.trim().slice(0, 48) : '';
      let isUnique = true;
      if (cleanHash) {
        if (hashes.includes(cleanHash)) {
          isUnique = false;
        } else {
          hashes.push(cleanHash);
          if (hashes.length > 1000) {
            hashes.splice(0, hashes.length - 1000);
          }
        }
      }

      const now = new Date().toISOString();
      const updatedEntry = {
        totalClicks: Math.max(0, Math.floor(Number(existing.totalClicks) || 0)) + 1,
        uniqueClicks: Math.max(0, Math.floor(Number(existing.uniqueClicks) || 0)) + (isUnique ? 1 : 0),
        recentVisitorHashes: hashes,
        lastClickedAt: now
      };

      map[affiliateId] = updatedEntry;
      await this.setPlatformSetting('affiliate_clicks_map', JSON.stringify(map));

      return {
        totalClicks: updatedEntry.totalClicks,
        uniqueClicks: updatedEntry.uniqueClicks,
        lastClickedAt: updatedEntry.lastClickedAt
      };
    });

    affiliateClickWriteLock = runTask.catch(() => {});
    return runTask;
  },

  async removeAffiliateClickStats(affiliateId: string): Promise<void> {
    const runTask = affiliateClickWriteLock.then(async () => {
      try {
        const raw = await this.getPlatformSetting('affiliate_clicks_map');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && affiliateId in parsed) {
          delete parsed[affiliateId];
          await this.setPlatformSetting('affiliate_clicks_map', JSON.stringify(parsed));
        }
      } catch {
        // Ignore cleanup errors
      }
    });
    affiliateClickWriteLock = runTask.catch(() => {});
    return runTask;
  },

  async getSalesChannelMetricsMap(): Promise<
    Record<
      string,
      {
        totalVisits: number;
        uniqueVisits: number;
        totalClicks: number;
        uniqueClicks: number;
        byPlanClicks: Record<string, number>;
        lastVisitedAt: string | null;
        lastClickedAt: string | null;
      }
    >
  > {
    try {
      const raw = await this.getPlatformSetting('sales_channel_metrics_map');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const result: Record<string, any> = {};
      for (const [channel, entry] of Object.entries(parsed as Record<string, any>)) {
        if (!entry || typeof entry !== 'object') continue;
        const rawByPlan = entry.byPlanClicks && typeof entry.byPlanClicks === 'object' ? entry.byPlanClicks : {};
        const byPlanClicks: Record<string, number> = {};
        for (const [k, v] of Object.entries(rawByPlan)) {
          byPlanClicks[k] = Math.max(0, Math.floor(Number(v) || 0));
        }
        result[channel] = {
          totalVisits: Math.max(0, Math.floor(Number(entry.totalVisits) || 0)),
          uniqueVisits: Math.max(0, Math.floor(Number(entry.uniqueVisits) || 0)),
          totalClicks: Math.max(0, Math.floor(Number(entry.totalClicks) || 0)),
          uniqueClicks: Math.max(0, Math.floor(Number(entry.uniqueClicks) || 0)),
          byPlanClicks,
          lastVisitedAt: typeof entry.lastVisitedAt === 'string' ? entry.lastVisitedAt : null,
          lastClickedAt: typeof entry.lastClickedAt === 'string' ? entry.lastClickedAt : null
        };
      }
      return result;
    } catch {
      return {};
    }
  },

  async recordSalesChannelEvent(
    channel: string,
    eventType: 'visit' | 'click',
    visitorHash?: string | null,
    planKey?: string | null
  ): Promise<void> {
    const runTask = salesChannelMetricsWriteLock.then(async () => {
      let map: Record<string, any> = {};
      try {
        const raw = await this.getPlatformSetting('sales_channel_metrics_map');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            map = parsed;
          }
        }
      } catch {
        map = {};
      }

      const existing = map[channel] || {
        totalVisits: 0,
        uniqueVisits: 0,
        totalClicks: 0,
        uniqueClicks: 0,
        byPlanClicks: {},
        recentVisitHashes: [],
        recentClickHashes: [],
        lastVisitedAt: null,
        lastClickedAt: null
      };

      const cleanHash = typeof visitorHash === 'string' && visitorHash.trim() ? visitorHash.trim().slice(0, 48) : '';
      const now = new Date().toISOString();

      if (eventType === 'visit') {
        const hashes = Array.isArray(existing.recentVisitHashes) ? [...existing.recentVisitHashes] : [];
        let isUnique = true;
        if (cleanHash) {
          if (hashes.includes(cleanHash)) {
            isUnique = false;
          } else {
            hashes.push(cleanHash);
            if (hashes.length > 1000) hashes.splice(0, hashes.length - 1000);
          }
        }
        existing.totalVisits = Math.max(0, Math.floor(Number(existing.totalVisits) || 0)) + 1;
        existing.uniqueVisits = Math.max(0, Math.floor(Number(existing.uniqueVisits) || 0)) + (isUnique ? 1 : 0);
        existing.recentVisitHashes = hashes;
        existing.lastVisitedAt = now;
      } else {
        const hashes = Array.isArray(existing.recentClickHashes) ? [...existing.recentClickHashes] : [];
        let isUnique = true;
        if (cleanHash) {
          if (hashes.includes(cleanHash)) {
            isUnique = false;
          } else {
            hashes.push(cleanHash);
            if (hashes.length > 1000) hashes.splice(0, hashes.length - 1000);
          }
        }
        existing.totalClicks = Math.max(0, Math.floor(Number(existing.totalClicks) || 0)) + 1;
        existing.uniqueClicks = Math.max(0, Math.floor(Number(existing.uniqueClicks) || 0)) + (isUnique ? 1 : 0);
        existing.recentClickHashes = hashes;
        existing.lastClickedAt = now;

        const cleanPlan = typeof planKey === 'string' ? planKey.trim().slice(0, 48) : '';
        if (cleanPlan) {
          const prevPlan = existing.byPlanClicks && typeof existing.byPlanClicks === 'object' ? existing.byPlanClicks : {};
          prevPlan[cleanPlan] = Math.max(0, Math.floor(Number(prevPlan[cleanPlan]) || 0)) + 1;
          existing.byPlanClicks = prevPlan;
        }
      }

      map[channel] = existing;
      await this.setPlatformSetting('sales_channel_metrics_map', JSON.stringify(map));
    });

    salesChannelMetricsWriteLock = runTask.catch(() => {});
    return runTask;
  }
};
