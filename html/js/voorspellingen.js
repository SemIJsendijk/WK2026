import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

// Auth Guard: Controleer of de gebruiker is ingelogd
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = './index.html';
}

async function loadConfig() {
    try {
        const cfg = await import('./config.js');
        return { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY };
    } catch (err) {
        console.error("Configuratie niet gevonden.");
        return null;
    }
}

async function ensureClient() {
    if (supabase) return supabase;
    const cfg = await loadConfig();
    if (!cfg) throw new Error('Missing Supabase config');
    supabase = createClient(cfg.url, cfg.key);
    return supabase;
}

// Tab-navigatie functie
window.showTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const section = document.getElementById(`${tabName}-section`);
    if (section) section.classList.add('active');
    
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
        btn.getAttribute('onclick')?.includes(tabName)
    );
    if (activeBtn) activeBtn.classList.add('active');
}

function renderWedstrijden(wedstrijdenJson, bestaandeVoorspellingen) {
    const container = document.getElementById('group-grid');
    if (!container) return;
    container.innerHTML = '';

    const groepen = {};
    wedstrijdenJson.forEach(match => {
        const g = match.home?.groep || 'Onbekend';
        if (!groepen[g]) groepen[g] = [];
        groepen[g].push(match);
    });

    Object.keys(groepen).sort().forEach(groepNaam => {
        const kaart = document.createElement('div');
        kaart.className = 'group-card';
        let matchRijenHtml = `<h3>Groep ${groepNaam}</h3>`;
        
        groepen[groepNaam].forEach(m => {
            // Zoek bestaande voorspelling op basis van match_id
            const v = bestaandeVoorspellingen.find(p => p.match_id === m.match_id) || {};
            
            matchRijenHtml += `
                <div class="match">
                    <span class="team">${m.home?.land}</span>
                    <div class="inputs">
                        <input type="number" name="m_${m.match_id}_h" value="${v.voorspeld_thuis ?? ''}" placeholder="0" min="0">
                        <input type="number" name="m_${m.match_id}_a" value="${v.voordspeld_uit ?? ''}" placeholder="0" min="0">
                    </div>
                    <span class="team text-right">${m.away?.land}</span>
                </div>`;
        });
        kaart.innerHTML = matchRijenHtml;
        container.appendChild(kaart);
    });
}

function renderLandenTabel(landenJson, bestaandeVoorspellingen) {
    const tbody = document.getElementById('ko-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    landenJson.forEach(land => {
        const v = bestaandeVoorspellingen.find(p => p.land_id === land.id) || {};
        
        // Let op: kwartfinale en halvefinale zijn hier gesplitst voor de UI
        const rij = `
            <tr>
                <td class="land-name">${land.land}</td>
                <td><input type="checkbox" name="l_${land.id}_32" ${v.laatste_32 ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${land.id}_16" ${v.laatste_16 ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${land.id}_kf" ${v.kwartfinale ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${land.id}_hf" ${v.halvefinale ? 'checked' : ''}></td>
                <td><input type="checkbox" name="l_${land.id}_f" ${v.finale ? 'checked' : ''}></td>
                <td><input type="radio" name="winnaar" value="${land.id}" ${v.winnaar ? 'checked' : ''}></td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', rij);
    });
}

// Event listener voor het opslaan van het formulier
document.getElementById('prediction-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveMsg = document.getElementById('save-msg');
    if (saveMsg) saveMsg.textContent = "⌛ Bezig met opslaan...";
    
    try {
        await ensureClient();
        const formData = new FormData(e.target);
        const matchUpdates = [];
        const toernooiUpdates = [];
        const winnerId = formData.get('winnaar');

        // Verzamel wedstrijd voorspellingen
        const matchIds = [...new Set([...formData.keys()].filter(k => k.startsWith('m_')).map(k => k.split('_')[1]))];
        matchIds.forEach(id => {
            matchUpdates.push({
                user_id: currentUser.id,
                match_id: parseInt(id),
                voorspeld_thuis: formData.get(`m_${id}_h`) !== "" ? parseInt(formData.get(`m_${id}_h`)) : null,
                voordspeld_uit: formData.get(`m_${id}_a`) !== "" ? parseInt(formData.get(`m_${id}_a`)) : null
            });
        });

        // Toernooi voorspellingen (gebruik een aparte tabel bijv. 'voorspellingen_toernooi')
        const landIds = [...new Set([...formData.keys()].filter(k => k.startsWith('l_')).map(k => k.split('_')[1]))];
        landIds.forEach(id => {
            toernooiUpdates.push({
                user_id: currentUser.id,
                land_id: parseInt(id),
                laatste_32: formData.get(`l_${id}_32`) === 'on',
                laatste_16: formData.get(`l_${id}_16`) === 'on',
                kwartfinale: formData.get(`l_${id}_kf`) === 'on',
                halvefinale: formData.get(`l_${id}_hf`) === 'on',
                finale: formData.get(`l_${id}_f`) === 'on',
                winnaar: winnerId == id
            });
        });

        // Voer de updates uit in Supabase
        const { error: err1 } = await supabase.from('voorspellingen').upsert(matchUpdates);
        const { error: err2 } = await supabase.from('voorspellingen_toernooi').upsert(toernooiUpdates);

        if (err1 || err2) throw err1 || err2;

        if (saveMsg) {
            saveMsg.style.color = "#00ff87";
            saveMsg.textContent = "✅ Voorspellingen succesvol opgeslagen!";
            setTimeout(() => { 
                saveMsg.textContent = "Pas je voorspellingen aan en klik op opslaan."; 
                saveMsg.style.color = "";
            }, 3000);
        }
    } catch (err) {
        if (saveMsg) {
            saveMsg.style.color = "red";
            saveMsg.textContent = "❌ Fout bij opslaan: " + err.message;
        }
    }
});

async function laadAlles() {
    try {
        await ensureClient();
        const authStatus = document.getElementById('auth-status');
        if (authStatus) authStatus.textContent = `Speler: ${currentUser.email}`;
        
        // Haal data op uit de tabellen met de exacte namen
        const { data: wedstrijden } = await supabase
            .from('wedstrijden_poulfase')
            .select('*, home:home_team_id(land, groep), away:away_team_id(land)')
            .order('match_id');

        const { data: landen } = await supabase
            .from('landen')
            .select('*')
            .order('land');

        const { data: v_matches } = await supabase.from('voorspellingen').select('*').eq('user_id', currentUser.id);
        const { data: v_toernooi } = await supabase.from('voorspellingen_toernooi').select('*').eq('user_id', currentUser.id);

        renderWedstrijden(wedstrijden || [], v_matches || []);
        renderLandenTabel(landen || [], v_toernooi || []);
    } catch (err) {
        console.error("Fout bij het laden van de gegevens:", err);
    }
}

laadAlles();