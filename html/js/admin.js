import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

// 1. Auth Guard
if (!currentUser || !currentUser.id) {
    window.location.href = './index.html';
    throw new Error("Geen ingelogde gebruiker. Redirecting...");
}

async function ensureClient() {
    if (supabase) return supabase;
    try {
        const cfg = await import('./config.js');
        supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        return supabase;
    } catch (e) {
        console.error("Configuratie fout:", e);
        throw e;
    }
}

async function checkAdmin() {
    await ensureClient();
    try {
        const { data: isAdmin, error } = await supabase.rpc('check_is_admin', {
            check_user_id: currentUser.id
        });

        if (error) {
            console.error("Database error during admin check:", error.message);
            window.location.href = './home.html';
            throw new Error("Error checking admin status. Redirecting...");
        }

        if (!isAdmin) {
            console.warn("User is not an admin. Redirecting to home...");
            window.location.href = './home.html';
            throw new Error("Geen admin toegang. Redirecting...");
        }
    } catch (err) {
        window.location.href = './home.html';
        throw err;
    }
}

// 2. Tab Navigatie
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

// 3. Constraints Logica
const ROUND_LIMITS = {
    'laatste_32': 32,
    'laatste_16': 16,
    'kwartfinale': 8,
    'halvefinale': 4,
    'finale': 2,
    'winnaar': 1
};

function setupConstraints() {
    const tbody = document.getElementById('countries-body');
    if (!tbody) return;

    tbody.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' || e.target.type === 'radio') {
            const round = e.target.dataset.round;
            if (!round) return;

            const limit = ROUND_LIMITS[round];
            if (limit !== undefined) {
                let checkedCount;
                if (round === 'winnaar') {
                    checkedCount = document.querySelectorAll(`input[data-round="winnaar"]:checked`).length;
                } else {
                    checkedCount = document.querySelectorAll(`input[data-round="${round}"]:checked`).length;
                }

                if (checkedCount > limit) {
                    e.target.checked = false;
                    alert(`⚠️ Let op: Maximaal ${limit} landen toegestaan voor ${round}.`);
                }
            }
        }
    });
}

// 4. Render Functies
function renderMatches(matches) {
    const container = document.getElementById('matches-grid');
    if (!container) return;
    container.innerHTML = '';

    const groups = {};
    matches.forEach(m => {
        const g = m.home?.groep || 'KO';
        if (!groups[g]) groups[g] = [];
        groups[g].push(m);
    });

    Object.keys(groups).sort().forEach(groupName => {
        const card = document.createElement('div');
        card.className = 'group-card';
        let html = `<h3>Groep ${groupName}</h3>`;

        groups[groupName].forEach(m => {
            html += `
                <div class="match" data-match-id="${m.match_id}">
                    <span class="team">${m.home?.land || 'Thuis'}</span>
                    <div class="inputs">
                        <input type="text" inputmode="numeric" class="score-home" value="${m.goals_home ?? ''}" placeholder="-">
                        <span>-</span>
                        <input type="text" inputmode="numeric" class="score-away" value="${m.goals_against ?? ''}" placeholder="-">
                    </div>
                    <span class="team text-right">${m.away?.land || 'Uit'}</span>
                </div>`;
        });
        card.innerHTML = html;
        container.appendChild(card);
    });
}

function renderCountries(countries) {
    const tbody = document.getElementById('countries-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    countries.forEach(c => {
        const row = `
            <tr data-country-id="${c.id}">
                <td class="text-left"><strong>${c.land}</strong></td>
                <td><input type="checkbox" data-round="laatste_32" ${c.laatste_32 ? 'checked' : ''}></td>
                <td><input type="checkbox" data-round="laatste_16" ${c.laatste_16 ? 'checked' : ''}></td>
                <td><input type="checkbox" data-round="kwartfinale" ${c.kwartfinale ? 'checked' : ''}></td>
                <td><input type="checkbox" data-round="halvefinale" ${c.halvefinale ? 'checked' : ''}></td>
                <td><input type="checkbox" data-round="finale" ${c.finale ? 'checked' : ''}></td>
                <td><input type="radio" name="winner-admin" data-round="winnaar" ${c.winnaar ? 'checked' : ''} value="${c.id}"></td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    setupConstraints();
}

// 5. Opslaan Functies
document.getElementById('save-all-btn').addEventListener('click', async () => {
    const saveMsg = document.getElementById('save-msg');
    saveMsg.style.color = "var(--text-dim)";
    saveMsg.textContent = "⌛ Bezig met opslaan...";

    try {
        await ensureClient();

        // A. Wedstrijden Data
        const matchUpdates = [];
        document.querySelectorAll('.match').forEach(m => {
            const id = m.dataset.matchId;
            const h = m.querySelector('.score-home').value.trim();
            const a = m.querySelector('.score-away').value.trim();

            matchUpdates.push({
                match_id: parseInt(id),
                goals_home: (h === "" || isNaN(parseInt(h))) ? null : parseInt(h),
                goals_against: (a === "" || isNaN(parseInt(a))) ? null : parseInt(a)
            });
        });

        // B. Landen Data
        const countryUpdates = [];
        document.querySelectorAll('#countries-body tr').forEach(row => {
            const id = row.dataset.countryId;
            countryUpdates.push({
                id: parseInt(id),
                laatste_32: row.querySelector('input[data-round="laatste_32"]').checked,
                laatste_16: row.querySelector('input[data-round="laatste_16"]').checked,
                kwartfinale: row.querySelector('input[data-round="kwartfinale"]').checked,
                halvefinale: row.querySelector('input[data-round="halvefinale"]').checked,
                finale: row.querySelector('input[data-round="finale"]').checked,
                winnaar: row.querySelector('input[data-round="winnaar"]').checked
            });
        });

        // C. Voer updates uit via de veilige 'achterdeur' (RPC)
        const { error } = await supabase.rpc('save_admin_data', {
            p_user_id: currentUser.id,
            p_match_updates: matchUpdates,
            p_country_updates: countryUpdates
        });

        if (error) {
            throw error;
        }

        saveMsg.style.color = "green";
        saveMsg.textContent = "✅ Alles succesvol opgeslagen!";
        setTimeout(() => {
            saveMsg.style.color = "var(--text-dim)";
            saveMsg.textContent = "Pas resultaten aan en klik op alles opslaan hieronder.";
        }, 3000);

    } catch (err) {
        console.error("Opslaan mislukt:", err);
        saveMsg.style.color = "red";
        saveMsg.textContent = "❌ Fout: " + err.message;
    }
});

// 6. Initialisatie
async function init() {
    try {
        await checkAdmin();

        const { data: matches, error: mErr } = await supabase
            .from('wedstrijden_poulfase')
            .select(`*, home:landen!home_team_id(land, groep), away:landen!away_team_id(land)`)
            .order('match_id');

        if (mErr) throw mErr;

        const { data: countries, error: cErr } = await supabase.from('landen').select('*').order('land');
        if (cErr) throw cErr;

        renderMatches(matches || []);
        renderCountries(countries || []);
    } catch (err) {
        console.error("Fout tijdens init:", err);
    }
}

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = './index.html';
});

init();