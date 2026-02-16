// Configureer hier je Supabase gegevens
const supabaseUrl = 'JOUW_SUPABASE_URL';
const supabaseKey = 'JOUW_SUPABASE_ANON_KEY';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let userId = null;

async function init() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
        document.getElementById('auth-status').innerHTML = '⚠️ Log in om je voorspellingen op te slaan.';
        return;
    }
    userId = user.id;
    document.getElementById('auth-status').innerText = `✅ Ingelogd als ${user.email}`;
    loadData();
}

async function loadData() {
    // 1. Haal alle basisdata op
    const { data: landen } = await _supabase.from('landen').select('*').order('land');
    const { data: wedstrijden } = await _supabase.from('wedstrijden_poulfase').select('*, home:home_team_id(land, groep), away:away_team_id(land)');
    
    // 2. Haal bestaande voorspellingen op
    const { data: v_wedstrijden } = await _supabase.from('voorspellingen_wedstrijden').select('*').eq('user_id', userId);
    const { data: v_toernooi } = await _supabase.from('voorspellingen_toernooi').select('*').eq('user_id', userId);

    renderMatches(wedstrijden, v_wedstrijden);
    renderKnockout(landen, v_toernooi);
}

function renderMatches(matches, predictions) {
    const grid = document.getElementById('group-grid');
    grid.innerHTML = '';
    const groups = {};

    matches.forEach(m => {
        const groep = m.home.groep;
        if (!groups[groep]) groups[groep] = [];
        groups[groep].push(m);
    });

    Object.keys(groups).sort().forEach(gName => {
        let html = `<div class="group-card"><h3>Groep ${gName}</h3>`;
        groups[gName].forEach(m => {
            const pred = predictions.find(p => p.match_id === m.match_id) || {};
            html += `
                <div class="match">
                    <span class="team">${m.home.land}</span>
                    <div class="inputs">
                        <input type="number" name="m_${m.match_id}_h" value="${pred.goals_home ?? ''}" placeholder="0">
                        <input type="number" name="m_${m.match_id}_a" value="${pred.goals_away ?? ''}" placeholder="0">
                    </div>
                    <span class="team text-right">${m.away.land}</span>
                </div>`;
        });
        html += `</div>`;
        grid.innerHTML += html;
    });
}

function renderKnockout(landen, predictions) {
    const tbody = document.getElementById('ko-body');
    tbody.innerHTML = '';
    landen.forEach(l => {
        const p = predictions.find(pred => pred.land_id === l.id) || {};
        tbody.innerHTML += `
            <tr>
                <td class="land-name">${l.land}</td>
                <td><input type="checkbox" name="l_${l.id}_32" ${p.laatste_32 ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${l.id}_16" ${p.laatste_16 ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${l.id}_kf" ${p.kwartfinale ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${l.id}_hf" ${p.halvefinale ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${l.id}_f" ${p.finale ? 'checked' : ''}></td>
                <td><input type="radio" name="winnaar" value="${l.id}" ${p.winnaar ? 'checked' : ''}></td>
            </tr>`;
    });
}

// OPSLAAN LOGICA
document.getElementById('prediction-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!userId) return alert("Log eerst in!");

    const formData = new FormData(e.target);
    const matchData = [];
    const tournamentData = {};

    // Formulier verwerken
    for (let [key, value] of formData.entries()) {
        if (key.startsWith('m_')) {
            const [_, id, side] = key.split('_');
            if (!matchData[id]) matchData[id] = { user_id: userId, match_id: parseInt(id) };
            matchData[id][side === 'h' ? 'goals_home' : 'goals_away'] = parseInt(value) || 0;
        }
        // Voeg hier vergelijkbare logica toe voor de booleans/landen
    }

    // Filter lege entries uit de array
    const cleanMatchData = Object.values(matchData);

    const { error } = await _supabase.from('voorspellingen_wedstrijden').upsert(cleanMatchData);
    
    if (error) alert("Fout bij opslaan: " + error.message);
    else alert("Voorspellingen succesvol opgeslagen!");
};

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tab + '-content').classList.add('active');
    event.target.classList.add('active');
}

init();