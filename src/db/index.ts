import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';
dotenv.config();

const queryClient = postgres(process.env.VITE_SUPABASE_URL!.replace('https://', 'postgres://postgres:PASSWORD@').replace('.supabase.co', '.supabase.co:5432/postgres'), { prepare: false });
// Actually for Supabase with drizzle we usually use a connection string. Since we just have ANON key and URL, 
// using PostgreSQL requires the database password, which we don't have.
// But wait! The data provided by the user is SUPABASE_URL and SUPABASE_ANON_KEY.
// These are used for connecting via the standard Supabase REST/PostgREST api, NOT the direct PostgreSQL connection.
// If the user wants us to use Drizzle with Supabase, we would normally need `DATABASE_URL` (direct pg connect).
// They only gave SUPABASE_URL and SUPABASE_ANON_KEY.
// Therefore, we should probably not use Drizzle to query directly if we don't have the password, we should use `@supabase/supabase-js`!
// BUT if they have drizzle, they might want to just keep using the Supabase client or we can't use Drizzle with postgres-js without the password!

