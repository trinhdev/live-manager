import { createClient } from '@supabase/supabase-js';

// Vite exposes env vars via import.meta.env
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string;

const missingSupabaseEnvMessage =
  '❌ Thiếu biến môi trường Supabase!\n' +
  'Hãy tạo file .env và điền:\n' +
  '  VITE_SUPABASE_URL=https://xxx.supabase.co\n' +
  '  VITE_SUPABASE_ANON_KEY=your_anon_key';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(missingSupabaseEnvMessage);
}

const createOfflineResponse = () => ({
  data: null,
  error: { message: 'Supabase is not configured. App is running in offline mode.' },
});

const createOfflineQuery = () => {
  const query: any = {
    select: () => query,
    order: () => query,
    eq: () => query,
    match: () => query,
    single: async () => createOfflineResponse(),
    maybeSingle: async () => createOfflineResponse(),
    upsert: () => query,
    insert: async () => createOfflineResponse(),
    update: () => query,
    delete: () => query,
    then: (resolve: (value: any) => any, reject?: (reason: any) => any) =>
      Promise.resolve(createOfflineResponse()).then(resolve, reject),
    catch: (reject: (reason: any) => any) => Promise.resolve(createOfflineResponse()).catch(reject),
    finally: (onFinally: () => void) => Promise.resolve(createOfflineResponse()).finally(onFinally),
  };

  return query;
};

const createOfflineClient = () => ({
  from: () => createOfflineQuery(),
  functions: {
    invoke: async () => createOfflineResponse(),
  },
});

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createOfflineClient();
