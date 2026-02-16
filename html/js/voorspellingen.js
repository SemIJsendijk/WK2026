import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let userId = null;

// Initialisatie
async function init() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
        document.getElementById('auth-status').innerHTML = '⚠️ <a href="/login">Log in</a> om je voortgang op te slaan.';
        return;
    }
    userId = user.id;
    document.getElementById('auth-status').innerText = `✅ Ingelogd als ${user.email}`;
    loadData();
}

async function loadData() {
    const { data: landen } = await _supabase.from('landen').select('*').order('land');
    const { data: wedstrijden } = await _supabase.from('wedstrijden_poulfase').select('*, home:home_team_id(land, groep), away:away_team_id(land)');
    
    const { data: v_wedstrijden } = await _supabase.from('voorspellingen_wedstrijden').select('*').eq('user_id', userId);
    const { data: v_toernooi } = await _supabase.from('voorspellingen_toernooi').select('*').eq('user_id', userId);

    renderMatches(wedstrijden, v_wedstrijden);
    renderKnockout(landen, v_toernooi);
}

// Render functies (zie vorige code, identiek gebleven)
// ... [renderMatches en renderKnockout hier invoegen] ...

// HET OPSLAAN: Complete logica
document.getElementById('prediction-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!userId) return alert("Je moet ingelogd zijn!");

    const formData = new FormData(e.target);
    const matchDataMap = {};
    const tournamentDataMap = {};

    // 1. Loop door alle formulierdata
    for (let [key, value] of formData.entries()) {
        
        // Wedstrijden verwerken (m_ID_Zijde)
        if (key.startsWith('m_')) {
            const [_, mId, side] = key.split('_');
            if (!matchDataMap[mId]) matchDataMap[mId] = { user_id: userId, match_id: parseInt(mId) };
            matchDataMap[mId][side === 'h' ? 'goals_home' : 'goals_away'] = parseInt(value) || 0;
        }

        // Booleans verwerken (l_ID_Fase)
        if (key.startsWith('l_')) {
            const [_, lId, fase] = key.split('_');
            if (!tournamentDataMap[lId]) tournamentDataMap[lId] = { 
                user_id: userId, land_id: parseInt(lId),
                laatste_32: false, laatste_16: false, kwartfinale: false, halvefinale: false, finale: false, winnaar: false 
            };
            
            const faseMap = { '32': 'laatste_32', '16': 'laatste_16', 'kf': 'kwartfinale', 'hf': 'halvefinale', 'f': 'finale' };
            if (faseMap[fase]) tournamentDataMap[lId][faseMap[fase]] = true;
        }

        // Winnaar radio button verwerken
        if (key === 'winnaar') {
            const lId = value;
            if (!tournamentDataMap[lId]) tournamentDataMap[lId] = { user_id: userId, land_id: parseInt(lId) };
            tournamentDataMap[lId].winnaar = true;
        }
    }

    // 2. Data klaarmaken voor verzending
    const finalMatchData = Object.values(matchDataMap);
    const finalTournamentData = Object.values(tournamentDataMap);

    try {
        // Voer beide Upserts uit
        const res1 = await _supabase.from('voorspellingen_wedstrijden').upsert(finalMatchData);
        const res2 = await _supabase.from('voorspellingen_toernooi').upsert(finalTournamentData);

        if (res1.error || res2.error) throw (res1.error || res2.error);
        
        alert("✅ Alles succesvol opgeslagen!");
    } catch (err) {
        console.error(err);
        alert("❌ Er ging iets mis: " + err.message);
    }
};

init();