import { createClient } from '@supabase/supabase-js';



const SUPABASE_URL = 'https://lzajurbkaynigljrsfab.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6YWp1cmJrYXluaWdsanJzZmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDI4MzAsImV4cCI6MjA5MDI3ODgzMH0.eCQlThFo5PmZbWayKwpERp-OrAh5DmY-LgGNZEclYXc';

export const secondarySupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
