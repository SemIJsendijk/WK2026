import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
let alleWedstrijden = [];
let huidigeToernooiVoorspellingen = [];
let toernooiDeadlines = {};

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
window.showTab = function (tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const section = document.getElementById(`${tabName}-section`);
    if (section) section.classList.add('active');

    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        if (btn.getAttribute('onclick')?.includes(tabName)) {
            btn.classList.add('active');
        }
    });
}

// 4. Validatie Logica & Tijdsloten
function isMatchLocked(datumTijdString) {
    if (!datumTijdString) return false;
    const matchTime = new Date(datumTijdString).getTime();
    const now = new Date().getTime();
    return now >= (matchTime - 300000); // 5 minuten voor aanvang
}

// Zoek de allereerste wedstrijd in een lijst van wedstrijden
function getEarliestTime(matches) {
    if (!matches || matches.length === 0) return Infinity;
    let earliest = Infinity;
    matches.forEach(m => {
        if (m.datum_tijd) {
            const t = new Date(m.datum_tijd).getTime();
            if (t < earliest) earliest = t;
        }
    });
    return earliest;
}

function setupLimitValidation() {
    const limits = {
        '32': 32,
        '16': 16,
        'kf': 8,
        'hf': 4,
        'tf': 2,
        'f': 2
    };

    const tbody = document.getElementById('ko-body');
    if (!tbody) return;

    tbody.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const parts = e.target.name.split('_');
            const type = parts[parts.length - 1];

            if (limits[type]) {
                const checkedCount = document.querySelectorAll(`input[name$="_${type}"]:not([disabled]):checked`).length
                    + document.querySelectorAll(`input[name$="_${type}"][disabled]:checked`).length;

                if (checkedCount > limits[type]) {
                    e.target.checked = false;
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

            const locked = isMatchLocked(m.datum_tijd);
            const disabledAttr = locked ? 'disabled title="Wedstrijd is al (bijna) begonnen"' : '';
            const bgStyle = locked ? 'background-color: #f0f0f0; cursor: not-allowed;' : '';

            matchHtml += `
                <div class="match">
                    <span class="team">${homeName}</span>
                    <div class="inputs">
                        <input type="text" inputmode="numeric" pattern="[0-9]*" name="m_${m.match_id}_h" value="${v.voorspeld_thuis ?? ''}" placeholder="-" ${disabledAttr} style="${bgStyle}">
                        <input type="text" inputmode="numeric" pattern="[0-9]*" name="m_${m.match_id}_a" value="${v.voorspeld_uit ?? ''}" placeholder="-" ${disabledAttr} style="${bgStyle}">
                    </div>
                    <span class="team text-right">${awayName}</span>
                </div>`;
        });
        kaart.innerHTML = matchHtml;
        container.appendChild(kaart);
    });
}

