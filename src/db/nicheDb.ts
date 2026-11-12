import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'niche_records.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  -- Psychology & General Notes
  CREATE TABLE IF NOT EXISTS client_clinical_notes (
    id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    author_name TEXT,
    session_date TEXT NOT NULL,
    session_time TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    patient_mood TEXT,
    therapeutic_goals TEXT,
    techniques_used TEXT,
    is_private INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_clinical_notes_client 
  ON client_clinical_notes (barbershop_id, client_id, session_date DESC);

  CREATE TABLE IF NOT EXISTS patient_anamnesis (
    client_id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    chief_complaint TEXT,
    history_of_problem TEXT,
    family_medical_history TEXT,
    current_medications TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL
  );

  -- Aesthetics & Beauty Specialized Tables
  CREATE TABLE IF NOT EXISTS aesthetics_anamnesis (
    client_id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    skin_phototype TEXT,
    skin_type TEXT,
    allergies TEXT,
    contraindications TEXT,
    main_complaints TEXT,
    home_care_routine TEXT,
    treatment_plan TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS aesthetics_photos (
    id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    procedure_name TEXT NOT NULL,
    date TEXT NOT NULL,
    before_photo_url TEXT,
    after_photo_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_aesthetics_photos_client
  ON aesthetics_photos (barbershop_id, client_id, date DESC);

  CREATE TABLE IF NOT EXISTS aesthetics_touchups (
    id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    procedure_name TEXT NOT NULL,
    performed_date TEXT NOT NULL,
    return_due_date TEXT NOT NULL,
    interval_days INTEGER DEFAULT 15,
    status TEXT DEFAULT 'pending', -- pending, contacted, completed
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_aesthetics_touchups_client
  ON aesthetics_touchups (barbershop_id, client_id, return_due_date ASC);

  -- Pet Shop & Banho e Tosa
  CREATE TABLE IF NOT EXISTS client_pets (
    id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    pet_name TEXT NOT NULL,
    species TEXT NOT NULL DEFAULT 'Cão',
    breed TEXT,
    size TEXT,
    coat_type TEXT,
    birth_year TEXT,
    temperament TEXT,
    allergies_medical TEXT,
    special_instructions TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_client_pets_client
  ON client_pets (barbershop_id, client_id);

  -- Oficina & Estética Automotiva
  CREATE TABLE IF NOT EXISTS client_vehicles (
    id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    plate TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year TEXT,
    color TEXT,
    current_km INTEGER,
    next_oil_change_km INTEGER,
    fuel_level TEXT,
    pre_existing_damages TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_client_vehicles_client
  ON client_vehicles (barbershop_id, client_id);

  -- Barbearia & Salão (Coloração, Fade, Lâminas)
  CREATE TABLE IF NOT EXISTS client_style_preferences (
    client_id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    hair_cut_style TEXT,
    beard_style TEXT,
    blade_sizes TEXT,
    hair_color_formula TEXT,
    shampoo_preference TEXT,
    aftershave_allergies TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL
  );

  -- Personal Trainer & Pilates & Nutrição (Avaliação física, medidas, prescrição)
  CREATE TABLE IF NOT EXISTS client_fitness_assessments (
    id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    assessment_date TEXT NOT NULL,
    weight_kg REAL,
    height_cm REAL,
    body_fat_pct REAL,
    muscle_mass_kg REAL,
    chest_cm REAL,
    waist_cm REAL,
    abdomen_cm REAL,
    hips_cm REAL,
    arms_cm REAL,
    thighs_cm REAL,
    physical_restrictions TEXT,
    training_goal TEXT,
    workout_prescription TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_fitness_assessments_client
  ON client_fitness_assessments (barbershop_id, client_id, assessment_date DESC);

  -- Tattoo & Piercing (Biossegurança, lote de agulhas, pigmentos, cicatrização)
  CREATE TABLE IF NOT EXISTS client_tattoo_records (
    id TEXT PRIMARY KEY,
    barbershop_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    title TEXT NOT NULL,
    placement TEXT NOT NULL,
    style TEXT,
    needle_batch TEXT,
    ink_batch TEXT,
    session_date TEXT NOT NULL,
    healing_stage TEXT DEFAULT 'Recente',
    consent_signed INTEGER DEFAULT 1,
    aftercare_instructions TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tattoo_records_client
  ON client_tattoo_records (barbershop_id, client_id, session_date DESC);

  -- Entity Photos for Professionals (Barbers) and Services / Procedures
  CREATE TABLE IF NOT EXISTS entity_photos (
    entity_id TEXT PRIMARY KEY,
    barbershop_id TEXT,
    entity_type TEXT NOT NULL, -- 'barber' or 'service'
    photo_url TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_entity_photos_type
  ON entity_photos (entity_type, barbershop_id);

  -- Barber / Professional Metadata (e.g. commission percentage, etc.)
  CREATE TABLE IF NOT EXISTS barber_metadata (
    barber_id TEXT PRIMARY KEY,
    barbershop_id TEXT,
    commission_percentage REAL DEFAULT 50,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_barber_meta_shop
  ON barber_metadata (barbershop_id);
`);

export interface ClinicalNote {
  id: string;
  barbershop_id: string;
  client_id: string;
  author_name?: string;
  session_date: string;
  session_time?: string;
  title: string;
  content: string;
  patient_mood?: string;
  therapeutic_goals?: string;
  techniques_used?: string;
  is_private?: number;
  created_at: string;
  updated_at: string;
}

export interface PatientAnamnesis {
  client_id: string;
  barbershop_id: string;
  chief_complaint?: string;
  history_of_problem?: string;
  family_medical_history?: string;
  current_medications?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  updated_at: string;
}

export interface AestheticsAnamnesis {
  client_id: string;
  barbershop_id: string;
  skin_phototype?: string;
  skin_type?: string;
  allergies?: string;
  contraindications?: string;
  main_complaints?: string;
  home_care_routine?: string;
  treatment_plan?: string;
  notes?: string;
  updated_at: string;
}

export interface AestheticsPhoto {
  id: string;
  barbershop_id: string;
  client_id: string;
  procedure_name: string;
  date: string;
  before_photo_url?: string;
  after_photo_url?: string;
  notes?: string;
  created_at: string;
}

export interface AestheticsTouchup {
  id: string;
  barbershop_id: string;
  client_id: string;
  procedure_name: string;
  performed_date: string;
  return_due_date: string;
  interval_days?: number;
  status: 'pending' | 'contacted' | 'completed';
  notes?: string;
  created_at: string;
}

export interface ClientPet {
  id: string;
  barbershop_id: string;
  client_id: string;
  pet_name: string;
  species: string;
  breed?: string;
  size?: string;
  coat_type?: string;
  birth_year?: string;
  temperament?: string;
  allergies_medical?: string;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientVehicle {
  id: string;
  barbershop_id: string;
  client_id: string;
  plate: string;
  brand: string;
  model: string;
  year?: string;
  color?: string;
  current_km?: number;
  next_oil_change_km?: number;
  fuel_level?: string;
  pre_existing_damages?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientStylePreference {
  client_id: string;
  barbershop_id: string;
  hair_cut_style?: string;
  beard_style?: string;
  blade_sizes?: string;
  hair_color_formula?: string;
  shampoo_preference?: string;
  aftershave_allergies?: string;
  notes?: string;
  updated_at: string;
}

export interface ClientFitnessAssessment {
  id: string;
  barbershop_id: string;
  client_id: string;
  assessment_date: string;
  weight_kg?: number;
  height_cm?: number;
  body_fat_pct?: number;
  muscle_mass_kg?: number;
  chest_cm?: number;
  waist_cm?: number;
  abdomen_cm?: number;
  hips_cm?: number;
  arms_cm?: number;
  thighs_cm?: number;
  physical_restrictions?: string;
  training_goal?: string;
  workout_prescription?: string;
  notes?: string;
  created_at: string;
}

export interface ClientTattooRecord {
  id: string;
  barbershop_id: string;
  client_id: string;
  title: string;
  placement: string;
  style?: string;
  needle_batch?: string;
  ink_batch?: string;
  session_date: string;
  healing_stage?: string;
  consent_signed?: number;
  aftercare_instructions?: string;
  notes?: string;
  created_at: string;
}

export const nicheDb = {
  // --- CLINICAL NOTES ---
  getNotesByClient(barbershopId: string, clientId: string): ClinicalNote[] {
    const stmt = db.prepare(`
      SELECT * FROM client_clinical_notes 
      WHERE barbershop_id = ? AND client_id = ? 
      ORDER BY session_date DESC, created_at DESC
    `);
    return stmt.all(barbershopId, clientId) as ClinicalNote[];
  },

  createNote(note: Omit<ClinicalNote, 'created_at' | 'updated_at'>): ClinicalNote {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO client_clinical_notes (
        id, barbershop_id, client_id, author_name, session_date, session_time,
        title, content, patient_mood, therapeutic_goals, techniques_used,
        is_private, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      note.id,
      note.barbershop_id,
      note.client_id,
      note.author_name || null,
      note.session_date,
      note.session_time || null,
      note.title,
      note.content,
      note.patient_mood || null,
      note.therapeutic_goals || null,
      note.techniques_used || null,
      note.is_private ?? 1,
      now,
      now
    );

    return {
      ...note,
      created_at: now,
      updated_at: now
    };
  },

  updateNote(
    id: string,
    barbershopId: string,
    data: Partial<Omit<ClinicalNote, 'id' | 'barbershop_id' | 'client_id' | 'created_at' | 'updated_at'>>
  ): boolean {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE client_clinical_notes SET
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        session_date = COALESCE(?, session_date),
        session_time = COALESCE(?, session_time),
        patient_mood = COALESCE(?, patient_mood),
        therapeutic_goals = COALESCE(?, therapeutic_goals),
        techniques_used = COALESCE(?, techniques_used),
        is_private = COALESCE(?, is_private),
        updated_at = ?
      WHERE id = ? AND barbershop_id = ?
    `);

    const res = stmt.run(
      data.title ?? null,
      data.content ?? null,
      data.session_date ?? null,
      data.session_time ?? null,
      data.patient_mood ?? null,
      data.therapeutic_goals ?? null,
      data.techniques_used ?? null,
      data.is_private ?? null,
      now,
      id,
      barbershopId
    );

    return res.changes > 0;
  },

  deleteNote(id: string, barbershopId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM client_clinical_notes 
      WHERE id = ? AND barbershop_id = ?
    `);
    const res = stmt.run(id, barbershopId);
    return res.changes > 0;
  },

  // --- PSYCHOLOGY ANAMNESIS ---
  getAnamnesis(barbershopId: string, clientId: string): PatientAnamnesis | null {
    const stmt = db.prepare(`
      SELECT * FROM patient_anamnesis 
      WHERE barbershop_id = ? AND client_id = ?
    `);
    const row = stmt.get(barbershopId, clientId);
    return (row as PatientAnamnesis) || null;
  },

  upsertAnamnesis(data: Omit<PatientAnamnesis, 'updated_at'>): PatientAnamnesis {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO patient_anamnesis (
        client_id, barbershop_id, chief_complaint, history_of_problem,
        family_medical_history, current_medications, emergency_contact_name,
        emergency_contact_phone, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        chief_complaint = excluded.chief_complaint,
        history_of_problem = excluded.history_of_problem,
        family_medical_history = excluded.family_medical_history,
        current_medications = excluded.current_medications,
        emergency_contact_name = excluded.emergency_contact_name,
        emergency_contact_phone = excluded.emergency_contact_phone,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      data.client_id,
      data.barbershop_id,
      data.chief_complaint || null,
      data.history_of_problem || null,
      data.family_medical_history || null,
      data.current_medications || null,
      data.emergency_contact_name || null,
      data.emergency_contact_phone || null,
      data.notes || null,
      now
    );

    return {
      ...data,
      updated_at: now
    };
  },

  // --- AESTHETICS ANAMNESIS ---
  getAestheticsAnamnesis(barbershopId: string, clientId: string): AestheticsAnamnesis | null {
    const stmt = db.prepare(`
      SELECT * FROM aesthetics_anamnesis 
      WHERE barbershop_id = ? AND client_id = ?
    `);
    const row = stmt.get(barbershopId, clientId);
    return (row as AestheticsAnamnesis) || null;
  },

  upsertAestheticsAnamnesis(data: Omit<AestheticsAnamnesis, 'updated_at'>): AestheticsAnamnesis {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO aesthetics_anamnesis (
        client_id, barbershop_id, skin_phototype, skin_type, allergies,
        contraindications, main_complaints, home_care_routine, treatment_plan,
        notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        skin_phototype = excluded.skin_phototype,
        skin_type = excluded.skin_type,
        allergies = excluded.allergies,
        contraindications = excluded.contraindications,
        main_complaints = excluded.main_complaints,
        home_care_routine = excluded.home_care_routine,
        treatment_plan = excluded.treatment_plan,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      data.client_id,
      data.barbershop_id,
      data.skin_phototype || null,
      data.skin_type || null,
      data.allergies || null,
      data.contraindications || null,
      data.main_complaints || null,
      data.home_care_routine || null,
      data.treatment_plan || null,
      data.notes || null,
      now
    );

    return {
      ...data,
      updated_at: now
    };
  },

  // --- AESTHETICS PHOTOS (BEFORE & AFTER) ---
  getAestheticsPhotos(barbershopId: string, clientId: string): AestheticsPhoto[] {
    const stmt = db.prepare(`
      SELECT * FROM aesthetics_photos 
      WHERE barbershop_id = ? AND client_id = ? 
      ORDER BY date DESC, created_at DESC
    `);
    return stmt.all(barbershopId, clientId) as AestheticsPhoto[];
  },

  addAestheticsPhoto(data: Omit<AestheticsPhoto, 'created_at'>): AestheticsPhoto {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO aesthetics_photos (
        id, barbershop_id, client_id, procedure_name, date,
        before_photo_url, after_photo_url, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.barbershop_id,
      data.client_id,
      data.procedure_name,
      data.date,
      data.before_photo_url || null,
      data.after_photo_url || null,
      data.notes || null,
      now
    );

    return {
      ...data,
      created_at: now
    };
  },

  deleteAestheticsPhoto(id: string, barbershopId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM aesthetics_photos 
      WHERE id = ? AND barbershop_id = ?
    `);
    const res = stmt.run(id, barbershopId);
    return res.changes > 0;
  },

  // --- AESTHETICS TOUCHUP & RETURN CYCLES ---
  getAestheticsTouchups(barbershopId: string, clientId?: string): AestheticsTouchup[] {
    let sql = `
      SELECT * FROM aesthetics_touchups 
      WHERE barbershop_id = ?
    `;
    const params: any[] = [barbershopId];

    if (clientId) {
      sql += ` AND client_id = ?`;
      params.push(clientId);
    }

    sql += ` ORDER BY return_due_date ASC`;
    const stmt = db.prepare(sql);
    return stmt.all(...params) as AestheticsTouchup[];
  },

  createAestheticsTouchup(data: Omit<AestheticsTouchup, 'created_at'>): AestheticsTouchup {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO aesthetics_touchups (
        id, barbershop_id, client_id, procedure_name, performed_date,
        return_due_date, interval_days, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.barbershop_id,
      data.client_id,
      data.procedure_name,
      data.performed_date,
      data.return_due_date,
      data.interval_days || 15,
      data.status || 'pending',
      data.notes || null,
      now
    );

    return {
      ...data,
      created_at: now
    };
  },

  updateAestheticsTouchupStatus(id: string, barbershopId: string, status: 'pending' | 'contacted' | 'completed'): boolean {
    const stmt = db.prepare(`
      UPDATE aesthetics_touchups 
      SET status = ? 
      WHERE id = ? AND barbershop_id = ?
    `);
    const res = stmt.run(status, id, barbershopId);
    return res.changes > 0;
  },

  deleteAestheticsTouchup(id: string, barbershopId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM aesthetics_touchups 
      WHERE id = ? AND barbershop_id = ?
    `);
    const res = stmt.run(id, barbershopId);
    return res.changes > 0;
  },

  // --- PET SHOP & BANHO E TOSA ---
  getPets(barbershopId: string, clientId: string): ClientPet[] {
    const stmt = db.prepare(`
      SELECT * FROM client_pets 
      WHERE barbershop_id = ? AND client_id = ? 
      ORDER BY pet_name ASC
    `);
    return stmt.all(barbershopId, clientId) as ClientPet[];
  },

  createPet(data: Omit<ClientPet, 'created_at' | 'updated_at'>): ClientPet {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO client_pets (
        id, barbershop_id, client_id, pet_name, species, breed, size,
        coat_type, birth_year, temperament, allergies_medical, special_instructions,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.barbershop_id,
      data.client_id,
      data.pet_name,
      data.species || 'Cão',
      data.breed || null,
      data.size || null,
      data.coat_type || null,
      data.birth_year || null,
      data.temperament || null,
      data.allergies_medical || null,
      data.special_instructions || null,
      now,
      now
    );

    return {
      ...data,
      created_at: now,
      updated_at: now
    };
  },

  deletePet(id: string, barbershopId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM client_pets 
      WHERE id = ? AND barbershop_id = ?
    `);
    const res = stmt.run(id, barbershopId);
    return res.changes > 0;
  },

  // --- OFICINA & ESTÉTICA AUTOMOTIVA ---
  getVehicles(barbershopId: string, clientId: string): ClientVehicle[] {
    const stmt = db.prepare(`
      SELECT * FROM client_vehicles 
      WHERE barbershop_id = ? AND client_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(barbershopId, clientId) as ClientVehicle[];
  },

  createVehicle(data: Omit<ClientVehicle, 'created_at' | 'updated_at'>): ClientVehicle {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO client_vehicles (
        id, barbershop_id, client_id, plate, brand, model, year, color,
        current_km, next_oil_change_km, fuel_level, pre_existing_damages,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.barbershop_id,
      data.client_id,
      data.plate.toUpperCase(),
      data.brand,
      data.model,
      data.year || null,
      data.color || null,
      data.current_km ?? null,
      data.next_oil_change_km ?? null,
      data.fuel_level || null,
      data.pre_existing_damages || null,
      data.notes || null,
      now,
      now
    );

    return {
      ...data,
      created_at: now,
      updated_at: now
    };
  },

  deleteVehicle(id: string, barbershopId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM client_vehicles 
      WHERE id = ? AND barbershop_id = ?
    `);
    const res = stmt.run(id, barbershopId);
    return res.changes > 0;
  },

  // --- BARBEARIA & SALÃO (PREFERÊNCIAS & COLORAÇÃO) ---
  getStylePreferences(barbershopId: string, clientId: string): ClientStylePreference | null {
    const stmt = db.prepare(`
      SELECT * FROM client_style_preferences 
      WHERE barbershop_id = ? AND client_id = ?
    `);
    const row = stmt.get(barbershopId, clientId);
    return (row as ClientStylePreference) || null;
  },

  upsertStylePreferences(data: Omit<ClientStylePreference, 'updated_at'>): ClientStylePreference {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO client_style_preferences (
        client_id, barbershop_id, hair_cut_style, beard_style,
        blade_sizes, hair_color_formula, shampoo_preference,
        aftershave_allergies, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        hair_cut_style = excluded.hair_cut_style,
        beard_style = excluded.beard_style,
        blade_sizes = excluded.blade_sizes,
        hair_color_formula = excluded.hair_color_formula,
        shampoo_preference = excluded.shampoo_preference,
        aftershave_allergies = excluded.aftershave_allergies,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      data.client_id,
      data.barbershop_id,
      data.hair_cut_style || null,
      data.beard_style || null,
      data.blade_sizes || null,
      data.hair_color_formula || null,
      data.shampoo_preference || null,
      data.aftershave_allergies || null,
      data.notes || null,
      now
    );

    return {
      ...data,
      updated_at: now
    };
  },

  // --- PERSONAL TRAINER & PILATES (ANTROPOMETRIA & TREINOS) ---
  getFitnessAssessments(barbershopId: string, clientId: string): ClientFitnessAssessment[] {
    const stmt = db.prepare(`
      SELECT * FROM client_fitness_assessments 
      WHERE barbershop_id = ? AND client_id = ? 
      ORDER BY assessment_date DESC, created_at DESC
    `);
    return stmt.all(barbershopId, clientId) as ClientFitnessAssessment[];
  },

  createFitnessAssessment(data: Omit<ClientFitnessAssessment, 'created_at'>): ClientFitnessAssessment {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO client_fitness_assessments (
        id, barbershop_id, client_id, assessment_date, weight_kg, height_cm,
        body_fat_pct, muscle_mass_kg, chest_cm, waist_cm, abdomen_cm,
        hips_cm, arms_cm, thighs_cm, physical_restrictions, training_goal,
        workout_prescription, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.barbershop_id,
      data.client_id,
      data.assessment_date,
      data.weight_kg ?? null,
      data.height_cm ?? null,
      data.body_fat_pct ?? null,
      data.muscle_mass_kg ?? null,
      data.chest_cm ?? null,
      data.waist_cm ?? null,
      data.abdomen_cm ?? null,
      data.hips_cm ?? null,
      data.arms_cm ?? null,
      data.thighs_cm ?? null,
      data.physical_restrictions || null,
      data.training_goal || null,
      data.workout_prescription || null,
      data.notes || null,
      now
    );

    return {
      ...data,
      created_at: now
    };
  },

  deleteFitnessAssessment(id: string, barbershopId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM client_fitness_assessments 
      WHERE id = ? AND barbershop_id = ?
    `);
    const res = stmt.run(id, barbershopId);
    return res.changes > 0;
  },

  // --- TATTOO & PIERCING (BIOSSEGURANÇA & CUIDADOS) ---
  getTattooRecords(barbershopId: string, clientId: string): ClientTattooRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM client_tattoo_records 
      WHERE barbershop_id = ? AND client_id = ? 
      ORDER BY session_date DESC, created_at DESC
    `);
    return stmt.all(barbershopId, clientId) as ClientTattooRecord[];
  },

  createTattooRecord(data: Omit<ClientTattooRecord, 'created_at'>): ClientTattooRecord {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO client_tattoo_records (
        id, barbershop_id, client_id, title, placement, style,
        needle_batch, ink_batch, session_date, healing_stage,
        consent_signed, aftercare_instructions, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.barbershop_id,
      data.client_id,
      data.title,
      data.placement,
      data.style || null,
      data.needle_batch || null,
      data.ink_batch || null,
      data.session_date,
      data.healing_stage || 'Recente',
      data.consent_signed ?? 1,
      data.aftercare_instructions || null,
      data.notes || null,
      now
    );

    return {
      ...data,
      created_at: now
    };
  },

  deleteTattooRecord(id: string, barbershopId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM client_tattoo_records 
      WHERE id = ? AND barbershop_id = ?
    `);
    const res = stmt.run(id, barbershopId);
    return res.changes > 0;
  },

  // --- ENTITY PHOTOS (PROFESSIONALS & SERVICES/PROCEDURES) ---
  upsertEntityPhoto(entityId: string, barbershopId: string, entityType: 'barber' | 'service', photoUrl: string | null): void {
    const now = new Date().toISOString();
    if (!photoUrl) {
      db.prepare(`DELETE FROM entity_photos WHERE entity_id = ?`).run(entityId);
      return;
    }
    const stmt = db.prepare(`
      INSERT INTO entity_photos (entity_id, barbershop_id, entity_type, photo_url, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        photo_url = excluded.photo_url,
        barbershop_id = excluded.barbershop_id,
        updated_at = excluded.updated_at
    `);
    stmt.run(entityId, barbershopId, entityType, photoUrl, now);
  },

  getEntityPhoto(entityId: string): string | null {
    const row = db.prepare(`SELECT photo_url FROM entity_photos WHERE entity_id = ?`).get(entityId) as any;
    return row ? row.photo_url : null;
  },

  getEntityPhotosMap(entityIds: string[]): Record<string, string> {
    if (!entityIds.length) return {};
    const placeholders = entityIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT entity_id, photo_url FROM entity_photos WHERE entity_id IN (${placeholders})`).all(...entityIds) as any[];
    const map: Record<string, string> = {};
    rows.forEach(r => {
      map[r.entity_id] = r.photo_url;
    });
    return map;
  },

  deleteEntityPhoto(entityId: string): boolean {
    const res = db.prepare(`DELETE FROM entity_photos WHERE entity_id = ?`).run(entityId);
    return res.changes > 0;
  },

  // --- BARBER METADATA (COMMISSION & EXTRA FIELDS) ---
  upsertBarberMetadata(barberId: string, barbershopId: string, commissionPercentage: number): void {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO barber_metadata (barber_id, barbershop_id, commission_percentage, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(barber_id) DO UPDATE SET
        commission_percentage = excluded.commission_percentage,
        barbershop_id = excluded.barbershop_id,
        updated_at = excluded.updated_at
    `);
    stmt.run(barberId, barbershopId, commissionPercentage, now);
  },

  getBarbersMetadataMap(barberIds: string[]): Record<string, { commission_percentage: number }> {
    if (!barberIds.length) return {};
    const placeholders = barberIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT barber_id, commission_percentage FROM barber_metadata WHERE barber_id IN (${placeholders})`).all(...barberIds) as any[];
    const map: Record<string, { commission_percentage: number }> = {};
    rows.forEach(r => {
      map[r.barber_id] = { commission_percentage: r.commission_percentage };
    });
    return map;
  }
};
