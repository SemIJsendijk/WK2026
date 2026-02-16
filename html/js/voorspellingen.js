import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Functie om de wedstrijden JSON om te zetten in HTML rijen
function renderWedstrijden(wedstrijdenJson, bestaandeVoorspellingen) {
    const container = document.getElementById('group-grid');
    container.innerHTML = ''; // Maak eerst leeg

    // Groepeer de JSON per poule
    const groepen = {};
    wedstrijdenJson.forEach(match => {
        const g = match.home.groep;
        if (!groepen[g]) groepen[g] = [];
        groepen[g].push(match);
    });

    // Maak voor elke groep een kaart en voor elke match een rij
    Object.keys(groepen).sort().forEach(groepNaam => {
        const kaart = document.createElement('div');
        kaart.className = 'group-card';
        
        let matchRijenHtml = `<h3>Groep ${groepNaam}</h3>`;
        
        groepen[groepNaam].forEach(m => {
            // Zoek in de voorspellingen JSON of deze match al is ingevuld
            const v = bestaandeVoorspellingen.find(p => p.match_id === m.match_id) || {};
            
            matchRijenHtml += `
                <div class="match">
                    <span class="team">${m.home.land}</span>
                    <div class="inputs">
                        <input type="number" name="m_${m.match_id}_h" value="${v.goals_home ?? ''}" placeholder="0">
                        <input type="number" name="m_${m.match_id}_a" value="${v.goals_away ?? ''}" placeholder="0">
                    </div>
                    <span class="team text-right">${m.away.land}</span>
                </div>
            `;
        });

        kaart.innerHTML = matchRijenHtml;
        container.appendChild(kaart);
    });
}

// Functie voor de Landen-Booleans JSON
function renderLandenTabel(landenJson, bestaandeVoorspellingen) {
    const tbody = document.getElementById('ko-body');
    tbody.innerHTML = '';

    landenJson.forEach(land => {
        const v = bestaandeVoorspellingen.find(p => p.land_id === land.id) || {};
        
        const rij = `
            <tr>
                <td class="land-name">${land.land}</td>
                <td><input type="checkbox" name="l_${land.id}_32" ${v.laatste_32 ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${land.id}_16" ${v.laatste_16 ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${land.id}_kf" ${v.kwartfinale ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${land.id}_hf" ${v.halvefinale ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${land.id}_f" ${v.finale ? 'checked' : ''}></td>
                <td><input type="radio" name="winnaar" value="${land.id}" ${v.winnaar ? 'checked' : ''}></td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', rij);
    });
}

// Data ophalen en functies aanroepen
async function laadAlles() {
    const { data: user } = await _supabase.auth.getUser();
    const uid = user?.user?.id;

    // Haal de JSON data op uit Supabase
    const { data: wedstrijden } = await _supabase.from('wedstrijden_poulfase').select('*, home:home_team_id(land, groep), away:away_team_id(land)');
    const { data: landen } = await _supabase.from('landen').select('*').order('land');
    
    let v_matches = [];
    let v_toernooi = [];

    if (uid) {
        const res1 = await _supabase.from('voorspellingen_wedstrijden').select('*').eq('user_id', uid);
        const res2 = await _supabase.from('voorspellingen_toernooi').select('*').eq('user_id', uid);
        v_matches = res1.data || [];
        v_toernooi = res2.data || [];
    }

    renderWedstrijden(wedstrijden, v_matches);
    renderLandenTabel(landen, v_toernooi);
}

laadAlles();