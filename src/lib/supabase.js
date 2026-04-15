import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://agzcaqgxlyrtbxtyxkwp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnemNhcWd4bHlydGJ4dHl4a3dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDMyOTQsImV4cCI6MjA5MTgxOTI5NH0.9zBiQbqs2Im4Krtq76u9qr8YRqY5pplLJgAvYJPvWVE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
