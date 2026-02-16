import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

// 1. Auth Guard
if (!currentUser) {
    window.location.href = './index.html';
}

// 2. Client Initialisatie
async function ensureClient() {
    if (supabase) return supabase;
    try {
        const cfg = await import('./config.js');
        supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        return supabase;
    } catch (e) {
        console.error("Configuratie fout:", e);
    }
}

// 3. Tab Navigatie
window.showTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const section = document.getElementById(`${tabName}-section`);
    if(section) section.classList.add('active');
    
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        if(btn.getAttribute('onclick')?.includes(tabName)) {
            btn.classList.add('active');
        }
    });
}

// 4. Validatie Logica (NIEUW)
function setupLimitValidation() {
    const limits = {
        '32': 32,
        '16': 16,
        'kf': 8,
        'hf': 4,
        'f': 2
    };

    const tbody = document.getElementById('ko-body');
    if (!tbody) return;

    // We gebruiken 'event delegation' op de body van de tabel
    tbody.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            // Haal het type op uit de naam (bijv: l_12_kf -> kf)
            const parts = e.target.name.split('_');
            const type = parts[parts.length - 1]; 

            if (limits[type]) {
                // Tel hoeveel er NU zijn aangevinkt in deze kolom
                // We zoeken op inputs die eindigen op dezelfde suffix (bijv: _kf)
                const checkedCount = document.querySelectorAll(`input[name$="_${type}"]:checked`).length;
                
                if (checkedCount > limits[type]) {
                    e.target.checked = false; // Draai de actie terug
                    alert(`⚠️ Let op: Je mag maximaal ${limits[type]} landen selecteren voor deze ronde.`);
                }
            }
        }
    });
}

// 5. Render Functies
function renderWedstrijden(wedstrijdenJson, bestaandeVoorspellingen) {
    const container = document.getElementById('group-grid');
    if (!container) return;
    container.innerHTML = '';

    if (wedstrijdenJson.length === 0) {
        container.innerHTML = '<div style="padding:20px">Geen wedstrijden gevonden. Check RLS policies.</div>';
        return;
    }

    const groepen = {};
    wedstrijdenJson.forEach(match => {
        const g = match.home?.groep || 'Onbekend'; 
        if (!groepen[g]) groepen[g] = [];
        groepen[g].push(match);
    });

    Object.keys(groepen).sort().forEach(groepNaam => {
        const kaart = document.createElement('div');
        kaart.className = 'group-card';
        let matchHtml = `<h3>Groep ${groepNaam}</h3>`;
        
        groepen[groepNaam].forEach(m => {
            const v = bestaandeVoorspellingen.find(p => p.match_id === m.match_id) || {};
            const homeName = m.home ? m.home.land : 'Thuis';
            const awayName = m.away ? m.away.land : 'Uit';

            matchHtml += `
                <div class="match">
                    <span class="team">${homeName}</span>
                    <div class="inputs">
                        <input type="number" name="m_${m.match_id}_h" value="${v.voorspeld_thuis ?? ''}" placeholder="-" min="0">
                        <input type="number" name="m_${m.match_id}_a" value="${v.voordspeld_uit ?? ''}" placeholder="-" min="0">
                    </div>
                    <span class="team text-right">${awayName}</span>
                </div>`;
        });
        kaart.innerHTML = matchHtml;
        container.appendChild(kaart);
    });
}

