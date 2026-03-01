import { fetchLeaderboard, subscribeToUpdates } from './leaderboard.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

async function ensureClient() {
    if (supabase) return supabase;
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('./config.js');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
}

async function initPodium() {
    const data = await fetchLeaderboard();
    const podiumContainer = document.getElementById('podium-container');
    if (!podiumContainer) return;

    if (!data || data.length === 0) {
        podiumContainer.innerHTML = '<p>Geen scores beschikbaar</p>';
        return;
    }

    const top3 = data.slice(0, 3);
    const displayOrder = [];
    if (top3[1]) displayOrder.push(top3[1]);
    if (top3[0]) displayOrder.push(top3[0]);
    if (top3[2]) displayOrder.push(top3[2]);

    podiumContainer.innerHTML = displayOrder.map((player) => {
        const rank = data.indexOf(player) + 1;
        let rankClass = `rank-${rank}`;
        let medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';

        return `
            <div class="podium-item ${rankClass}">
                <div class="podium-info">
                    <span class="podium-name">${player.speler_naam || 'Anoniem'}</span>
                    <span class="podium-points">${player.totaal_punten} pts</span>
                </div>
                <div class="podium-step">
                    <span class="podium-rank">${medal}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function initNextGame() {
    const container = document.getElementById('next-game-container');
    if (!container) return;

    await ensureClient();
    const now = new Date().toISOString();

    // Fetch from both tables
    const [pouleRes, koRes] = await Promise.all([
        supabase.from('wedstrijden_poulfase')
            .select('*, home:landen!home_team_id(land), away:landen!away_team_id(land)')
            .gt('datum_tijd', now)
            .order('datum_tijd', { ascending: true })
            .limit(1),
        supabase.from('wedstrijden_knockout')
            .select('*, home:landen!home_team_id(land), away:landen!away_team_id(land)')
            .gt('datum_tijd', now)
            .order('datum_tijd', { ascending: true })
            .limit(1)
    ]);

    let nextGame = null;
    const pGame = pouleRes.data?.[0];
    const kGame = koRes.data?.[0];

    if (pGame && kGame) {
        nextGame = new Date(pGame.datum_tijd) < new Date(kGame.datum_tijd) ? pGame : kGame;
    } else {
        nextGame = pGame || kGame;
    }

    if (!nextGame) {
        container.innerHTML = '<p>Geen aankomende wedstrijden</p>';
        return;
    }

    const date = new Date(nextGame.datum_tijd).toLocaleString('nl-NL', {
        weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    container.innerHTML = `
        <div class="game-card">
            <div class="game-header">
                <span>Volgende Wedstrijd</span>
                <span>${nextGame.round || 'Poulefase'}</span>
            </div>
            <div class="game-main">
                <div class="game-team">
                    <span class="game-team-name">${nextGame.home?.land || 'TBC'}</span>
                </div>
                <div class="game-vs">VS</div>
                <div class="game-team">
                    <span class="game-team-name">${nextGame.away?.land || 'TBC'}</span>
                </div>
            </div>
            <div class="game-footer">
                <div>📅 ${date}</div>
                <div id="countdown-timer" class="game-countdown"></div>
            </div>
        </div>
    `;

    startCountdown(nextGame.datum_tijd);
}

function startCountdown(targetDate) {
    const countdownEl = document.getElementById('countdown-timer');
    if (!countdownEl) return;

    function update() {
        const now = new Date().getTime();
        const distance = new Date(targetDate).getTime() - now;

        if (distance < 0) {
            countdownEl.innerHTML = "BEGONNEN / AFGELOPEN";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        let parts = [];
        if (days > 0) parts.push(`${days}d`);
        parts.push(`${hours}u`);
        parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);

        countdownEl.innerHTML = `⏳ ${parts.join(' ')}`;
    }

    // Clear any existing intervals if we refresh
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    window.countdownInterval = setInterval(update, 1000);
    update();
}

async function initLatestAnnouncement() {
    const preview = document.getElementById('latest-announcement-preview');
    if (!preview) return;

    try {
        await ensureClient();
        const { data, error } = await supabase
            .from('aankondigingen')
            .select('*')
            .eq('is_active', true)
            .order('datum_tijd', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            preview.style.display = 'none';
            return;
        }

        const ann = data[0];
        preview.style.display = 'block';
        preview.innerHTML = `
            <div style="background: white; border-radius: 30px; padding: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); border: 2px solid var(--primary);">
                <span style="font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 2px;">Laatste Aankondiging</span>
                <h2 style="color: var(--primary); margin: 15px 0; font-family: Outfit, sans-serif; font-weight: 900; font-size: 2.5rem;">${ann.titel}</h2>
                <p style="font-size: 1.2rem; color: #444; margin-bottom: 20px; line-height: 1.5; max-height: 120px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${ann.inhoud}</p>
                <a href="aankondigingen.html" style="color: #0055ff; font-weight: 800; text-decoration: none; border-bottom: 2px solid #0055ff;">Lees meer...</a>
            </div>
        `;
    } catch (err) {
        console.error("Error loading latest announcement:", err);
    }
}

function init() {
    initPodium();
    initNextGame();
    initLatestAnnouncement();

    // Refresh periodically or on update
    subscribeToUpdates(() => {
        initPodium();
        initNextGame();
        initLatestAnnouncement();
    });
}

init();

