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
  ClientCreativeProject
} from './nicheDb.js';

const warnedTables = new Set<string>();

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
  'password_reset_tokens',
  'platform_settings',
  'saas_payments'
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
  password_reset_tokens: 'id',
  platform_settings: 'key',
  saas_payments: 'id'
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
      .limit(50);
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
      'saas_payments'
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

    nicheDb.deleteShopData(barbershopId, cleanUserIds);
  }
};
