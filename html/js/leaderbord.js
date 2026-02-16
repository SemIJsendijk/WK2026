// html/js/leaderboard.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

// Check of de gebruiker is opgeslagen in localStorage
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = './index.html';
}

// 1. Laden van configuratie (net als in auth.js)
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
 * Haalt de ranglijst op uit de aangepaste View
 */
export async function fetchLeaderboard() {
    await ensureClient();
    const { data, error } = await supabase
        .from('leaderboard')
        .select('*');

    if (error) {
        console.error('Fout bij ophalen leaderboard:', error);
        return [];
    }
    return data;
}

/**
 * Tekent de tabel in je HTML (bijv. in home.html)
 */
export function renderLeaderboard(data) {
    const container = document.getElementById('leaderboard-body');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = '<tr><td colspan="3">Nog geen scores bekend.</td></tr>';
        return;
    }

    container.innerHTML = data.map((player, index) => `
        <tr class="leaderboard-row">
            <td>${index + 1}</td>
            <td>${player.speler_naam || 'Anoniem'}</td>
            <td><strong>${player.totaal_punten}</strong></td>
        </tr>
    `).join('');
}

/**
 * Realtime luisteren naar uitslagen
 */
export async function subscribeToUpdates(onUpdate) {
    await ensureClient();
    return supabase
        .channel('schema-db-changes')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'wedstrijden' },
            () => {
                console.log('Wedstrijd update gedetecteerd, leaderboard verversen...');
                onUpdate();
            }
        )
        .subscribe();
}