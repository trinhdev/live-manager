import { createClient } from '@supabase/supabase-js';

// Vite exposes env vars via import.meta.env
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '❌ Thiếu biến môi trường Supabase!\n' +
    'Hãy tạo file .env và điền:\n' +
    '  VITE_SUPABASE_URL=https://xxx.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=your_anon_key'
  );
}

export const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || ''
);