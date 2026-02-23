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

        // Voeg medailles en styling toe voor de top 3
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
                <td class="text-left">${player.speler_naam || 'Anoniem'}</td>
                <td><strong>${player.totaal_punten}</strong></td>
            </tr>
        `;
    }).join('');
}

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