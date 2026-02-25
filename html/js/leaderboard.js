import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = './index.html';
}

async function loadConfig() {
    try {
        const cfg = await import('./config.js');
        return { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY };
    } catch (err) {
        console.error("Config niet gevonden");
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

/**
 * Haalt de ranglijst op via de veilige RPC berekening
 */
export async function fetchLeaderboard() {
    await ensureClient();

    // We roepen nu de functie (RPC) aan in plaats van een tabel!
    const { data, error } = await supabase.rpc('get_leaderboard');

    if (error) {
        console.error('Fout bij ophalen leaderboard:', error);
        return [];
    }
    return data;
}

/**
 * Tekent de tabel in je HTML met opmaak en medailles voor de top 3
 */
export function renderLeaderboard(data) {
    const container = document.getElementById('leaderboard-body');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<tr><td colspan="3">Nog geen spelers gevonden in de database.</td></tr>';
        return;
    }

    container.innerHTML = data.map((player, index) => {
        let rankClass = '';
        let rankDisplay = index + 1;

        if (index === 0) {
            rankClass = 'rank-1';
            rankDisplay = '🥇';
        } else if (index === 1) {
            rankClass = 'rank-2';
            rankDisplay = '🥈';
        } else if (index === 2) {
            rankClass = 'rank-3';
            rankDisplay = '🥉';
        }

        return `
            <tr class="${rankClass}">
                <td>${rankDisplay}</td>
                <td class="text-left">
                    <span class="leaderboard-name" onclick="window.showUserPredictions('${player.user_id}', '${player.speler_naam}')">
                        ${player.speler_naam || 'Anoniem'}
                    </span>
                </td>
                <td><strong>${player.totaal_punten}</strong></td>
            </tr>
        `;
    }).join('');
}

// Prediction viewing logic
function isLocked(dateStr) {
    if (!dateStr) return false;
    const matchTime = new Date(dateStr).getTime();
    const now = new Date().getTime();
    // Reusing the 5-minute lock logic from voorspellingen.js
    return now >= (matchTime - 300000);
}

window.showUserPredictions = async function (userId, userName) {
    const modal = document.getElementById('predictions-modal');
    const container = document.getElementById('predictions-container');
    const title = document.getElementById('modal-user-title');

    modal.style.display = 'block';
    title.textContent = `Voorspellingen van ${userName}`;
    container.innerHTML = '<div class="stats-loading">Laden...</div>';

    try {
        await ensureClient();

        // 1. Fetch all matches (Group + KO)
        const [pouleRes, koRes] = await Promise.all([
            supabase.from('wedstrijden_poulfase').select('*, home:landen!home_team_id(land), away:landen!away_team_id(land)'),
            supabase.from('wedstrijden_knockout').select('*, home:landen!home_team_id(land), away:landen!away_team_id(land)')
        ]);

        const allMatches = [...(pouleRes.data || []), ...(koRes.data || [])];

        // 2. Fetch user's predictions
        const { data: predictions, error } = await supabase
            .from('voorspellingen')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;

        // 3. Filter for matches that have already started
        const lockedPredictions = predictions.filter(p => {
            const match = allMatches.find(m => m.match_id === p.match_id);
            return match && isLocked(match.datum_tijd);
        });

        if (lockedPredictions.length === 0) {
            container.innerHTML = '<div class="stats-total">Geen openbare voorspellingen gevonden (wedstrijden moeten eerst beginnen).</div>';
            return;
        }

        container.innerHTML = lockedPredictions.map(p => {
            const match = allMatches.find(m => m.match_id === p.match_id);
            const home = match.home?.land || 'Thuis';
            const away = match.away?.land || 'Uit';
            return `
                <div class="prediction-item">
                    <span class="prediction-teams">${home} - ${away}</span>
                    <span class="prediction-score">${p.voorspeld_thuis} - ${p.voorspeld_uit}</span>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Fout bij laden voorspellingen:", err);
        container.innerHTML = `<div style="color:red">Fout: ${err.message}</div>`;
    }
};

// Modal closing logic
function setupModal() {
    const modal = document.getElementById('predictions-modal');
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

// Call setup
setupModal();
document.addEventListener('DOMContentLoaded', setupModal);
// Also export setupModal in case it's needed after re-rendering
export { setupModal };

/**
 * Realtime luisteren naar uitslagen (Poule, Knockout én Landen)
 */
export async function subscribeToUpdates(onUpdate) {
    await ensureClient();

    // We luisteren naar alle tabellen die de score kunnen beïnvloeden
    supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wedstrijden_poulfase' }, onUpdate)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wedstrijden_knockout' }, onUpdate)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'landen' }, onUpdate)
        .subscribe();
}