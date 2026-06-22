import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
supabase.from('products').select('*').limit(1).then(r => console.log(Object.keys(r.data![0]))).catch(console.error);