function renderLandenTabel(landenJson, bestaandeToernooiVoorspellingen) {
    const tbody = document.getElementById('ko-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    landenJson.forEach(land => {
        const v = bestaandeToernooiVoorspellingen.find(p => p.land_id === land.id) || {};

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

    // Activeer de validatie nadat de tabel is getekend
    setupLimitValidation();
}

// 6. Opslaan Logica
const form = document.getElementById('prediction-form');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveMsg = document.getElementById('save-msg');
        saveMsg.textContent = "⌛ Bezig met opslaan...";
        saveMsg.style.color = "var(--text-dim)";
        
        try {
            await ensureClient();
            const formData = new FormData(e.target);
            
            // A. Wedstrijden
            const matchUpdates = [];
            const matchKeys = Array.from(formData.keys()).filter(k => k.startsWith('m_') && k.endsWith('_h'));
            
            matchKeys.forEach(key => {
                const id = key.split('_')[1];
                const homeVal = formData.get(`m_${id}_h`);
                const awayVal = formData.get(`m_${id}_a`);

                if (homeVal !== "" && awayVal !== "") {
                    matchUpdates.push({
                        user_id: currentUser.id,
                        match_id: parseInt(id),
                        voorspeld_thuis: parseInt(homeVal),
                        voordspeld_uit: parseInt(awayVal)
                    });
                }
            });

            // B. Toernooi (Loop over ALLE landen in de DOM om unchecks mee te pakken)
            const toernooiUpdates = [];
            const winnerId = formData.get('winnaar'); 
            
            // We halen alle radio buttons op (1 per land) om zeker elk land te itereren
            const allLandInputs = document.querySelectorAll('input[name="winnaar"]');
            
            allLandInputs.forEach(input => {
                const landId = input.value;
                
                toernooiUpdates.push({
                    user_id: currentUser.id,
                    land_id: parseInt(landId),
                    laatste_32: formData.get(`l_${landId}_32`) === 'on',
                    laatste_16: formData.get(`l_${landId}_16`) === 'on',
                    kwartfinale: formData.get(`l_${landId}_kf`) === 'on',
                    halvefinale: formData.get(`l_${landId}_hf`) === 'on',
                    finale: formData.get(`l_${landId}_f`) === 'on',
                    winnaar: winnerId == landId
                });
            });

            // C. Uitvoeren
            const promises = [];
            if (matchUpdates.length > 0) {
                promises.push(supabase.from('voorspellingen').upsert(matchUpdates, { onConflict: 'user_id, match_id' }));
            }
            if (toernooiUpdates.length > 0) {
                promises.push(supabase.from('voorspellingen_toernooi').upsert(toernooiUpdates, { onConflict: 'user_id, land_id' }));
            }

            const results = await Promise.all(promises);
            const error = results.find(r => r.error)?.error;
            if (error) throw error;

            saveMsg.textContent = "✅ Alles succesvol opgeslagen!";
            saveMsg.style.color = "#00ff87"; 
            
            setTimeout(() => {
                saveMsg.textContent = "Pas je voorspellingen aan en klik op opslaan.";
                saveMsg.style.color = "var(--text-dim)";
            }, 3000);

        } catch (err) {
            console.error(err);
            saveMsg.textContent = "❌ Fout: " + err.message;
            saveMsg.style.color = "red";
        }
    });
}

// 7. Data Laden
async function laadAlles() {
    try {
        await ensureClient();
        const statusEl = document.getElementById('auth-status');
        if(statusEl) statusEl.textContent = `Speler: ${currentUser.email}`;

        const { data: wedstrijden, error: wError } = await supabase
            .from('wedstrijden_poulfase')
            .select(`*, home:landen!home_team_id(land, groep), away:landen!away_team_id(land)`)
            .order('match_id');

        if (wError) throw wError;

        const { data: landen, error: lError } = await supabase.from('landen').select('*').order('land');
        if (lError) throw lError;

        const { data: v_matches } = await supabase.from('voorspellingen').select('*').eq('user_id', currentUser.id);
        const { data: v_toernooi } = await supabase.from('voorspellingen_toernooi').select('*').eq('user_id', currentUser.id);

        renderWedstrijden(wedstrijden || [], v_matches || []);
        renderLandenTabel(landen || [], v_toernooi || []);

    } catch (err) {
        console.error("Laden mislukt:", err);
        const grid = document.getElementById('group-grid');
        if(grid) grid.innerHTML = `<div style="color:red; padding:20px;">Error: ${err.message}<br>Check console.</div>`;
    }
}

laadAlles();