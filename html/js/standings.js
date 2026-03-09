import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

if (!currentUser) {
    window.location.href = './index.html';
}

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

async function fetchStats() {
    await ensureClient();

    // 1. Haal alle landen op
    const { data: landen, error: lError } = await supabase
        .from('landen')
        .select('*')
        .order('groep', { ascending: true });

    if (lError) throw lError;

    // 2. Haal alle poule wedstrijden op
    const { data: matches, error: mError } = await supabase
        .from('wedstrijden_poulfase')
        .select('*');

    if (mError) throw mError;

    // 3. Initialiseer stats object per land
    const stats = {};
    landen.forEach(l => {
        stats[l.id] = {
            id: l.id,
            land: l.land,
            groep: l.groep,
            gespeeld: 0,
            winst: 0,
            gelijk: 0,
            verlies: 0,
            voor: 0,
            tegen: 0,
            punten: 0
        };
    });

    // 4. Verwerk wedstrijden
    matches.forEach(m => {
        if (m.goals_home !== null && m.goals_against !== null) {
            const h = stats[m.home_team_id];
            const a = stats[m.away_team_id];

            if (h && a) {
                h.gespeeld++;
                a.gespeeld++;
                h.voor += m.goals_home;
                h.tegen += m.goals_against;
                a.voor += m.goals_against;
                a.tegen += m.goals_home;

                if (m.goals_home > m.goals_against) {
                    h.winst++;
                    h.punten += 3;
                    a.verlies++;
                } else if (m.goals_home < m.goals_against) {
                    a.winst++;
                    a.punten += 3;
                    h.verlies++;
                } else {
                    h.gelijk++;
                    h.punten += 1;
                    a.gelijk++;
                    a.punten += 1;
                }
            }
        }
    });

    return stats;
}

