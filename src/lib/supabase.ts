import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://loljdygrqzzydmqpycnh.supabase.co';
const supabaseAnonKey = 'sb_publishable_Eg9nidzOresgrUzYQ7TgKw_FNkvOVHX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
