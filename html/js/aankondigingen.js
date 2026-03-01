import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

async function loadConfig() {
    try {
        const cfg = await import('./config.js');
        return { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY };
    } catch (err) {
        console.error('Config load error:', err);
        return null;
    }
}

async function ensureClient() {
    if (supabase) return supabase;
    const cfg = await loadConfig();
    if (!cfg) throw new Error('Kon Supabase-configuratie niet laden.');
    supabase = createClient(cfg.url, cfg.key);
    return supabase;
}

async function fetchAnnouncements() {
    const container = document.getElementById('announcements-container');
    try {
        await ensureClient();
        const { data, error } = await supabase
            .from('aankondigingen')
            .select('*')
            .eq('is_active', true)
            .order('datum_tijd', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="card" style="text-align: center; padding: 40px;"><p>Er zijn nog geen aankondigingen.</p></div>';
            return;
        }

        container.innerHTML = '';
        data.forEach(ann => {
            const date = new Date(ann.datum_tijd).toLocaleString('nl-NL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const card = document.createElement('div');
            card.className = 'announcement-card';
            card.innerHTML = `
                <div class="announcement-header">
                    <h2 class="announcement-title">${ann.titel}</h2>
                    <span class="announcement-date">${date}</span>
                </div>
                <div class="announcement-content">
                    ${ann.inhoud.replace(/\n/g, '<br>')}
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error('Error fetching announcements:', err);
        container.innerHTML = '<div class="card" style="text-align: center; color: red; padding: 40px;"><p>Fout bij het laden van aankondigingen: ' + err.message + '</p></div>';
    }
}

document.addEventListener('DOMContentLoaded', fetchAnnouncements);
