
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const supabaseUrl = 'https://dlwafsxxojkgelydjkqr.supabase.co';
const supabaseKey = 'sb_publishable_9lP4Aomqx9S6aGFacaiWgw_VqsUf_4w';

export const supabase = createClient(supabaseUrl, supabaseKey);
