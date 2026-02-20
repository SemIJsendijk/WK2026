import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

async function loadConfig() {
    try {
        const cfg = await import('./config.js');
        return { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY };
    } catch (err) {
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

const form = document.getElementById('change-password-form');
const msg = document.getElementById('status-message');

if (form) {
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();

        const email = document.getElementById('email').value.trim();
        const oldPw = document.getElementById('old-password').value;
        const newPw = document.getElementById('new-password').value;
        const confirmPw = document.getElementById('confirm-password').value;

        // Validatie: Komen de nieuwe wachtwoorden overeen?
        if (newPw !== confirmPw) {
            msg.style.color = 'red';
            msg.style.fontWeight = 'bold';
            msg.textContent = 'Nieuwe wachtwoorden komen niet overeen.';
            return;
        }

        msg.style.color = 'black';
        msg.style.fontWeight = 'bold';
        msg.textContent = 'Bezig met verifiëren...';

        try {
            await ensureClient();

            // We gebruiken een RPC om veilig op de server te checken of email + oud wachtwoord kloppen
            const { data, error } = await supabase.rpc('secure_change_password', {
                p_email: email,
                p_old_password: oldPw,
                p_new_password: newPw
            });

            if (error || !data) {
                throw new Error(error?.message || 'E-mail of wachtwoord is onjuist.');
            }

            msg.style.color = 'green';
            msg.style.fontWeight = 'bold';
            msg.textContent = 'Wachtwoord succesvol gewijzigd! Je wordt nu uitgelogd...';

            // Verwijder de opgeslagen gebruiker zodat ze opnieuw moeten inloggen
            localStorage.removeItem('currentUser');

            // Stuur de gebruiker na 2 seconden terug naar login
            setTimeout(() => { window.location.href = './index.html'; }, 2000);

        } catch (err) {
            console.error('Change Password Error:', err);
            msg.style.color = 'red';
            msg.style.fontWeight = 'bold';
            msg.textContent = err.message;
        }
    });
}