// Supabase login handler (browser ESM)

// This file expects a local `config.js` to export `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
// See `html/js/config.example.js` for the template. Do NOT commit your real key.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;

const form = document.getElementById('login-form');
const msg = document.getElementById('login-message');

// 1. Load Configuration
async function loadConfig() {
    try {
        // dynamic import so the file can be gitignored and absent in the repo
        const cfg = await import('./config.js');
        if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
            throw new Error('Invalid config');
        }
        return { url: cfg.SUPABASE_URL, key: cfg.SUPABASE_ANON_KEY };
    } catch (err) {
        return null;
    }
}

// 2. Initialize Supabase Client
async function ensureClient() {
    if (supabase) return supabase;
    const cfg = await loadConfig();
    if (!cfg) {
        if (msg) {
            msg.style.color = 'orange';
            msg.textContent = 'Missing Supabase config. Copy html/js/config.example.js → html/js/config.js';
        }
        throw new Error('Missing Supabase config');
    }
    supabase = createClient(cfg.url, cfg.key);
    return supabase;
}

// 3. Handle Login Form Submission
if (form) {
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();

        // Reset message state
        if (msg) {
            msg.style.color = '';
            msg.textContent = 'Logging in...';
        }

        const email = form.email?.value?.trim();
        const password = form.password?.value;

        // Basic validation
        if (!email || !password) {
            if (msg) {
                msg.style.color = 'red';
                msg.textContent = 'Please provide both email and password.';
            }
            return;
        }

        try {
            await ensureClient();

            // Call the custom 'login_user' database function (RPC) which verifies credentials server-side
            const { data, error } = await supabase.rpc('login_user', {
                login_email: email,
                login_password: password,
            });

            console.debug('Supabase RPC login_user result:', { data, error });

            if (error || !data) {
                console.error('Login failed:', error);
                if (msg) {
                    msg.style.color = 'red';
                    msg.textContent = `Email of wachtwoord is incorrect. Debug: ${error?.message || 'no details'}`;
                }
                return;
            }

            if (msg) {
                msg.style.color = 'green';
                msg.textContent = 'Succesvol ingelogd';
            }

            // Save user and redirect
            localStorage.setItem('currentUser', JSON.stringify(data));
            setTimeout(() => { window.location.href = '../html/home.html'; }, 700);

        } catch (err) {
            console.error('Unexpected error:', err);
            if (msg) {
                msg.style.color = 'red';
                msg.textContent = `Er is een fout opgetreden: ${err?.message || String(err)}`;
            }
        }
    });
}