function renderStandings(stats) {
    const container = document.getElementById('groups-container');
    if (!container) return;
    container.innerHTML = '';

    // 1. Groepeer per poule en sorteer per poule
    const groepen = {};
    Object.values(stats).forEach(s => {
        if (!groepen[s.groep]) groepen[s.groep] = [];
        groepen[s.groep].push(s);
    });

    const thirdPlacedTeams = [];
    const groupRankings = {};

    Object.keys(groepen).forEach(groepNaam => {
        const teams = groepen[groepNaam];
        teams.sort((a, b) => {
            if (b.punten !== a.punten) return b.punten - a.punten;
            const diffA = a.voor - a.tegen;
            const diffB = b.voor - b.tegen;
            if (diffB !== diffA) return diffB - diffA;
            if (b.voor !== a.voor) return b.voor - a.voor;
            return a.land.localeCompare(b.land);
        });
        groupRankings[groepNaam] = teams;

        // Bewaar de nummer 3 voor later
        if (teams.length >= 3) {
            thirdPlacedTeams.push(teams[2]);
        }
    });

    // 2. Bepaal beste 8 nummers 3
    thirdPlacedTeams.sort((a, b) => {
        if (b.punten !== a.punten) return b.punten - a.punten;
        const diffA = a.voor - a.tegen;
        const diffB = b.voor - b.tegen;
        if (diffB !== diffA) return diffB - diffA;
        if (b.voor !== a.voor) return b.voor - a.voor;
        return 0;
    });

    const best8ThirdsIds = thirdPlacedTeams.slice(0, 8).map(t => t.id);

    // 3. Renderen
    const sortedGroupNames = Object.keys(groepen).sort();

    sortedGroupNames.forEach(groepNaam => {
        const teams = groupRankings[groepNaam];
        const card = document.createElement('div');
        card.className = 'group-card';

        let tableHtml = `
            <div class="group-title">Groep ${groepNaam}</div>
            <table class="standings-table">
                <thead>
                    <tr>
                        <th style="width: 20px">#</th>
                        <th>Team</th>
                        <th class="col-num">G</th>
                        <th class="col-num">W</th>
                        <th class="col-num">GL</th>
                        <th class="col-num">V</th>
                        <th class="col-num">+/-</th>
                        <th class="col-num">Pnt</th>
                    </tr>
                </thead>
                <tbody>
        `;

        teams.forEach((t, index) => {
            const diff = t.voor - t.tegen;
            const diffStr = diff > 0 ? `+${diff}` : diff;

            let rowClass = 'rank-eliminated';
            if (index < 2) {
                rowClass = 'rank-qualified'; // Top 2
            } else if (index === 2 && best8ThirdsIds.includes(t.id)) {
                rowClass = 'rank-qualified-32'; // Beste 8 nummers 3
            }

            tableHtml += `
                <tr class="${rowClass} clickable-row" onclick="window.showCountryResults(${t.id}, '${t.land}')">
                    <td class="col-num">${index + 1}</td>
                    <td class="col-team">${t.land}</td>
                    <td class="col-num">${t.gespeeld}</td>
                    <td class="col-num">${t.winst}</td>
                    <td class="col-num">${t.gelijk}</td>
                    <td class="col-num">${t.verlies}</td>
                    <td class="col-num">${diffStr}</td>
                    <td class="col-num col-pts">${t.punten}</td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;

        card.innerHTML = tableHtml;
        container.appendChild(card);
    });
}

// Country results modal logic
window.showCountryResults = async function (countryId, countryName) {
    const modal = document.getElementById('results-modal');
    const container = document.getElementById('results-container');
    const title = document.getElementById('modal-country-title');

    modal.style.display = 'block';
    title.textContent = `Resultaten van ${countryName}`;
    container.innerHTML = '<div class="stats-loading">Laden...</div>';

    try {
        await ensureClient();

        // 1. Fetch matches from both tables
        const [pouleRes, koRes] = await Promise.all([
            supabase.from('wedstrijden_poulfase')
                .select('*, home:landen!home_team_id(land), away:landen!away_team_id(land)')
                .or(`home_team_id.eq.${countryId},away_team_id.eq.${countryId}`),
            supabase.from('wedstrijden_knockout')
                .select('*, home:landen!home_team_id(land), away:landen!away_team_id(land)')
                .or(`home_team_id.eq.${countryId},away_team_id.eq.${countryId}`)
        ]);

        const allMatches = [...(pouleRes.data || []), ...(koRes.data || [])];

        // 2. Filter for matches that have a result
        const playedMatches = allMatches.filter(m => m.goals_home !== null && m.goals_against !== null)
            .sort((a, b) => new Date(b.datum_tijd) - new Date(a.datum_tijd));

        if (playedMatches.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Nog geen gespeelde wedstrijden gevonden voor dit land.</div>';
            return;
        }

        container.innerHTML = playedMatches.map(m => {
            const homeName = m.home?.land || 'Thuis';
            const awayName = m.away?.land || 'Uit';
            const round = m.round || 'Poulefase';

            return `
                <div class="result-item">
                    <div class="result-row-info">
                        <span class="result-round">${round}</span>
                        <span class="result-teams">${homeName} - ${awayName}</span>
                    </div>
                    <span class="result-score">${m.goals_home} - ${m.goals_against}</span>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Fout bij laden resultaten:", err);
        container.innerHTML = `<div style="color:red; padding: 20px;">Fout bij laden: ${err.message}</div>`;
    }
}

// Modal closing logic
function setupModal() {
    const modal = document.getElementById('results-modal');
    if (!modal) return;
    const span = modal.querySelector('.close-modal');

    if (span) {
        span.onclick = () => modal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
}

async function init() {
    try {
        const stats = await fetchStats();
        renderStandings(stats);
        setupModal();
    } catch (err) {
        console.error(err);
        const container = document.getElementById('groups-container');
        if (container) {
            container.innerHTML = `<div style="color:red; padding:20px;">Er is een fout opgetreden bij het laden van de standen.</div>`;
        }
    }
}

init();