function renderKnockoutWedstrijden(koWedstrijden, bestaandeVoorspellingen) {
    const containers = {
        'Laatste 32': document.getElementById('l32-grid'),
        'Laatste 16': document.getElementById('l16-grid'),
        'Kwartfinale': document.getElementById('kf-grid'),
        'Halve finale': document.getElementById('hf-grid'),
        'Troostfinale': document.getElementById('tf-grid'),
        'Finale': document.getElementById('fin-grid')
    };

    Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });

    koWedstrijden.forEach(m => {
        const container = containers[m.round];
        if (!container) return;

        const v = bestaandeVoorspellingen.find(p => p.match_id === m.match_id) || {};
        const isKnown = m.home_team_id !== null && m.away_team_id !== null;
        const locked = isMatchLocked(m.datum_tijd);

        const homeName = m.home ? m.home.land : `Nog onbekend`;
        const awayName = m.away ? m.away.land : `Nog onbekend`;

        let disabledAttr = '';
        if (!isKnown) {
            disabledAttr = 'disabled title="Wordt geopend als landen bekend zijn"';
        } else if (locked) {
            disabledAttr = 'disabled title="Wedstrijd is al (bijna) begonnen"';
        }

        // Special handling for the final and troostfinale cards
        if (m.round === 'Finale' || m.round === 'Troostfinale') {
            const isFinal = m.round === 'Finale';
            const stadiumImg = isFinal ? 'metlife-stadium.jpg' : 'troostfinale.webp';
            const pillText = isFinal ? 'FINAL' : 'TROOSTFINALE';

            const dateStr = m.datum_tijd ? new Date(m.datum_tijd).toLocaleString('nl-NL', {
                weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
            }) : 'Tijdstip nog onbekend';

            const html = `
                <div class="ko-card final-card">
                    <img src="./pictures/stadions/${stadiumImg}" alt="Stadium" class="final-stadium-img">
                    
                    <div class="final-match-content">
                        <div class="ko-match-layout">
                            <div class="ko-team-box">
                                <span class="ko-team-name final-team">${homeName}</span>
                            </div>
                            
                            <div class="ko-vs-container">
                                <div class="vs-pill">${pillText}</div>
                                <div class="ko-score-inputs">
                                    <input type="text" class="ko-score-input" inputmode="numeric" pattern="[0-9]*" name="m_${m.match_id}_h" value="${v.voorspeld_thuis ?? ''}" placeholder="-" ${disabledAttr}>
                                    <input type="text" class="ko-score-input" inputmode="numeric" pattern="[0-9]*" name="m_${m.match_id}_a" value="${v.voorspeld_uit ?? ''}" placeholder="-" ${disabledAttr}>
                                </div>
                            </div>

                            <div class="ko-team-box">
                                <span class="ko-team-name final-team">${awayName}</span>
                            </div>
                        </div>
                    </div>

                    <div class="final-footer">
                        📅 ${dateStr}
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', html);
            return;
        }

        const html = `
            <div class="ko-card">
                <div class="ko-match-layout">
                    <div class="ko-team-box">
                        <span class="ko-team-name">${homeName}</span>
                    </div>
                    
                    <div class="ko-vs-container">
                        <div class="vs-pill">VS</div>
                        <div class="ko-score-inputs">
                            <input type="text" class="ko-score-input" inputmode="numeric" pattern="[0-9]*" name="m_${m.match_id}_h" value="${v.voorspeld_thuis ?? ''}" placeholder="-" ${disabledAttr}>
                            <input type="text" class="ko-score-input" inputmode="numeric" pattern="[0-9]*" name="m_${m.match_id}_a" value="${v.voorspeld_uit ?? ''}" placeholder="-" ${disabledAttr}>
                        </div>
                    </div>

                    <div class="ko-team-box">
                        <span class="ko-team-name">${awayName}</span>
                    </div>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderLandenTabel(landenJson, bestaandeToernooiVoorspellingen) {
    const tbody = document.getElementById('ko-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const now = Date.now();
    const locked32 = now >= toernooiDeadlines['32'] - 300000;
    const locked16 = now >= toernooiDeadlines['16'] - 300000;
    const lockedKF = now >= toernooiDeadlines['kf'] - 300000;
    const lockedHF = now >= toernooiDeadlines['hf'] - 300000;
    const lockedTF = now >= toernooiDeadlines['tf'] - 300000;
    const lockedF = now >= toernooiDeadlines['f'] - 300000;
    const lockedWinnaar = now >= toernooiDeadlines['winnaar'] - 300000;

    landenJson.forEach(land => {
        const v = bestaandeToernooiVoorspellingen.find(p => p.land_id === land.id) || {};

        const dis32 = locked32 ? 'disabled title="Poulefase is al begonnen"' : '';
        const dis16 = locked16 ? 'disabled title="Laatste 32 is al begonnen"' : '';
        const disKF = lockedKF ? 'disabled title="Laatste 16 is al begonnen"' : '';
        const disHF = lockedHF ? 'disabled title="Kwartfinales zijn al begonnen"' : '';
        const disTF = lockedTF ? 'disabled title="Halve finales zijn al begonnen"' : '';
        const disF = lockedF ? 'disabled title="Halve finales zijn al begonnen"' : '';
        const disW = lockedWinnaar ? 'disabled title="De Finale is al begonnen"' : '';

        const rij = `
            <tr>
                <td class="land-name">${land.land}</td>
                <td><input type="checkbox" name="l_${land.id}_32" ${v.laatste_32 ? 'checked' : ''} ${dis32}></td>
                <td><input type="checkbox" name="l_${land.id}_16" ${v.laatste_16 ? 'checked' : ''} ${dis16}></td>
                <td><input type="checkbox" name="l_${land.id}_kf" ${v.kwartfinale ? 'checked' : ''} ${disKF}></td>
                <td><input type="checkbox" name="l_${land.id}_hf" ${v.halvefinale ? 'checked' : ''} ${disHF}></td>
                <td><input type="checkbox" name="l_${land.id}_tf" ${v.troostfinale ? 'checked' : ''} ${disTF}></td>
                <td><input type="checkbox" name="l_${land.id}_f" ${v.finale ? 'checked' : ''} ${disF}></td>
                <td><input type="radio" name="winnaar" value="${land.id}" ${v.winnaar ? 'checked' : ''} ${disW}></td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', rij);
    });

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

            // A. Wedstrijden Anti-Cheat
            const matchUpdates = [];
            const matchKeys = Array.from(formData.keys()).filter(k => k.startsWith('m_') && k.endsWith('_h'));

            matchKeys.forEach(key => {
                const id = parseInt(key.split('_')[1]);
                const matchDef = alleWedstrijden.find(m => m.match_id === id);
                if (matchDef && isMatchLocked(matchDef.datum_tijd)) return;

                const homeVal = formData.get(`m_${id}_h`);
                const awayVal = formData.get(`m_${id}_a`);
                const homeGoals = homeVal.trim() === "" ? 0 : parseInt(homeVal);
                const awayGoals = awayVal.trim() === "" ? 0 : parseInt(awayVal);

                matchUpdates.push({
                    user_id: currentUser.id,
                    match_id: id,
                    voorspeld_thuis: homeGoals,
                    voorspeld_uit: awayGoals
                });
            });

            // B. Toernooiverloop Anti-Cheat
            const toernooiUpdates = [];
            const winnerId = formData.get('winnaar');
            const allLandInputs = document.querySelectorAll('input[name="winnaar"]');

            const now = Date.now();
            const locked32 = now >= toernooiDeadlines['32'] - 300000;
            const locked16 = now >= toernooiDeadlines['16'] - 300000;
            const lockedKF = now >= toernooiDeadlines['kf'] - 300000;
            const lockedHF = now >= toernooiDeadlines['hf'] - 300000;
            const lockedTF = now >= toernooiDeadlines['tf'] - 300000;
            const lockedF = now >= toernooiDeadlines['f'] - 300000;
            const lockedWinnaar = now >= toernooiDeadlines['winnaar'] - 300000;

            allLandInputs.forEach(input => {
                const landId = parseInt(input.value);
                const oldV = huidigeToernooiVoorspellingen.find(p => p.land_id === landId) || {};

                // Als de ronde op slot is, pak de oude waarde uit de database (of false). 
                // Anders, kijk in de formData wat de gebruiker zojuist heeft aangevinkt.
                const is32 = locked32 ? !!oldV.laatste_32 : formData.get(`l_${landId}_32`) === 'on';
                const is16 = locked16 ? !!oldV.laatste_16 : formData.get(`l_${landId}_16`) === 'on';
                const isKF = lockedKF ? !!oldV.kwartfinale : formData.get(`l_${landId}_kf`) === 'on';
                const isHF = lockedHF ? !!oldV.halvefinale : formData.get(`l_${landId}_hf`) === 'on';
                const isTF = lockedTF ? !!oldV.troostfinale : formData.get(`l_${landId}_tf`) === 'on';
                const isF = lockedF ? !!oldV.finale : formData.get(`l_${landId}_f`) === 'on';
                const isWin = lockedWinnaar ? !!oldV.winnaar : (winnerId == landId);

                toernooiUpdates.push({
                    user_id: currentUser.id,
                    land_id: landId,
                    laatste_32: is32,
                    laatste_16: is16,
                    kwartfinale: isKF,
                    halvefinale: isHF,
                    troostfinale: isTF,
                    finale: isF,
                    winnaar: isWin
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

            // Herlaad de voorspellingen in het geheugen zodat de anti-cheat up-to-date is
            huidigeToernooiVoorspellingen = toernooiUpdates;

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
        if (statusEl) statusEl.textContent = `Speler: ${currentUser.email}`;

        const { data: wedstrijden, error: wError } = await supabase
            .from('wedstrijden_poulfase')
            .select(`*, home:landen!home_team_id(land, groep), away:landen!away_team_id(land)`)
            .order('match_id');
        if (wError) throw wError;

        const { data: koWedstrijden, error: koError } = await supabase
            .from('wedstrijden_knockout')
            .select(`*, home:landen!home_team_id(land), away:landen!away_team_id(land)`)
            .order('match_id');
        if (koError) throw koError;

        const { data: landen, error: lError } = await supabase.from('landen').select('*').order('land');
        if (lError) throw lError;

        const { data: v_matches } = await supabase.from('voorspellingen').select('*').eq('user_id', currentUser.id);
        const { data: v_toernooi } = await supabase.from('voorspellingen_toernooi').select('*').eq('user_id', currentUser.id);

        // Gegevens bewaren voor de anti-cheat controles
        alleWedstrijden = [...(wedstrijden || []), ...(koWedstrijden || [])];
        huidigeToernooiVoorspellingen = v_toernooi || [];

        // Bepaal de deadlines aan de hand van de allereerste wedstrijd van iedere specifieke ronde
        toernooiDeadlines = {
            '32': getEarliestTime(wedstrijden || []),
            '16': getEarliestTime((koWedstrijden || []).filter(m => m.round === 'Laatste 32')),
            'kf': getEarliestTime((koWedstrijden || []).filter(m => m.round === 'Laatste 16')),
            'hf': getEarliestTime((koWedstrijden || []).filter(m => m.round === 'Kwartfinale')),
            'tf': getEarliestTime((koWedstrijden || []).filter(m => m.round === 'Halve finale')),
            'f': getEarliestTime((koWedstrijden || []).filter(m => m.round === 'Halve finale')),
            'winnaar': getEarliestTime((koWedstrijden || []).filter(m => m.round === 'Finale' || m.round === 'Troostfinale'))
        };

        renderWedstrijden(wedstrijden || [], v_matches || []);
        renderKnockoutWedstrijden(koWedstrijden || [], v_matches || []);
        renderLandenTabel(landen || [], v_toernooi || []);

    } catch (err) {
        console.error("Laden mislukt:", err);
        const grid = document.getElementById('group-grid');
        if (grid) grid.innerHTML = `<div style="color:red; padding:20px;">Error: ${err.message}<br>Check console.</div>`;
    }
}

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = './index.html';
});

laadAlles();