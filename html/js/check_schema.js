import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
    const { data, error } = await supabase
        .from('wedstrijden_knockout')
        .select('*')
        .limit(5);

    if (error) {
        console.error(error);
    } else {
        console.log("Columns in wedstrijden_knockout:", Object.keys(data[0]));
        console.log("Sample match data:", data[0]);
    }
}

checkSchema();
